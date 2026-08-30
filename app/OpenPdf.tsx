import OpenWith from "@/components/OpenWith";
import type { PickedPdf } from "@/hooks/useDocumentPicker";
import { usePdfLibrary } from "@/hooks/usePdfLibrary";
import { FREE_PDF_LIMIT } from "@/lib/premiumFeatures";
import { useRevenueCat } from "@/providers/RevenueCatProvider";
import { useCallback } from "react";
import { ActivityIndicator, Text, View, useColorScheme } from "react-native";

export default function OpenPdfScreen() {
  const isDark = useColorScheme() === "dark";
  const { isPremium } = useRevenueCat();
  const { pdfs, importPdf, isLoading } = usePdfLibrary();

  const handleIncomingPdf = useCallback(
    async (pdf: PickedPdf) => {
      const allowNew = isPremium || pdfs.length < FREE_PDF_LIMIT;
      const result = await importPdf(pdf, { allowNew });

      if (result.status === "limit") return null;
      return result.status === "imported" ? result.pdf.id : result.pdfId;
    },
    [importPdf, isPremium, pdfs.length],
  );

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: isDark ? "#10120F" : "#F7F5EF" }}
    >
      {!isLoading ? <OpenWith onPdfReceived={handleIncomingPdf} /> : null}
      <ActivityIndicator color="#639922" size="large" />
      <Text className="mt-4 text-sm text-black/50 dark:text-white/50">
        Opening PDF…
      </Text>
    </View>
  );
}
