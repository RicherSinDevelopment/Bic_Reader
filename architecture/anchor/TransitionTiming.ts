// Renderers already wait for settled geometry before reporting their anchor.
// Sample promptly so three matching observations add ~32ms, not 120ms.
// Keep the longer readiness/verification deadlines for uncached destinations.
export const TRANSITION_POLL_MS = 16;
