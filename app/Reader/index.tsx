import BackButton from "@/components/Backbutton";
import OriginalPDF from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
import ThreeLinesButton from "@/components/threelinesbutton";
import { Box } from "@/components/ui/box";
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
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  extractPdfDocumentRange,
  isPdfEngineLinked,
  type ExtractedPdfBlock,
  type ExtractedPdfDocument,
} from "@/modules/bic-pdf-reader";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, View } from "react-native";

function isVisibleReaderBlock(block: ExtractedPdfBlock) {
  if (block.hiddenInReader) return false;
  const normalized = block.text.toLowerCase();
  const isPrepressMarker = normalized.includes(".qxp")
    || normalized.startsWith("aronson rdg_")
    || (normalized.includes("_ch") && normalized.includes(" page "));
  return !isPrepressMarker;
}

export default function ReaderScreen() {
  const { pdfId } = useLocalSearchParams<{ pdfId?: string }>();
  const db = useSQLiteContext();
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [headerVisibility] = useState(() => new Animated.Value(1));
  const [activeTab, setActiveTab] = useState("reader");
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [readerBlocks, setReaderBlocks] = useState<ExtractedPdfBlock[]>([]);
  const [readerLoading, setReaderLoading] = useState(true);
  const [readerError, setReaderError] = useState<string | null>(null);
  const readerExtractionStarted = React.useRef(false);

  useScreenRotation(setIsLandscape);

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
              setReaderLoading(false);
            }
          };

          if (document?.pages.length) publish(document);

          let nextPage = document?.pages.reduce(
            (highest, page) => Math.max(highest, page.page),
            0,
          ) ?? 0;
          let pageCount = document?.pageCount ?? Number.MAX_SAFE_INTEGER;

          while (!cancelled && nextPage < pageCount) {
            const chunk = await extractPdfDocumentRange(pdf.uri, nextPage, 40);
            const pagesByNumber = new Map(
              document?.pages.map((page) => [page.page, page]) ?? [],
            );
            chunk.pages.forEach((page) => pagesByNumber.set(page.page, page));
            document = {
              pageCount: chunk.pageCount,
              pages: Array.from(pagesByNumber.values()).sort((a, b) => a.page - b.page),
            };
            pageCount = document.pageCount;
            nextPage = document.pages.reduce(
              (highest, page) => Math.max(highest, page.page),
              0,
            );
            await savePdfExtraction(db, pdfId, document);
            publish(document);

            if (chunk.pages.length === 0) break;
          }
        } catch (error) {
          if (!cancelled) {
            setReaderError(error instanceof Error ? error.message : "Unable to create Reader Mode.");
          }
        } finally {
          if (!cancelled) setReaderLoading(false);
        }
      })();
    }, 150);

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
    setActiveTab(value);
  };

  const handlePageChanged = useCallback(
    (page: number, totalPages: number) => {
      if (pdfId) {
        void updatePdfProgress(db, pdfId, page, totalPages);
      }
    },
    [db, pdfId],
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

              <Box className="absolute right-2 top-1/2 -translate-y-1/2">
                <ThreeLinesButton />
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
        </View>
      </Animated.View>

      <View className="flex-1 overflow-hidden">
        <View
          pointerEvents={activeTab === "original" ? "auto" : "none"}
          style={{ position: "absolute", inset: 0, opacity: activeTab === "original" ? 1 : 0 }}
        >
          <OriginalPDF
            pdfUri={pdf.uri}
            initialPage={pdf.currentPage || 1}
            onPageChanged={handlePageChanged}
          />
        </View>

        <View
          pointerEvents={activeTab === "reader" ? "auto" : "none"}
          style={{ position: "absolute", inset: 0, opacity: activeTab === "reader" ? 1 : 0 }}
        >
          {readerBlocks.length > 0 ? (
            <ReaderView isLandscape={isLandscape} blocks={readerBlocks} />
          ) : readerLoading ? (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8">
              <ActivityIndicator size="large" color="#8fb996" />
              <Text className="mt-4 text-center text-sm text-black/60">
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
        </View>
      </View>
    </Box>
  );
}
