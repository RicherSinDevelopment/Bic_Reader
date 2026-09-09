import { hasExactOriginalDestination } from "@/architecture/anchor/OriginalNavigation";

const highlight = {
  page: 21,
  sourceBounds: { left: 10, top: 20, right: 30, bottom: 40 },
  pageSize: { width: 600, height: 800 },
};

describe("Original PDF destination arbitration", () => {
  it("lets the exact PDFKit rectangle command own a matching page", () => {
    expect(hasExactOriginalDestination({ page: 21, nonce: 1 }, highlight)).toBe(
      true,
    );
  });

  it("falls back to page navigation when no exact rectangle exists", () => {
    expect(hasExactOriginalDestination({ page: 21, nonce: 1 }, null)).toBe(
      false,
    );
  });

  it("uses page navigation when the highlight belongs to another page", () => {
    expect(hasExactOriginalDestination({ page: 22, nonce: 1 }, highlight)).toBe(
      false,
    );
  });
});

test('Original resolves conflicting word metadata by source character offset', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { originalHighlightTarget } = require('@/architecture/anchor/OriginalAnchorAdapter');
  const block = { id: 'b', page: 20, text: 'first second third', sourceBounds: { left: 0, top: 0, right: 100, bottom: 20 }, wordBounds: [[0, 0, 10, 20], [10, 0, 20, 20], [20, 0, 30, 20]] };
  const result = originalHighlightTarget({ sourcePage: 20, sourceBlockId: 'b', characterOffset: 13, wordIndex: 0, blockProgress: 0 }, [block], { 20: { width: 600, height: 800 } });
  expect(result).toMatchObject({ word: 'third', wordIndex: 2, sourceBounds: { left: 20, top: 0, right: 30, bottom: 20 } });
});
