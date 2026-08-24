import BackButton from "@/components/Backbutton";
import OriginalPDF, { type PdfOutlineItem } from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
import type { TranslationLanguage } from "@/components/readernavbar/TTS";
import ReaderSearchButton from "@/components/ReaderSearchButton";
import ReaderModeTabs, {
  type ReaderMode,
} from "@/components/readerui/ReaderModeTabs";
import ThreeLinesButton, {
  type ReaderChapter,
} from "@/components/threelinesbutton";
import { Box } from "@/components/ui/box";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  getPdfById,
  markPdfOpened,
  updatePdfProgress,
} from "@/database/pdfRepository";
import {
  getCachedPdfExtraction,
  savePdfExtraction,
} from "@/database/pdfExtractionRepository";
import type { PdfDocument } from "@/database/types";
import { useScreenRotation } from "@/hooks/screenRotation";
import { useSwitchHighlight, type PdfPageSize } from "@/hooks/switchhighlight";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  extractPdfDocumentRange,
  isPdfEngineLinked,
  type ExtractedPdfBlock,
  type ExtractedPdfDocument,
} from "@/modules/bic-pdf-reader";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, useColorScheme, View } from "react-native";
import Reanimated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  cancelActiveBookTranslation,
  isBookTranslationCancellation,
  translateAnchorText,
  translatePdfBlocks,
} from "@/services/translationService";
import { normalizeReaderBlocks } from "@/services/readerTypography";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";

function isVisibleReaderBlock(block: ExtractedPdfBlock) {
  if (block.hiddenInReader) return false;
  const normalized = block.text.toLowerCase();
  const isPrepressMarker =
    normalized.includes(".qxp") ||
    normalized.startsWith("aronson rdg_") ||
    (normalized.includes("_ch") && normalized.includes(" page "));
  return !isPrepressMarker;
}

function firstMissingPageIndex(
  document: ExtractedPdfDocument | null | undefined,
) {
  if (!document) return 0;
  const loaded = new Set(document.pages.map((page) => page.page));
  for (let page = 1; page <= document.pageCount; page += 1) {
    if (!loaded.has(page)) return page - 1;
  }
  return document.pageCount;
}

function outlineTranslationBlocks(
  items: PdfOutlineItem[],
  path = "outline",
): ExtractedPdfBlock[] {
  return items.flatMap((item, index) => {
    const chapterId = `${path}-${index}-${item.page}`;
    const block: ExtractedPdfBlock = {
      id: `toc-${chapterId}`,
      kind: "heading",
      text: item.title,
      page: item.page,
      sourceBounds: { left: 0, top: 0, right: 0, bottom: 0 },
      wordBounds: [],
      readingOrder: index,
      confidence: 1,
      hiddenInReader: true,
    };
    return [
      block,
      ...outlineTranslationBlocks(item.children ?? [], `${path}-${index}`),
    ];
  });
}

const FIRST_READER_PAGE_BATCH = 1;
const WARM_READER_PAGE_COUNT = 5;
const BACKGROUND_READER_PAGE_BATCH = 16;
const TRANSLATION_WORK_CHUNK = 80;
const TRANSLATION_PRIORITY_CHUNK = 56;
const TRANSLATION_PRIORITY_RADIUS = 12;
const CHAPTER_EXTRACTION_PAGES_ABOVE = 3;
const CHAPTER_EXTRACTION_PAGE_COUNT = 7;
const TRANSLATION_PREFETCH_DISTANCE = 7;
const EXTRACTION_CACHE_PAGE_INTERVAL = 32;

function BookPageSkeleton() {
  const lineWidths = [
    "w-full",
    "w-[94%]",
    "w-[98%]",
    "w-[88%]",
    "w-full",
    "w-[92%]",
    "w-[96%]",
    "w-[84%]",
    "w-full",
    "w-[90%]",
    "w-[97%]",
    "w-[72%]",
  ];

  return (
    <View className="flex-1 bg-white px-6 py-8 dark:bg-[#151814]">
      <Skeleton
        speed={2}
        startColor="bg-[#E7E3D8]"
        className="mb-8 h-7 w-[58%] rounded-md"
      />
      <View className="gap-4">
        {lineWidths.map((width, index) => (
          <Skeleton
            key={`${width}-${index}`}
            speed={2}
            startColor="bg-[#E7E3D8]"
            className={`h-3.5 rounded-full ${width}`}
          />
        ))}
      </View>
      <View className="mt-10 gap-4">
        {lineWidths.slice(0, 7).map((width, index) => (
          <Skeleton
            key={`second-${width}-${index}`}
            speed={2}
            startColor="bg-[#E7E3D8]"
            className={`h-3.5 rounded-full ${width}`}
          />
        ))}
      </View>
    </View>
  );
}

