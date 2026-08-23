import {
  isTranslationSupported,
  onTranslateTask,
} from "@bsky.app/expo-translate-text";
import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

// Native progress events make the first results immediate, so every session
// can stay alive long enough to process a substantial section of the book.
const FIRST_BATCH_ITEMS = 80;
const FIRST_BATCH_CHARACTERS = 35_000;
const MAX_BATCH_ITEMS = 80;
const MAX_BATCH_CHARACTERS = 35_000;

export const isOnDeviceTranslationSupported = isTranslationSupported();

type TranslationProgress = {
  requestId: string;
  index: number;
  translatedText: string;
  sourceLanguage?: string;
};

type TranslationResult = {
  translatedTexts: string[];
  sourceLanguage?: string;
};

type NativeTranslationModule = {
  translateTask(params: Record<string, unknown>): Promise<TranslationResult>;
  cancelTranslationTask(): Promise<void>;
  addListener(
    eventName: "onTranslationProgress",
    listener: (event: TranslationProgress) => void,
  ): { remove(): void };
};

const nativeTranslation = Platform.OS === "ios"
  ? requireNativeModule<NativeTranslationModule>("ExpoTranslateText")
  : null;
let translationRequestNumber = 0;

export function isBookTranslationCancellation(error: unknown) {
  return error instanceof Error &&
    error.message.includes("BIC_TRANSLATION_CANCELLED");
}

export async function cancelActiveBookTranslation() {
  await nativeTranslation?.cancelTranslationTask();
}

async function translateBatch(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string | undefined,
  onProgress: (progress: TranslationProgress) => void,
) {
  if (!nativeTranslation) {
    return onTranslateTask({
      input: texts,
      sourceLangCode: sourceLanguage,
      targetLangCode: targetLanguage,
    });
  }

  const requestId = `book-${Date.now()}-${translationRequestNumber++}`;
  const subscription = nativeTranslation.addListener(
    "onTranslationProgress",
    (progress) => {
      if (progress.requestId === requestId) onProgress(progress);
    },
  );
  try {
    return await nativeTranslation.translateTask({
      input: texts,
      sourceLangCode: sourceLanguage,
      targetLangCode: targetLanguage,
      requestId,
    });
  } finally {
    subscription.remove();
  }
}

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
    const batch = batches[batchIndex];
    const publishedIndices = new Set<number>();
    const pendingProgress = new Map<number, ExtractedPdfBlock>();
    let nextProgressIndex = 0;
    const result = await translateBatch(
      batch.map((block) => block.text),
      targetLanguage,
      resolvedSourceLanguage,
      (progress) => {
        if (progress.index < 0 || progress.index >= batch.length) return;
        if (!resolvedSourceLanguage && progress.sourceLanguage) {
          resolvedSourceLanguage = progress.sourceLanguage;
          onSourceLanguageDetected?.(resolvedSourceLanguage);
        }
        pendingProgress.set(progress.index, {
          ...batch[progress.index],
          text: progress.translatedText,
          id: `translated-${targetLanguage}-${batch[progress.index].id}`,
        });

        // Apple may finish requests out of order. Only expose the contiguous
        // ordered prefix so the reader never inserts text into earlier pages.
        const readyBlocks: ExtractedPdfBlock[] = [];
        while (pendingProgress.has(nextProgressIndex)) {
          readyBlocks.push(pendingProgress.get(nextProgressIndex)!);
          pendingProgress.delete(nextProgressIndex);
          publishedIndices.add(nextProgressIndex);
          nextProgressIndex += 1;
        }
        if (readyBlocks.length > 0) onBatch?.(readyBlocks);
      },
    );
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
    const unpublishedBlocks = translatedBatch.filter(
      (_, index) => !publishedIndices.has(index),
    );
    if (unpublishedBlocks.length > 0) onBatch?.(unpublishedBlocks);
  }

  return translatedBlocks;
}
