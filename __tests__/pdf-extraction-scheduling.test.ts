import {
  MAX_NATIVE_PDF_PAGE,
  extractionFocusPage,
  extractionRangeForDocument,
  nextOcrPrefetchPage,
  prioritizeHorizontalRequests,
  prioritizeVerticalBlocks,
  readerRuntimeSeedBlocks,
  sanitizeSourcePage,
  takeCompletePageBatch,
  validateNativeExtractionRange,
} from '@/architecture/PdfExtractionScheduling';
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

test('vertical delivery sends a distant destination before its surrounding buffer', () => {
  const blocks = [
    { id: 'p288-a', page: 288 },
    { id: 'p291-a', page: 291 },
    { id: 'p290-a', page: 290 },
    { id: 'p291-b', page: 291 },
    { id: 'p292-a', page: 292 },
  ];
  expect(prioritizeVerticalBlocks(blocks, 291).map(block => block.id)).toEqual([
    'p291-a', 'p291-b', 'p290-a', 'p292-a', 'p288-a',
  ]);
});

test('vertical batches keep source pages whole', () => {
  const blocks = [
    { id: 'p291-a', page: 291 },
    { id: 'p291-b', page: 291 },
    { id: 'p290-a', page: 290 },
    { id: 'p290-b', page: 290 },
    { id: 'p292-a', page: 292 },
  ];
  expect(takeCompletePageBatch(blocks, 2).map(block => block.id)).toEqual([
    'p291-a', 'p291-b', 'p290-a', 'p290-b',
  ]);
});

test('unloaded TOC destination survives pruning while the old page remains visible', () => {
  const current = { sourcePage: 2540 };
  const desired = { sourcePage: 980 };
  const focus = extractionFocusPage(desired, current);
  expect(prioritizeHorizontalRequests([980, 2541, 2539], focus)).toEqual([980]);
  expect(extractionFocusPage(null, current)).toBe(2540);
  expect(extractionFocusPage({ sourcePage: 117 }, current)).toBe(117);
});

test('invalid queued pages are rejected before reaching native extraction', () => {
  expect(sanitizeSourcePage(Number.NaN, 100)).toBeNull();
  expect(sanitizeSourcePage(Number.POSITIVE_INFINITY, 100)).toBeNull();
  expect(sanitizeSourcePage(Number.NEGATIVE_INFINITY, 100)).toBeNull();
  expect(sanitizeSourcePage(0, 100)).toBeNull();
  expect(sanitizeSourcePage(-20, 100)).toBeNull();
});

test('valid queued pages are normalized and clamped to safe bounds', () => {
  expect(sanitizeSourcePage(12.9, 100)).toBe(12);
  expect(sanitizeSourcePage(Number.MAX_VALUE, 100)).toBe(100);
  expect(sanitizeSourcePage(90_000)).toBe(MAX_NATIVE_PDF_PAGE);
  expect(sanitizeSourcePage(90_000, 125)).toBe(125);
});

test('native extraction range rejects values that could trap Swift conversion', () => {
  const invalidValues = [
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_VALUE,
    -1,
    1.5,
  ];

  for (const value of invalidValues) {
    expect(() => validateNativeExtractionRange(value as number, 1)).toThrow(RangeError);
    expect(() => validateNativeExtractionRange(0, value as number)).toThrow(RangeError);
  }
  expect(() => validateNativeExtractionRange(0, 0)).toThrow(RangeError);
  expect(validateNativeExtractionRange(0, 7)).toEqual({ firstPage: 0, maxPages: 7 });
  expect(validateNativeExtractionRange(MAX_NATIVE_PDF_PAGE, MAX_NATIVE_PDF_PAGE))
    .toEqual({ firstPage: MAX_NATIVE_PDF_PAGE, maxPages: MAX_NATIVE_PDF_PAGE });
});

test('a recreated reader runtime is seeded around the last visible page', () => {
  const blocks = Array.from({ length: 2600 }, (_, index) => ({
    id: `p${index + 1}`,
    page: index + 1,
  }));
  const seed = readerRuntimeSeedBlocks(blocks, 2554);
  expect(seed[0].page).toBe(2550);
  expect(seed.at(-1)?.page).toBe(2560);
  expect(seed.some((block) => block.page === 1)).toBe(false);
  expect(seed.some((block) => block.page === 2554)).toBe(true);
});
