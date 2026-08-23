import { Text } from "@/components/ui/text";
import type { SwitchHighlightTarget } from "@/hooks/switchhighlight";
import { usePdfKitHighlight } from "@/hooks/usePdfKitHighlight";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import Pdf, { type TableContent } from "react-native-pdf";

type OriginalPdfProps = {
  pdfUri: string;
  fileSize?: number;
  initialPage?: number;
  onPageChanged?: (page: number, totalPages: number) => void;
  onOutlineChanged?: (outline: PdfOutlineItem[]) => void;
  highlightTarget?: SwitchHighlightTarget | null;
  outlineOnly?: boolean;
  destination?: { page: number; nonce: number } | null;
};

export type PdfOutlineItem = {
  title: string;
  page: number;
  children: PdfOutlineItem[];
};

function convertOutline(items?: TableContent[]): PdfOutlineItem[] {
  return (items ?? [])
    .map((item) => ({
      title: item.title.trim(),
      page: Math.max(1, Number(item.pageIdx) + 1),
      children: convertOutline(item.children),
    }))
    .filter((item) => item.title.length > 0);
}

function getErrorMessage(error: object) {
  if (error instanceof Error) return error.message;
  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Preview unavailable.";
}

export default function OriginalPDF({
  pdfUri,
  initialPage = 1,
  onPageChanged,
  onOutlineChanged,
  highlightTarget,
  outlineOnly = false,
  destination,
}: OriginalPdfProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isDark = useColorScheme() === "dark";
  const source = useMemo(() => ({ uri: pdfUri, cache: false }), [pdfUri]);
  const { markDocumentReady, pdfRef } = usePdfKitHighlight({
    documentKey: pdfUri,
    target: highlightTarget,
  });

  useEffect(() => {
    setErrorMessage(null);
    setLoading(true);
  }, [pdfUri]);

  useEffect(() => {
    if (loading || !destination) return;
    pdfRef.current?.setPage(Math.max(1, destination.page));
  }, [destination, loading, pdfRef]);

  const handleLoadComplete = useCallback(
    (
      totalPages: number,
      _path: string,
      _size: { height: number; width: number },
      tableContents?: TableContent[],
    ) => {
      setLoading(false);
      markDocumentReady();
      onOutlineChanged?.(convertOutline(tableContents));
      onPageChanged?.(Math.max(1, initialPage), totalPages);
    },
    [initialPage, markDocumentReady, onOutlineChanged, onPageChanged],
  );

  if (errorMessage) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]">
        <Text className="text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">
          Could not open this PDF
        </Text>
        <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
          {errorMessage}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-[#F7F5EC] dark:bg-[#10120F]"
      pointerEvents={outlineOnly ? "none" : "auto"}
    >
      {loading && !outlineOnly && (
        <View className="absolute inset-0 z-10 items-center justify-center bg-[#F7F5EC] dark:bg-[#10120F]">
          <ActivityIndicator size="large" color="#8fb996" />
        </View>
      )}

      <Pdf
        ref={pdfRef}
        source={source}
        page={Math.max(1, destination?.page ?? initialPage)}
        horizontal={false}
        enablePaging={false}
        fitPolicy={0}
        minScale={1}
        maxScale={5}
        spacing={8}
        trustAllCerts={false}
        enableDoubleTapZoom
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={!outlineOnly}
        scrollEnabled={!outlineOnly}
        onLoadComplete={handleLoadComplete}
        onPageChanged={onPageChanged}
        onError={(error) => {
          console.error("Failed to display PDF with PDFKit:", error);
          setLoading(false);
          setErrorMessage(getErrorMessage(error));
        }}
        renderActivityIndicator={() => (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#8fb996" />
          </View>
        )}
        style={{
          flex: 1,
          width: "100%",
          backgroundColor: isDark ? "#10120F" : "#F7F5EC",
          opacity: outlineOnly ? 0 : 1,
        }}
      />
    </View>
  );
}
