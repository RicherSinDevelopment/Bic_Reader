import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 1;

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

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
