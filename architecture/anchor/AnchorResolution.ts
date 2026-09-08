import type { AnchorCandidate } from "./AnchorTypes";

type SourceBlock = { id: string; page: number; text: string };

/** Never borrow a later extracted page while the requested page is still loading. */
export function pageStartAnchor(
  documentId: string,
  page: number,
  blocks: SourceBlock[],
): AnchorCandidate {
  const block = blocks.find((item) => item.page === page && item.text.trim());
  return {
    documentId,
    sourcePage: page,
    sourceBlockId: block?.id,
    wordIndex: block ? 0 : undefined,
    characterOffset: block ? 0 : undefined,
    blockProgress: block ? 0 : undefined,
  };
}

/** Missing extraction degrades precision; it never substitutes a different page. */
export function resolveAnchor(
  candidate: AnchorCandidate,
  documentId: string,
  pageCount: number,
  blocks: SourceBlock[],
): AnchorCandidate | null {
  if (
    candidate.documentId !== documentId ||
    !Number.isFinite(candidate.sourcePage) ||
    candidate.sourcePage < 1 ||
    (pageCount > 0 && candidate.sourcePage > pageCount)
  )
    return null;
  const block = blocks.find(
    (item) =>
      item.id === candidate.sourceBlockId && item.page === candidate.sourcePage,
  );
  if (!block) return pageStartAnchor(documentId, candidate.sourcePage, blocks);
  const words = Array.from(block.text.matchAll(/\S+/g));
  if (!words.length)
    return pageStartAnchor(documentId, candidate.sourcePage, blocks);
  const offset = candidate.characterOffset;
  const index = candidate.wordIndex;
  const progress = candidate.blockProgress;
  const wordIndex =
    offset !== undefined &&
    Number.isFinite(offset) &&
    offset >= 0 &&
    offset < block.text.length
      ? Math.max(
          0,
          words.findIndex((word) => word.index! + word[0].length > offset),
        )
      : index !== undefined &&
          Number.isInteger(index) &&
          index >= 0 &&
          index < words.length
        ? index
        : progress !== undefined &&
            Number.isFinite(progress) &&
            progress >= 0 &&
            progress <= 1
          ? Math.round(progress * (words.length - 1))
          : 0;
  return {
    ...candidate,
    wordIndex,
    characterOffset: words[wordIndex].index,
    blockProgress: words.length > 1 ? wordIndex / (words.length - 1) : 0,
  };
}
