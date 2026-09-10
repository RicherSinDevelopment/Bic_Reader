# Reader navigation stabilization — 2026-09-08

This audit used the existing, extensively modified working tree as its baseline. Unrelated auth, translation removal, database, and UI changes were preserved. Findings below are code-path findings, not claims that the supplied screenshots were reproduced on an iPhone.

## Audit before implementation

| Responsibility | Existing owner and finding |
| --- | --- |
| Intent | `app/Reader/index.tsx`: initial hydration, TOC, search, mode/layout changes, and page picker |
| Canonical position | `AnchorController`/`AnchorStore`; commands originally committed and persisted before verification |
| Observation | `useReaderAnchor`: live word ref, 220 ms debounced commit; transition guard existed here but not in the controller |
| Restore | `TransitionController` plus independent WebView delivery retries, startup reset, append re-pinning, typography compensation, and timed rotation corrections |
| Page display | Vertical raw scroll/source-page reports; horizontal generated page index; separate from canonical commits |
| Persistence | One SQLite hydration per document, debounced saves, close/background flush; no save-completion-to-restore subscription found |
| Window | 12 pages behind/24 ahead delivery; sections and blocks already deduplicated; pruning originally only removed earlier sections |
| Original | Existing iOS page-only `setPage` vs precise native highlight navigation separation; preserved |

Confirmed conflicts:

- Rotation issued a React destination while the WebView independently restored at multiple fixed times. An early return could label a navigation successful without restoring during rotation.
- WebView delivery retried up to 16 times separately from the controller's two attempts. Typography and append code could also scroll independently.
- TOC/page lookup used `page >= target`, allowing a later cached page to replace an unextracted requested page. Targets already reset intra-block offsets; spreading the previous anchor was **not** the cause here.
- Page counters and window focus consumed raw source-page probes during layout/scroll while semantic position committed later.
- Fresh opening could inherit cached library progress; same-document reset retained an old in-memory anchor.
- Horizontal destination publication occurred immediately after issuing the native scroll, before native viewability confirmation.
- Rotation measured words across visible blocks on every animation frame of scrolling.

Not established: duplicate source sections (existing deduplication was retained), a general SQLite feedback loop, or a general 0/1-based mismatch. Source pages are one-based; generated horizontal indices remain renderer-local.

## Resulting ownership

`intent → desiredAnchor → capture → prepare/extract/normalize → layout → restore → verify → canonical commit + persistence → complete`

Failure or cancellation clears desired state. A newer transition invalidates an older transition. The controller retains its bounded two-attempt verification policy; the unconditional 40 ms sleep and the independent vertical delivery retry loop were removed.

`user reading → settled renderer word → live observed ref → 220 ms quiet-period commit → canonical page display → debounced SQLite save`

Canonical updates do not issue restore commands. The existing one-time initial restore guard remains. `desiredAnchor` holds command intent, the hook's ref holds observations, and `canonicalAnchor` holds committed position. No third global observation store was added.

## Restore suppression and stale reports

`VerticalNavigationRuntime` is shared by destination, window, and rotation work. It tracks navigation ID and layout generation. While suppressed, scroll handlers and word publishers do not publish navigation observations. Completion requires three consecutive stable comparisons of scroll offset, content height, viewport dimensions, and (for destinations) target position. A 120-frame ceiling releases suppression as failure protection; semantic adapter verification still decides success.

Destinations wait for fonts when loading, then apply document-start, page-start, or existing exact-word alignment. Completion reports carry document ID, navigation ID, and generation. React rejects mismatched documents, older generations, and reports that do not match its delivered command. The verification ref is cleared when restoring so old viewport data cannot verify a new command. Touch/pointer/wheel takeover cancels suppression, and touch invalidates the rotation callback chain.

The controller also rejects ordinary observations while a command is pending/running. Debounced observations carry the transition ID from their scheduling time. Commands persist only after successful verification.

## Initial opening and TOC

