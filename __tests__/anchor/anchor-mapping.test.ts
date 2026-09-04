/// <reference types="jest" />

import {
  anchorAccuracyScore,
  getRecentTransitionMetrics,
  recordTransitionMetric,
  resetTransitionMetrics,
  summarizeTransitionMetrics,
} from "@/architecture/anchor/AnchorMetrics";
import {
  generatedPageForAnchor,
  generatedPageDestination,
  type HorizontalSegment,
} from "@/architecture/anchor/HorizontalAnchorAdapter";
import {
  captureHorizontalFlipAnchor,
  horizontalPageForFlipAnchor,
} from "@/architecture/HorizontalSwipFlip";
import {
  proportionalWordIndex,
  sourceBlockId,
  toSourceAnchor,
  toTranslationAnchor,
  translatedBlockId,
} from "@/architecture/anchor/TranslationAnchorMapper";
import {
  anchorFromVisibleWord,
  verticalAnchorsMatch,
  verticalDestination,
  verticalRestoreMessage,
} from "@/architecture/anchor/VerticalAnchorAdapter";
import { originalDestination } from "@/architecture/anchor/OriginalAnchorAdapter";
import type { CanonicalAnchor } from "@/architecture/anchor/AnchorTypes";

const anchor: CanonicalAnchor = {
  documentId: "book-1",
  sourcePage: 22,
  sourceBlockId: "p22-b3",
  wordIndex: 7,
  characterOffset: 43,
  blockProgress: 0.35,
  revision: 8,
  updatedAt: "2026-09-04T00:00:00.000Z",
};

const portraitPages: HorizontalSegment[][] = [
  [{ blockId: "p22-b2", sourcePage: 22, startOffset: 0, text: "Previous block" }],
  [{ blockId: "p22-b3", sourcePage: 22, startOffset: 0, text: "012345678901234567890123456789" }],
  [{ blockId: "p22-b3", sourcePage: 22, startOffset: 30, text: "012345678901234567890123456789" }],
];
const landscapePages: HorizontalSegment[][] = [
  [{ blockId: "p22-b2", sourcePage: 22, startOffset: 0, text: "Previous block" }],
  [{ blockId: "p22-b3", sourcePage: 22, startOffset: 0, text: "01234567890123456789012345678901234567890123456789" }],
  [{ blockId: "p22-b3", sourcePage: 22, startOffset: 50, text: "0123456789" }],
];

describe("canonical anchor mapping", () => {
  test("translation round-trip preserves source identity and progress", () => {
    const translated = toTranslationAnchor(anchor, "es");
    expect(translated.translatedBlockId).toBe("translated-es-p22-b3");
    expect(toSourceAnchor(translated)).toMatchObject({
      documentId: anchor.documentId,
      sourcePage: anchor.sourcePage,
      sourceBlockId: anchor.sourceBlockId,
      blockProgress: anchor.blockProgress,
    });
  });

  test("translated IDs round-trip without corrupting ordinary IDs", () => {
    expect(sourceBlockId(translatedBlockId("p2-b7", "ar"), "ar")).toBe("p2-b7");
    expect(sourceBlockId("p2-b7", "ar")).toBe("p2-b7");
  });

  test("proportional word mapping is bounded and deterministic", () => {
    expect(proportionalWordIndex(0.35, 21)).toBe(7);
    expect(proportionalWordIndex(-2, 21)).toBe(0);
    expect(proportionalWordIndex(4, 21)).toBe(20);
    expect(proportionalWordIndex(0.5, 0)).toBe(0);
  });

  test("vertical capture and destination retain the exact word identity", () => {
    const captured = anchorFromVisibleWord({
      documentId: "book-1",
      sourcePage: 22,
      sourceBlockId: "p22-b3",
      wordIndex: 7,
      characterOffset: 43,
      wordCount: 21,
    });
    expect(captured.blockProgress).toBeCloseTo(0.35);
    expect(verticalDestination({ ...captured, revision: 1, updatedAt: "now" }, 99))
      .toMatchObject({ page: 22, blockId: "p22-b3", switchHighlightWordIndex: 7, nonce: 99 });
  });

  test("vertical restore messages retain an explicit document-start command", () => {
    expect(JSON.parse(verticalRestoreMessage({
      page: 1,
      blockId: "p1-b0",
      documentStart: true,
      nonce: 7,
    }))).toMatchObject({
      type: "goToSourcePage",
      page: 1,
      blockId: "p1-b0",
      documentStart: true,
    });
  });

  test("original PDF consumes the immutable source page", () => {
    expect(originalDestination(anchor, 42)).toEqual({ page: 22, nonce: 42 });
  });

  test("horizontal destination uses generated page without replacing source page", () => {
    expect(generatedPageDestination(311, anchor.sourcePage, 4)).toEqual({
      page: 22,
      readerPage: 311,
      nonce: 4,
    });
  });
});

