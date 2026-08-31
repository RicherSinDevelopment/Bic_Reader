import type { CanonicalAnchor, TranslationAnchor } from "./AnchorTypes";

export const translatedBlockId = (sourceBlockId: string, languageCode: string) =>
  `translated-${languageCode}-${sourceBlockId}`;

export const sourceBlockId = (blockId: string, languageCode: string) => {
  const prefix = `translated-${languageCode}-`;
  return blockId.startsWith(prefix) ? blockId.slice(prefix.length) : blockId;
};

export function toTranslationAnchor(anchor: CanonicalAnchor, languageCode: string): TranslationAnchor {
  return { ...anchor, languageCode, translatedBlockId: anchor.sourceBlockId ? translatedBlockId(anchor.sourceBlockId, languageCode) : undefined };
}

export function toSourceAnchor(anchor: TranslationAnchor): Omit<CanonicalAnchor, "revision" | "updatedAt"> {
  return {
    documentId: anchor.documentId,
    sourcePage: anchor.sourcePage,
    sourceBlockId: anchor.sourceBlockId ?? (anchor.translatedBlockId ? sourceBlockId(anchor.translatedBlockId, anchor.languageCode) : undefined),
    wordIndex: undefined,
    characterOffset: undefined,
    blockProgress: anchor.blockProgress,
  };
}

export function proportionalWordIndex(progress: number | undefined, wordCount: number) {
  if (wordCount <= 1) return 0;
  return Math.round(Math.max(0, Math.min(1, progress ?? 0)) * (wordCount - 1));
}