A fresh opening has no semantic saved position: it begins at the first extracted readable page/block with zero offsets and document-start alignment. Cached library progress no longer supplies an implicit resume. A saved semantic anchor hydrates once and is kept as the initial target; missing extraction is requested before precision is normalized. Changing documents clears destinations, handoff refs, transition state, and canonical in-memory state, and keys ReaderView by document ID.

Page-only TOC targets search **only the requested source page**. They use its first readable block with word/character/progress zero, or a page-only target until extraction arrives. Page-start alignment uses one scroll calculation against the readable top boundary. Explicit block/search targets retain their own precision.

`resolveAnchor` checks document/page validity and block/page membership, then resolves valid character offset, word index, progress, or page/block start. It never substitutes a later extracted source page.

## Page stability and performance

The Reader header now uses committed source page and PDF source-page total in both layouts. The horizontal page picker still uses generated page indices internally, preserving its existing navigation semantics.

Hysteresis uses the existing quiet-period policy rather than adding a parallel candidate-page store: a transient page probe cannot change the header; the final word observation must survive the commit debounce. During a long uninterrupted fling, the header intentionally waits for settlement. This sacrifices live page-number movement for a stable semantic counter.

Raw scroll messages now control chrome only. They no longer mutate source-page React state. Word tokenization is cached per block text and React-side block lookup uses a map. Rotation capture is debounced after scroll rather than scanning words every frame. The existing main precise DOM probe runs after scrolling pauses; it still examines visible blocks and is not a universal DOM word index.

Window insertion retains existing stable page/block identities and deduplication. It captures the visible source block (with section fallback) and compensates its measured displacement in the same layout, under suppression. It no longer re-scrolls to an older pinned destination on every append. Pruning is delayed until idle and now removes distant sections in either direction, retaining the opening pages. Canonical semantic position is unchanged by these same-layout compensations. This is not pixel synchronization across layouts.

SQLite remains downstream: 750 ms debounced persistence, with existing background/unmount flush. Removing noisy page updates and early command persistence avoids unnecessary saves. No new SQLite listeners were added.

## Remaining limits and device validation

- No physical iPhone or simulator visual run was performed. PDFKit behavior, momentum timing, rotation appearance, and a several-thousand-page document need the manual checks below.
- Very large individual text blocks can still make the final precise DOM probe expensive. This pass does not add a whole-document word-span DOM or rewrite pagination.
- Blank/image-only TOC pages without extracted text may still require the existing page fallback or fail semantic verification. A failed verification clears authority and reveals the renderer; it does not claim an exact landing.
- The horizontal pager retains its existing repagination compensation and native index-failure fallback. This pass removes duplicate explicit-destination scrolling and optimistic destination reports; it does not rewrite native pagination.
- Original/PDFKit remains page-authoritative; no unsupported word precision is invented.
- New-document start intentionally does not migrate the old library-only page counter into a semantic resume.

## Validation

Validation result: 76 tests passed across 18 suites; TypeScript passed; both embedded WebView scripts parsed successfully; `git diff --check` passed. Targeted ESLint reported no errors and six existing horizontal-pager warnings.

Automated commands:

```sh
npm run test:anchor -- --silent
npm test -- --silent
npx tsc --noEmit
```

Development diagnostics:

```sh
EXPO_PUBLIC_ANCHOR_DEBUG=1 npx expo start --dev-client
```

Inspect `[Reader navigation]` events for command/generation, stable frames, and rejected observations. Anchor/transition position logs are gated behind this development-only opt-in. Production error/transition metrics remain intact.

Manual checks on an iPhone development build:

1. Import a new PDF with title/frontmatter. Open Reader in vertical and horizontal modes. Confirm the actual beginning and a stable source-page counter.
2. Read mid-block, leave, reopen; confirm one resume to the saved word. Repeat after backgrounding.
3. From mid-block, select a distant TOC page that has not yet been extracted. Confirm the requested page start and zero carried offsets. Repeat rapidly with two different destinations.
4. Fling across several pages, reverse direction, and stop. Confirm no corrective navigation while reading and one settled header update. Toggle chrome during the gesture.
5. Switch Reader vertical → horizontal → Original → Reader. Check the same source block/word where extraction supports it, and page fallback otherwise.
6. Rotate in both directions mid-block; change font size and margins. Interrupt a restore with a touch and scroll. Confirm no delayed correction takes control back.
7. Open a multi-thousand-page PDF, jump deep, then scroll forward/backward through multiple window shifts. Inspect DOM section count, uniqueness, and stable position across insertion/pruning.
8. Exercise search, generated-page picker, TTS, word/line guides, annotations, and PDFKit page/word destinations to check preserved behavior.

## Files changed by this pass

- `app/Reader/index.tsx`
- `architecture/VerticalScroolFlip.tsx`
- `architecture/anchor/AnchorController.ts`
- `architecture/anchor/AnchorStore.ts`
- `architecture/anchor/TransitionController.ts`
- `architecture/anchor/AnchorResolution.ts` (new)
- `architecture/anchor/AnchorDiagnostics.ts` (new)
- `architecture/anchor/VerticalNavigationRuntime.ts` (new)
- `components/ReaderView.tsx`
- `components/HorizontalReaderPager.tsx`
- `hooks/useReaderAnchor.ts` (already present as an untracked file at audit start)
- `__tests__/anchor/navigation-stability.test.ts` (new)
- `docs/READER_NAVIGATION_STABILIZATION.md` (new)

Other working-tree changes predate this pass.

## Retained scroll callsite inventory

Line references are approximate after subsequent maintenance; function/owner descriptions identify the paths.

| File / location | Classification and owner |
| --- | --- |
| `VerticalScroolFlip.tsx`, `restore` | Layout compensation: one semantic word-range realignment after width settles |
| `ReaderView.tsx`, append handler | Layout compensation: captured visible section displacement, suppressed |
| `ReaderView.tsx`, document-start branch | Navigation restore: one absolute beginning scroll |
| `ReaderView.tsx`, page-start branch | Navigation restore: one page-top calculation |
| `ReaderView.tsx`, coarse target branch | Navigation restore: block/search element fallback |
| `ReaderView.tsx`, TTS highlight handler | User-enabled speech following; preserved |
| `ReaderView.tsx`, `__highlightSwitchWordAtIndex` | Navigation restore: exact word alignment |
| `ReaderView.tsx`, word-guide movement | User-enabled guide movement; preserved |
| `ReaderView.tsx`, line-guide movement | User-enabled guide movement; preserved |
| `ReaderView.tsx`, `applyReaderTransition` | Local CSS pager origin reset; guarded to pager mode |
| `ReaderView.tsx`, prune handler | Layout compensation: visible section displacement, suppressed |
| `HorizontalReaderPager.tsx`, pending viewport layout effect | Layout compensation after native size change; deferred when explicit destination is pending |
| `HorizontalReaderPager.tsx`, destination layout effect | Navigation restore: one native `scrollToIndex`, observation after viewability |
| `HorizontalReaderPager.tsx`, no-destination layout effect, first call | Existing repagination compensation; retained |
| `HorizontalReaderPager.tsx`, same effect, animation-frame call | Existing native data-layout fallback; retained, not an explicit navigation retry |
| `HorizontalReaderPager.tsx`, spoken-word effect | User-enabled speech following; preserved |
| `HorizontalReaderPager.tsx`, guide movement | User-enabled guide movement; preserved |
| `HorizontalReaderPager.tsx`, `onScrollToIndexFailed` | Native unmeasured-index fallback; retained |
| `OriginalPDF.ios.tsx`, destination effect | Page-only native command, bypassed for precise geometry destinations |
| Existing `react-native-pdf` patch, `goToRect` | Precise PDFKit command, preserved |

The non-iOS `OriginalPDF.tsx` PDF.js runtime also retains its page navigation, target highlight navigation, resize compensation, and startup alignment fallback. It was inspected but not rewritten in this iOS stabilization pass.