describe("horizontal repagination", () => {
  test("finds the page containing the exact character after width changes", () => {
    expect(generatedPageForAnchor(portraitPages, anchor)).toBe(2);
    expect(generatedPageForAnchor(landscapePages, anchor)).toBe(1);
  });

  test("flip anchors survive repagination instead of retaining page numbers", () => {
    const blocks = [{ id: "p22-b3", text: "zero one two three four five six seven eight nine" }];
    const oldPage = [{ blockId: "p22-b3", sourcePage: 22, startOffset: 19, text: "four five" }];
    const captured = captureHorizontalFlipAnchor(oldPage, blocks);
    const newPages = [
      [{ blockId: "p22-b3", sourcePage: 22, startOffset: 0, text: "zero one two" }],
      [{ blockId: "p22-b3", sourcePage: 22, startOffset: 13, text: "three four five six" }],
      [{ blockId: "p22-b3", sourcePage: 22, startOffset: 33, text: "seven eight nine" }],
    ];
    expect(captured).toMatchObject({ blockId: "p22-b3", blockOffset: 19 });
    expect(horizontalPageForFlipAnchor(newPages, captured)).toBe(1);
  });
});

describe("accuracy scoring", () => {
  test("scores exact, near-word, wrong-block, and wrong-page landings", () => {
    expect(anchorAccuracyScore(anchor, anchor)).toBe(100);
    expect(anchorAccuracyScore(anchor, { ...anchor, blockProgress: 0.39 })).toBe(94);
    expect(anchorAccuracyScore(anchor, { ...anchor, sourceBlockId: "p22-b2" })).toBe(25);
    expect(anchorAccuracyScore(anchor, { ...anchor, sourcePage: 21 })).toBe(0);
  });

  test("verification tolerance accepts at most eight percent word progress drift", () => {
    expect(verticalAnchorsMatch(anchor, { ...anchor, blockProgress: 0.43 })).toBe(true);
    expect(verticalAnchorsMatch(anchor, { ...anchor, blockProgress: 0.431 })).toBe(false);
  });

  test("does not accept a different block merely because it is on the same page", () => {
    expect(verticalAnchorsMatch(anchor, {
      ...anchor,
      sourceBlockId: "p22-b2",
      blockProgress: 0,
    })).toBe(false);
  });

  test("allows the previous visible block only for an end-of-block destination", () => {
    expect(verticalAnchorsMatch(
      { ...anchor, blockProgress: 0.95 },
      { ...anchor, sourceBlockId: "p22-b2", blockProgress: 1 },
    )).toBe(true);
  });

  test("keeps only the latest 100 privacy-safe transition measurements", () => {
    resetTransitionMetrics();
    const log = jest.spyOn(console, "info").mockImplementation(() => undefined);
    for (let index = 0; index < 105; index += 1) {
      recordTransitionMetric({
        id: index,
        from: { mode: "reader", layout: "vertical" },
        target: { mode: "translated", layout: "horizontal" },
        durationMs: 400,
        accuracyScore: 100,
        status: "complete",
      });
    }
    expect(getRecentTransitionMetrics()).toHaveLength(100);
    expect(getRecentTransitionMetrics()[0].id).toBe(5);
    log.mockRestore();
  });

  test("summarizes real-device success, accuracy, and latency percentiles", () => {
    expect(summarizeTransitionMetrics([
      {
        id: 1,
        from: { mode: "reader", layout: "vertical" },
        target: { mode: "translated", layout: "vertical" },
        durationMs: 300,
        accuracyScore: 100,
        status: "complete",
      },
      {
        id: 2,
        from: { mode: "translated", layout: "vertical" },
        target: { mode: "reader", layout: "horizontal" },
        durationMs: 900,
        accuracyScore: 80,
        status: "complete",
      },
      {
        id: 3,
        from: { mode: "reader", layout: "horizontal" },
        target: { mode: "original", layout: "vertical" },
        durationMs: 2_000,
        status: "failed",
      },
    ])).toEqual({
      sampleSize: 3,
      successRate: 67,
      averageAccuracy: 90,
      p50Ms: 900,
      p95Ms: 2_000,
    });
  });
});
