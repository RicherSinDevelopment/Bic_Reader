const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSupabaseUserId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isOwnedStoragePath(userId: string, path: unknown): path is string {
  if (typeof path !== "string" || !isSupabaseUserId(userId)) return false;
  if (!path.startsWith(`${userId}/`)) return false;
  const objectName = path.slice(userId.length + 1);
  return objectName.length > 0 && objectName.length <= 512 &&
    !objectName.includes("\\") &&
    objectName.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function isRevenueCatEventIdentity(
  id: unknown,
  eventTimestampMs: unknown,
) {
  return typeof id === "string" && id.length > 0 && id.length <= 200 &&
    typeof eventTimestampMs === "number" && Number.isSafeInteger(eventTimestampMs) &&
    eventTimestampMs > 0;
}
