import { withSerializedWriteTransaction } from "@/database/serializedWriteTransaction";
import { supabase } from "@/lib/supabase";
import type { SQLiteDatabase } from "expo-sqlite";

export async function deleteCurrentAccount(db: SQLiteDatabase) {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirmation: "DELETE" },
  });
  if (error || data?.deleted !== true) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Unable to delete your account. Please try again.",
    );
  }

  let cleanupError: unknown;
  try {
    await withSerializedWriteTransaction(db, async (transaction) => {
      // Imported PDF files remain available offline, but all account-linked
      // reading data is erased and the files are detached from cloud sync.
      await transaction.runAsync("DELETE FROM reader_annotations");
      await transaction.runAsync("DELETE FROM pdf_ai_conversations");
      await transaction.runAsync(
        "UPDATE pdf_documents SET cloud_owner_id = NULL WHERE cloud_owner_id IS NOT NULL",
      );
    });
  } catch (error) {
    cleanupError = error;
  } finally {
    // The server has already invalidated the account. Clear the persisted
    // device session even if optional local cleanup encountered a problem.
    await supabase.auth.signOut({ scope: "local" });
  }

  if (cleanupError) {
    throw new Error(
      "Your account was deleted, but some reading data could not be removed from this device.",
    );
  }
}
