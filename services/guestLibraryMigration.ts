import { withSerializedWrite } from "@/database/serializedWriteTransaction";
import type { SQLiteDatabase } from "expo-sqlite";

/** Atomically attaches only unowned guest PDFs to the newly signed-in user. */
export function claimGuestLibrary(db: SQLiteDatabase, userId: string) {
  return withSerializedWrite(db, (database) =>
    database.runAsync(
      "UPDATE pdf_documents SET cloud_owner_id = ? WHERE cloud_owner_id IS NULL",
      userId,
    ),
  );
}
