import type { SQLiteDatabase } from "expo-sqlite";
import { withSerializedWriteTransaction } from "./serializedWriteTransaction";

export type StoredHighlight = {
  blockId: string;
  offset: number;
  length: number;
  color: string;
};

export type StoredNote = {
  id: string;
  blockId: string;
  offset: number;
  length: number;
  text: string;
};

type AnnotationRow = {
  annotation_id: string;
  kind: "highlight" | "note";
  block_id: string;
  start_offset: number;
  text_length: number;
  color: string | null;
  note_text: string | null;
};

export async function loadReaderAnnotations(
  db: SQLiteDatabase,
  pdfId: string,
  scope: string,
) {
  const rows = await db.getAllAsync<AnnotationRow>(
    `SELECT annotation_id, kind, block_id, start_offset, text_length, color, note_text
     FROM reader_annotations
     WHERE pdf_id = ? AND scope = ?
     ORDER BY created_at, id`,
    pdfId,
    scope,
  );

  return {
    highlights: rows.filter((row) => row.kind === "highlight").map((row) => ({
      blockId: row.block_id,
      offset: row.start_offset,
      length: row.text_length,
      color: row.color ?? "#fde68a",
    })),
    notes: rows.filter((row) => row.kind === "note").map((row) => ({
      id: row.annotation_id,
      blockId: row.block_id,
      offset: row.start_offset,
      length: row.text_length,
      text: row.note_text ?? "",
    })),
  };
}

export async function saveReaderAnnotations(
  db: SQLiteDatabase,
  pdfId: string,
  scope: string,
  highlights: StoredHighlight[],
  notes: StoredNote[],
) {
  const timestamp = new Date().toISOString();
  await withSerializedWriteTransaction(db, async (transaction) => {
    await transaction.runAsync(
      "DELETE FROM reader_annotations WHERE pdf_id = ? AND scope = ?",
      pdfId,
      scope,
    );
    for (const [index, highlight] of highlights.entries()) {
      await transaction.runAsync(
        `INSERT INTO reader_annotations
         (id, annotation_id, pdf_id, scope, kind, block_id, start_offset, text_length, color, note_text, created_at)
         VALUES (?, ?, ?, ?, 'highlight', ?, ?, ?, ?, NULL, ?)`,
        `${pdfId}:${scope}:highlight:${index}`,
        `highlight-${index}`,
        pdfId,
        scope,
        highlight.blockId,
        highlight.offset,
        highlight.length,
        highlight.color,
        timestamp,
      );
    }
    for (const [index, note] of notes.entries()) {
      await transaction.runAsync(
        `INSERT INTO reader_annotations
         (id, annotation_id, pdf_id, scope, kind, block_id, start_offset, text_length, color, note_text, created_at)
         VALUES (?, ?, ?, ?, 'note', ?, ?, ?, NULL, ?, ?)`,
        `${pdfId}:${scope}:note:${index}`,
        note.id,
        pdfId,
        scope,
        note.blockId,
        note.offset,
        note.length,
        note.text,
        timestamp,
      );
    }
  });
}
