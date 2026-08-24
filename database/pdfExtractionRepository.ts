import type { ExtractedPdfDocument } from "@/modules/bic-pdf-reader";
import type { SQLiteDatabase } from "expo-sqlite";

// Version 7 adds word-level Apple Vision bounds for scanned-page highlights.
export const PDF_EXTRACTION_ENGINE_VERSION = 7;

export async function getCachedPdfExtraction(db: SQLiteDatabase, pdfId: string) {
  const row = await db.getFirstAsync<{ document_json: string; engine_version: number }>(
    "SELECT document_json, engine_version FROM pdf_extractions WHERE pdf_id = ?",
    pdfId,
  );
  if (!row || row.engine_version !== PDF_EXTRACTION_ENGINE_VERSION) return null;
  try {
    return JSON.parse(row.document_json) as ExtractedPdfDocument;
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
