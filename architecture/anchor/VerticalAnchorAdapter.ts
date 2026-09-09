import type {
  AnchorAdapter,
  AnchorAdapterPorts,
  AnchorDestination,
  AnchorVerificationResult,
  CanonicalAnchor,
} from "./AnchorTypes";

export function verticalDestination(
  anchor: CanonicalAnchor,
  nonce = Date.now(),
): AnchorDestination {
  return {
    page: anchor.sourcePage,
    blockId: anchor.sourceBlockId,
    searchMatchIndex: anchor.characterOffset,
    switchHighlightOffset: anchor.characterOffset,
    switchHighlightWordIndex: anchor.wordIndex,
    switchHighlightWordProgress: anchor.blockProgress,
    nonce,
  };
}

export function verticalRestoreMessage(destination: AnchorDestination) {
  return JSON.stringify({ type: "goToSourcePage", ...destination });
}

export function anchorFromVisibleWord(input: {
  documentId: string;
  sourcePage: number;
  sourceBlockId: string;
  wordIndex: number;
  characterOffset?: number;
  wordCount?: number;
}): Omit<CanonicalAnchor, "revision" | "updatedAt"> {
  return {
    ...input,
    blockProgress:
      input.wordCount && input.wordCount > 1
        ? input.wordIndex / (input.wordCount - 1)
        : 0,
  };
}

function anchorsMatch(
  expected: CanonicalAnchor,
  actual: CanonicalAnchor | null,
) {
  if (!actual || expected.documentId !== actual.documentId) return false;
  if (expected.sourcePage !== actual.sourcePage) return false;
  if (expected.sourceBlockId) {
    if (expected.sourceBlockId !== actual.sourceBlockId) return false;
    if (expected.characterOffset !== undefined) return expected.characterOffset === actual.characterOffset;
    if (expected.wordIndex !== undefined) return expected.wordIndex === actual.wordIndex;
    if (expected.blockProgress !== undefined) return expected.blockProgress === actual.blockProgress;
    return true;
  }
  return expected.sourcePage === actual.sourcePage;
}

/**
 * How long verification waits for the renderer to actually land on the target
 * after the restore message was delivered. Far-away destinations (TOC jumps,
 * search hits, cross-tab switches) depend on progressive extraction + block
 * append reaching the WebView before the target word is visible; a fixed
 * microsecond check races that pipeline and mislabels a slow-but-successful
 * restore as a failure, so callers may extend the window for slower content.
 */
const VERIFY_RESOLVE_WINDOW_MS = 2500;

export function createVerticalAnchorAdapter(
  ports: AnchorAdapterPorts,
  options?: {
    verifyTimeoutMs?: number;
    verificationAnchor?: (anchor: CanonicalAnchor) => CanonicalAnchor;
  },
): AnchorAdapter {
  const verifyTimeoutMs = options?.verifyTimeoutMs ?? VERIFY_RESOLVE_WINDOW_MS;
  return {
    async waitUntilReady(anchor) {
      const startedAt = Date.now();
      while (Date.now() - startedAt < 10_000) {
        if (ports.isReady(anchor)) return true;
        await new Promise<void>((resolve) => setTimeout(resolve, 40));
      }
      return false;
    },
    async restore(anchor, transitionId) {
      ports.restore(anchor, transitionId);
      return { ok: true, retryable: true };
    },
    async verify(anchor, transitionId): Promise<AnchorVerificationResult> {
      const expected = options?.verificationAnchor?.(anchor) ?? anchor;
      const startedAt = Date.now();
      let stableMatches = 0;
      while (Date.now() - startedAt < verifyTimeoutMs) {
        if (
          ports.isTransitionCurrent &&
          !ports.isTransitionCurrent(transitionId)
        )
          break;
        const actual = ports.actual();
        if (anchorsMatch(expected, actual)) {
          stableMatches += 1;
          if (stableMatches >= 3) {
            return { ok: true, expected, actual: actual ?? undefined };
          }
        } else {
          stableMatches = 0;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
      }
      const actual = ports.actual();
      return { ok: false, expected, actual: actual ?? undefined };
    },
  };
}

export { anchorsMatch as verticalAnchorsMatch };
