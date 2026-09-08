export function isCloudRecordNewer(
  localUpdatedAt: string | null | undefined,
  cloudUpdatedAt: string,
) {
  if (!localUpdatedAt) return true;
  const localTime = Date.parse(localUpdatedAt);
  const cloudTime = Date.parse(cloudUpdatedAt);
  if (!Number.isFinite(cloudTime)) return false;
  if (!Number.isFinite(localTime)) return true;
  return cloudTime > localTime;
}
