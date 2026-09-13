import type { CanonicalAnchor, ReaderMode } from './AnchorTypes';

/** Capture the settled active view, never a pending navigation or the hidden tab. */
export function captureVisiblePosition(
  documentId: string | undefined,
  mode: ReaderMode,
  reader: CanonicalAnchor | null,
  original: CanonicalAnchor | null,
  fallback: CanonicalAnchor | null,
): CanonicalAnchor | null {
  const visible = mode === 'reader' ? reader : original;
  const chosen = visible?.documentId === documentId ? visible : fallback;
  return chosen && chosen.documentId === documentId ? { ...chosen } : null;
}
