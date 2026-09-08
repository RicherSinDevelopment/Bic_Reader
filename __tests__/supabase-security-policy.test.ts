import {
  isOwnedStoragePath,
  isRevenueCatEventIdentity,
  isSupabaseUserId,
} from "@/supabase/functions/_shared/securityPolicy";

const USER_ID = "5ccaff64-2cb1-4817-b42d-c0c0d9bf715b";

describe("Supabase security boundaries", () => {
  test("accepts valid Supabase user IDs only", () => {
    expect(isSupabaseUserId(USER_ID)).toBe(true);
    expect(isSupabaseUserId("../../another-user")).toBe(false);
  });

  test("accepts storage objects only inside the exact user's folder", () => {
    expect(isOwnedStoragePath(USER_ID, `${USER_ID}/book.pdf`)).toBe(true);
    expect(isOwnedStoragePath(USER_ID, `${USER_ID}/folder/book.pdf`)).toBe(true);
    expect(isOwnedStoragePath(USER_ID, "other-user/book.pdf")).toBe(false);
    expect(isOwnedStoragePath(USER_ID, `${USER_ID}/../victim/book.pdf`)).toBe(false);
    expect(isOwnedStoragePath(USER_ID, `${USER_ID}/folder\\book.pdf`)).toBe(false);
  });

  test("requires stable RevenueCat replay identifiers", () => {
    expect(isRevenueCatEventIdentity("event-id", 1_788_500_000_000)).toBe(true);
    expect(isRevenueCatEventIdentity("", 1_788_500_000_000)).toBe(false);
    expect(isRevenueCatEventIdentity("event-id", 0)).toBe(false);
    expect(isRevenueCatEventIdentity("event-id", Number.NaN)).toBe(false);
  });
});
