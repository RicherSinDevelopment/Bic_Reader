import { resolvePremiumAccess } from "@/services/revenueCatIdentity";

describe("RevenueCat identity changes", () => {
  test("an anonymous receipt unlocks local Premium without account services", () => {
    expect(resolvePremiumAccess(null, true)).toEqual({
      accountFeatures: false,
      localFeatures: true,
    });
  });
  test("sign-in extends an active entitlement to account services", () => {
    expect(resolvePremiumAccess("user-1", true)).toEqual({
      accountFeatures: true,
      localFeatures: true,
    });
  });
  test("identity alone does not create an entitlement", () => {
    expect(resolvePremiumAccess("user-1", false)).toEqual({
      accountFeatures: false,
      localFeatures: false,
    });
  });
});
