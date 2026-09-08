import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

export function typographyForReadingDirection(
  direction: "ltr" | "rtl",
  settings: { letterSpacing: number; automaticHyphenation: boolean },
) {
  if (direction !== "rtl") return settings;
  // Connected scripts must not inherit Latin-oriented tracking or word
  // breaking: those settings visually separate and distort glyphs.
  return { letterSpacing: 0, automaticHyphenation: false };
}

type PageLineMetrics = {
  lineHeight: number;
  lineWidth: number;
};

function percentile(values: number[], ratio: number, fallback: number) {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((first, second) => first - second);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * ratio)),
  );
  return sorted[index] ?? fallback;
}

function blockHeight(block: ExtractedPdfBlock) {
  return Math.max(1, block.sourceBounds.bottom - block.sourceBounds.top);
}

function blockWidth(block: ExtractedPdfBlock) {
  return Math.max(1, block.sourceBounds.right - block.sourceBounds.left);
}

function pageMetrics(blocks: ExtractedPdfBlock[]) {
  const metrics = new Map<number, PageLineMetrics>();
  const paragraphsByPage = new Map<number, ExtractedPdfBlock[]>();

  blocks.forEach((block) => {
    if (block.kind !== "paragraph") return;
    const pageBlocks = paragraphsByPage.get(block.page);
    if (pageBlocks) pageBlocks.push(block);
    else paragraphsByPage.set(block.page, [block]);
  });

  paragraphsByPage.forEach((pageBlocks, page) => {
    metrics.set(page, {
      // The lower quartile represents a single printed line even when some
      // already-grouped paragraphs span several lines.
      lineHeight: percentile(pageBlocks.map(blockHeight), 0.25, 12),
      lineWidth: percentile(pageBlocks.map(blockWidth), 0.75, 240),
    });
  });

  return metrics;
}

function cleanReaderText(text: string) {
  return text
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function endsLikelyParagraph(text: string) {
  return /[.!?…][\u2019\u201d'"]?$/.test(text.trim());
}

function startsLikeSentence(text: string) {
  const firstCharacter = Array.from(
    text.trim().replace(/^[\u2018\u201c'"]/, ""),
  )[0];
  if (!firstCharacter) return false;
  return (
    /[0-9]/.test(firstCharacter) ||
    (firstCharacter.toLocaleUpperCase() === firstCharacter &&
      firstCharacter.toLocaleLowerCase() !== firstCharacter)
  );
}

function startsWithLowercaseLetter(text: string) {
  const firstCharacter = Array.from(text.trim())[0];
  return Boolean(
    firstCharacter &&
    firstCharacter.toLocaleLowerCase() === firstCharacter &&
    firstCharacter.toLocaleUpperCase() !== firstCharacter,
  );
}

function shouldJoinParagraphLines(
  previous: ExtractedPdfBlock,
  next: ExtractedPdfBlock,
  metrics: PageLineMetrics,
) {
  if (
    previous.page !== next.page ||
    previous.kind !== "paragraph" ||
    next.kind !== "paragraph" ||
    !previous.id.startsWith("ocr-") ||
    !next.id.startsWith("ocr-")
  ) {
    return false;
  }

  const previousHeight = blockHeight(previous);
  const nextHeight = blockHeight(next);
  const maximumLineHeight = metrics.lineHeight * 1.4;
  if (previousHeight > maximumLineHeight || nextHeight > maximumLineHeight) {
    return false;
  }

  const verticalGap = next.sourceBounds.top - previous.sourceBounds.bottom;
  if (
    verticalGap < -metrics.lineHeight * 0.25 ||
    verticalGap > metrics.lineHeight * 0.95
  ) {
    return false;
  }

  const leftDelta = Math.abs(
    next.sourceBounds.left - previous.sourceBounds.left,
  );
  if (leftDelta > Math.max(18, metrics.lineHeight * 1.25)) return false;

  const overlap =
    Math.min(previous.sourceBounds.right, next.sourceBounds.right) -
    Math.max(previous.sourceBounds.left, next.sourceBounds.left);
  if (overlap < Math.min(blockWidth(previous), blockWidth(next)) * 0.5) {
    return false;
  }

  // A short sentence-ending line followed by a capital is usually a genuine
  // paragraph boundary even when the source book uses no extra vertical gap.
  if (
    blockWidth(previous) < metrics.lineWidth * 0.72 &&
    endsLikelyParagraph(previous.text) &&
    startsLikeSentence(next.text)
  ) {
    return false;
  }

  return true;
}

function mergeParagraphLine(
  paragraph: ExtractedPdfBlock,
  line: ExtractedPdfBlock,
) {
  const dehyphenate =
    paragraph.wordBounds.length === 0 &&
    line.wordBounds.length === 0 &&
    paragraph.text.endsWith("-") &&
    startsWithLowercaseLetter(line.text);
  const paragraphText = dehyphenate
    ? paragraph.text.slice(0, -1)
    : `${paragraph.text} `;

  return {
    ...paragraph,
    text: `${paragraphText}${line.text}`,
    sourceBounds: {
      left: Math.min(paragraph.sourceBounds.left, line.sourceBounds.left),
      top: Math.min(paragraph.sourceBounds.top, line.sourceBounds.top),
      right: Math.max(paragraph.sourceBounds.right, line.sourceBounds.right),
      bottom: Math.max(paragraph.sourceBounds.bottom, line.sourceBounds.bottom),
    },
    wordBounds: [...paragraph.wordBounds, ...line.wordBounds],
    confidence: Math.min(paragraph.confidence, line.confidence),
  } satisfies ExtractedPdfBlock;
}

/**
 * Produces stable Reader Mode paragraphs without altering Original PDF data.
 * IDs come from the first source line so search and highlights
 * all operate on the same normalized block collection.
 */
export function normalizeReaderBlocks(blocks: ExtractedPdfBlock[]) {
  const cleaned = blocks
    .map((block) => ({ ...block, text: cleanReaderText(block.text) }))
    .filter((block) => block.text.length > 0);
  const metrics = pageMetrics(cleaned);
  const normalized: ExtractedPdfBlock[] = [];
  let previousSourceBlock: ExtractedPdfBlock | undefined;

  cleaned.forEach((block) => {
    const paragraph = normalized.at(-1);
    const lineMetrics = metrics.get(block.page);
    if (
      paragraph &&
      previousSourceBlock &&
      lineMetrics &&
      shouldJoinParagraphLines(previousSourceBlock, block, lineMetrics)
    ) {
      normalized[normalized.length - 1] = mergeParagraphLine(paragraph, block);
    } else {
      normalized.push(block);
    }
    previousSourceBlock = block;
  });

  return normalized;
}