export default function ReaderScreen() {
  const { pdfId } = useLocalSearchParams<{ pdfId?: string }>();
  const db = useSQLiteContext();
  const readerTransition = useReaderSettingsStore((state) => state.transition);
  const hideTopBarOnScroll = useReaderSettingsStore(
    (state) => state.hideTopBarOnScroll,
  );
  const lineGuideEnabled = useReaderSettingsStore(
    (state) => state.lineGuideEnabled,
  );
  const wordGuideEnabled = useReaderSettingsStore(
    (state) => state.wordGuideEnabled,
  );
  const readerGuideEnabled = lineGuideEnabled || wordGuideEnabled;
  const [readerChromeHidden, setReaderChromeHidden] = useState(false);
  const isDark = useColorScheme() === "dark";
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [headerVisibility] = useState(() => new Animated.Value(1));
  const [activeTab, setActiveTab] = useState<ReaderMode>("reader");
  const [translationLanguage, setTranslationLanguage] =
    useState<TranslationLanguage>();
  const [translatedBlocks, setTranslatedBlocks] = useState<ExtractedPdfBlock[]>([]);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationPriorityVersion, setTranslationPriorityVersion] = useState(0);
  const [translationRestartWaitingPage, setTranslationRestartWaitingPage] =
    useState<number | null>(null);
  const [translatedChapterRequest, setTranslatedChapterRequest] = useState<{
    sourcePage: number;
    resolvedPage?: number;
    nonce: number;
  } | null>(null);
  const [hasVisitedOriginal, setHasVisitedOriginal] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [readerBlocks, setReaderBlocks] = useState<ExtractedPdfBlock[]>([]);
  const [readerPageSizes, setReaderPageSizes] = useState<
    Record<number, PdfPageSize>
  >({});
  const [readerLoading, setReaderLoading] = useState(true);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerPageCount, setReaderPageCount] = useState(0);
  const [readerContentReady, setReaderContentReady] = useState(false);
  const readerSkeletonOpacity = useSharedValue(1);
  const [, setReaderCurrentPage] = useState(1);
  const [readerDisplayCurrentPage, setReaderDisplayCurrentPage] = useState(1);
  const [readerDisplayPageCount, setReaderDisplayPageCount] = useState(0);
  const [readerChapterPageMap, setReaderChapterPageMap] = useState<
    Record<number, number>
  >({});
  const [translatedChapterPageMap, setTranslatedChapterPageMap] = useState<
    Record<number, number>
  >({});
  const [originalCurrentPage, setOriginalCurrentPage] = useState(1);
  const [originalPageCount, setOriginalPageCount] = useState(0);
  const [originalDestination, setOriginalDestination] = useState<{
    page: number;
    nonce: number;
  } | null>(null);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [readerDestination, setReaderDestination] = useState<{
    page: number;
    readerPage?: number;
    blockId?: string;
    searchQuery?: string;
    searchMatchIndex?: number;
    switchHighlightOffset?: number;
    switchHighlightWordIndex?: number;
    nonce: number;
  } | null>(null);
  const [readerSwitchHighlight, setReaderSwitchHighlight] = useState<{
    blockId: string;
    offset: number;
    nonce: number;
  } | null>(null);
  const [translatedDestination, setTranslatedDestination] = useState<{
    page: number;
    readerPage?: number;
    blockId?: string;
    switchHighlightWordIndex?: number;
    switchHighlightWordProgress?: number;
    switchHighlightQuery?: string;
    nonce: number;
  } | null>(null);
  const readerExtractionStarted = React.useRef(false);
  const requestedExtractionPages = React.useRef<number[]>([]);
  const requestedTranslationPage = React.useRef<number | null>(null);
  const latestTranslatedChapterRequest = React.useRef<number | null>(null);
  const translatedBlockCache = React.useRef(
    new Map<string, ExtractedPdfBlock>(),
  );
  const translationQueue = React.useRef<Promise<void>>(Promise.resolve());
  const translationPublishTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scheduledTranslationLanguage = React.useRef<string | null>(null);
  const activeTranslationLanguage = React.useRef<string | null>(null);
  const translationCancellationRequested = React.useRef(false);
  const translationSourceLanguage = React.useRef<string | undefined>(undefined);
  const latestReaderBlocks = React.useRef(readerBlocks);
  const latestPdfOutline = React.useRef(pdfOutline);
  const latestReaderPageSizes = React.useRef(readerPageSizes);
  const latestReaderPageCount = React.useRef(readerPageCount);
  const { reportVisibleBlock, target: switchHighlightTarget } =
    useSwitchHighlight(readerBlocks, readerPageSizes);

  useScreenRotation(setIsLandscape);

  activeTranslationLanguage.current = translationLanguage?.code ?? null;
  latestReaderBlocks.current = readerBlocks;
  latestPdfOutline.current = pdfOutline;
  latestReaderPageSizes.current = readerPageSizes;
  latestReaderPageCount.current = readerPageCount;

  useEffect(() => {
    translationSourceLanguage.current = undefined;
  }, [pdfId]);

  useEffect(() => {
    if (!translationLanguage) {
      setTranslatedBlocks([]);
      setTranslatedChapterRequest(null);
      setTranslationLoading(false);
      setTranslationError(null);
      return;
    }

    const languageCode = translationLanguage.code;
    const publishTranslatedBlocks = () => {
      const latestBlocks = latestReaderBlocks.current;
      const blocksByPage = new Map<number, ExtractedPdfBlock[]>();
      latestBlocks
        .filter((block) => block.text.trim().length > 0)
        .forEach((block) => {
          const pageBlocks = blocksByPage.get(block.page);
          if (pageBlocks) pageBlocks.push(block);
          else blocksByPage.set(block.page, [block]);
        });
      const completedBlocks: ExtractedPdfBlock[] = [];
      const orderedPages = [...blocksByPage.keys()].sort((a, b) => a - b);
      for (const page of orderedPages) {
        const pageBlocks = blocksByPage.get(page) ?? [];
        const translatedPage = pageBlocks.flatMap((block) => {
          const translated = translatedBlockCache.current.get(
            `${languageCode}:${block.id}`,
          );
          return translated ? [translated] : [];
        });
        if (translatedPage.length === pageBlocks.length) {
          completedBlocks.push(...translatedPage);
        }
      }
      setTranslatedBlocks((current) => {
        if (
          current.length === completedBlocks.length &&
          current.at(-1)?.id === completedBlocks.at(-1)?.id
        ) {
          return current;
        }
        return completedBlocks;
      });
    };
    const scheduleTranslatedPublish = () => {
      if (translationPublishTimer.current) return;
      translationPublishTimer.current = setTimeout(() => {
        translationPublishTimer.current = null;
        if (activeTranslationLanguage.current === languageCode) {
          publishTranslatedBlocks();
        }
      }, 180);
    };
    publishTranslatedBlocks();
    setTranslationLoading(true);
    setTranslationError(null);

    // A running worker reads the latest refs on every pass, so extraction and
    // outline updates do not enqueue stale copies of the whole document.
    if (scheduledTranslationLanguage.current === languageCode) return;
    scheduledTranslationLanguage.current = languageCode;

    translationQueue.current = translationQueue.current
      .catch(() => undefined)
      .then(async () => {
        while (activeTranslationLanguage.current === languageCode) {
          const latestContentBlocks = latestReaderBlocks.current;
          const firstContentPage = latestContentBlocks[0]?.page;
          const warmContentBlocks = firstContentPage === undefined
            ? []
            : latestContentBlocks.filter(
                (block) => block.page <= firstContentPage + 1,
              );
          const warmContentIds = new Set(
            warmContentBlocks.map((block) => block.id),
          );
          const allSourceBlocks = [
            ...warmContentBlocks,
            ...outlineTranslationBlocks(latestPdfOutline.current),
            ...latestContentBlocks.filter(
              (block) => !warmContentIds.has(block.id),
            ),
          ];
          let missingBlocks = allSourceBlocks.filter(
            (block) =>
              block.text.trim().length > 0 &&
              !translatedBlockCache.current.has(`${languageCode}:${block.id}`),
          );

          const hasTranslatedContent = latestContentBlocks.some((block) =>
            translatedBlockCache.current.has(`${languageCode}:${block.id}`),
          );
          if (!hasTranslatedContent && firstContentPage !== undefined) {
            missingBlocks = missingBlocks.filter(
              (block) =>
                !block.id.startsWith("toc-") &&
                block.page === firstContentPage,
            );
          }

          const priorityPage = requestedTranslationPage.current;
          if (priorityPage !== null) {
            const contentBlocks = missingBlocks.filter(
              (block) => !block.id.startsWith("toc-"),
            );
            const allNearbyBlocks = contentBlocks
              .filter(
                (block) =>
                  Math.abs(block.page - priorityPage) <=
                  TRANSLATION_PRIORITY_RADIUS,
              )
              .sort((a, b) => {
                const distanceDifference =
                  Math.abs(a.page - priorityPage) -
                  Math.abs(b.page - priorityPage);
                return distanceDifference || a.page - b.page;
              });
            const nearbyBlocks = allNearbyBlocks.slice(
              0,
              TRANSLATION_PRIORITY_CHUNK,
            );
            const selectedIds = new Set(nearbyBlocks.map((block) => block.id));
            const sequentialBlocks = [
              ...contentBlocks.filter((block) => !selectedIds.has(block.id)),
              ...missingBlocks.filter((block) => block.id.startsWith("toc-")),
            ];
            missingBlocks = [...nearbyBlocks, ...sequentialBlocks];

          }
          missingBlocks = missingBlocks.slice(0, TRANSLATION_WORK_CHUNK);

          if (missingBlocks.length === 0) break;
          await translatePdfBlocks(
            missingBlocks,
            languageCode,
            (batch) => {
              batch.forEach((block) => {
                const sourceId = block.id.replace(
                  `translated-${languageCode}-`,
                  "",
                );
                translatedBlockCache.current.set(
                  `${languageCode}:${sourceId}`,
                  block,
                );
              });

              if (activeTranslationLanguage.current === languageCode) {
                scheduleTranslatedPublish();
              }
            },
            translationSourceLanguage.current,
            (detectedLanguage) => {
              translationSourceLanguage.current = detectedLanguage;
            },
          );
        }

        if (activeTranslationLanguage.current === languageCode) {
          if (translationPublishTimer.current) {
            clearTimeout(translationPublishTimer.current);
            translationPublishTimer.current = null;
          }
          publishTranslatedBlocks();
          const extractionIsComplete =
            latestReaderPageCount.current > 0 &&
            Object.keys(latestReaderPageSizes.current).length >=
              latestReaderPageCount.current;
          setTranslationLoading(!extractionIsComplete);
        }
      })
      .catch((error) => {
        if (activeTranslationLanguage.current !== languageCode) return;
        if (
          translationCancellationRequested.current ||
          isBookTranslationCancellation(error)
        ) {
          setTranslationLoading(true);
          return;
        }
        setTranslationError(
          error instanceof Error
            ? error.message
            : "Unable to translate this document.",
        );
        setTranslatedChapterRequest(null);
        setTranslationLoading(false);
      })
      .finally(() => {
        if (scheduledTranslationLanguage.current === languageCode) {
          scheduledTranslationLanguage.current = null;
        }
      });
  }, [
    pdfOutline,
    readerBlocks,
    translationLanguage,
    translationPriorityVersion,
  ]);

  useEffect(() => {
    if (
      translationRestartWaitingPage === null ||
      !readerPageSizes[translationRestartWaitingPage]
    ) {
      return;
    }
    setTranslationRestartWaitingPage(null);
    setTranslationPriorityVersion((version) => version + 1);
  }, [readerPageSizes, translationRestartWaitingPage]);

  useEffect(
    () => () => {
      if (translationPublishTimer.current) {
        clearTimeout(translationPublishTimer.current);
      }
    },
    [],
  );

  const translatedAvailablePageCount = useMemo(() => {
    if (!translationLanguage || translatedBlocks.length === 0) return 0;
    const prefix = `translated-${translationLanguage.code}-`;
    const translatedSourceIds = new Set(
      translatedBlocks.map((block) => block.id.replace(prefix, "")),
    );
    const sourceBlocksByPage = new Map<number, ExtractedPdfBlock[]>();
    readerBlocks
      .filter((block) => block.text.trim().length > 0)
      .forEach((block) => {
        const pageBlocks = sourceBlocksByPage.get(block.page);
        if (pageBlocks) pageBlocks.push(block);
        else sourceBlocksByPage.set(block.page, [block]);
      });

    let highestCompletedPage = 0;
    sourceBlocksByPage.forEach((pageBlocks, page) => {
      if (pageBlocks.every((block) => translatedSourceIds.has(block.id))) {
        highestCompletedPage = Math.max(highestCompletedPage, page);
      }
    });
    return highestCompletedPage;
  }, [readerBlocks, translatedBlocks, translationLanguage]);

  useEffect(() => {
    if (!translatedChapterRequest || translatedChapterRequest.resolvedPage) {
      return;
    }

    const sourcePage = translatedChapterRequest.sourcePage;
    if (!readerPageSizes[sourcePage]) return;

    const sourcePageHasText = readerBlocks.some(
      (block) => block.page === sourcePage && block.text.trim().length > 0,
    );
    const translatedPages = new Set(translatedBlocks.map((block) => block.page));
    let resolvedPage: number | undefined;

    if (sourcePageHasText) {
      const nearbySourcePages = [
        ...new Set(
          readerBlocks
            .filter(
              (block) =>
                block.text.trim().length > 0 &&
                Math.abs(block.page - sourcePage) <=
                  CHAPTER_EXTRACTION_PAGES_ABOVE,
            )
            .map((block) => block.page),
        ),
      ];
      const previousPage = nearbySourcePages
        .filter((page) => page < sourcePage)
        .sort((a, b) => b - a)[0];
      const nextPage = nearbySourcePages
        .filter((page) => page > sourcePage)
        .sort((a, b) => a - b)[0];
      const neighborhoodIsReady =
        translatedPages.has(sourcePage) &&
        (previousPage === undefined || translatedPages.has(previousPage)) &&
        (nextPage === undefined || translatedPages.has(nextPage));
      if (neighborhoodIsReady) resolvedPage = sourcePage;
    } else {
      resolvedPage = [...translatedPages]
        .filter(
          (page) =>
            Math.abs(page - sourcePage) <= TRANSLATION_PRIORITY_RADIUS,
        )
        .sort((a, b) => {
          const distance =
            Math.abs(a - sourcePage) - Math.abs(b - sourcePage);
          return distance || a - b;
        })[0];
    }

    if (resolvedPage === undefined) return;
    const nonce = translatedChapterRequest.nonce;
    setTranslatedChapterRequest((current) =>
      current?.nonce === nonce ? { ...current, resolvedPage } : current,
    );
    setTranslatedDestination({ page: resolvedPage, nonce: Date.now() });
  }, [
    readerBlocks,
    readerPageSizes,
    translatedBlocks,
    translatedChapterRequest,
  ]);

  const handleTranslatedPageChange = useCallback((page: number) => {
    setReaderCurrentPage(page);
    requestedTranslationPage.current = page;
    const pageCount = latestReaderPageCount.current;
    const extractionCandidates = [
      Math.max(1, page - TRANSLATION_PREFETCH_DISTANCE),
      Math.min(pageCount, page + TRANSLATION_PREFETCH_DISTANCE),
    ];
    extractionCandidates.forEach((candidate) => {
      if (
        candidate > 0 &&
        !latestReaderPageSizes.current[candidate] &&
        !requestedExtractionPages.current.includes(candidate)
      ) {
        requestedExtractionPages.current.push(candidate);
      }
    });
    if (
      activeTranslationLanguage.current &&
      scheduledTranslationLanguage.current === null
    ) {
      setTranslationPriorityVersion((version) => version + 1);
    }
    setTranslatedChapterRequest((current) =>
      current?.resolvedPage === page ? null : current,
    );
  }, []);

  useEffect(() => {
    readerSkeletonOpacity.value = withTiming(readerContentReady ? 0 : 1, {
      duration: readerContentReady ? 140 : 0,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [readerContentReady, readerSkeletonOpacity]);

  const readerSkeletonStyle = useAnimatedStyle(() => ({
    opacity: readerSkeletonOpacity.value,
  }));

  useEffect(() => {
    let cancelled = false;

    const loadTimer = setTimeout(() => {
      void (async () => {
        try {
          if (!pdfId) {
            throw new Error("No PDF was selected.");
          }

          const storedPdf = await getPdfById(db, pdfId);

          if (!storedPdf) {
            throw new Error("This PDF is no longer in your library.");
          }

          await markPdfOpened(db, pdfId);

          if (!cancelled) {
            setPdf(storedPdf);
            setLoadError(null);
          }
        } catch (error) {
          if (!cancelled) {
            setLoadError(
              error instanceof Error ? error.message : "Unable to load PDF.",
            );
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
    };
  }, [db, pdfId]);

  useEffect(() => {
    if (!pdf || !pdfId || readerExtractionStarted.current) {
      return;
    }
    readerExtractionStarted.current = true;
    let cancelled = false;
    const extractionTimer = setTimeout(() => {
      setReaderLoading(true);
      setReaderError(null);

      void (async () => {
        try {
          let document = await getCachedPdfExtraction(db, pdfId);

          const publish = (value: ExtractedPdfDocument) => {
            if (!cancelled) {
              setReaderBlocks(
                normalizeReaderBlocks(
                  value.pages.flatMap((page) =>
                    page.blocks.filter(isVisibleReaderBlock),
                  ),
                ),
              );
              setReaderPageCount(value.pageCount);
              setReaderPageSizes(
                Object.fromEntries(
                  value.pages.map((page) => [
                    page.page,
                    {
                      width: page.width,
                      height: page.height,
                    },
                  ]),
                ),
              );
              setReaderLoading(false);
            }
          };

          if (document?.pages.length) publish(document);

          let nextPage = firstMissingPageIndex(document);
          let pageCount = document?.pageCount ?? Number.MAX_SAFE_INTEGER;
          let lastSavedPageCount = document?.pages.length ?? 0;

          while (!cancelled && nextPage < pageCount) {
            let requestedPage: number | null = null;
            while (
              requestedPage === null &&
              requestedExtractionPages.current.length > 0
            ) {
              const candidate = requestedExtractionPages.current.shift()!;
              if (!document?.pages.some((page) => page.page === candidate)) {
                requestedPage = candidate;
              }
            }
            const requestIsMissing = requestedPage !== null;
            const firstPage = requestedPage !== null
              ? Math.max(
                  0,
                  requestedPage - 1 - CHAPTER_EXTRACTION_PAGES_ABOVE,
                )
              : nextPage;

            const extractedPageCount = document?.pages.length ?? 0;
            const batchSize =
              requestIsMissing
                ? CHAPTER_EXTRACTION_PAGE_COUNT
                : extractedPageCount === 0 && firstPage === 0
                ? FIRST_READER_PAGE_BATCH
                : firstPage < WARM_READER_PAGE_COUNT
                  ? WARM_READER_PAGE_COUNT - firstPage
                  : BACKGROUND_READER_PAGE_BATCH;
            const chunk = await extractPdfDocumentRange(
              pdf.uri,
              firstPage,
              batchSize,
            );
            const pagesByNumber = new Map(
              document?.pages.map((page) => [page.page, page]) ?? [],
            );
            chunk.pages.forEach((page) => pagesByNumber.set(page.page, page));
            document = {
              pageCount: chunk.pageCount,
              pages: Array.from(pagesByNumber.values()).sort(
                (a, b) => a.page - b.page,
              ),
            };
            pageCount = document.pageCount;
            nextPage = firstMissingPageIndex(document);
            publish(document);
            const shouldSaveExtraction =
              document.pages.length - lastSavedPageCount >=
                EXTRACTION_CACHE_PAGE_INTERVAL ||
              nextPage >= pageCount;
            if (shouldSaveExtraction) {
              await savePdfExtraction(db, pdfId, document);
              lastSavedPageCount = document.pages.length;
            }

            if (chunk.pages.length === 0) break;
            await new Promise<void>((resolve) => setTimeout(resolve, 16));
          }
        } catch (error) {
          if (!cancelled) {
            setReaderError(
              error instanceof Error
                ? error.message
                : "Unable to create Reader Mode.",
            );
          }
        } finally {
          if (!cancelled) setReaderLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(extractionTimer);
    };
  }, [db, pdf, pdfId]);

  useEffect(() => {
    const animation = Animated.timing(headerVisibility, {
      toValue: isLandscape || readerChromeHidden ? 0 : 1,
      duration: 140,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [headerVisibility, isLandscape, readerChromeHidden]);

  const handleTabChange = (value: ReaderMode) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value !== "reader") setReaderChromeHidden(false);
    if (value === "original") setHasVisitedOriginal(true);
    if (value === "reader") {
      // Returning from Original must not navigate the horizontal reader. Its
      // FlatList has remained mounted and already owns the exact reading
      // offset. Highlight the mapped word independently of navigation.
      setReaderDestination(null);
    }
    if (switchHighlightTarget && value === "reader") {
      setReaderSwitchHighlight({
        blockId: switchHighlightTarget.blockId,
        offset: switchHighlightTarget.blockOffset,
        nonce: Date.now(),
      });
    }
    if (switchHighlightTarget && value === "translated" && translationLanguage) {
      const destinationBase = {
        page: switchHighlightTarget.page,
        blockId: `translated-${translationLanguage.code}-${switchHighlightTarget.blockId}`,
        switchHighlightWordIndex: switchHighlightTarget.wordIndex,
        switchHighlightWordProgress:
          switchHighlightTarget.sourceWordCount > 1
            ? switchHighlightTarget.wordIndex /
              (switchHighlightTarget.sourceWordCount - 1)
            : 0,
        nonce: Date.now(),
      };
      setTranslatedDestination(destinationBase);

      const sourceLanguage = translationSourceLanguage.current;
      if (!translationLoading && sourceLanguage && switchHighlightTarget.word) {
        const sourceWord = switchHighlightTarget.word.replace(
          /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
          "",
        );
        if (sourceWord) {
          void translateAnchorText(
            sourceWord,
            translationLanguage.code,
            sourceLanguage,
          )
            .then((translatedWord) => {
              if (!translatedWord) return;
              setTranslatedDestination({
                ...destinationBase,
                switchHighlightQuery: translatedWord,
                nonce: Date.now(),
              });
            })
            .catch(() => undefined);
        }
      }
    }
    setActiveTab(value);
  };

  useEffect(() => {
    // A newly activated guide starts in the reader's current visible frame.
    // Scrolling can hide the chrome afterward through the callback below.
    setReaderChromeHidden(false);
  }, [
    activeTab,
    hideTopBarOnScroll,
    readerGuideEnabled,
    readerTransition,
  ]);

  const handleReaderToolbarVisibilityChange = useCallback(
    (visible: boolean) => {
      if (
        activeTab === "reader" &&
        (hideTopBarOnScroll ||
          readerTransition === "pager" ||
          readerGuideEnabled)
      ) {
        setReaderChromeHidden(!visible);
      }
    },
    [activeTab, hideTopBarOnScroll, readerGuideEnabled, readerTransition],
  );

  const handleTranslationLanguageChange = (language?: TranslationLanguage) => {
    setTranslationLanguage(language);
    if (!language && activeTab === "translated") {
      setHasVisitedOriginal(true);
      setActiveTab("original");
    }
  };

  const handlePageChanged = useCallback(
    (page: number, totalPages: number) => {
      setOriginalCurrentPage(page);
      setOriginalPageCount(totalPages);
      if (pdfId) {
        void updatePdfProgress(db, pdfId, page, totalPages);
      }
    },
    [db, pdfId],
  );

  const readerChapters = useMemo<ReaderChapter[]>(() => {
    const pageMap = activeTab === "reader"
      ? readerChapterPageMap
      : activeTab === "translated"
        ? translatedChapterPageMap
        : null;
    const convert = (
      items: PdfOutlineItem[],
      path = "outline",
    ): ReaderChapter[] =>
      items.map((item, index) => {
        const chapterId = `${path}-${index}-${item.page}`;
        const translatedTitle =
          activeTab === "translated" && translationLanguage
            ? translatedBlockCache.current.get(
                `${translationLanguage.code}:toc-${chapterId}`,
              )?.text
            : undefined;
        return {
          id: chapterId,
          title: translatedTitle || item.title,
          page: pageMap?.[item.page] ?? item.page,
          sourcePage: item.page,
          children: convert(item.children ?? [], `${path}-${index}`),
        };
      });
    return convert(pdfOutline);
  }, [
    activeTab,
    pdfOutline,
    readerChapterPageMap,
    translatedBlocks,
    translatedChapterPageMap,
    translationLanguage,
  ]);

  const updateReaderChapterPageMap = useCallback(
    (setPageMap: React.Dispatch<React.SetStateAction<Record<number, number>>>) =>
      (next: Record<number, number>) => {
        setPageMap((current) => {
          const currentKeys = Object.keys(current);
          const nextKeys = Object.keys(next);
          if (
            currentKeys.length === nextKeys.length &&
            nextKeys.every((key) => current[Number(key)] === next[Number(key)])
          ) return current;
          return next;
        });
      },
    [],
  );
  const handleReaderChapterPageMapChange = useMemo(
    () => updateReaderChapterPageMap(setReaderChapterPageMap),
    [updateReaderChapterPageMap],
  );
  const handleTranslatedChapterPageMapChange = useMemo(
    () => updateReaderChapterPageMap(setTranslatedChapterPageMap),
    [updateReaderChapterPageMap],
  );

  const handleOutlineChanged = useCallback((outline: PdfOutlineItem[]) => {
    setPdfOutline(outline);
  }, []);

  const handleReaderPagination = useCallback(
    (current: number, total: number) => {
      setReaderDisplayCurrentPage(current);
      setReaderDisplayPageCount(total);
    },
    [],
  );

  const visiblePage =
    activeTab === "original" ? originalCurrentPage : readerDisplayCurrentPage;
  const visiblePageCount =
    activeTab === "original"
      ? originalPageCount || pdf?.totalPages || readerPageCount
      : readerDisplayPageCount || readerPageCount;
  const navigationCurrentPage =
    activeTab === "original" ? originalCurrentPage : readerDisplayCurrentPage;
  const displayPdfName = pdf?.name.replace(/\.pdf$/i, "") ?? "";

  const goToReaderPage = useCallback(
    (
      page: number,
      blockId?: string,
      searchQuery?: string,
      searchMatchIndex?: number,
    ) => {
      requestedExtractionPages.current.push(page);
      setActiveTab("reader");
      setReaderDestination({
        page,
        blockId,
        searchQuery,
        searchMatchIndex,
        nonce: Date.now(),
      });
    },
    [],
  );

  const goToNavigationPage = useCallback(
    (page: number, blockId?: string) => {
      if (activeTab === "original") {
        setOriginalDestination({ page, nonce: Date.now() });
        return;
      }
      if (activeTab === "translated") {
        const requestNonce = Date.now();
        const lastSourcePage =
          latestReaderPageCount.current ||
          page + TRANSLATION_PREFETCH_DISTANCE;
        latestTranslatedChapterRequest.current = requestNonce;
        requestedExtractionPages.current = [
          page,
          Math.max(1, page - TRANSLATION_PREFETCH_DISTANCE),
          Math.min(lastSourcePage, page + TRANSLATION_PREFETCH_DISTANCE),
        ];
        requestedTranslationPage.current = page;
        setTranslationRestartWaitingPage(null);
        setTranslatedDestination(null);
        setTranslatedChapterRequest({
          sourcePage: page,
          nonce: requestNonce,
        });
        translationCancellationRequested.current = true;
        void cancelActiveBookTranslation().finally(() => {
          const activeQueue = translationQueue.current;
          void activeQueue.finally(() => {
            if (latestTranslatedChapterRequest.current !== requestNonce) return;
            translationCancellationRequested.current = false;
            const chapterIsExtracted = Boolean(
              latestReaderPageSizes.current[page],
            );
            if (chapterIsExtracted) {
              setTranslationPriorityVersion((version) => version + 1);
            } else {
              setTranslationRestartWaitingPage(page);
            }
          });
        });
        return;
      }
      goToReaderPage(page, blockId);
    },
    [activeTab, goToReaderPage],
  );

  const goToDisplayedPage = useCallback(
    (page: number) => {
      if (activeTab === "original") {
        setOriginalDestination({ page, nonce: Date.now() });
        return;
      }

      if (readerTransition !== "pager") {
        setReaderDisplayCurrentPage(page);
        if (activeTab === "translated") {
          setTranslatedDestination({ page, nonce: Date.now() });
        } else {
          goToReaderPage(page);
        }
        return;
      }

      const destination = {
        page: 1,
        readerPage: page,
        nonce: Date.now(),
      };
      if (activeTab === "translated") {
        setTranslatedDestination(destination);
      } else {
        setReaderDestination(destination);
      }
    },
    [activeTab, goToReaderPage, readerTransition],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F5EC] dark:bg-[#10120F]">
        <ActivityIndicator size="large" color="#8fb996" />
      </View>
    );
  }

  if (!pdf || loadError) {
    return (
      <View className="flex-1 bg-[#F7F5EC] px-6 pt-12 dark:bg-[#10120F]">
        <BackButton />
        <View className="flex-1 items-center justify-center pb-20">
          <Text className="text-center font-lato-bold text-lg text-black dark:text-[#F4F5F1]">
            PDF unavailable
          </Text>
          <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
            {loadError ?? "Unable to find this PDF."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Box className="flex-1 bg-[#F7F5EC] dark:bg-[#10120F]">
      <StatusBar
        animated
        hidden={
          activeTab === "reader" &&
          readerChromeHidden &&
          (hideTopBarOnScroll ||
            readerTransition === "pager" ||
            readerGuideEnabled)
        }
        style="auto"
      />
      <Animated.View
        pointerEvents={isLandscape ? "none" : "auto"}
        accessibilityElementsHidden={isLandscape}
        importantForAccessibility={isLandscape ? "no-hide-descendants" : "auto"}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          zIndex: 50,
          height: isLandscape ? 0 : headerHeight || undefined,
          overflow: "hidden",
          backgroundColor: isDark ? "#151814" : "#ffffff",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isDark ? "#343A31" : "#deddd7",
          transform: [{
            translateY: headerVisibility.interpolate({
              inputRange: [0, 1],
              outputRange: [-Math.max(headerHeight, 120), 0],
            }),
          }],
        }}
      >
        <Animated.View
          className="pt-12"
          style={{ minHeight: 128 }}
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height;

            if (Math.abs(measuredHeight - headerHeight) > 0.5) {
              setHeaderHeight(measuredHeight);
            }
          }}
        >
          <View className="relative h-14 w-full items-center justify-center px-5">
            <View className="absolute left-4 top-1/2 -translate-y-1/2">
              <BackButton />
            </View>

            <View className="absolute right-4 top-1/2 -translate-y-1/2 flex-row">
                <ReaderSearchButton
                  blocks={readerBlocks}
                  grouped
                  onSelectResult={(page, blockId, query, matchIndex) =>
                    goToReaderPage(page, blockId, query, matchIndex)
                  }
                />
                <ThreeLinesButton
                  chapters={readerChapters}
                  currentPage={navigationCurrentPage}
                  grouped
                  totalPages={visiblePageCount}
                  onGoToPage={goToDisplayedPage}
                  onGoToChapter={(chapter) =>
                    goToNavigationPage(
                      chapter.sourcePage ?? chapter.page,
                      chapter.blockId,
                    )
                  }
                />
            </View>

            <View
              style={
                translationLanguage
                  ? { transform: [{ translateX: -12 }] }
                  : undefined
              }
            >
              <ReaderModeTabs
                value={activeTab}
                onValueChange={handleTabChange}
                showTranslated={Boolean(translationLanguage)}
              />
            </View>
          </View>
          {visiblePageCount > 0 && (
            <View className="absolute bottom-[6px] left-0 right-0 flex-row items-center px-5">
              <Text
                className="mr-4 flex-1 font-lato-bold text-xs text-[#83877e]"
                numberOfLines={1}
              >
                {displayPdfName}
              </Text>
              <Text className="min-w-14 text-right font-lato-bold text-xs text-[#6d716a]">
                {visiblePage}/{visiblePageCount}
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      <View className="flex-1 overflow-hidden">
        <Animated.View
          pointerEvents={
            activeTab === "original" ||
            (activeTab === "reader" && readerBlocks.length === 0)
              ? "auto"
              : "none"
          }
          style={{
            position: "absolute",
            top: isLandscape ? 0 : headerHeight,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: activeTab === "original" ? 2 : 0,
          }}
        >
          <OriginalPDF
            pdfUri={pdf.uri}
            fileSize={pdf.size}
            initialPage={pdf.currentPage || 1}
            destination={originalDestination}
            onPageChanged={handlePageChanged}
            onOutlineChanged={handleOutlineChanged}
            highlightTarget={
              activeTab === "original" ? switchHighlightTarget : null
            }
          />
        </Animated.View>

        <Animated.View
          pointerEvents={activeTab === "translated" ? "auto" : "none"}
          style={{
            position: "absolute",
            top: isLandscape ? 0 : headerHeight,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: activeTab === "translated" ? 2 : 0,
          }}
        >
          {translatedBlocks.length > 0 ? (
            <ReaderView
              key={`translated-${translationLanguage?.code ?? "unknown"}`}
              isActive={activeTab === "translated"}
              isLandscape={isLandscape}
              blocks={translatedBlocks}
              pageCount={translatedAvailablePageCount}
              sourcePageCount={readerPageCount}
              destination={translatedDestination}
              onPageChange={handleTranslatedPageChange}
              onPaginationChange={handleReaderPagination}
              onPageMapChange={handleTranslatedChapterPageMapChange}
              showSwitchHighlight={activeTab === "translated"}
              translationLanguage={translationLanguage}
              onTranslationLanguageChange={handleTranslationLanguageChange}
              useTranslatedTextDirection
            />
          ) : translationError ? (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]">
              <Text className="text-center font-lato-bold text-lg text-black dark:text-[#F4F5F1]">
                Translation unavailable
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                {translationError}
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]">
              <ActivityIndicator size="large" color="#8fb996" />
              <Text className="mt-4 text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">
                Translating the first page to {translationLanguage?.label}…
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                iOS may ask to download the required language models.
              </Text>
            </View>
          )}
          {translationLoading && translatedBlocks.length > 0 && (
            <View className="absolute right-4 top-4 rounded-full bg-white/90 p-2 shadow-sm dark:bg-[#1A1E18]/90">
              <ActivityIndicator size="small" color="#4f936b" />
            </View>
          )}
          {translatedChapterRequest && (
            <View className="absolute inset-0 z-50 items-center justify-center bg-[#F7F5EC]/95 px-8 dark:bg-[#10120F]/95">
              <ActivityIndicator size="large" color="#4f936b" />
              <Text className="mt-4 text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">
                {readerPageSizes[translatedChapterRequest.sourcePage]
                  ? "Translating this chapter…"
                  : "Preparing this chapter…"}
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                Preparing page {translatedChapterRequest.sourcePage} and the
                pages around it.
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View
          pointerEvents={
            activeTab === "reader" && readerContentReady ? "auto" : "none"
          }
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: activeTab === "reader" ? 2 : 0,
          }}
        >
          {readerBlocks.length > 0 ? (
            <View style={{ flex: 1 }}>
              <ReaderView
                isActive={activeTab === "reader"}
                isLandscape={isLandscape}
                headerOverlayHeight={isLandscape ? 0 : headerHeight}
                topBarVisible={isLandscape || !readerChromeHidden}
                blocks={readerBlocks}
                pageCount={readerPageCount}
                destination={readerDestination}
                stationarySwitchHighlight={readerSwitchHighlight}
                onPageChange={setReaderCurrentPage}
                onPaginationChange={handleReaderPagination}
                onPageMapChange={handleReaderChapterPageMapChange}
                onSwitchAnchorChange={reportVisibleBlock}
                showSwitchHighlight={
                  hasVisitedOriginal && activeTab === "reader"
                }
                onReady={() => setReaderContentReady(true)}
                onToolbarVisibilityChange={handleReaderToolbarVisibilityChange}
                translationLanguage={translationLanguage}
                onTranslationLanguageChange={handleTranslationLanguageChange}
              />
            </View>
          ) : readerLoading ? (
            <View className="flex-1 bg-transparent">
              <Text className="hidden">
                Preparing a comfortable reading version…
              </Text>
            </View>
          ) : readerError ? (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]">
              <Text className="text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">
                Reader Mode is not ready
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                {readerError}
              </Text>
              {!isPdfEngineLinked && (
                <Text className="mt-3 text-center text-xs text-black/40 dark:text-white/40">
                  Install the iOS development build containing the Rust
                  extraction engine.
                </Text>
              )}
            </View>
          ) : (
            <View className="flex-1 bg-[#F7F5EC] dark:bg-[#10120F]" />
          )}
          {!readerError && (
            <Reanimated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, readerSkeletonStyle]}
            >
              <BookPageSkeleton />
            </Reanimated.View>
          )}
        </Animated.View>
      </View>
    </Box>
  );
}
