import ThreeDotsButton from "@/components/pdfcardcomponent/Threedotsbutton";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { WebView } from "react-native-webview";

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
  /** Render a horizontal result row for compact lists such as search. */
  compact?: boolean;
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

// HTML shell that loads pdf.js from CDN, renders page 1 of the embedded
// base64 PDF onto a canvas, and posts the resulting PNG data URL back
// to React Native. Runs entirely inside the WebView — no native module.
function buildRendererHtml(base64Pdf: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body style="margin:0;padding:0;">
  <script>
    const post = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));

    function base64ToUint8Array(base64) {
      const raw = atob(base64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return arr;
    }

    async function renderFirstPage() {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const data = base64ToUint8Array("${base64Pdf}");
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const page = await pdf.getPage(1);

        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        post({ type: "success", dataUrl });
      } catch (err) {
        post({ type: "error", message: String(err) });
      }
    }

    renderFirstPage();
  </script>
</body>
</html>
`;
}

export default function PdfCoverCard({
  pdfPath,
  fileName,
  dateOpened,
  completionPercentage,
  width = 220,
  onDelete,
  onRename,
  compact = false,
}: PdfCoverCardProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const hasRendered = useRef(false);

  const height = Math.round(width * 1.3);

  useEffect(() => {
    let cancelled = false;

    async function loadPdfAsHtml() {
      try {
        const base64 = await FileSystem.readAsStringAsync(pdfPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!cancelled) setHtml(buildRendererHtml(base64));
      } catch (e) {
        console.log("Failed to read PDF as base64:", e);
        if (!cancelled) setError(true);
      }
    }

    loadPdfAsHtml();
    return () => {
      cancelled = true;
    };
  }, [pdfPath]);

  const displayName = fileName
    ? stripPdfExtension(fileName)
    : deriveFileName(pdfPath);
  const clampedPercent = Math.max(0, Math.min(100, completionPercentage));

  const coverPreview = (
    <>
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
            <Text className="text-xs text-white/40">Preview unavailable</Text>
          )}
        </View>
      )}

      {html && !thumbnailUri && !error && (
        <View style={{ width: 0, height: 0, opacity: 0 }}>
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            javaScriptEnabled
            onMessage={(event) => {
              if (hasRendered.current) return;
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "success") {
                  hasRendered.current = true;
                  setThumbnailUri(data.dataUrl);
                } else {
                  console.log("pdf.js render error:", data.message);
                  setError(true);
                }
              } catch (e) {
                console.log("Failed to parse WebView message:", e);
                setError(true);
              }
            }}
          />
        </View>
      )}
    </>
  );

  if (compact) {
    return (
      <View className="h-28 flex-row items-center rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
        <View className="min-w-0 flex-1 px-1 pr-5">
          <Text
            numberOfLines={2}
            className="font-lato-bold text-base text-black"
          >
            {displayName}
          </Text>
          <Text className="mt-2 text-sm text-gray-400">
            Added {formatDateOpened(dateOpened)}
          </Text>
        </View>

        <View className="h-20 w-14 overflow-hidden rounded-lg bg-black">
          {coverPreview}
        </View>
      </View>
    );
  }

  return (
    <View style={{ width }}>
      {/* Cover card */}
      <View
        style={{ width, height }}
        className="rounded-2xl overflow-hidden bg-black shadow-lg"
      >
        {coverPreview}

        {/* Progress bar glued to the bottom edge of the cover */}
        <Progress
          value={clampedPercent}
          className="absolute bottom-0 left-0 right-0 rounded-none bg-white/10"
        >
          <ProgressFilledTrack className="bg-[#8fb996]" />
        </Progress>
      </View>

      {/* Meta row: name, completion %, date opened */}
      <View className="mt-2 flex-row items-start">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-lato-bold text-black text-sm">
            {displayName}
          </Text>
          <View className="mt-0.5 flex-row items-center justify-between">
            <Text className="text-gray-400 text-xs uppercase">
              {clampedPercent}%
            </Text>
            <Text numberOfLines={1} className="text-gray-400 text-xs">
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
