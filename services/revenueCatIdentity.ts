export type PremiumAccess = {
  accountFeatures: boolean;
  localFeatures: boolean;
};

export function resolvePremiumAccess(
  userId: string | null | undefined,
  hasEntitlement: boolean,
): PremiumAccess {
  return {
    // App Store purchases belong to the store account and must unlock local
    // Premium functionality without requiring a Bic Reader account.
    localFeatures: hasEntitlement,
    // Cloud sync and AI store account-owned data in Supabase, so those
    // services still require an optional Bic Reader identity.
    accountFeatures: Boolean(userId && hasEntitlement),
  };
}
