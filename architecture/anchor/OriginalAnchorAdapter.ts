import type { AnchorAdapter, CanonicalAnchor } from "./AnchorTypes";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

export type OriginalDestination = { page: number; nonce: number };
export type OriginalPageSize = { width: number; height: number };

/** Original consumes source identity. Its ordinary page-change events are never published. */
export function originalDestination(anchor: CanonicalAnchor, nonce = Date.now()): OriginalDestination {
  return { page: Math.max(1, anchor.sourcePage), nonce };
}

export function originalHighlightTarget(
  anchor: CanonicalAnchor | null,
  blocks: ExtractedPdfBlock[],
  pageSizes: Record<number, OriginalPageSize>,
) {
  if (!anchor) return null;
  const block = anchor.sourceBlockId
    ? blocks.find((candidate) => candidate.id === anchor.sourceBlockId)
    : blocks.find((candidate) => candidate.page === anchor.sourcePage && candidate.text.trim());
  if (!block || !pageSizes[block.page]) return null;
  const words = Array.from(block.text.matchAll(/\S+/g));
  const wordIndex = Math.max(0, Math.min(
    Math.max(0, words.length - 1),
    (anchor.characterOffset !== undefined
      ? Math.max(0, words.findIndex((word) => word.index! + word[0].length > anchor.characterOffset!))
      : anchor.wordIndex) ?? Math.round((anchor.blockProgress ?? 0) * Math.max(0, words.length - 1)),
  ));
  const bounds = block.wordBounds?.[wordIndex];
  const sourceBounds = bounds && bounds.length === 4
    ? { left: bounds[0], top: bounds[1], right: bounds[2], bottom: bounds[3] }
    : block.sourceBounds;
  return {
    blockId: block.id,
    word: words[wordIndex]?.[0] ?? "",
    wordIndex,
    blockOffset: words[wordIndex]?.index ?? 0,
    sourceWordCount: words.length,
    page: block.page,
    sourceBounds,
    pageSize: pageSizes[block.page],
  };
}

export function createOriginalAnchorAdapter(ports: {
  isReady: () => boolean;
  restore: (destination: OriginalDestination, transitionId: number) => void;
  currentPage: () => number;
}): AnchorAdapter {
  return {
    async waitUntilReady() {
      const startedAt = Date.now();
      while (Date.now() - startedAt < 10_000) {
        if (ports.isReady()) return true;
        await new Promise<void>((resolve) => setTimeout(resolve, 40));
      }
      return false;
    },
    async restore(anchor, transitionId) {
      ports.restore(originalDestination(anchor, transitionId), transitionId);
      return { ok: true, retryable: true };
    },
    async verify(anchor) {
      const page = ports.currentPage();
      const actual: CanonicalAnchor = { ...anchor, sourcePage: page };
      return { ok: page === anchor.sourcePage, expected: anchor, actual };
    },
  };
}
