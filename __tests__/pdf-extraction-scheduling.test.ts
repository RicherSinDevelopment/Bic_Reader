import { extractionRangeForDocument, nextOcrPrefetchPage, prioritizeHorizontalRequests, extractionFocusPage } from '@/architecture/PdfExtractionScheduling';
import type { ExtractedPdfDocument } from '@/modules/bic-pdf-reader';
const documentWith = (flags: object) => ({ pageCount: 4000, pages: [{ page: 1, requiresOcr: false, ...flags }] }) as ExtractedPdfDocument;
test('digital documents retain chapter and background batches', () => {
  expect(extractionRangeForDocument(documentWith({}), 200, 196, 7)).toEqual({ firstPage: 196, batchSize: 7 });
  expect(extractionRangeForDocument(null, null, 0, 1)).toEqual({ firstPage: 0, batchSize: 1 });
});
test('completed OCR remains detectable and jumps extract the destination first', () => {
  expect(extractionRangeForDocument(documentWith({ ocrPerformed: true }), 200, 196, 7)).toEqual({ firstPage: 199, batchSize: 1 });
});
test('scanned background work yields after each page', () => {
  expect(extractionRangeForDocument(documentWith({ requiresOcr: true }), null, 25, 8)).toEqual({ firstPage: 25, batchSize: 1 });
});

test('idle OCR warms eight following and three preceding pages without re-extracting them', () => {
  const doc = documentWith({ ocrPerformed: true });
  doc.pages[0].page = 117;
  const chosen: number[] = [];
  for (let i = 0; i < 11; i++) {
    const page = nextOcrPrefetchPage(doc, 117)!;
    chosen.push(page);
    doc.pages.push({ ...doc.pages[0], page });
  }
  expect(chosen).toEqual([118, 119, 120, 116, 121, 122, 115, 123, 124, 114, 125]);
  expect(nextOcrPrefetchPage(doc, 117)).toBeNull();
  expect(nextOcrPrefetchPage(documentWith({}), 117)).toBeNull();
});

test('new horizontal location drops stale prefetch and serves closest pages first', () => {
  expect(prioritizeHorizontalRequests([2, 3, 110, 119, 116, 118, 117, 118, 200], 117))
    .toEqual([117, 118, 116, 119, 110]);
});

test('unloaded TOC destination survives pruning while the old page remains visible', () => {
  const current = { sourcePage: 2540 };
  const desired = { sourcePage: 980 };
  const focus = extractionFocusPage(desired, current);
  expect(prioritizeHorizontalRequests([980, 2541, 2539], focus)).toEqual([980]);
  expect(extractionFocusPage(null, current)).toBe(2540);
  expect(extractionFocusPage({ sourcePage: 117 }, current)).toBe(117);
});