## Rotation/crash follow-up — 2026-09-09

The device log reported `Webview Process Terminated` after repeated rotations. This establishes a WebKit process exit, not its OS-level cause; no native memory/crash report was available. The earlier transition accuracy scores did not validate the independent vertical rotation path.

Additional confirmed code defects were addressed:

- Reading guides passed a flag to `useScreenRotation` that locked the current orientation. Guides no longer lock orientation; the explicit **Disable rotation** setting is still respected.
- Rotation retained the old absolute screen Y after landscape removed the header. It now restores the saved semantic word relative to the new readable top boundary.
- Rotation still created a Range for every word in up to 12 visible blocks. That scanner was removed entirely. Rotation consumes the same word observation as the reader and resolves only that word during restoration.
- The general precise reader probe also scanned all blocks and measured all words in several visible blocks. It now uses bounded hit testing (at most 56 word ranges), cached text-node tokenization, and binary word lookup. This removes a concrete source of layout pressure; device testing is still needed to confirm the WebKit termination stops.
- Empty append batches rebuilt annotations and opened layout transactions while background extraction continued. They now send a lightweight availability-status message; actual insertions and annotation changes retain their existing paths.
- Resize callbacks no longer schedule independent pruning/full-section page probing during vertical rotation. Width changes own the native rotation mask, avoiding duplicate orientation-event mask updates.
- Process recovery captures the pre-crash semantic target, marks content unavailable, remounts the WebView with a new runtime ID, rejects old-runtime reports, and blocks fresh initial observations until the recovery destination is delivered. Recovery does not supersede an already running mode transition merely because the vertical WebView remounted.
- A failed local rotation restore now reports failure and requests a canonical controller restore; it does not publish the displaced viewport as a successful rotation.

Follow-up files: `hooks/screenRotation.tsx`, `app/Reader/index.tsx`, `components/ReaderView.tsx`, `architecture/VerticalScroolFlip.tsx`, new `architecture/anchor/VerticalAnchorProbe.ts`, new `__tests__/anchor/vertical-rotation.test.ts`, and this report.

Regression coverage executes the real WebView runtime strings against controlled viewport/DOM fixtures: portrait/landscape readable boundaries, rapid width pulses, repeated rotation, document start, touch cancellation, height-only chrome changes, missing-anchor failure, and bounded probe work. This does not substitute for WKWebView memory profiling.

Device retest: leave **Disable rotation** off; enable a reading guide; rotate portrait → landscape → portrait at least ten times while reading mid-paragraph, then repeat without a guide and immediately after a distant TOC jump. Confirm landscape activates, the same word remains at the readable edge, and no process-termination warning appears. If WebKit terminates again, the position should recover from the pre-crash semantic target; capture the native device log to determine the remaining termination cause.

## Device-confirmed memory termination — 2026-09-09

A read-only retrieval from the paired iPhone found `JetsamEvent-2026-09-09-003104.ips`. At 00:31:03 +0300, the report lists `com.apple.WebKit.WebContent` as the largest process, terminated for `highwater`. `BicReader` in the same process coalition was terminated for `vm-pageshortage`. This confirms memory termination rather than an ordinary caught JavaScript exception. Raw device reports remain outside the repository; they include unrelated system information.

The reading-guide CSS used a **9,999 CSS-pixel spread shadow** to dim the surrounding content. This gives the guide enormous paint bounds, amplified by Retina scaling. It is a strong code-level match for the WebKit memory spike, though the report does not identify the individual allocation stack. The replacement uses four fixed panels whose rectangles are clamped to the current viewport. Their combined area never exceeds the viewport, even when the guide is offscreen or the phone rotates. No large shadow, large offscreen dimmer, or giant backing surface is needed. The small inset outline around the guide is retained. Hidden reader guides are deactivated while Original is visible.

Two additional sources of memory churn were removed:

