import type { ExtractedPdfDocument } from "@/modules/bic-pdf-reader";

export const MAX_NATIVE_PDF_PAGE = 65_535;

/** Return a safe, one-based source page or null for an unusable value. */
export function sanitizeSourcePage(page: number, pageCount?: number) {
  if (!Number.isFinite(page)) return null;
  const integerPage = Math.trunc(page);
  if (integerPage < 1) return null;
  const finitePageCount = Number.isFinite(pageCount)
    ? Math.max(1, Math.trunc(pageCount!))
    : MAX_NATIVE_PDF_PAGE;
  return Math.min(integerPage, finitePageCount, MAX_NATIVE_PDF_PAGE);
}

/** Seed a recreated reader runtime near its last known page, never page 1 by accident. */
export function readerRuntimeSeedBlocks<T extends { page: number }>(
  blocks: T[],
  focusPage?: number,
) {
  const firstAvailablePage = blocks[0]?.page ?? 1;
  const safeFocus = typeof focusPage === "number" &&
      Number.isFinite(focusPage) && focusPage >= 1
    ? Math.trunc(focusPage)
    : firstAvailablePage;
  const start = Math.max(1, safeFocus - 4);
  const end = safeFocus + 6;
  const focused = blocks.filter((block) => block.page >= start && block.page <= end);
  return focused.length > 0
    ? focused
    : blocks.filter((block) => block.page < firstAvailablePage + 5);
}

/** Validate values before Expo attempts to bridge JavaScript numbers to Swift. */
export function validateNativeExtractionRange(firstPage: number, maxPages: number) {
  if (!Number.isFinite(firstPage) || !Number.isInteger(firstPage) ||
      firstPage < 0 || firstPage > MAX_NATIVE_PDF_PAGE) {
    throw new RangeError("PDF extraction start page is invalid.");
  }
  if (!Number.isFinite(maxPages) || !Number.isInteger(maxPages) ||
      maxPages < 1 || maxPages > MAX_NATIVE_PDF_PAGE) {
    throw new RangeError("PDF extraction page count is invalid.");
  }
  return { firstPage, maxPages };
}

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

/** Deliver a jump target before its surrounding vertical-reader buffer. */
export function prioritizeVerticalBlocks<T extends { page: number }>(
  blocks: T[],
  focus: number,
) {
  return blocks
    .map((block, index) => ({ block, index }))
    .sort(
      (left, right) =>
        Math.abs(left.block.page - focus) -
          Math.abs(right.block.page - focus) ||
        left.block.page - right.block.page ||
        left.index - right.index,
    )
    .map(({ block }) => block);
}

/** Never split one source page across repeated WebView layout mutations. */
export function takeCompletePageBatch<T extends { page: number }>(
  blocks: T[],
  maxPages = 2,
) {
  const selectedPages = new Set<number>();
  for (const block of blocks) {
    if (!selectedPages.has(block.page) && selectedPages.size >= maxPages) break;
    selectedPages.add(block.page);
  }
  return blocks.filter((block) => selectedPages.has(block.page));
}

/** Explicit navigation is pending before the viewport/canonical anchor moves. */
export function extractionFocusPage(
  desired: { sourcePage: number } | null | undefined,
  current: { sourcePage: number } | null | undefined,
) {
  return desired?.sourcePage ?? current?.sourcePage ?? 1;
}
