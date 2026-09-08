import {
  authReturnTarget,
  authRoute,
  destinationAfterAuth,
} from "@/lib/authNavigation";

describe("guest authentication navigation", () => {
  it("only accepts known return targets", () => {
    expect(authReturnTarget("premium")).toBe("premium");
    expect(authReturnTarget(["premium"])).toBe("premium");
    expect(authReturnTarget("unknown")).toBeUndefined();
  });

  it("returns premium customers to the paywall after authentication", () => {
    expect(destinationAfterAuth("premium")).toEqual({
      pathname: "/onboarding/premium",
      params: { source: "app" },
    });
  });

  it("returns ordinary authentication to the local library", () => {
    expect(destinationAfterAuth(undefined)).toBe("/HomePage");
  });

  it("preserves the premium intent between sign in and sign up", () => {
    expect(authRoute("/(auth)/sign-up", "premium")).toEqual({
      pathname: "/(auth)/sign-up",
      params: { returnTo: "premium" },
    });
  });
});
