import { typographyForReadingDirection } from "@/services/readerTypography";
import fs from "fs";
import path from "path";

describe("direction-safe reader typography", () => {
  it("preserves left-to-right typography settings", () => {
    expect(
      typographyForReadingDirection("ltr", {
        letterSpacing: 1.2,
        automaticHyphenation: true,
      }),
    ).toEqual({ letterSpacing: 1.2, automaticHyphenation: true });
  });

  it("keeps connected right-to-left glyphs intact", () => {
    expect(
      typographyForReadingDirection("rtl", {
        letterSpacing: 1.2,
        automaticHyphenation: true,
      }),
    ).toEqual({ letterSpacing: 0, automaticHyphenation: false });
  });
});

describe("rotation-stable WebView typography", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../components/ReaderView.tsx"),
    "utf8",
  );

  it("disables WKWebView orientation text autosizing", () => {
    expect(source).toContain("-webkit-text-size-adjust: 100%");
    expect(source).toContain("text-size-adjust: 100%");
  });

  it("seeds a rebuilt runtime with the persisted font metrics", () => {
    expect(source).toContain("runtimeTypographyRef.current = useReaderSettingsStore.getState()");
    expect(source).toContain("font-size: ${initialTypography.fontSize}px");
    expect(source).toContain("line-height: ${initialTypography.lineHeight}");
    expect(source).toContain("--paragraph-spacing: ${initialTypography.paragraphSpacing}em");
  });
});
