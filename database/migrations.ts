import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 4;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pdf_documents (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        file_uri TEXT NOT NULL UNIQUE,
        file_size INTEGER,
        mime_type TEXT,
        added_at TEXT NOT NULL,
        last_opened_at TEXT NOT NULL,
        current_page INTEGER NOT NULL DEFAULT 0,
        total_pages INTEGER,
        completion_percentage REAL NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_pdf_documents_last_opened
      ON pdf_documents(last_opened_at DESC);

      CREATE INDEX IF NOT EXISTS idx_pdf_documents_added_at
      ON pdf_documents(added_at DESC);
    `);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pdf_extractions (
        pdf_id TEXT PRIMARY KEY NOT NULL,
        engine_version INTEGER NOT NULL,
        document_json TEXT NOT NULL,
        extracted_at TEXT NOT NULL,
        FOREIGN KEY (pdf_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
      );
    `);
  }

  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pdf_translations (
        pdf_id TEXT NOT NULL,
        language_code TEXT NOT NULL,
        source_block_id TEXT NOT NULL,
        block_json TEXT NOT NULL,
        translated_at TEXT NOT NULL,
        PRIMARY KEY (pdf_id, language_code, source_block_id),
        FOREIGN KEY (pdf_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_pdf_translations_document_language
      ON pdf_translations(pdf_id, language_code);

      CREATE TABLE IF NOT EXISTS pdf_translation_preferences (
        pdf_id TEXT PRIMARY KEY NOT NULL,
        language_code TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (pdf_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
      );
    `);
  }

  if (currentVersion < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reader_annotations (
        id TEXT PRIMARY KEY NOT NULL,
        annotation_id TEXT NOT NULL,
        pdf_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('highlight', 'note')),
        block_id TEXT NOT NULL,
        start_offset INTEGER NOT NULL,
        text_length INTEGER NOT NULL,
        color TEXT,
        note_text TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (pdf_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_reader_annotations_document_scope
      ON reader_annotations(pdf_id, scope);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
