# Reader transition architecture and quality gates

## State model

The app has five rendered states:

1. Reader vertical
2. Reader horizontal
3. Translated vertical
4. Translated horizontal
5. Original PDF

Transitions do not map one renderer directly to another. The source renderer
captures a canonical source anchor, and the destination adapter restores that
anchor. Generated horizontal page numbers and vertical pixel offsets are never
treated as durable identity because both change when text reflows.

The canonical anchor is:

- source PDF page;
- source block ID;
- source word index and character offset;
- normalized progress through the block;
- document ID, revision, and timestamp.

## Automated quality gates

Run `npm run test:anchor` for the regression suite and
`npm run test:anchor:coverage` for coverage. The suite covers all 20 directed
edges among the five states, horizontal repagination, translation round trips,
selected-word transfer, stale anchor rejection, transition retry/failure, and
superseded transitions.

## Runtime measurements

Every completed transition records privacy-safe metrics in
`AnchorMetrics.ts`: duration, logical accuracy score, retry count, source, and
destination. Development builds print `[Transition Metrics]`. Slow transitions
over 2.5 seconds and accuracy below 90 are reported to Sentry without document
text, filenames, questions, or user identity.

Interpret the score as follows:

- 100: exact source page, block, and normalized word progress;
- 90–99: correct block with small word-progress drift;
- 25: correct source page but a different top-left block;
- 0: wrong page, document, or no verified destination.

Use `summarizeTransitionMetrics()` to calculate sample size, success rate,
average accuracy, median latency, and p95 latency for a test session.

## Release targets

- Transition success rate: at least 99.5% across 200 real-device transitions.
- Average accuracy: at least 95.
- Wrong-page rate: 0%.
- Same-page wrong-block rate: below 1%.
- Warm reader/translated transition p50: below 500 ms.
- Warm transition p95: below 1,200 ms.
- Cold translated transition p95: below 4,000 ms.

Unit tests prove mapping logic, not WebView or PDFKit geometry. Before release,
run a physical-device matrix using small, large, RTL, image-only, malformed,
and translation-heavy PDFs in portrait and landscape.

## Known precision boundary

Reader-to-translated word mapping currently uses normalized progress within a
block. This is deterministic but is not semantic word alignment: translations
can reorder, combine, or split words. Exact cross-language word accuracy will
require the translation pipeline to persist source-span to translated-span
alignment metadata. Original PDF verification is currently page-level; the
highlight coordinates provide the word target, but PDFKit does not report a
verified top-left word back to the canonical controller.
