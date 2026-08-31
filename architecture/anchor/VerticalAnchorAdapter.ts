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
  if (expected.sourceBlockId) {
    if (!actual.sourceBlockId) return false;
    if (expected.sourceBlockId !== actual.sourceBlockId) {
      // Near the end of a source page the browser cannot place the final block
      // at the viewport top because there is no content beneath it. The
      // previous block's last line becomes the reported top-left word even
      // though the requested block is visible immediately below it. Treat the
      // same source page as a valid vertical landing; exact word placement is
      // still handled by the destination highlight.
      return expected.sourcePage === actual.sourcePage;
    }
    if (
      expected.blockProgress !== undefined &&
      actual.blockProgress !== undefined
    ) {
      return Math.abs(expected.blockProgress - actual.blockProgress) <= 0.08;
    }
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
 * restore as a failure. Translated targets can additionally wait on Apple's
 * on-demand translation pipeline, so callers may extend the window.
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
