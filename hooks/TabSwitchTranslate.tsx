import { anchorController } from "@/architecture/anchor/AnchorController";
import { useAnchorStore } from "@/architecture/anchor/AnchorStore";
import {
  proportionalWordIndex,
  sourceBlockId,
  translatedBlockId,
} from "@/architecture/anchor/TranslationAnchorMapper";
import type { CanonicalAnchor } from "@/architecture/anchor/AnchorTypes";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import { useCallback, useEffect, useRef } from "react";

export type LatestTranslatedAnchor = {
  languageCode: string;
  blockId: string;
  offset: number;
  sourceBlockId: string;
  sourcePage: number;
  wordProgress: number;
};

export type TabSwitchDestination = {
  page: number;
  blockId?: string;
  searchMatchIndex?: number;
  switchHighlightOffset?: number;
  switchHighlightWordIndex?: number;
  switchHighlightWordProgress?: number;
  switchHighlightQuery?: string;
  nonce: number;
};

function wordsIn(block: ExtractedPdfBlock) {
  return Array.from(block.text.matchAll(/\S+/g));
}

export function translatedDestinationForAnchor(
  anchor: CanonicalAnchor,
  languageCode: string,
  translatedBlocks: ExtractedPdfBlock[],
  nonce = Date.now(),
): TabSwitchDestination {
  const blockId = anchor.sourceBlockId
    ? translatedBlockId(anchor.sourceBlockId, languageCode)
    : undefined;
  const translatedBlock = blockId
    ? translatedBlocks.find((block) => block.id === blockId)
    : undefined;
  const words = translatedBlock ? wordsIn(translatedBlock) : [];
  const wordIndex = proportionalWordIndex(anchor.blockProgress, words.length);
  const offset = words[wordIndex]?.index;
  return {
    page: anchor.sourcePage,
    blockId,
    searchMatchIndex: offset,
    switchHighlightOffset: offset,
    switchHighlightWordProgress: anchor.blockProgress,
    nonce,
  };
}

export function readerDestinationForTranslatedAnchor(
  anchor: LatestTranslatedAnchor,
  readerBlocks: ExtractedPdfBlock[],
  nonce = Date.now(),
): TabSwitchDestination {
  const sourceBlock = readerBlocks.find((block) => block.id === anchor.sourceBlockId);
  const words = sourceBlock ? wordsIn(sourceBlock) : [];
  const wordIndex = proportionalWordIndex(anchor.wordProgress, words.length);
  const offset = words[wordIndex]?.index;
  return {
    page: anchor.sourcePage,
    blockId: anchor.sourceBlockId,
    searchMatchIndex: offset,
    switchHighlightOffset: offset,
    switchHighlightWordProgress: anchor.wordProgress,
    nonce,
  };
}