- Original → Reader previously changed PDFKit's React key to reset zoom, reloading the PDF in the background on every switch. The PDF now stays mounted for the document's lifetime. Its initial page prop is frozen; canonical page updates no longer drive hidden native PDF navigation. Explicit page/highlight commands remain authoritative. Zoom is now preserved across tab switches instead of reset through a document reload.
- Content insertion now prunes sections outside the delivery window within the existing suppressed layout transaction. It preserves opening sections and the visible section. Programmatic TOC jumps can no longer defer all pruning until a subsequent manual scroll.

The pasted unsupported-return warning was audited separately: the application's explicit injection strings already terminate in `true`, and the installed native `postMessage` dispatcher returns a boolean. Adding another trailing `true` would not establish the cause or fix the confirmed memory kill. The updated vertical runtime logs `version: bounded-guide-20260909` so a device run can verify it loaded the new bundle.

Added regression tests exercise 1,000 guide movements in each of three viewport sizes, including offscreen/invalid rectangles, and verify bounded nonnegative paint geometry. A native-PDF component lifecycle test verifies repeated canonical-page prop updates do not remount the native PDF or change its initial page. These tests prove the application-side bounds/lifecycle contracts; they do not constitute an iPhone memory-profile run after the patch.

Additional changed files: `architecture/ReaderGuideDimming.ts`, `components/ReaderView.tsx`, `components/OriginalPDF.ios.tsx`, `app/Reader/index.tsx`, `__tests__/reader-guide-memory.test.ts`, `__tests__/anchor/original-pdf-lifecycle.test.tsx`, and this report.

Validation for the memory fix: the full suite passed **89 tests in 21 suites**, including guide paint-bound stress tests and the native-PDF lifecycle test. Reload the app fully from Metro and look for `[Reader Runtime]` with `version: bounded-guide-20260909` before repeating the device scenario. No native dependency or binary change is required for these fixes. The post-fix rotation/switching sequence has not yet been manually reproduced on the iPhone.

## Horizontal pager regression follow-up

The added per-page paint/spinner gate was removed. Startup already hides the reader until readiness/restoration completes; making readiness depend on paint frames in that hidden WebView creates a circular dependency. Native load completion again supplies layout readiness. There is one screen-owned rotation cover, and the reader surface no longer fades to 55% opacity (which exposed the PDF underneath). Reader bounds clip intermediate native layout content.

Pager navigation now compares its measured safe-area width with its committed pagination width, rather than comparing that width with the full screen. A destination delivered during a resize waits for the coalesced layout and clears the pending viewport restoration flag when applied. User swipes notify the existing navigation controller, and clearing the destination does not repaginate or issue duplicate position corrections. Word boundaries are retained for page-picker navigation.

Layout events that return to the existing dimensions cancel queued intermediate resizes. Previously such events returned without cancelling the timer, allowing a stale narrow/short viewport to drive page totals and suppress scrolling. The exact reported 8,000-page total has not been reproduced with the user's document; lifecycle tests verify stable totals when returning to the same dimensions and no stale viewport installation after a cancelled rotation. Generated totals still legitimately depend on typography and orientation.

The new component lifecycle tests exercise native load readiness, safe-area swipes, TOC jumps across reflow, destination clearing, page-picker consistency, and cancelled rotations. Native FlatList/WebView events are simulated; actual iPhone rendering and rotation smoothness still require device verification.

## Handoff, TOC, and displayed page numbers

A delayed-native-viewability lifecycle test reproduced a handoff to source page 20 being overwritten by the first measured layout restoring source page 1. The pending programmatic word now outranks the initial visible-page observation during resizing. A destination arriving during the resize debounce also retains its own boundary instead of accepting the earlier viewport snapshot. User drags still release programmatic ownership.

Horizontal mode now uses generated current/total pages in both the header and TOC; vertical and Original continue to use PDF source pages. TOC page-top commands retain existing pagination boundaries, so selecting a chapter does not change the page numbering that was just displayed. A missing target source page remains pending rather than falling through to the next extracted source page.

