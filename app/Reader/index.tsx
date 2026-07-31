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
import type { PdfDocument } from "@/database/types";
import { useScreenRotation } from "@/hooks/screenRotation";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, View } from "react-native";

export default function ReaderScreen() {
  const { pdfId } = useLocalSearchParams<{ pdfId?: string }>();
  const db = useSQLiteContext();
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [headerVisibility] = useState(() => new Animated.Value(1));
  const [activeTab, setActiveTab] = useState("original");
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);

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

      <View className="flex-1">
        {activeTab === "reader" ? (
          <ReaderView isLandscape={isLandscape} />
        ) : (
          <OriginalPDF
            pdfUri={pdf.uri}
            initialPage={pdf.currentPage || 1}
            onPageChanged={handlePageChanged}
          />
        )}
      </View>
    </Box>
  );
}
