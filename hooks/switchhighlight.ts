import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import { useCallback, useMemo, useState } from "react";

export type PdfPageSize = { width: number; height: number };

export type SwitchHighlightTarget = {
  blockId: string;
  word: string;
  wordIndex: number;
  blockOffset: number;
  sourceWordCount: number;
  page: number;
  sourceBounds: ExtractedPdfBlock["sourceBounds"];
  pageSize: PdfPageSize;
};

function estimatedWordBounds(
  block: ExtractedPdfBlock,
  wordIndex: number,
): ExtractedPdfBlock["sourceBounds"] | undefined {
  const match = Array.from(block.text.matchAll(/\S+/g))[wordIndex];
  const textLength = block.text.length;
  if (!match || !textLength) return undefined;

  const start = match.index ?? 0;
  const end = start + match[0].length;
  const width = block.sourceBounds.right - block.sourceBounds.left;
  if (width <= 0) return undefined;

  // Vision normally supplies exact character ranges. If an older native
  // extraction has only a line rectangle, keep the switch highlight word-sized
  // instead of falling back to the entire OCR line.
  const isRtl = /^[\s\p{P}\p{N}]*[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(block.text);
  const startRatio = start / textLength;
  const endRatio = end / textLength;
  const leftRatio = isRtl ? 1 - endRatio : startRatio;
  const rightRatio = isRtl ? 1 - startRatio : endRatio;
  return {
    left: block.sourceBounds.left + width * leftRatio,
    top: block.sourceBounds.top,
    right: block.sourceBounds.left + width * rightRatio,
    bottom: block.sourceBounds.bottom,
  };
}

export function useSwitchHighlight(
  blocks: ExtractedPdfBlock[],
  pageSizes: Record<number, PdfPageSize>,
) {
  const [anchor, setAnchor] = useState<{
    blockId: string;
    word: string;
    wordIndex: number;
  } | null>(null);

  const reportVisibleBlock = useCallback((blockId: string, word: string, wordIndex: number) => {
    setAnchor((current) =>
      current?.blockId === blockId && current.wordIndex === wordIndex
        ? current
        : { blockId, word, wordIndex },
    );
  }, []);

  const target = useMemo<SwitchHighlightTarget | null>(() => {
    const block = anchor
      ? blocks.find((candidate) => candidate.id === anchor.blockId)
      : blocks.find((candidate) => Boolean(pageSizes[candidate.page]) && candidate.text.trim());
    const pageSize = block ? pageSizes[block.page] : undefined;
    if (!block || !pageSize) return null;
    const wordIndex = anchor?.wordIndex ?? 0;
    const candidateWordBounds = block.wordBounds?.[wordIndex];
    const exactWordBounds = candidateWordBounds &&
      candidateWordBounds.every(Number.isFinite) &&
      candidateWordBounds[2] > candidateWordBounds[0] &&
      candidateWordBounds[3] > candidateWordBounds[1]
      ? candidateWordBounds
      : undefined;
    const wordMatch = Array.from(block.text.matchAll(/\S+/g))[wordIndex];
    const fallbackWordBounds = estimatedWordBounds(block, wordIndex);
    return {
      blockId: block.id,
      word: anchor?.word || block.text.trim().split(/\s+/, 1)[0] || "",
      wordIndex: anchor?.wordIndex ?? 0,
      blockOffset: wordMatch?.index ?? 0,
      sourceWordCount: block.text.trim().split(/\s+/).filter(Boolean).length,
      page: block.page,
      sourceBounds: exactWordBounds ? {
        left: exactWordBounds[0],
        top: exactWordBounds[1],
        right: exactWordBounds[2],
        bottom: exactWordBounds[3],
      } : fallbackWordBounds ?? block.sourceBounds,
      pageSize,
    };
  }, [anchor, blocks, pageSizes]);

  return { reportVisibleBlock, target };
}
