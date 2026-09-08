/// <reference types="jest" />

import { AnchorController } from "@/architecture/anchor/AnchorController";
import { useAnchorStore } from "@/architecture/anchor/AnchorStore";
import { TransitionController } from "@/architecture/anchor/TransitionController";
import type {
  AnchorAdapter,
  CanonicalAnchor,
} from "@/architecture/anchor/AnchorTypes";

jest.mock("@/services/errorReporting", () => ({
  addSafeBreadcrumb: jest.fn(),
  captureOperationalMessage: jest.fn(),
}));

const canonical: CanonicalAnchor = {
  documentId: "book",
  sourcePage: 20,
  sourceBlockId: "p20-b5",
  wordIndex: 18,
  characterOffset: 100,
  blockProgress: 0.5,
  revision: 4,
  updatedAt: "2026-09-04T00:00:00.000Z",
};

function resetStore() {
  useAnchorStore.setState({
    canonicalAnchor: null,
    activeMode: "reader",
    activeLayout: "vertical",
    transition: { id: 0, phase: "idle", status: "idle" },
  });
}

describe("AnchorController authority", () => {
  beforeEach(resetStore);

  test("normalizes candidates and persists authoritative movement", () => {
    const controller = new AnchorController();
    const persisted = jest.fn();
    controller.setPersistenceScheduler(persisted);
    const result = controller.publish(
      {
        documentId: "book",
        sourcePage: 19.6,
        wordIndex: -3,
        blockProgress: 4,
      },
      "reader-user",
    );
    expect(result).toMatchObject({
      sourcePage: 20,
      wordIndex: 0,
      blockProgress: 1,
    });
    expect(persisted).toHaveBeenCalledWith(result);
  });

  test("rejects renderer noise, invalid pages, and stale revisions", () => {
    const controller = new AnchorController();
    controller.initialize(canonical);
    expect(
      controller.publish({ ...canonical, sourcePage: 99 }, "renderer"),
    ).toEqual(canonical);
    expect(
      controller.publish({ ...canonical, sourcePage: 0 }, "reader-user"),
    ).toEqual(canonical);
    expect(
      controller.publish(
        { ...canonical, sourcePage: 21, revision: 3 },
        "reader-user",
      ),
    ).toEqual(canonical);
  });
});

describe("TransitionController transaction", () => {
  beforeEach(() => {
    resetStore();
    jest.useFakeTimers();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function adapter(verifyResults: boolean[] = [true]): AnchorAdapter {
    let verification = 0;
    return {
      waitUntilReady: jest.fn(async () => true),
      restore: jest.fn(async () => ({ ok: true, retryable: true })),
      verify: jest.fn(async (expected) => ({
        ok: verifyResults[Math.min(verification++, verifyResults.length - 1)],
        expected,
        actual: expected,
      })),
    };
  }

  test("commits mode/layout only after restore verification", async () => {
    const controller = new TransitionController();
    const destination = adapter();
    const result = controller.run({
      from: { mode: "reader", layout: "vertical" },
      target: { mode: "original", layout: "horizontal" },
      capture: () => canonical,
      adapter: destination,
    });
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe(true);
    expect(destination.restore).toHaveBeenCalledTimes(1);
    expect(useAnchorStore.getState()).toMatchObject({
      activeMode: "original",
      activeLayout: "horizontal",
      transition: { status: "complete" },
    });
  });

  test("retries one failed verification and then succeeds", async () => {
    const controller = new TransitionController();
    const destination = adapter([false, true]);
    const result = controller.run({
      from: { mode: "reader", layout: "vertical" },
      target: { mode: "reader", layout: "horizontal" },
      capture: () => canonical,
      adapter: destination,
    });
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe(true);
    expect(destination.restore).toHaveBeenCalledTimes(2);
    expect(destination.verify).toHaveBeenCalledTimes(2);
  });

  test("fails closed after both verification attempts miss", async () => {
    const controller = new TransitionController();
    const destination = adapter([false, false]);
    const result = controller.run({
      from: { mode: "reader", layout: "vertical" },
      target: { mode: "original", layout: "vertical" },
      capture: () => canonical,
      adapter: destination,
    });
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBe(false);
    expect(useAnchorStore.getState().transition.status).toBe("failed");
  });

  test("a newer transition supersedes an older capture", async () => {
    const controller = new TransitionController();
    let releaseCapture!: (anchor: CanonicalAnchor) => void;
    const delayedCapture = new Promise<CanonicalAnchor>((resolve) => {
      releaseCapture = resolve;
    });
    const first = controller.run({
      from: { mode: "reader", layout: "vertical" },
      target: { mode: "original", layout: "vertical" },
      capture: () => delayedCapture,
      adapter: adapter(),
    });
    const second = controller.run({
      from: { mode: "reader", layout: "vertical" },
      target: { mode: "original", layout: "vertical" },
      capture: () => canonical,
      adapter: adapter(),
    });
    releaseCapture(canonical);
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(useAnchorStore.getState().activeMode).toBe("original");
  });
});
