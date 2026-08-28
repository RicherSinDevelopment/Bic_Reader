import type { SQLiteDatabase } from "expo-sqlite";

let pendingWrite: Promise<void> = Promise.resolve();

/**
 * Keep write transactions on the shared Expo SQLite connection sequential.
 * Reader, Translated, and translation caching can otherwise begin overlapping
 * async transactions and cause one transaction to commit/rollback another.
 */
export function withSerializedWriteTransaction(
  db: SQLiteDatabase,
  task: (transaction: SQLiteDatabase) => Promise<void>,
) {
  const operation = pendingWrite.then(() =>
    db.withExclusiveTransactionAsync(task)
  );
  pendingWrite = operation.catch(() => undefined);
  return operation;
}