TOC parent rows now navigate on the first tap. Their separate, labelled expand/collapse button controls child sections. Component tests cover both actions independently, alongside handoff timing before native viewability and during resize, stable chapter page mapping, and delivery after missing extraction arrives. These tests simulate native events and do not replace a physical iPhone interaction run.

## Horizontal typography and landscape fit

Typography is now captured before changed pages commit: the pager freezes its first visible word, then repaginates and restores it locally. The screen no longer launches an additional horizontal typography transition. Rendering and pagination use the same settings, and measured viewport height changes are no longer ignored below an 80-point threshold.

Character-based pagination remains the initial estimate. Each mounted page checks actual word rectangles after fonts load and reports the first word that would overlap the reserved footer space. That source offset becomes an additional page boundary for the current geometry/typography only; the remaining text is paginated onto subsequent pages. Stale geometry reports and duplicate boundaries are ignored, and soft hyphens are excluded from source offsets. This does not add a loading/readiness gate. Totals can refine as mounted pages are measured.

Tests cover increasing/decreasing typography with both a consumed destination and a manually swiped position, overflowing text moved without loss, multiple measured breaks within a block, footer limits, and soft-hyphen offsets. Physical-device visual verification is still outstanding.

## Exact handoff and toolbar alignment

Reader verification now requires source-page/block identity and the exact character offset (or exact word index for legacy anchors). The former 8% progress tolerance and neighboring-block exception were removed. Horizontal native viewability reports must refer to the current page object, and reported anchors come from rendered page content instead of being replaced with the requested anchor.

Vertical word restoration resolves source character offsets across annotation spans and soft hyphens. It aligns the selected word against the measured toolbar boundary, including at initial scroll offset zero, and uses the existing settling transaction to maintain alignment through layout changes. The final loader reserves enough trailing space for an end-of-document word to reach the top. A pinned word is reported only when its range is actually aligned and visible; normal user interaction releases it.

Original highlights use the pending destination instead of briefly applying the previous canonical word. PDFKit highlight commands wait for a measured viewport and reapply for a new request or changed viewport dimensions. Passive native page changes cannot overwrite the saved return word; page-based changes to that return anchor require a user interaction. No native dependency or PDFKit binary patch was added.

Validation: 119 tests passed in 28 suites, TypeScript passed, both reader script bodies parsed, and lint reported only the six existing horizontal-pager warnings. Added coverage includes repeated words, conflicting offset/progress metadata, annotation-split words, soft hyphens, initial toolbar alignment, viewport-driven PDFKit reapplication, and stale horizontal viewability events. These are simulated renderer tests; post-change visual checks on the physical iPhone remain outstanding.

### Live vertical scroll reporting

Audit found that vertical scroll events only reported their exact word after
180 ms without another sample, and the vertical header preferred the separately
debounced canonical bookmark. Continuous scrolling therefore left both the
visible source-page counter and the delivery window behind the viewport.

The existing 80 ms scroll sample now reports the bounded viewport word directly;
the header uses the resulting live source page. Bookmark persistence retains its
existing debounce, and navigation/rotation suppression remains in place. No new
page-only navigation or restoration path was added. Regression tests execute the
shipped listener with continuous motion, a pause/reverse gesture, burst events,
and navigation/rotation suppression. Physical iPhone scrolling still needs
verification; these tests do not establish native momentum behavior.

### Repeated horizontal tab handoff timeout

The reported ~5.3-second failures match two 2.5-second verification windows.
Pager confirmation compared page arrays by reference, while FlatList keyed cells
only by generated page number. A rebuilt but identical page could therefore be
rejected without another viewability event. Confirmation now compares source
segments, offsets and text; cell keys include source segment boundaries so a
changed page gets a distinct identity. Different content still cannot verify a
handoff. Exact-word verification and timeout limits remain unchanged.

