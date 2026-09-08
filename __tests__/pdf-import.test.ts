/* eslint-disable import/first */
const mockFindPdf = jest.fn();
const mockInsertPdf = jest.fn();
const mockMakeDirectory = jest.fn();
const mockCopy = jest.fn();
const mockDelete = jest.fn();
const mockRead = jest.fn();
jest.mock("@/database/pdfRepository", () => ({
  findPdfByNormalizedName: (...args: unknown[]) => mockFindPdf(...args),
  insertPdf: (...args: unknown[]) => mockInsertPdf(...args),
}));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectory(...args),
  copyAsync: (...args: unknown[]) => mockCopy(...args),
  deleteAsync: (...args: unknown[]) => mockDelete(...args),
  readAsStringAsync: (...args: unknown[]) => mockRead(...args),
  EncodingType: { Base64: "base64" },
}));
jest.mock("@/services/pdfThumbnailService", () => ({ deletePdfThumbnail: jest.fn() }));

import { importPdf, normalizePdfName } from "@/services/pdfImportService";

describe("PDF imports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindPdf.mockResolvedValue(null);
    mockInsertPdf.mockResolvedValue(undefined);
    mockMakeDirectory.mockResolvedValue(undefined);
    mockCopy.mockResolvedValue(undefined);
    mockRead.mockResolvedValue("JVBERi0xLjc=");
  });

  test("detects duplicate names before copying", async () => {
    mockFindPdf.mockResolvedValue({ id: "existing" });
    await expect(importPdf({} as any, { name: "Book copy.pdf", uri: "file:///tmp/book.pdf" }))
      .resolves.toEqual({ status: "duplicate", pdfId: "existing" });
    expect(normalizePdfName("Book (2).pdf")).toBe("book");
    expect(mockCopy).not.toHaveBeenCalled();
  });

  test("accepts a large PDF without loading it into JavaScript memory", async () => {
    const result = await importPdf({} as any, {
      name: "Large.pdf", uri: "file:///tmp/large.pdf", size: 500_000_000,
      mimeType: "application/pdf",
    });
    expect(result.status).toBe("imported");
    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockInsertPdf.mock.calls[0][1].size).toBe(500_000_000);
  });

  test("does not insert a record when an unreadable source cannot be copied", async () => {
    mockCopy.mockRejectedValue(new Error("source unreadable"));
    await expect(importPdf({} as any, { name: "Broken.pdf", uri: "file:///tmp/broken.pdf" }))
      .rejects.toThrow("source unreadable");
    expect(mockInsertPdf).not.toHaveBeenCalled();
  });

  test("removes a copied file whose contents are not a PDF", async () => {
    mockRead.mockResolvedValue("bm90IGEgcGRm");
    await expect(importPdf({} as any, { name: "Broken.pdf", uri: "file:///tmp/broken.pdf" }))
      .rejects.toThrow("corrupt or is not a valid PDF");
    expect(mockInsertPdf).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), { idempotent: true });
  });

  test("enforces the free-library limit before filesystem writes", async () => {
    await expect(importPdf({} as any, { name: "Sixth.pdf", uri: "file:///tmp/6.pdf" }, { allowNew: false }))
      .resolves.toEqual({ status: "limit" });
    expect(mockCopy).not.toHaveBeenCalled();
  });
});