export function useTabSwitchTranslate(input: {
  documentId?: string;
  languageCode?: string;
  activeMode: "reader" | "translated" | "original";
  readerBlocks: ExtractedPdfBlock[];
  translatedBlocks: ExtractedPdfBlock[];
  reportVisibleReaderBlock?: (blockId: string, word: string, wordIndex: number) => void;
}) {
  const latestTranslatedAnchor = useRef<LatestTranslatedAnchor | null>(null);
  const actualReaderAnchor = useRef<CanonicalAnchor | null>(null);
  const actualTranslatedAnchor = useRef<CanonicalAnchor | null>(null);
  const latestReaderBlocks = useRef(input.readerBlocks);
  const latestTranslatedBlocks = useRef(input.translatedBlocks);
  const activeMode = useRef(input.activeMode);
  const readerPublishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translatedPublishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestReaderBlocks.current = input.readerBlocks;
  latestTranslatedBlocks.current = input.translatedBlocks;
  activeMode.current = input.activeMode;

  useEffect(() => {
    if (readerPublishTimer.current) clearTimeout(readerPublishTimer.current);
    if (translatedPublishTimer.current) clearTimeout(translatedPublishTimer.current);
    readerPublishTimer.current = null;
    translatedPublishTimer.current = null;
    latestTranslatedAnchor.current = null;
    actualReaderAnchor.current = null;
    actualTranslatedAnchor.current = null;
    return () => {
      if (readerPublishTimer.current) clearTimeout(readerPublishTimer.current);
      if (translatedPublishTimer.current) clearTimeout(translatedPublishTimer.current);
    };
  }, [input.documentId, input.languageCode]);

  const reportReaderAnchor = useCallback((blockId: string, word: string, wordIndex: number) => {
    if (!input.documentId || activeMode.current !== "reader") return;
    const block = latestReaderBlocks.current.find((candidate) => candidate.id === blockId);
    if (!block) return;
    const words = wordsIn(block);
    const exactIndex = Math.max(0, Math.min(Math.max(0, words.length - 1), wordIndex));
    const progress = words.length > 1 ? exactIndex / (words.length - 1) : 0;
    actualReaderAnchor.current = {
      documentId: input.documentId,
      sourcePage: block.page,
      sourceBlockId: block.id,
      wordIndex: exactIndex,
      characterOffset: words[exactIndex]?.index ?? 0,
      blockProgress: progress,
      revision: anchorController.current()?.revision ?? 0,
      updatedAt: new Date().toISOString(),
    };
    if (useAnchorStore.getState().transition.status === "running") return;
    input.reportVisibleReaderBlock?.(blockId, word, wordIndex);
    const current = anchorController.current();
    if (current?.documentId === input.documentId && current.sourceBlockId === block.id &&
        (current.wordIndex === exactIndex || Math.abs((current.blockProgress ?? 0) - progress) < 0.015)) return;
    if (readerPublishTimer.current) clearTimeout(readerPublishTimer.current);
    readerPublishTimer.current = setTimeout(() => {
      readerPublishTimer.current = null;
      const latest = actualReaderAnchor.current;
      if (!latest || activeMode.current !== "reader" ||
          useAnchorStore.getState().transition.status === "running") return;
      anchorController.publish(latest, "reader-user");
    }, 220);
  }, [input.documentId, input.reportVisibleReaderBlock]);

  const reportTranslatedAnchor = useCallback((blockId: string, _word: string, wordIndex: number) => {
    if (!input.documentId || !input.languageCode) return;
    const block = latestTranslatedBlocks.current.find((candidate) => candidate.id === blockId);
    if (!block) return;
    const words = wordsIn(block);
    const exactIndex = Math.max(0, Math.min(Math.max(0, words.length - 1), wordIndex));
    const progress = words.length > 1 ? exactIndex / (words.length - 1) : 0;
    const sourceId = sourceBlockId(blockId, input.languageCode);
    latestTranslatedAnchor.current = {
      languageCode: input.languageCode,
      blockId,
      offset: words[exactIndex]?.index ?? 0,
      sourceBlockId: sourceId,
      sourcePage: block.page,
      wordProgress: progress,
    };
    actualTranslatedAnchor.current = {
      documentId: input.documentId,
      sourcePage: block.page,
      sourceBlockId: sourceId,
      blockProgress: progress,
      revision: anchorController.current()?.revision ?? 0,
      updatedAt: new Date().toISOString(),
    };
    if (activeMode.current !== "translated") return;
    if (useAnchorStore.getState().transition.status === "running") return;
    const current = anchorController.current();
    if (current?.documentId === input.documentId && current.sourceBlockId === sourceId &&
        Math.abs((current.blockProgress ?? 0) - progress) < 0.015) return;
    if (translatedPublishTimer.current) clearTimeout(translatedPublishTimer.current);
    translatedPublishTimer.current = setTimeout(() => {
      translatedPublishTimer.current = null;
      const latest = actualTranslatedAnchor.current;
      if (!latest || activeMode.current !== "translated" ||
          useAnchorStore.getState().transition.status === "running") return;
      anchorController.publish(latest, "translated-user");
    }, 220);
  }, [input.documentId, input.languageCode]);

  return {
    actualReaderAnchor,
    actualTranslatedAnchor,
    latestTranslatedAnchor,
    reportReaderAnchor,
    reportTranslatedAnchor,
  };
}
