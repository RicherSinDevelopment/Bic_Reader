import type { CanonicalAnchor } from "@/architecture/anchor/AnchorTypes";
import { withSerializedWrite } from "./serializedWriteTransaction";
import type { SQLiteDatabase } from "expo-sqlite";

type ReaderPositionRow = {
  pdf_id: string; source_page: number; source_block_id: string | null;
  word_index: number | null; character_offset: number | null;
  block_progress: number | null; revision: number; updated_at: string;
};

export async function loadReaderPosition(db: SQLiteDatabase, pdfId: string): Promise<CanonicalAnchor | null> {
  const row = await db.getFirstAsync<ReaderPositionRow>(
    "SELECT * FROM reader_positions WHERE pdf_id = ? LIMIT 1", pdfId,
  );
  return row ? {
    documentId: row.pdf_id,
    sourcePage: row.source_page,
    sourceBlockId: row.source_block_id ?? undefined,
    wordIndex: row.word_index ?? undefined,
    characterOffset: row.character_offset ?? undefined,
    blockProgress: row.block_progress ?? undefined,
    revision: row.revision,
    updatedAt: row.updated_at,
  } : null;
}

export async function saveReaderPosition(db: SQLiteDatabase, anchor: CanonicalAnchor) {
  await withSerializedWrite(db, (database) => database.runAsync(
    `INSERT INTO reader_positions (
      pdf_id, source_page, source_block_id, word_index, character_offset,
      block_progress, revision, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pdf_id) DO UPDATE SET
      source_page = excluded.source_page,
      source_block_id = excluded.source_block_id,
      word_index = excluded.word_index,
      character_offset = excluded.character_offset,
      block_progress = excluded.block_progress,
      revision = excluded.revision,
      updated_at = excluded.updated_at`,
    anchor.documentId, anchor.sourcePage, anchor.sourceBlockId ?? null,
    anchor.wordIndex ?? null, anchor.characterOffset ?? null,
    anchor.blockProgress ?? null, anchor.revision, anchor.updatedAt,
  ));
}
