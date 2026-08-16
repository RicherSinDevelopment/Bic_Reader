import type { SwitchHighlightTarget } from "@/hooks/switchhighlight";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfRef } from "react-native-pdf";

type UsePdfKitHighlightOptions = {
  documentKey: string;
  target?: SwitchHighlightTarget | null;
};

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

    const { left, top, right, bottom } = target.sourceBounds;
    const { width, height } = target.pageSize;
    const nextKey = [
      target.page,
      left,
      top,
      right,
      bottom,
      width,
      height,
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
      );
      lastAppliedKey.current = nextKey;
    });

    return () => cancelAnimationFrame(frame);
  }, [clearHighlight, documentReady, target]);

  return {
    clearHighlight,
    markDocumentReady,
    pdfRef,
  };
}
