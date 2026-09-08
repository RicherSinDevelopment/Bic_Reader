import { hasPremiumAccessForIdentity } from "@/services/revenueCatIdentity";

describe("RevenueCat identity changes", () => {
  test("an anonymous receipt cannot unlock account-bound Premium features", () => {
    expect(hasPremiumAccessForIdentity(null, true)).toBe(false);
  });
  test("sign-in exposes an active entitlement and sign-out removes access", () => {
    expect(hasPremiumAccessForIdentity("user-1", true)).toBe(true);
    expect(hasPremiumAccessForIdentity(undefined, true)).toBe(false);
  });
  test("identity alone does not create an entitlement", () => {
    expect(hasPremiumAccessForIdentity("user-1", false)).toBe(false);
  });
});
