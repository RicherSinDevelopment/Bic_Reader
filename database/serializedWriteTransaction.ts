import type { SQLiteDatabase } from "expo-sqlite";

let pendingWrite: Promise<void> = Promise.resolve();

function enqueueWrite<T>(task: () => Promise<T>) {
  const operation = pendingWrite.then(task);
  pendingWrite = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

/**
 * Run a single database mutation after all previously queued mutations finish.
 */
export function withSerializedWrite<T>(
  db: SQLiteDatabase,
  task: (database: SQLiteDatabase) => Promise<T>,
) {
  return enqueueWrite(() => task(db));
}

/**
 * Keep write transactions on the shared Expo SQLite connection sequential.
 * Reader annotations and other persistence work can otherwise begin overlapping
 * async transactions and cause one transaction to commit/rollback another.
 */
export function withSerializedWriteTransaction(
  db: SQLiteDatabase,
  task: (transaction: SQLiteDatabase) => Promise<void>,
) {
  return enqueueWrite(() => db.withExclusiveTransactionAsync(task));
}
