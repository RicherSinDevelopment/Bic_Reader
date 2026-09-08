/** Opt in with EXPO_PUBLIC_ANCHOR_DEBUG=1; never log reading positions in production. */
export const ANCHOR_DEBUG =
  __DEV__ && process.env.EXPO_PUBLIC_ANCHOR_DEBUG === "1";
export function traceAnchor(event: string, details: Record<string, unknown>) {
  if (ANCHOR_DEBUG) console.info(`[Reader navigation] ${event}`, details);
}
