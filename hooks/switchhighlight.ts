import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import { useCallback, useMemo, useState } from "react";

export type PdfPageSize = { width: number; height: number };

export type SwitchHighlightTarget = {
  blockId: string;
  word: string;
  wordIndex: number;
  sourceWordCount: number;
  page: number;
  sourceBounds: ExtractedPdfBlock["sourceBounds"];
  pageSize: PdfPageSize;
};

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
    const block = blocks.find((candidate) => candidate.id === anchor?.blockId);
    const pageSize = block ? pageSizes[block.page] : undefined;
    if (!block || !pageSize) return null;
    const exactWordBounds = block.wordBounds?.[anchor?.wordIndex ?? 0];
    return {
      blockId: block.id,
      word: anchor?.word || block.text.trim().split(/\s+/, 1)[0] || "",
      wordIndex: anchor?.wordIndex ?? 0,
      sourceWordCount: block.text.trim().split(/\s+/).filter(Boolean).length,
      page: block.page,
      sourceBounds: exactWordBounds ? {
        left: exactWordBounds[0],
        top: exactWordBounds[1],
        right: exactWordBounds[2],
        bottom: exactWordBounds[3],
      } : block.sourceBounds,
      pageSize,
    };
  }, [anchor, blocks, pageSizes]);

  return { reportVisibleBlock, target };
}
