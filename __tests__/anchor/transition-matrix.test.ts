/// <reference types="jest" />

import type {
  CanonicalAnchor,
  TransitionTarget,
} from "@/architecture/anchor/AnchorTypes";
import { generatedPageDestination } from "@/architecture/anchor/HorizontalAnchorAdapter";
import { originalDestination } from "@/architecture/anchor/OriginalAnchorAdapter";
import { verticalDestination } from "@/architecture/anchor/VerticalAnchorAdapter";

const states: TransitionTarget[] = [
  { mode: "reader", layout: "vertical" },
  { mode: "reader", layout: "horizontal" },
  { mode: "original", layout: "vertical" },
];

const canonical: CanonicalAnchor = {
  documentId: "book-1",
  sourcePage: 119,
  sourceBlockId: "p119-b2",
  wordIndex: 8,
  characterOffset: 44,
  blockProgress: 0.4,
  revision: 3,
  updatedAt: "2026-09-04T00:00:00.000Z",
};

function destinationFor(state: TransitionTarget) {
  if (state.mode === "original") return originalDestination(canonical, 1);
  if (state.layout === "horizontal") {
    return generatedPageDestination(12, canonical.sourcePage, 1);
  }
  return verticalDestination(canonical, 1);
}

describe("reader transition matrix", () => {
  const transitions = states.flatMap((from) =>
    states
      .filter((target) => target !== from)
      .map((target) => ({ from, target })),
  );

  test.each(transitions)(
    "preserves source page from $from to $target",
    ({ target }) => {
      expect(destinationFor(target).page).toBe(canonical.sourcePage);
    },
  );

  test("covers every directed transition between supported states", () => {
    expect(transitions).toHaveLength(6);
  });
});