Original verification now waits for its asynchronous native page acknowledgement
(with cancellation and a bounded timeout), rather than failing immediately after
issuing the destination. Tests cover delayed acknowledgement, repeated unchanged
pager destinations, and rejection of different content. Device confirmation is
still needed for the reported sequence.

### Hide the initial page during layout switches

The opaque transition cover previously applied only to mode switches and was
activated by a passive effect. Horizontal-to-vertical remounts could expose the
vertical WebView's initial page before restoration. Cover visibility is now
derived during render from a pending layout change or a running mode/layout
transition. The existing verification completion releases it; failure and
cancellation release it too. No navigation logic or artificial delay was added.
Physical-device visual confirmation remains outstanding.

### Quiet rotation and TOC positioning

Horizontal orientation restores now carry an explicit visual suppression flag
without removing their exact word offsets. The pager hides both navigation and
stationary transition markers for that command. Vertical TOC commands also gate
the separate live switch-highlight visibility setting, which previously could
reintroduce the yellow marker despite explicit highlight suppression. Existing
TOC page-top positioning is retained. The vertical exact-word helper can suppress
painting after alignment without skipping alignment. Pager lifecycle tests cover
preservation of the destination offset through both viewport shapes.

### Keep prefetch out of active navigation

The live-scroll reporting fix exposed an existing conflict: every background
append began a suppression transaction, waited for scrolling to settle, forced
another anchor report, and could prune distant sections with scroll compensation.
During momentum this stalled reporting until idle/the frame limit, and append-time
removal could interrupt native scrolling. Background append now leaves navigation
ownership alone; append-time pruning is limited to an already suppressed
transaction. Ordinary removal remains in the existing 1.2-second idle pruner.
Insertion compensation is retained for incoming text above the viewport.

This also removes the background settle wait from renderer startup. The transition
cover and exact destination verification remain unchanged. Tests execute the
actual append handler and verify no background begin/settle/removal, while covered
destination cleanup still preserves opening and visible sections. Native momentum
and device handoff duration require physical verification.

### Preserve scroll geometry when unloading pages

The supplied logs include a 2,971 ms second-attempt handoff and two WebKit content
process terminations. They do not include viewport coordinates for the reported
510-to-470 jump and do not establish the process termination cause.

Pruning previously removed page sections altogether, collapsing their scroll
space. Both pruning paths now release their children while retaining a measured
minimum-height placeholder. The scroll sampler separately requests the window at
the viewport's section, including an unloaded section; it does not publish that
approximation as a canonical word. Reloaded placeholders retain their height until
all available source blocks for that page are delivered, and recover their divider.
Exact block destinations now wait for the block rather than falling back to a
partially delivered section. Existing exact-word verification remains intact.

The 55 anchor tests pass, including assertions that covered cleanup frees children
without removing the page or its measured height. Injected scripts parse. Device
validation of native scrolling and process termination remains outstanding.

### Do not mutate background content during native momentum

The remaining append path could still insert text/refill placeholders during a
finger drag or momentum and issue scrollBy compensation. Background append is now
queued by revision until touch has ended and scroll events have been quiet for
180 ms. Initial delivery and explicit navigation bypass that queue. Annotation
rendering precedes compensation so the measurement includes the full mutation.
This is a vertical-only change; navigation verification remains unchanged.

Regression coverage exercises continuous momentum, duplicate revisions, cancelled
touches and explicit-navigation bypass: 58 anchor tests pass. Development logs
now identify page jumps and append corrections without book text; runtime version
is idle-prefetch-20260910. Physical-device reproduction is still needed before
claiming the intermittent skipping is permanently resolved.

### Handoff highlight lifetime

Horizontal highlight keyframes no longer animate opacity on the mark containing
the word; only background and shadow fade. Vertical explicit markers pause their
animation until the destination is released after verification. Live reports and
synthetic scroll events preserve that explicit marker, while user touch still
clears it. Positioning and suppression for rotation/TOC are unchanged. Regression
tests execute the marker/release code and inspect the horizontal keyframes.
