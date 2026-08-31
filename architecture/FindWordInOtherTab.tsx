import type { ReaderMode } from "@/architecture/anchor/AnchorTypes";
import { sourceBlockId } from "@/architecture/anchor/TranslationAnchorMapper";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

export type SelectedTextRange = {
  blockId: string;
  offset: number;
  length: number;
};

export type FindWordAnchor = {
  sourcePage: number;
  sourceBlockId: string;
  word: string;
  wordIndex: number;
  characterOffset: number;
  blockProgress: number;
};

export type FindWordTarget = Exclude<ReaderMode, "translated"> | "translated";

export function findWordMenuItems(
  mode: "reader" | "translated",
  hasTranslation: boolean,
) {
  if (mode === "translated") {
    return [
      { key: "findInReader", label: "Find in Reader" },
      { key: "findInOriginal", label: "Find in Original" },
    ];
  }
  return [
    ...(hasTranslation
      ? [{ key: "findInTranslated", label: "Find in Translation" }]
      : []),
    { key: "findInOriginal", label: "Find in Original" },
  ];
}

export function findTargetForMenuKey(key: string): FindWordTarget | null {
  if (key === "findInReader") return "reader";
  if (key === "findInTranslated") return "translated";
  if (key === "findInOriginal") return "original";
  return null;
}

/** Converts the first selected word back to the source block used by all tabs. */
export function anchorForSelectedWord(input: {
  range: SelectedTextRange | undefined;
  selectedText?: string;
  blocks: ExtractedPdfBlock[];
  mode: "reader" | "translated";
  languageCode?: string;
}): FindWordAnchor | null {
  const { range } = input;
  if (!range) return null;
  const block = input.blocks.find(
    (candidate) => candidate.id === range.blockId,
  );
  if (!block) return null;

  const words = Array.from(block.text.matchAll(/\S+/g));
  if (!words.length) return null;
  const selectionOffset = Math.max(0, range.offset);
  const wordIndex = Math.max(
    0,
    words.findIndex((match) => {
      const start = match.index ?? 0;
      return selectionOffset < start + match[0].length;
    }),
  );
  const match = words[wordIndex] ?? words[0];
  const translated = input.mode === "translated" && input.languageCode;

  return {
    sourcePage: block.page,
    sourceBlockId: translated
      ? sourceBlockId(block.id, input.languageCode!)
      : block.id,
    word: input.selectedText?.trim().split(/\s+/, 1)[0] || match[0],
    wordIndex,
    characterOffset: match.index ?? 0,
    blockProgress: words.length > 1 ? wordIndex / (words.length - 1) : 0,
  };
}
