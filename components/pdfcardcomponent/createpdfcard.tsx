import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import PdfThumbnail from "react-native-pdf-thumbnail";

interface PdfCoverCardProps {
  /** Local file path or content URI to the PDF (e.g. from expo-file-system) */
  pdfPath: string;
  /** Optional display name; derived from pdfPath if not provided */
  fileName?: string;
  /** When the document was last opened */
  dateOpened: Date | string;
  /** 0–100 */
  completionPercentage: number;
  /** Card width — height is derived to keep a page-like aspect ratio */
  width?: number;
}

function deriveFileName(path: string) {
  const withoutExt = path.split("/").pop()?.replace(/\.pdf$/i, "") ?? "Document";
  return withoutExt;
}

function formatDateOpened(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PdfCoverCard({
  pdfPath,
  fileName,
  dateOpened,
  completionPercentage,
  width = 220,
}: PdfCoverCardProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const height = Math.round(width * 1.3); // roughly A4-ish card ratio

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnail() {
      try {
        // Generates a bitmap of the first page of the PDF at pdfPath
        const { uri } = await PdfThumbnail.generate(pdfPath, 0);
        if (!cancelled) setThumbnailUri(uri);
      } catch (e) {
        console.log("PDF thumbnail generation failed:", e);
        if (!cancelled) setError(true);
      }
    }

    loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [pdfPath]);

  const displayName = fileName ?? deriveFileName(pdfPath);
  const clampedPercent = Math.max(0, Math.min(100, completionPercentage));

  return (
    <View style={{ width }}>
      {/* Cover card */}
      <View
        style={{ width, height }}
        className="rounded-2xl overflow-hidden bg-black shadow-lg"
      >
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-black">
            {!error ? (
              <ActivityIndicator color="#8fb996" />
            ) : (
              <Text className="text-white/40 text-xs">Preview unavailable</Text>
            )}
          </View>
        )}

        {/* Progress bar glued to the bottom edge of the cover */}
        <Progress
          value={clampedPercent}
          className="absolute bottom-0 left-0 right-0 rounded-none bg-white/10"
        >
          <ProgressFilledTrack className="bg-[#8fb996]" />
        </Progress>
      </View>

      {/* Meta row: name, completion %, date opened */}
      <View className="mt-2">
        <Text
          numberOfLines={1}
          className="font-lato-bold text-black text-sm"
        >
          {displayName}
        </Text>
        <View className="flex-row items-center justify-between mt-0.5">
          <Text className="text-gray-400 text-xs uppercase">
            {clampedPercent}% completed
          </Text>
          <Text className="text-gray-400 text-xs">
            {formatDateOpened(dateOpened)}
          </Text>
        </View>
      </View>
    </View>
  );
}