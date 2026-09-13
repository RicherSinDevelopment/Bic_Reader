import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

export function ttsPositionForBlock(
  blocks: ExtractedPdfBlock[],
  blockId: string,
  blockOffset: number,
) {
  let globalOffset = 0;
  for (const block of blocks) {
    const text = block.text.trim();
    if (block.id === blockId) {
      const leadingWhitespace =
        block.text.length - block.text.trimStart().length;
      return (
        globalOffset +
        Math.max(0, Math.min(text.length, blockOffset - leadingWhitespace))
      );
    }
    globalOffset += text.length + 2;
  }
  return 0;
}


export function spokenWordForTtsOffset(
  blocks: ExtractedPdfBlock[],
  charIndex: number,
  charLength: number,
) {
  let globalOffset = 0;
  for (const block of blocks) {
    const text = block.text.trim();
    const blockEnd = globalOffset + text.length;
    if (charIndex >= globalOffset && charIndex < blockEnd) {
      const leadingWhitespace =
        block.text.length - block.text.trimStart().length;
      const localOffset = charIndex - globalOffset;
      const word = Array.from(text.matchAll(/\S+/g)).find(
        (match) =>
          localOffset >= (match.index ?? 0) &&
          localOffset < (match.index ?? 0) + match[0].length,
      );
      return {
        blockId: block.id,
        offset: leadingWhitespace + (word?.index ?? localOffset),
        length: word?.[0].length ?? charLength,
      };
    }
    globalOffset = blockEnd + 2;
  }
  return null;
}

