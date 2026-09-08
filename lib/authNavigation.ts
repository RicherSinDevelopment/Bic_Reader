export type AuthReturnTarget = "premium";

export function authReturnTarget(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "premium" ? candidate : undefined;
}

export function destinationAfterAuth(value: string | string[] | undefined) {
  return authReturnTarget(value) === "premium"
    ? ({ pathname: "/onboarding/premium", params: { source: "app" } } as const)
    : ("/HomePage" as const);
}

export function authRoute(
  pathname: "/(auth)/sign-in" | "/(auth)/sign-up",
  returnTo?: AuthReturnTarget,
) {
  return returnTo
    ? ({ pathname, params: { returnTo } } as const)
    : ({ pathname } as const);
}
