import { typographyForReadingDirection } from "@/services/readerTypography";

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
