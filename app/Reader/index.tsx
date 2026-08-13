import BackButton from "@/components/Backbutton";
import OriginalPDF, { type PdfOutlineItem } from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
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
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  extractPdfDocumentRange,
  isPdfEngineLinked,
  type ExtractedPdfBlock,
  type ExtractedPdfDocument,
} from "@/modules/bic-pdf-reader";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import Reanimated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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

const FIRST_READER_PAGE_BATCH = 1;
const WARM_READER_PAGE_COUNT = 5;
const BACKGROUND_READER_PAGE_BATCH = 16;

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
    <View className="flex-1 bg-white px-6 py-8">
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
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [headerVisibility] = useState(() => new Animated.Value(1));
  const [activeTab, setActiveTab] = useState<ReaderMode>("reader");
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
  const [readerCurrentPage, setReaderCurrentPage] = useState(1);
  const [readerDisplayCurrentPage, setReaderDisplayCurrentPage] = useState(1);
  const [readerDisplayPageCount, setReaderDisplayPageCount] = useState(0);
  const [originalCurrentPage, setOriginalCurrentPage] = useState(1);
  const [originalPageCount, setOriginalPageCount] = useState(0);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [readerDestination, setReaderDestination] = useState<{
    page: number;
    blockId?: string;
    searchQuery?: string;
    searchMatchIndex?: number;
    nonce: number;
  } | null>(null);
  const readerExtractionStarted = React.useRef(false);
  const requestedExtractionPage = React.useRef<number | null>(null);
  const { reportVisibleBlock, target: switchHighlightTarget } =
    useSwitchHighlight(readerBlocks, readerPageSizes);

  useScreenRotation(setIsLandscape);

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
                value.pages.flatMap((page) =>
                  page.blocks.filter(isVisibleReaderBlock),
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

          while (!cancelled && nextPage < pageCount) {
            const requestedPage = requestedExtractionPage.current;
            const requestIsMissing =
              requestedPage !== null &&
              !document?.pages.some((page) => page.page === requestedPage);
            const firstPage = requestIsMissing ? requestedPage - 1 : nextPage;
            if (requestIsMissing) requestedExtractionPage.current = null;

            const extractedPageCount = document?.pages.length ?? 0;
            const batchSize =
              extractedPageCount === 0 && firstPage === 0
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
            await savePdfExtraction(db, pdfId, document);
            publish(document);

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
      toValue: isLandscape ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    });

    animation.start();
    return () => animation.stop();
  }, [headerVisibility, isLandscape]);

  const handleTabChange = (value: ReaderMode) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value === "original") setHasVisitedOriginal(true);
    setActiveTab(value);
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
    const convert = (
      items: PdfOutlineItem[],
      path = "outline",
    ): ReaderChapter[] =>
      items.map((item, index) => ({
        id: `${path}-${index}-${item.page}`,
        title: item.title,
        page: item.page,
        children: convert(item.children ?? [], `${path}-${index}`),
      }));
    return convert(pdfOutline);
  }, [pdfOutline]);

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
    activeTab === "original" ? originalCurrentPage : readerCurrentPage;
  const readingProgress =
    visiblePageCount > 0
      ? Math.max(0, Math.min(1, visiblePage / visiblePageCount))
      : 0;

  const goToReaderPage = useCallback(
    (
      page: number,
      blockId?: string,
      searchQuery?: string,
      searchMatchIndex?: number,
    ) => {
      requestedExtractionPage.current = page;
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

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F5EC]">
        <ActivityIndicator size="large" color="#8fb996" />
      </View>
    );
  }

  if (!pdf || loadError) {
    return (
      <View className="flex-1 bg-[#F7F5EC] px-6 pt-12">
        <BackButton />
        <View className="flex-1 items-center justify-center pb-20">
          <Text className="text-center font-lato-bold text-lg text-black">
            PDF unavailable
          </Text>
          <Text className="mt-2 text-center text-sm text-black/50">
            {loadError ?? "Unable to find this PDF."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Box className="flex-1">
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
          backgroundColor: "#ffffff",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "#deddd7",
          transform: [{ translateY: isLandscape ? -Math.max(headerHeight, 120) : 0 }],
        }}
      >
        <Animated.View
          className="pb-3 pt-12"
          style={{ minHeight: 148 }}
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height;

            if (measuredHeight > headerHeight) {
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
                  onGoToPage={(page) => goToReaderPage(page)}
                  onGoToChapter={(chapter) =>
                    goToReaderPage(chapter.page, chapter.blockId)
                  }
                />
            </View>

            <ReaderModeTabs value={activeTab} onValueChange={handleTabChange} />
          </View>
          {visiblePageCount > 0 && (
            <View className="absolute bottom-3 left-0 right-0 flex-row items-center px-5">
              <Text
                className="mr-4 flex-1 font-lato-bold text-xs text-[#83877e]"
                numberOfLines={1}
              >
                {pdf.name}
              </Text>
              <View
                accessible
                accessibilityLabel={`${Math.round(readingProgress * 100)} percent read`}
                className="mr-3 h-1.5 w-24 overflow-hidden rounded-full bg-[#e9ebe8]"
              >
                <View
                  className="h-full rounded-full bg-[#4f936b]"
                  style={{ width: `${readingProgress * 100}%` }}
                />
              </View>
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
            onPageChanged={handlePageChanged}
            onOutlineChanged={handleOutlineChanged}
            highlightTarget={
              activeTab === "original" ? switchHighlightTarget : null
            }
          />
        </Animated.View>

        <Animated.View
          pointerEvents={
            activeTab === "reader" && readerContentReady ? "auto" : "none"
          }
          style={{
            position: "absolute",
            top: isLandscape ? 0 : headerHeight,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: activeTab === "reader" ? 2 : 0,
          }}
        >
          {readerBlocks.length > 0 ? (
            <View style={{ flex: 1 }}>
              <ReaderView
                isLandscape={isLandscape}
                blocks={readerBlocks}
                pageCount={readerPageCount}
                destination={readerDestination}
                onPageChange={setReaderCurrentPage}
                onPaginationChange={handleReaderPagination}
                onSwitchAnchorChange={reportVisibleBlock}
                showSwitchHighlight={
                  hasVisitedOriginal && activeTab === "reader"
                }
                onReady={() => setReaderContentReady(true)}
              />
            </View>
          ) : readerLoading ? (
            <View className="flex-1 bg-transparent">
              <Text className="hidden">
                Preparing a comfortable reading version…
              </Text>
            </View>
          ) : readerError ? (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8">
              <Text className="text-center font-lato-bold text-base text-black">
                Reader Mode is not ready
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50">
                {readerError}
              </Text>
              {!isPdfEngineLinked && (
                <Text className="mt-3 text-center text-xs text-black/40">
                  Install the iOS development build containing the Rust
                  extraction engine.
                </Text>
              )}
            </View>
          ) : (
            <View className="flex-1 bg-[#F7F5EC]" />
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
