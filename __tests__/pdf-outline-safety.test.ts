import {
  convertNativePdfOutline,
  sanitizePdfOutline,
} from "@/architecture/PdfOutline";

describe("native PDF outline validation", () => {
  test("converts valid zero-based native destinations", () => {
    expect(convertNativePdfOutline([
      { title: "Introduction", pageIdx: 0, children: [] },
      // react-native-pdf's iOS implementation actually emits pageIdx strings,
      // despite declaring this property as a number in its TypeScript types.
      { title: "Chapter 12", pageIdx: "11", children: [] },
    ], 20)).toEqual([
      { title: "Introduction", page: 1, children: [] },
      { title: "Chapter 12", page: 12, children: [] },
    ]);
  });

  test.each([
    ["missing", undefined],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["excessively large", Number.MAX_VALUE],
    ["fractional", 1.5],
    ["fractional string", "1.5"],
    ["negative", -1],
    ["negative string", "-1"],
  ])("rejects a %s pageIdx", (_label, pageIdx) => {
    expect(convertNativePdfOutline([
      { title: "Unsafe destination", pageIdx, children: [] },
    ], 100)).toEqual([]);
  });

  test("promotes a valid child when its parent destination is malformed", () => {
    expect(convertNativePdfOutline([
      {
        title: "Broken parent",
        pageIdx: undefined,
        children: [{ title: "Usable child", pageIdx: 4, children: [] }],
      },
    ], 10)).toEqual([
      { title: "Usable child", page: 5, children: [] },
    ]);
  });

  test("rejects native destinations beyond the actual document", () => {
    expect(convertNativePdfOutline([
      { title: "Past EOF", pageIdx: 100, children: [] },
    ], 100)).toEqual([]);
  });
});

describe("PDF.js outline validation", () => {
  test("keeps only finite, integer, in-document one-based pages", () => {
    expect(sanitizePdfOutline([
      { title: "Valid", page: 8, children: [] },
      { title: "Missing", children: [] },
      { title: "NaN", page: Number.NaN, children: [] },
      { title: "Huge", page: Number.MAX_VALUE, children: [] },
    ], 12)).toEqual([
      { title: "Valid", page: 8, children: [] },
    ]);
  });
});
