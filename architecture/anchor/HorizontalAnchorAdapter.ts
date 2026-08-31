import type { AnchorAdapter, AnchorAdapterPorts, CanonicalAnchor } from "./AnchorTypes";
import { verticalAnchorsMatch } from "./VerticalAnchorAdapter";

export type HorizontalSegment = { blockId: string; startOffset: number; text: string; sourcePage: number };
export type GeneratedPageDestination = { page: number; readerPage: number; nonce: number };

export function generatedPageDestination(
  readerPage: number,
  fallbackSourcePage: number,
  nonce = Date.now(),
): GeneratedPageDestination {
  return {
    page: Math.max(1, fallbackSourcePage),
    readerPage: Math.max(1, Math.round(readerPage)),
    nonce,
  };
}

export function generatedPageForAnchor(
  pages: HorizontalSegment[][],
  anchor?: Pick<CanonicalAnchor, "sourceBlockId" | "characterOffset"> & { sourcePage?: number },
) {
  if (!anchor) return -1;
  if (anchor.sourceBlockId) {
    const offset = anchor.characterOffset;
    const exact = pages.findIndex((page) => page.some((segment) =>
      segment.blockId === anchor.sourceBlockId &&
      (offset === undefined || (offset >= segment.startOffset && offset <= segment.startOffset + segment.text.length)),
    ));
    if (exact >= 0) return exact;
    const block = pages.findIndex((page) => page.some((segment) => segment.blockId === anchor.sourceBlockId));
    if (block >= 0) return block;
  }
  return anchor.sourcePage === undefined
    ? -1
    : pages.findIndex((page) => page.some((segment) => segment.sourcePage >= anchor.sourcePage!));
}

const VERIFY_RESOLVE_WINDOW_MS = 2500;

export function createHorizontalAnchorAdapter(
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
    async verify(anchor, transitionId) {
      const expected = options?.verificationAnchor?.(anchor) ?? anchor;
      const startedAt = Date.now();
      let stableMatches = 0;
      while (Date.now() - startedAt < verifyTimeoutMs) {
        if (ports.isTransitionCurrent && !ports.isTransitionCurrent(transitionId)) break;
        const actual = ports.actual();
        if (verticalAnchorsMatch(expected, actual)) {
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
      return {
        ok: false,
        expected,
        actual: actual ?? undefined,
      };
    },
  };
}
