import type { SwitchHighlightTarget } from "@/hooks/switchhighlight";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfRef } from "react-native-pdf";

type UsePdfKitHighlightOptions = {
  documentKey: string;
  target?: SwitchHighlightTarget | null;
  color?: string;
  requestId?: number;
  viewportKey?: string;
};

function hexToRgb(color: string) {
  const normalized = color.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;
  const parsed = /^[0-9a-f]{6}$/i.test(expanded)
    ? Number.parseInt(expanded, 16)
    : 0xf59e0b;
  return {
    red: ((parsed >> 16) & 0xff) / 255,
    green: ((parsed >> 8) & 0xff) / 255,
    blue: (parsed & 0xff) / 255,
  };
}

function isFiniteBounds(target: SwitchHighlightTarget) {
  const { left, top, right, bottom } = target.sourceBounds;
  const { width, height } = target.pageSize;

  return (
    Number.isFinite(target.page) &&
    target.page >= 1 &&
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    Number.isFinite(right) &&
    Number.isFinite(bottom) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    right > left &&
    bottom > top &&
    width > 0 &&
    height > 0
  );
}

/**
 * Keeps the temporary Reader-to-Original highlight in sync with PDFKit.
 * The native command scales the extractor's top-left crop-box coordinates
 * into PDFKit page coordinates, draws a temporary marker, and scrolls it into
 * view. The marker does not depend on the PDF having selectable PDFKit text.
 */
export function usePdfKitHighlight({
  documentKey,
  target,
  color = "#F59E0B",
  requestId,
  viewportKey,
}: UsePdfKitHighlightOptions) {
  const pdfRef = useRef<PdfRef>(null);
  const [documentReady, setDocumentReady] = useState(false);
  const lastAppliedKey = useRef<string | null>(null);

  useEffect(() => {
    setDocumentReady(false);
    lastAppliedKey.current = null;
  }, [documentKey]);

  const markDocumentReady = useCallback(() => {
    setDocumentReady(true);
  }, []);

  const clearHighlight = useCallback(() => {
    if (lastAppliedKey.current === null) return;

    pdfRef.current?.clearHighlight();
    lastAppliedKey.current = null;
  }, []);

  useEffect(() => {
    if (!documentReady) return;

    if (!target || !isFiniteBounds(target)) {
      clearHighlight();
      return;
    }

    if (!viewportKey) return;
    const { left, top, right, bottom } = target.sourceBounds;
    const { width, height } = target.pageSize;
    const { red, green, blue } = hexToRgb(color);
    const nextKey = [
      requestId, viewportKey,
      target.page,
      left,
      top,
      right,
      bottom,
      width,
      height,
      color,
    ].join(":");
    if (lastAppliedKey.current === nextKey) return;

    const frame = requestAnimationFrame(() => {
      pdfRef.current?.setHighlight(
        target.page,
        left,
        top,
        right,
        bottom,
        width,
        height,
        red,
        green,
        blue,
      );
      lastAppliedKey.current = nextKey;
    });

    return () => cancelAnimationFrame(frame);
  }, [clearHighlight, color, documentReady, target, requestId, viewportKey]);

  return {
    clearHighlight,
    markDocumentReady,
    pdfRef,
  };
}
