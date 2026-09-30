export type PdfOutlineItem = {
  title: string;
  page: number;
  children: PdfOutlineItem[];
};

type UnknownOutlineItem = {
  title?: unknown;
  page?: unknown;
  pageIdx?: unknown;
  children?: unknown;
};

const MAX_PDF_SOURCE_PAGE = 65_535;

function nativePageIndex(value: unknown): number | null {
  // react-native-pdf declares pageIdx as a number, but its iOS implementation
  // serializes the PDFKit page index with stringWithFormat and therefore sends
  // a decimal string over the React Native bridge.
  const pageIndex = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isFinite(pageIndex) ||
      !Number.isSafeInteger(pageIndex) ||
      pageIndex < 0) return null;
  return pageIndex;
}

function outlineItems(value: unknown): UnknownOutlineItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is UnknownOutlineItem =>
        typeof item === "object" && item !== null,
      )
    : [];
}

function normalizeOutline(
  value: unknown,
  pageFor: (item: UnknownOutlineItem) => number | null,
  maximumPage: number,
): PdfOutlineItem[] {
  return outlineItems(value).flatMap((item) => {
    const children = normalizeOutline(item.children, pageFor, maximumPage);
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const page = pageFor(item);

    // A malformed parent must never poison native navigation. Preserve any
    // valid descendants by promoting them one level instead of dropping an
    // otherwise usable section of the table of contents.
    if (!title || page === null || page < 1 || page > maximumPage) {
      return children;
    }
    return [{ title, page, children }];
  });
}

/** Convert react-native-pdf's zero-based pageIdx values into safe source pages. */
export function convertNativePdfOutline(
  value: unknown,
  maximumPage = MAX_PDF_SOURCE_PAGE,
): PdfOutlineItem[] {
  return normalizeOutline(
    value,
    (item) => {
      const pageIndex = nativePageIndex(item.pageIdx);
      return pageIndex === null ? null : pageIndex + 1;
    },
    maximumPage,
  );
}

/** Validate the one-based outline emitted by the PDF.js WebView. */
export function sanitizePdfOutline(
  value: unknown,
  maximumPage = MAX_PDF_SOURCE_PAGE,
): PdfOutlineItem[] {
  return normalizeOutline(
    value,
    (item) => {
      if (typeof item.page !== "number" ||
          !Number.isFinite(item.page) ||
          !Number.isInteger(item.page)) return null;
      return item.page;
    },
    maximumPage,
  );
}
