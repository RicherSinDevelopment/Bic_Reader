import {
  isTranslationSupported,
  onTranslateTask,
} from "@bsky.app/expo-translate-text";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

const FIRST_BATCH_ITEMS = 12;
const FIRST_BATCH_CHARACTERS = 6_000;
const MAX_BATCH_ITEMS = 48;
const MAX_BATCH_CHARACTERS = 20_000;

export const isOnDeviceTranslationSupported = isTranslationSupported();

export async function translateAnchorText(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
) {
  const result = await onTranslateTask({
    input: text,
    sourceLangCode: sourceLanguage,
    targetLangCode: targetLanguage,
  });
  return typeof result.translatedTexts === "string"
    ? result.translatedTexts.trim()
    : "";
}

function createBatches(blocks: ExtractedPdfBlock[]) {
  const batches: ExtractedPdfBlock[][] = [];
  let batch: ExtractedPdfBlock[] = [];
  let characters = 0;

  for (const block of blocks) {
    const itemLimit = batches.length === 0
      ? FIRST_BATCH_ITEMS
      : MAX_BATCH_ITEMS;
    const characterLimit = batches.length === 0
      ? FIRST_BATCH_CHARACTERS
      : MAX_BATCH_CHARACTERS;
    const wouldOverflow =
      batch.length >= itemLimit ||
      (batch.length > 0 && characters + block.text.length > characterLimit);

    if (wouldOverflow) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }

    batch.push(block);
    characters += block.text.length;
  }

  if (batch.length > 0) batches.push(batch);
  return batches;
}

export async function translatePdfBlocks(
  blocks: ExtractedPdfBlock[],
  targetLanguage: string,
  onBatch?: (blocks: ExtractedPdfBlock[]) => void,
  sourceLanguage?: string,
  onSourceLanguageDetected?: (language: string) => void,
) {
  if (!isOnDeviceTranslationSupported) {
    throw new Error(
      "On-device document translation requires iOS 18 or later.",
    );
  }

  const translatedBlocks: ExtractedPdfBlock[] = [];
  let resolvedSourceLanguage = sourceLanguage;
  const batches = createBatches(blocks);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const originalBatch = batches[batchIndex];
    // Put a substantial paragraph first when Apple must detect the language.
    // Results are cached by block ID, so this does not alter document order.
    const batch = !resolvedSourceLanguage && batchIndex === 0
      ? [...originalBatch].sort((a, b) => b.text.length - a.text.length)
      : originalBatch;
    const result = await onTranslateTask({
      input: batch.map((block) => block.text),
      sourceLangCode: resolvedSourceLanguage,
      targetLangCode: targetLanguage,
    });
    const translatedTexts = result.translatedTexts;

    if (!Array.isArray(translatedTexts) || translatedTexts.length !== batch.length) {
      throw new Error("The translation service returned an incomplete batch.");
    }

    if (!resolvedSourceLanguage && result.sourceLanguage) {
      resolvedSourceLanguage = result.sourceLanguage;
      onSourceLanguageDetected?.(resolvedSourceLanguage);
    }
    if (!resolvedSourceLanguage && batchIndex === 0) {
      throw new Error("Apple could not detect the book's source language.");
    }

    const translatedBatch = batch.map((block, index) => ({
      ...block,
      text: translatedTexts[index],
      id: `translated-${targetLanguage}-${block.id}`,
    }));
    translatedBlocks.push(...translatedBatch);
    onBatch?.(translatedBatch);
  }

  return translatedBlocks;
}
