import ThreeDotsButton from "@/components/pdfcardcomponent/Threedotsbutton";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import {
  getCachedPdfThumbnail,
  getOrCreatePdfThumbnail,
} from "@/services/pdfThumbnailService";
import { memo, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";

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
  onDelete?: () => void;
  onRename?: (name: string) => void;
  onOpen?: () => void;
  /** Render a horizontal row for compact lists such as search. */
  compact?: boolean;
  /** Render a spacious library row with the cover on the left. */
  list?: boolean;
}

function deriveFileName(path: string) {
  const withoutExt =
    path
      .split("/")
      .pop()
      ?.replace(/\.pdf$/i, "") ?? "Document";
  return withoutExt;
}

function stripPdfExtension(name: string) {
  return name.replace(/\.pdf$/i, "");
}

function formatDateOpened(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PdfCoverCard({
  pdfPath,
  fileName,
  dateOpened,
  completionPercentage,
  width = 220,
  onDelete,
  onRename,
  onOpen,
  compact = false,
  list = false,
}: PdfCoverCardProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(() =>
    getCachedPdfThumbnail(pdfPath),
  );
  const [error, setError] = useState(false);

  const height = Math.round(width * 1.3); // roughly A4-ish card ratio

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnail() {
      try {
        const uri = await getOrCreatePdfThumbnail(pdfPath);

        if (!cancelled) {
          setThumbnailUri(uri);
        }
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

  const displayName = fileName
    ? stripPdfExtension(fileName)
    : deriveFileName(pdfPath);
  const clampedPercent = Math.max(0, Math.min(100, completionPercentage));

  if (list) {
    return (
      <View className="h-[132px] flex-row items-center rounded-[22px] border border-[#E5E5DB] bg-[#FFFDF8] p-3.5 shadow-sm dark:border-white/10 dark:bg-[#1A1E18]">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${displayName}`}
          onPress={onOpen}
          className="min-w-0 flex-1 flex-row items-center active:opacity-75"
        >
          <View className="h-24 w-[68px] overflow-hidden rounded-[14px] bg-[#1C211A] shadow-sm">
            {thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center bg-black">
                {!error ? (
                  <ActivityIndicator color="#8fb996" size="small" />
                ) : (
                  <Text className="px-1 text-center text-[10px] text-white/40">Unavailable</Text>
                )}
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1 px-4">
            <Text
              numberOfLines={2}
              className="font-lato-bold text-base leading-5 text-black dark:text-[#F4F5F1]"
            >
              {displayName}
            </Text>
            <Text className="mt-2 text-xs text-[#858C80]">
              Opened {formatDateOpened(dateOpened)}
            </Text>
            <View className="mt-3 flex-row items-center gap-3">
              <Progress value={clampedPercent} className="h-2 flex-1 bg-[#E4E8DD] dark:bg-white/10">
                <ProgressFilledTrack className="bg-[#639922]" />
              </Progress>
              <Text className="w-9 text-right text-xs text-gray-400">{clampedPercent}%</Text>
            </View>
          </View>
        </Pressable>

        {onDelete && onRename ? (
          <ThreeDotsButton
            fileName={displayName}
            onDelete={onDelete}
            onRename={onRename}
          />
        ) : null}
      </View>
    );
  }

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${displayName}`}
        onPress={onOpen}
        className="h-28 flex-row items-center rounded-2xl border border-black/5 bg-white p-3 shadow-sm active:opacity-80 dark:border-white/10 dark:bg-[#1A1E18]"
      >
        <View className="min-w-0 flex-1 px-1 pr-5">
          <Text
            numberOfLines={2}
            className="font-lato-bold text-base text-black dark:text-[#F4F5F1]"
          >
            {displayName}
          </Text>
          <Text className="mt-2 text-sm text-gray-400">
            {clampedPercent}% {formatDateOpened(dateOpened)}
          </Text>
        </View>

        <View className="h-20 w-14 overflow-hidden rounded-lg bg-black">
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
                <Text className="text-xs text-white/40">Unavailable</Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ width }}>
      {/* Cover card */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${displayName}`}
        onPress={onOpen}
        style={{ width, height }}
        className="overflow-hidden rounded-[22px] bg-[#1C211A] shadow-lg active:opacity-90"
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
          <ProgressFilledTrack className="bg-[#639922]" />
        </Progress>
      </Pressable>

      {/* Meta row: name, completion %, date opened */}
      <View className="mt-3 flex-row items-center px-0.5">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-lato-bold text-black text-sm dark:text-[#F4F5F1]">
            {displayName}
          </Text>
          <View className="flex-row items-center justify-between mt-0.5">
            <Text className="text-gray-400 text-xs uppercase">
              {clampedPercent}%
            </Text>
            <Text className="text-gray-400 text-xs">
              {formatDateOpened(dateOpened)}
            </Text>
          </View>
        </View>

        {onDelete && onRename && (
          <ThreeDotsButton
            fileName={displayName}
            onDelete={onDelete}
            onRename={onRename}
          />
        )}
      </View>
    </View>
  );
}

export default memo(PdfCoverCard);
