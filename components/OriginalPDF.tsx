import { Text } from "@/components/ui/text";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Pdf from "react-native-pdf";

type OriginalPdfProps = {
  pdfUri: string;
  initialPage?: number;
  onPageChanged?: (page: number, totalPages: number) => void;
};

export default function OriginalPDF({
  pdfUri,
  initialPage = 1,
  onPageChanged,
}: OriginalPdfProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const source = useMemo(
    () => ({ uri: pdfUri, cache: false }),
    [pdfUri],
  );

  if (errorMessage) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8">
        <Text className="text-center font-lato-bold text-base text-black">
          Could not open this PDF
        </Text>
        <Text className="mt-2 text-center text-sm text-black/50">
          {errorMessage}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F7F5EC]">
      <Pdf
        source={source}
        page={Math.max(1, initialPage)}
        trustAllCerts={false}
        enableDoubleTapZoom
        spacing={8}
        onPageChanged={onPageChanged}
        onError={(error) => {
          console.error("Failed to display PDF:", error);
          setErrorMessage(
            error instanceof Error ? error.message : "Preview unavailable.",
          );
        }}
        renderActivityIndicator={() => (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#8fb996" />
          </View>
        )}
        style={{ flex: 1, width: "100%", backgroundColor: "#F7F5EC" }}
      />
    </View>
  );
}
