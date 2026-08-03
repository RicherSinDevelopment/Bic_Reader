import { requireOptionalNativeModule } from "expo";

export type PdfBlockKind =
  | "title" | "heading" | "paragraph" | "listItem"
  | "footnote" | "header" | "footer";

export type PdfSourceBounds = {
  left: number; top: number; right: number; bottom: number;
};

export type ExtractedPdfBlock = {
  id: string;
  kind: PdfBlockKind;
  text: string;
  page: number;
  sourceBounds: PdfSourceBounds;
  wordBounds: [number, number, number, number][];
  readingOrder: number;
  confidence: number;
  hiddenInReader: boolean;
};

export type ExtractedPdfPage = {
  page: number;
  width: number;
  height: number;
  blocks: ExtractedPdfBlock[];
  confidence: number;
  requiresOcr: boolean;
};

export type ExtractedPdfDocument = {
  pageCount: number;
  pages: ExtractedPdfPage[];
};

type NativeResponse = { ok: boolean; data: ExtractedPdfDocument | null; error: string | null };
type BicPdfReaderNative = {
  extractDocument(path: string): Promise<string>;
  extractDocumentRange(path: string, firstPage: number, maxPages: number): Promise<string>;
  isEngineLinked: boolean;
};
const native = requireOptionalNativeModule<BicPdfReaderNative>("BicPdfReader");

export const isPdfEngineLinked = native?.isEngineLinked ?? false;

export async function extractPdfDocument(path: string): Promise<ExtractedPdfDocument> {
  if (!native) throw new Error("PDF extraction is available in the iOS development build.");
  const response = JSON.parse(await native.extractDocument(normalizeFilePath(path))) as NativeResponse;
  if (!response.ok || !response.data) throw new Error(response.error ?? "PDF extraction failed");
  return response.data;
}

export async function extractPdfDocumentRange(
  path: string,
  firstPage: number,
  maxPages: number,
): Promise<ExtractedPdfDocument> {
  if (!native) throw new Error("PDF extraction is available in the iOS development build.");
  const response = JSON.parse(await native.extractDocumentRange(
    normalizeFilePath(path),
    firstPage,
    maxPages,
  )) as NativeResponse;
  if (!response.ok || !response.data) throw new Error(response.error ?? "PDF extraction failed");
  return response.data;
}

function normalizeFilePath(path: string): string {
  return decodeURIComponent(path.replace(/^file:\/\//, ""));
}
