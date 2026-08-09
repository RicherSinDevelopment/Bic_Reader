import BackButton from "@/components/Backbutton";
import OriginalPDF, { type PdfOutlineItem } from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
import ReaderSearchButton from "@/components/ReaderSearchButton";
import ThreeLinesButton, { type ReaderChapter } from "@/components/threelinesbutton";
import { Box } from "@/components/ui/box";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsTrigger,
  TabsTriggerText,
} from "@/components/ui/tabs";
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
  const isPrepressMarker = normalized.includes(".qxp")
    || normalized.startsWith("aronson rdg_")
    || (normalized.includes("_ch") && normalized.includes(" page "));
  return !isPrepressMarker;
}

function firstMissingPageIndex(document: ExtractedPdfDocument | null | undefined) {
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
    "w-full", "w-[94%]", "w-[98%]", "w-[88%]", "w-full", "w-[92%]",
    "w-[96%]", "w-[84%]", "w-full", "w-[90%]", "w-[97%]", "w-[72%]",
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
  const [activeTab, setActiveTab] = useState("reader");
  const [hasVisitedOriginal, setHasVisitedOriginal] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [readerBlocks, setReaderBlocks] = useState<ExtractedPdfBlock[]>([]);
  const [readerPageSizes, setReaderPageSizes] = useState<Record<number, PdfPageSize>>({});
  const [readerLoading, setReaderLoading] = useState(true);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerPageCount, setReaderPageCount] = useState(0);
  const [readerContentReady, setReaderContentReady] = useState(false);
  const readerContentOpacity = useSharedValue(0);
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
  const { reportVisibleBlock, target: switchHighlightTarget } = useSwitchHighlight(
    readerBlocks,
    readerPageSizes,
  );

  useScreenRotation(setIsLandscape);

  useEffect(() => {
    readerContentOpacity.value = withTiming(readerContentReady ? 1 : 0, {
      duration: readerContentReady ? 180 : 0,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    readerSkeletonOpacity.value = withTiming(readerContentReady ? 0 : 1, {
      duration: readerContentReady ? 140 : 0,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [readerContentOpacity, readerContentReady, readerSkeletonOpacity]);

  const readerContentStyle = useAnimatedStyle(() => ({
    opacity: readerContentOpacity.value,
  }));
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
              setReaderBlocks(value.pages.flatMap((page) =>
                page.blocks.filter(isVisibleReaderBlock),
              ));
              setReaderPageCount(value.pageCount);
              setReaderPageSizes(Object.fromEntries(
                value.pages.map((page) => [page.page, {
                  width: page.width,
                  height: page.height,
                }]),
              ));
              setReaderLoading(false);
            }
          };

          if (document?.pages.length) publish(document);

          let nextPage = firstMissingPageIndex(document);
          let pageCount = document?.pageCount ?? Number.MAX_SAFE_INTEGER;

          while (!cancelled && nextPage < pageCount) {
            const requestedPage = requestedExtractionPage.current;
            const requestIsMissing = requestedPage !== null &&
              !document?.pages.some((page) => page.page === requestedPage);
            const firstPage = requestIsMissing ? requestedPage - 1 : nextPage;
            if (requestIsMissing) requestedExtractionPage.current = null;

            const extractedPageCount = document?.pages.length ?? 0;
            const batchSize = extractedPageCount === 0 && firstPage === 0
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
              pages: Array.from(pagesByNumber.values()).sort((a, b) => a.page - b.page),
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
            setReaderError(error instanceof Error ? error.message : "Unable to create Reader Mode.");
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

  const handleTabChange = (value: string) => {
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
    const convert = (items: PdfOutlineItem[], path = "outline"): ReaderChapter[] =>
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

  const handleReaderPagination = useCallback((current: number, total: number) => {
    setReaderDisplayCurrentPage(current);
    setReaderDisplayPageCount(total);
  }, []);

  const visiblePage = activeTab === "original"
    ? originalCurrentPage
    : readerDisplayCurrentPage;
  const visiblePageCount = activeTab === "original"
    ? (originalPageCount || pdf?.totalPages || readerPageCount)
    : (readerDisplayPageCount || readerPageCount);
  const navigationCurrentPage = activeTab === "original"
    ? originalCurrentPage
    : readerCurrentPage;

  const goToReaderPage = useCallback((
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
  }, []);

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
          height: headerHeight
            ? headerVisibility.interpolate({
                inputRange: [0, 1],
                outputRange: [0, headerHeight],
              })
            : undefined,
          overflow: "hidden",
          transform: [
            {
              translateY: headerVisibility.interpolate({
                inputRange: [0, 1],
                outputRange: [-Math.max(headerHeight, 120), 0],
              }),
            },
          ],
        }}
      >
        <View
          className="pb-4 pt-12"
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height;

            if (measuredHeight > headerHeight) {
              setHeaderHeight(measuredHeight);
            }
          }}
        >
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            variant="filled"
            className="w-full"
          >
            <Box className="relative w-full items-center">
              <Box className="absolute left-2 top-1/2 -translate-y-1/2">
                <BackButton />
              </Box>

              <Box className="absolute right-2 top-1/2 -translate-y-1/2 flex-row gap-2">
                <ReaderSearchButton
                  blocks={readerBlocks}
                  onSelectResult={(page, blockId, query, matchIndex) =>
                    goToReaderPage(page, blockId, query, matchIndex)
                  }
                />
                <ThreeLinesButton
                  chapters={readerChapters}
                  currentPage={navigationCurrentPage}
                  totalPages={visiblePageCount}
                  onGoToPage={(page) => goToReaderPage(page)}
                  onGoToChapter={(chapter) => goToReaderPage(chapter.page, chapter.blockId)}
                />
              </Box>

              <TabsList className="rounded-xl p-2">
                <TabsTrigger value="reader" className="px-6 py-3">
                  <TabsTriggerText>Reader</TabsTriggerText>
                </TabsTrigger>

                <TabsTrigger value="original" className="px-6 py-3">
                  <TabsTriggerText>Original</TabsTriggerText>
                </TabsTrigger>

                <TabsIndicator />
              </TabsList>
            </Box>
          </Tabs>
          {visiblePageCount > 0 && (
            <Text className="mt-2 text-center font-lato-bold text-xs text-black/55">
              {visiblePage} of {visiblePageCount}
            </Text>
          )}
        </View>
      </Animated.View>

      <View className="flex-1 overflow-hidden">
        <View
          pointerEvents={
            activeTab === "original" ||
              (activeTab === "reader" && readerBlocks.length === 0)
              ? "auto"
              : "none"
          }
          style={{
            position: "absolute",
            inset: 0,
            opacity: 1,
          }}
        >
          <OriginalPDF
            pdfUri={pdf.uri}
            fileSize={pdf.size}
            initialPage={pdf.currentPage || 1}
            onPageChanged={handlePageChanged}
            onOutlineChanged={handleOutlineChanged}
            highlightTarget={activeTab === "original" ? switchHighlightTarget : null}
          />
        </View>

        <View
          pointerEvents={
            activeTab === "reader" && readerContentReady ? "auto" : "none"
          }
          style={{ position: "absolute", inset: 0, opacity: activeTab === "reader" ? 1 : 0 }}
        >
          {readerBlocks.length > 0 ? (
            <Reanimated.View
              style={[{ flex: 1 }, readerContentStyle]}
            >
              <ReaderView
                isLandscape={isLandscape}
                blocks={readerBlocks}
                pageCount={readerPageCount}
                destination={readerDestination}
                onPageChange={setReaderCurrentPage}
                onPaginationChange={handleReaderPagination}
                onSwitchAnchorChange={reportVisibleBlock}
                showSwitchHighlight={hasVisitedOriginal && activeTab === "reader"}
                onReady={() => setReaderContentReady(true)}
              />
            </Reanimated.View>
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
                  Install the iOS development build containing the Rust extraction engine.
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
        </View>
      </View>
    </Box>
  );
}
