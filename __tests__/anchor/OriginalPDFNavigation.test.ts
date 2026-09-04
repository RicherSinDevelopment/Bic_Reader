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
