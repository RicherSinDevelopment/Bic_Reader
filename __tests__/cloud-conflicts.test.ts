import { isCloudRecordNewer } from "@/services/cloudConflictPolicy";

describe("cloud conflict policy", () => {
  test("restores missing or stale local state from cloud", () => {
    expect(isCloudRecordNewer(null, "2026-09-04T11:00:00Z")).toBe(true);
    expect(isCloudRecordNewer("2026-09-04T10:00:00Z", "2026-09-04T11:00:00Z")).toBe(true);
  });
  test("does not overwrite newer local state", () => {
    expect(isCloudRecordNewer("2026-09-04T12:00:00Z", "2026-09-04T11:00:00Z")).toBe(false);
    expect(isCloudRecordNewer("2026-09-04T11:00:00Z", "2026-09-04T11:00:00Z")).toBe(false);
  });
  test("rejects a malformed cloud timestamp", () => {
    expect(isCloudRecordNewer("2026-09-04T10:00:00Z", "bad-date")).toBe(false);
  });
});
