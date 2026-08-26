import type {
  ExtractedPdfDocument,
  ExtractedPdfPage,
} from "@/modules/bic-pdf-reader";
import type { SQLiteDatabase } from "expo-sqlite";

// Version 17 adds multi-signal page scoring plus document-wide scan sampling.
export const PDF_EXTRACTION_ENGINE_VERSION = 17;

const extractionMemoryCache = new Map<string, ExtractedPdfDocument>();

export async function getCachedPdfExtractionPreview(
  db: SQLiteDatabase,
  pdfId: string,
  pageLimit = 5,
) {
  const inMemory = extractionMemoryCache.get(pdfId);
  if (inMemory) {
    return {
      pageCount: inMemory.pageCount,
      pages: inMemory.pages.slice(0, pageLimit),
    } satisfies ExtractedPdfDocument;
  }

  try {
    const rows = await db.getAllAsync<{
      page_count: number;
      page_json: string;
    }>(
      `SELECT
         CAST(json_extract(extraction.document_json, '$.pageCount') AS INTEGER) AS page_count,
         page.value AS page_json
       FROM pdf_extractions AS extraction,
            json_each(extraction.document_json, '$.pages') AS page
       WHERE extraction.pdf_id = ?
         AND extraction.engine_version = ?
       LIMIT ?`,
      pdfId,
      PDF_EXTRACTION_ENGINE_VERSION,
      Math.max(1, pageLimit),
    );
    if (!rows.length) return null;
    const pages = rows.flatMap((row) => {
      try {
        return [JSON.parse(row.page_json) as ExtractedPdfPage];
      } catch {
        return [];
      }
    });
    if (pages.length) {
      return {
        pageCount: rows[0].page_count,
        pages,
      } satisfies ExtractedPdfDocument;
    }
    const document = await getCachedPdfExtraction(db, pdfId);
    return document
      ? { pageCount: document.pageCount, pages: document.pages.slice(0, pageLimit) }
      : null;
  } catch {
    // Older SQLite builds may not expose JSON table functions. Preserve the
    // existing cache path in that case, even though it must parse the full blob.
    const document = await getCachedPdfExtraction(db, pdfId);
    return document
      ? { pageCount: document.pageCount, pages: document.pages.slice(0, pageLimit) }
      : null;
  }
}

export async function getCachedPdfExtraction(db: SQLiteDatabase, pdfId: string) {
  const inMemory = extractionMemoryCache.get(pdfId);
  if (inMemory) return inMemory;
  const row = await db.getFirstAsync<{ document_json: string; engine_version: number }>(
    "SELECT document_json, engine_version FROM pdf_extractions WHERE pdf_id = ?",
    pdfId,
  );
  if (!row || row.engine_version !== PDF_EXTRACTION_ENGINE_VERSION) return null;
  try {
    const document = JSON.parse(row.document_json) as ExtractedPdfDocument;
    extractionMemoryCache.set(pdfId, document);
    return document;
  } catch {
    await db.runAsync("DELETE FROM pdf_extractions WHERE pdf_id = ?", pdfId);
    return null;
  }
}

export async function savePdfExtraction(
  db: SQLiteDatabase,
  pdfId: string,
  document: ExtractedPdfDocument,
) {
  extractionMemoryCache.set(pdfId, document);
  await db.runAsync(
    `INSERT INTO pdf_extractions (pdf_id, engine_version, document_json, extracted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(pdf_id) DO UPDATE SET
       engine_version = excluded.engine_version,
       document_json = excluded.document_json,
       extracted_at = excluded.extracted_at`,
    pdfId,
    PDF_EXTRACTION_ENGINE_VERSION,
    JSON.stringify(document),
    new Date().toISOString(),
  );
}
