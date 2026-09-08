import {
  findPdfByNormalizedName,
  insertPdf,
} from "@/database/pdfRepository";
import type { NewPdfDocument, PdfDocument } from "@/database/types";
import type { PickedPdf } from "@/hooks/useDocumentPicker";
import { deletePdfThumbnail } from "@/services/pdfThumbnailService";
import * as FileSystem from "expo-file-system/legacy";
import type { SQLiteDatabase } from "expo-sqlite";

const PDF_DIRECTORY_NAME = "pdfs";
const PDF_HEADER_SCAN_BYTES = 1024;

export type PdfImportResult =
  | { status: "imported"; pdf: PdfDocument }
  | { status: "duplicate"; pdfId: string }
  | { status: "limit" };

export function normalizePdfName(name: string) {
  const normalizedName = name
    .replace(/\.pdf$/i, "")
    .replace(/\s*(?:\(\d+\)|-?\s*copy)$/i, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

  return normalizedName || name.toLocaleLowerCase().trim();
}

function createPdfId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getPdfDirectoryUri() {
  if (!FileSystem.documentDirectory) {
    throw new Error("The app documents directory is unavailable.");
  }

  return `${FileSystem.documentDirectory}${PDF_DIRECTORY_NAME}/`;
}

async function assertPdfHeader(uri: string) {
  const encodedHeader = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    length: PDF_HEADER_SCAN_BYTES,
    position: 0,
  });
  const header = globalThis.atob(encodedHeader);
  if (!header.includes("%PDF-")) {
    throw new Error("This file is corrupt or is not a valid PDF.");
  }
}

export async function importPdf(
  db: SQLiteDatabase,
  pickedPdf: PickedPdf,
  options: { allowNew?: boolean } = {},
): Promise<PdfImportResult> {
  const normalizedName = normalizePdfName(pickedPdf.name);
  const duplicate = await findPdfByNormalizedName(db, normalizedName);

  if (duplicate) {
    return { status: "duplicate", pdfId: duplicate.id };
  }

  if (options.allowNew === false) {
    return { status: "limit" };
  }

  const directoryUri = getPdfDirectoryUri();
  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });

  const id = createPdfId();
  const permanentUri = `${directoryUri}${id}.pdf`;
  const timestamp = new Date().toISOString();

  await FileSystem.copyAsync({ from: pickedPdf.uri, to: permanentUri });

  try {
    await assertPdfHeader(permanentUri);
  } catch (error) {
    await FileSystem.deleteAsync(permanentUri, { idempotent: true });
    throw error;
  }

  const pdf: NewPdfDocument = {
    id,
    name: pickedPdf.name,
    normalizedName,
    originalName: pickedPdf.name,
    uri: permanentUri,
    size: pickedPdf.size,
    mimeType: pickedPdf.mimeType,
    addedAt: timestamp,
    dateOpened: timestamp,
    currentPage: 0,
    completionPercentage: 0,
  };

  try {
    await insertPdf(db, pdf);
  } catch (error) {
    await FileSystem.deleteAsync(permanentUri, { idempotent: true });

    // Another external-open handler may have inserted the same document after
    // our initial duplicate check. Resolve that race to the existing record.
    const racedDuplicate = await findPdfByNormalizedName(db, normalizedName);
    if (racedDuplicate) {
      return { status: "duplicate", pdfId: racedDuplicate.id };
    }

    throw error;
  }

  return { status: "imported", pdf };
}

export async function deleteStoredPdf(uri: string) {
  const directoryUri = getPdfDirectoryUri();

  if (!uri.startsWith(directoryUri)) {
    throw new Error("Refusing to delete a PDF outside app storage.");
  }

  await Promise.all([
    FileSystem.deleteAsync(uri, { idempotent: true }),
    deletePdfThumbnail(uri),
  ]);
}
