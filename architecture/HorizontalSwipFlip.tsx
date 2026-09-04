/** Stable text identity used while a horizontal book is repaginated. */
export type HorizontalFlipAnchor = {
  blockId: string;
  blockOffset: number;
  wordIndex: number;
};

export type HorizontalFlipSegment = {
  blockId: string;
  sourcePage: number;
  startOffset: number;
  text: string;
};

/** Generated page numbers are not retained because layout changes invalidate them. */
export function captureHorizontalFlipAnchor(
  page: HorizontalFlipSegment[] | undefined,
  blocks: readonly { id: string; text: string }[],
): HorizontalFlipAnchor | undefined {
  const segment = page?.[0];
  if (!segment) return undefined;
  const firstWord = segment.text.match(/\S+/);
  const blockOffset = segment.startOffset + (firstWord?.index ?? 0);
  const prefix =
    blocks
      .find((block) => block.id === segment.blockId)
      ?.text.slice(0, blockOffset) ?? "";
  return {
    blockId: segment.blockId,
    blockOffset,
    wordIndex: prefix.match(/\S+/g)?.length ?? 0,
  };
}

/** Finds the repaginated page containing the exact captured text offset. */
export function horizontalPageForFlipAnchor(
  pages: HorizontalFlipSegment[][],
  anchor: HorizontalFlipAnchor | undefined,
) {
  if (!anchor) return -1;
  const exact = pages.findIndex((page) =>
    page.some(
      (segment) =>
        segment.blockId === anchor.blockId &&
        anchor.blockOffset >= segment.startOffset &&
        anchor.blockOffset < segment.startOffset + segment.text.length,
    ),
  );
  if (exact >= 0) return exact;
  return pages.findIndex((page) =>
    page.some((segment) => segment.blockId === anchor.blockId),
  );
}

/** Coalesces iOS's intermediate orientation layout passes. */
export const HORIZONTAL_FLIP_SETTLE_MS = 80;
