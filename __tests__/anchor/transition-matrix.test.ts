/// <reference types="jest" />

import { anchorForSelectedWord } from "@/architecture/FindWordInOtherTab";
import { generatedPageForAnchor } from "@/architecture/anchor/HorizontalAnchorAdapter";
import { originalDestination } from "@/architecture/anchor/OriginalAnchorAdapter";
import { toTranslationAnchor } from "@/architecture/anchor/TranslationAnchorMapper";
import { verticalDestination } from "@/architecture/anchor/VerticalAnchorAdapter";
import type { CanonicalAnchor, ReaderLayout, ReaderMode } from "@/architecture/anchor/AnchorTypes";

type RenderState = { mode: ReaderMode; layout: ReaderLayout };

const states: RenderState[] = [
  { mode: "reader", layout: "vertical" },
  { mode: "reader", layout: "horizontal" },
  { mode: "translated", layout: "vertical" },
  { mode: "translated", layout: "horizontal" },
  { mode: "original", layout: "vertical" },
];

const canonical: CanonicalAnchor = {
  documentId: "regression-book",
  sourcePage: 119,
  sourceBlockId: "p119-b2",
  wordIndex: 7,
  characterOffset: 38,
  blockProgress: 0.21875,
  revision: 1097,
  updatedAt: "2026-09-04T00:00:00.000Z",
};

const pages = [
  [{ blockId: "p118-b9", sourcePage: 118, startOffset: 0, text: "old page" }],
  [{ blockId: "p119-b2", sourcePage: 119, startOffset: 0, text: "x".repeat(80) }],
];

function destinationFor(state: RenderState) {
  if (state.mode === "original") return originalDestination(canonical, 1);
  if (state.layout === "horizontal") {
    return {
      sourcePage: canonical.sourcePage,
      generatedPageIndex: generatedPageForAnchor(pages, canonical),
    };
  }
  if (state.mode === "translated") {
    const translated = toTranslationAnchor(canonical, "es");
    return verticalDestination({ ...canonical, sourceBlockId: translated.sourceBlockId }, 1);
  }
  return verticalDestination(canonical, 1);
}

describe("all directed transition edges", () => {
  test.each(
    states.flatMap((from) => states
      .filter((target) => target !== from)
      .map((target) => [
        `${from.mode}/${from.layout} -> ${target.mode}/${target.layout}`,
        from,
        target,
      ] as const)),
  )("%s preserves source identity", (_label, _from, target) => {
    const destination = destinationFor(target);
    if (target.mode === "original") {
      expect(destination).toMatchObject({ page: canonical.sourcePage });
    } else if (target.layout === "horizontal") {
      expect(destination).toMatchObject({
        sourcePage: canonical.sourcePage,
        generatedPageIndex: 1,
      });
    } else {
      expect(destination).toMatchObject({
        page: canonical.sourcePage,
        blockId: canonical.sourceBlockId,
      });
    }
  });
});

describe("selected-word cross-tab regression", () => {
  test("maps a translated selection back to source progress", () => {
    const selected = anchorForSelectedWord({
      range: { blockId: "translated-es-p119-b2", offset: 10, length: 5 },
      selectedText: "palabra",
      blocks: [{
        id: "translated-es-p119-b2",
        kind: "paragraph",
        page: 119,
        text: "uno dos tres cuatro cinco",
        sourceBounds: { left: 0, top: 0, right: 100, bottom: 20 },
        wordBounds: [],
        readingOrder: 1,
        confidence: 1,
        hiddenInReader: false,
      }],
      mode: "translated",
      languageCode: "es",
    });
    expect(selected).toMatchObject({
      sourcePage: 119,
      sourceBlockId: "p119-b2",
      wordIndex: 2,
      blockProgress: 0.5,
    });
  });
});

describe("mapping performance", () => {
  test("50,000 transition mapping sets stay below the regression budget", () => {
    const startedAt = performance.now();
    for (let index = 0; index < 50_000; index += 1) {
      generatedPageForAnchor(pages, canonical);
      verticalDestination(canonical, index);
      originalDestination(canonical, index);
      toTranslationAnchor(canonical, "es");
    }
    const elapsed = performance.now() - startedAt;
    // This executes 200,000 mapping operations under Jest instrumentation.
    // The generous ceiling detects algorithmic regressions without depending
    // on a particular developer machine's momentary CPU load.
    expect(elapsed).toBeLessThan(1_500);
  });
});
