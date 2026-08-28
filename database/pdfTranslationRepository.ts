import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  withSerializedWrite,
  withSerializedWriteTransaction,
} from "./serializedWriteTransaction";

export async function getCachedPdfTranslations(
  db: SQLiteDatabase,
  pdfId: string,
  languageCode: string,
) {
  const rows = await db.getAllAsync<{ block_json: string }>(
    `SELECT block_json
     FROM pdf_translations
     WHERE pdf_id = ? AND language_code = ?`,
    pdfId,
    languageCode,
  );

  const blocks: ExtractedPdfBlock[] = [];
  for (const row of rows) {
    try {
      blocks.push(JSON.parse(row.block_json) as ExtractedPdfBlock);
    } catch {
      // Ignore a damaged row; the normal translation worker will replace it.
    }
  }
  return blocks;
}

export async function savePdfTranslations(
  db: SQLiteDatabase,
  pdfId: string,
  languageCode: string,
  blocks: ExtractedPdfBlock[],
) {
  if (blocks.length === 0) return;
  await withSerializedWriteTransaction(db, async (transaction) => {
    const statement = await transaction.prepareAsync(
      `INSERT INTO pdf_translations (
         pdf_id, language_code, source_block_id, block_json, translated_at
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(pdf_id, language_code, source_block_id) DO UPDATE SET
         block_json = excluded.block_json,
         translated_at = excluded.translated_at`,
    );
    try {
      const translatedAt = new Date().toISOString();
      for (const block of blocks) {
        const prefix = `translated-${languageCode}-`;
        const sourceBlockId = block.id.startsWith(prefix)
          ? block.id.slice(prefix.length)
          : block.id;
        await statement.executeAsync([
          pdfId,
          languageCode,
          sourceBlockId,
          JSON.stringify(block),
          translatedAt,
        ]);
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

export async function getPdfTranslationPreference(
  db: SQLiteDatabase,
  pdfId: string,
) {
  const row = await db.getFirstAsync<{ language_code: string }>(
    "SELECT language_code FROM pdf_translation_preferences WHERE pdf_id = ?",
    pdfId,
  );
  return row?.language_code;
}

export async function savePdfTranslationPreference(
  db: SQLiteDatabase,
  pdfId: string,
  languageCode?: string,
) {
  if (!languageCode) {
    await withSerializedWrite(db, (database) =>
      database.runAsync(
        "DELETE FROM pdf_translation_preferences WHERE pdf_id = ?",
        pdfId,
      ),
    );
    return;
  }
  await withSerializedWrite(db, (database) =>
    database.runAsync(
      `INSERT INTO pdf_translation_preferences (pdf_id, language_code, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(pdf_id) DO UPDATE SET
       language_code = excluded.language_code,
       updated_at = excluded.updated_at`,
      pdfId,
      languageCode,
      new Date().toISOString(),
    ),
  );
}
