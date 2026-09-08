export function hasPremiumAccessForIdentity(
  userId: string | null | undefined,
  hasEntitlement: boolean,
) {
  return Boolean(userId && hasEntitlement);
}
