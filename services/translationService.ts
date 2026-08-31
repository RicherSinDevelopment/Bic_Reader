import {
  isTranslationSupported,
  onTranslateTask,
} from "@bsky.app/expo-translate-text";
import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

// Native progress events make the first results immediate, so every session
// can stay alive long enough to process a substantial section of the book.
const FIRST_BATCH_ITEMS = 12;
const FIRST_BATCH_CHARACTERS = 5_000;
const MAX_BATCH_ITEMS = 48;
const MAX_BATCH_CHARACTERS = 18_000;
const PROGRESS_PUBLISH_INTERVAL_MS = 40;

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

export function translationSourceHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}-${text.length}`;
}

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
    const pendingProgress = new Map<number, ExtractedPdfBlock>();
    let progressPublishTimer: ReturnType<typeof setTimeout> | null = null;
    let nextProgressIndex = 0;
    const flushProgress = () => {
      progressPublishTimer = null;
      const readyBlocks: ExtractedPdfBlock[] = [];
      while (pendingProgress.has(nextProgressIndex)) {
        readyBlocks.push(pendingProgress.get(nextProgressIndex)!);
        pendingProgress.delete(nextProgressIndex);
        nextProgressIndex += 1;
      }
      if (readyBlocks.length > 0) onBatch?.(readyBlocks);
    };
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
          sourceContentHash: translationSourceHash(batch[progress.index].text),
        });

        // Coalesce Apple's per-item events to avoid a React render and SQLite
        // write for every individual paragraph.
        if (!progressPublishTimer) {
          progressPublishTimer = setTimeout(
            flushProgress,
            PROGRESS_PUBLISH_INTERVAL_MS,
          );
        }
      },
    );
    if (progressPublishTimer) clearTimeout(progressPublishTimer);
    flushProgress();
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

    const translatedBatch = batch.map((block, index) => {
      const completedText = translatedTexts[index]?.trim();
      return {
        ...block,
        // Apple can legitimately return an empty string for punctuation or
        // emit an empty progressive value before its completed result. Keep a
        // renderable anchor in either case so this source block can always be
        // restored precisely.
        text: completedText ? translatedTexts[index] : block.text,
        id: `translated-${targetLanguage}-${block.id}`,
        sourceContentHash: translationSourceHash(block.text),
      };
    });
    translatedBlocks.push(...translatedBatch);
    // Completed results are authoritative. Always publish them so a partial or
    // empty progress event cannot remain in memory/SQLite indefinitely.
    onBatch?.(translatedBatch);
  }

  return translatedBlocks;
}
