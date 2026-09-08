import { READER_GUIDE_DIMMING_SCRIPT } from "@/architecture/ReaderGuideDimming";

function dimmer(width: number, height: number) {
  const panels = Array.from({ length: 4 }, () => ({ style: {} as Record<string, string> }));
  const window: any = { innerWidth: width, innerHeight: height };
  let index = 0;
  new Function("window", "document", READER_GUIDE_DIMMING_SCRIPT)(window, {
    getElementById: () => panels[index++],
  });
  return { panels, draw: window.__drawReaderGuideDimming };
}

test.each([[414, 896], [896, 414], [1024, 1366]])("guide dimming stays inside a %i × %i viewport during repeated movement", (width, height) => {
  const { panels, draw } = dimmer(width, height);
  for (let i = 0; i < 1000; i++) {
    const x = (i * 19) % (width * 2) - width / 2;
    const y = (i * 37) % (height * 2) - height / 2;
    draw({ left: x, right: x + 80, top: y, bottom: y + 24 });
    let area = 0;
    for (const { style } of panels) {
      const left = parseFloat(style.left), top = parseFloat(style.top);
      const w = parseFloat(style.width), h = parseFloat(style.height);
      expect(left).toBeGreaterThanOrEqual(0); expect(top).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThanOrEqual(0); expect(h).toBeGreaterThanOrEqual(0);
      expect(left + w).toBeLessThanOrEqual(width);
      expect(top + h).toBeLessThanOrEqual(height);
      area += w * h;
    }
    expect(area).toBeLessThanOrEqual(width * height);
  }
});

test("turning the guide off or receiving invalid geometry releases every dimming panel", () => {
  const { panels, draw } = dimmer(414, 896);
  draw({ left: 10, right: 60, top: 20, bottom: 40 });
  draw(null);
  expect(panels.every((panel) => panel.style.display === "none")).toBe(true);
  draw({ left: NaN, right: 60, top: 20, bottom: 40 });
  expect(panels.every((panel) => panel.style.display === "none")).toBe(true);
});
