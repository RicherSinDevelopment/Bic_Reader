import type { ExtractedPdfDocument } from "@/modules/bic-pdf-reader";

/** Yield between slow OCR pages so a new navigation can take priority. */
export function extractionRangeForDocument(
  document: ExtractedPdfDocument | null,
  requestedPage: number | null,
  firstPage: number,
  batchSize: number,
) {
  const usesOcr = document?.pages.some(page => page.ocrPerformed || page.requiresOcr);
  return usesOcr
    ? { firstPage: requestedPage === null ? firstPage : Math.max(0, requestedPage - 1), batchSize: 1 }
    : { firstPage, batchSize };
}

/** Warm the reading neighborhood before resuming whole-book extraction. */
export function nextOcrPrefetchPage(document: ExtractedPdfDocument | null, focus: number) {
  if (!document?.pages.some(page => page.ocrPerformed || page.requiresOcr)) return null;
  const loaded = new Set(document.pages.map(page => page.page));
  // Prefer forward reading, but keep a few previous pages ready too.
  for (const offset of [0, 1, 2, 3, -1, 4, 5, -2, 6, 7, -3, 8]) {
    const page = focus + offset;
    if (page >= 1 && page <= document.pageCount && !loaded.has(page)) return page;
  }
  return null;
}

/** Horizontal requests from an old window must not delay the visible window. */
export function prioritizeHorizontalRequests(queue: number[], focus: number) {
  return [...new Set(queue)].filter(page => Math.abs(page - focus) <= 20)
    .sort((a, b) => Math.abs(a - focus) - Math.abs(b - focus) || b - a);
}

/** Explicit navigation is pending before the viewport/canonical anchor moves. */
export function extractionFocusPage(
  desired: { sourcePage: number } | null | undefined,
  current: { sourcePage: number } | null | undefined,
) {
  return desired?.sourcePage ?? current?.sourcePage ?? 1;
}
