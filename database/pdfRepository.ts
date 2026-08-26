import type { NewPdfDocument, PdfDocument } from "@/database/types";
import { resolveStoredFileUri } from "@/storage/filePaths";
import type { SQLiteDatabase } from "expo-sqlite";

type PdfDocumentRow = {
  id: string;
  display_name: string;
  original_name: string;
  file_uri: string;
  file_size: number | null;
  mime_type: string | null;
  added_at: string;
  last_opened_at: string;
  current_page: number;
  total_pages: number | null;
  completion_percentage: number;
};

const pdfMemoryCache = new Map<string, PdfDocument>();

export function peekCachedPdfById(id: string) {
  return pdfMemoryCache.get(id) ?? null;
}

function mapPdfRow(row: PdfDocumentRow): PdfDocument {
  return {
    id: row.id,
    name: row.display_name,
    originalName: row.original_name,
    uri: resolveStoredFileUri(row.file_uri),
    size: row.file_size ?? undefined,
    mimeType: row.mime_type ?? undefined,
    addedAt: row.added_at,
    dateOpened: row.last_opened_at,
    currentPage: row.current_page,
    totalPages: row.total_pages ?? undefined,
    completionPercentage: row.completion_percentage,
  };
}

export async function getAllPdfs(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<PdfDocumentRow>(`
    SELECT id, display_name, original_name, file_uri, file_size, mime_type,
           added_at, last_opened_at, current_page, total_pages,
           completion_percentage
    FROM pdf_documents
    ORDER BY added_at DESC
  `);

  const documents = rows.map(mapPdfRow);
  pdfMemoryCache.clear();
  documents.forEach((document) => pdfMemoryCache.set(document.id, document));
  return documents;
}

export async function getPdfById(db: SQLiteDatabase, id: string) {
  const cached = pdfMemoryCache.get(id);
  if (cached) return cached;
  const row = await db.getFirstAsync<PdfDocumentRow>(
    `SELECT id, display_name, original_name, file_uri, file_size, mime_type,
            added_at, last_opened_at, current_page, total_pages,
            completion_percentage
     FROM pdf_documents
     WHERE id = ?
     LIMIT 1`,
    id,
  );

  if (!row) return null;
  const document = mapPdfRow(row);
  pdfMemoryCache.set(id, document);
  return document;
}

export async function markPdfOpened(db: SQLiteDatabase, id: string) {
  const openedAt = new Date().toISOString();
  await db.runAsync(
    "UPDATE pdf_documents SET last_opened_at = ? WHERE id = ?",
    openedAt,
    id,
  );
  const cached = pdfMemoryCache.get(id);
  if (cached) pdfMemoryCache.set(id, { ...cached, dateOpened: openedAt });
}

export async function updatePdfProgress(
  db: SQLiteDatabase,
  id: string,
  currentPage: number,
  totalPages: number,
) {
  const completionPercentage =
    totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  await db.runAsync(
    `UPDATE pdf_documents
     SET current_page = ?, total_pages = ?, completion_percentage = ?
     WHERE id = ?`,
    currentPage,
    totalPages,
    completionPercentage,
    id,
  );
  const cached = pdfMemoryCache.get(id);
  if (cached) {
    pdfMemoryCache.set(id, {
      ...cached,
      currentPage,
      totalPages,
      completionPercentage,
    });
  }
}
export async function findPdfByNormalizedName(
  db: SQLiteDatabase,
  normalizedName: string,
) {
  return db.getFirstAsync<{ id: string }>(
    "SELECT id FROM pdf_documents WHERE normalized_name = ? LIMIT 1",
    normalizedName,
  );
}

export async function insertPdf(db: SQLiteDatabase, pdf: NewPdfDocument) {
  await db.runAsync(
    `INSERT INTO pdf_documents (
      id, display_name, normalized_name, original_name, file_uri, file_size,
      mime_type, added_at, last_opened_at, current_page, total_pages,
      completion_percentage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    pdf.id,
    pdf.name,
    pdf.normalizedName,
    pdf.originalName,
    pdf.uri,
    pdf.size ?? null,
    pdf.mimeType ?? null,
    pdf.addedAt,
    pdf.dateOpened,
    pdf.currentPage,
    pdf.totalPages ?? null,
    pdf.completionPercentage,
  );
  pdfMemoryCache.set(pdf.id, pdf);
}

export async function renamePdf(
  db: SQLiteDatabase,
  id: string,
  name: string,
) {
  await db.runAsync(
    "UPDATE pdf_documents SET display_name = ? WHERE id = ?",
    name,
    id,
  );
  const cached = pdfMemoryCache.get(id);
  if (cached) pdfMemoryCache.set(id, { ...cached, name });
}

export async function deletePdfRecord(db: SQLiteDatabase, id: string) {
  await db.runAsync("DELETE FROM pdf_documents WHERE id = ?", id);
  pdfMemoryCache.delete(id);
}
