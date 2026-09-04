type PageDestination = { page: number; nonce?: number } | null | undefined;
type PageHighlight = { page: number } | null | undefined;

/**
 * Exact PDFKit rectangle navigation must not compete with a page-only command.
 */
export function hasExactOriginalDestination(
  destination: PageDestination,
  highlightTarget: PageHighlight,
) {
  return Boolean(
    destination &&
      highlightTarget &&
      Math.max(1, destination.page) === Math.max(1, highlightTarget.page),
  );
}
