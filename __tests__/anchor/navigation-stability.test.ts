import { AnchorController } from "@/architecture/anchor/AnchorController";
import { useAnchorStore } from "@/architecture/anchor/AnchorStore";
import {
  pageStartAnchor,
  resolveAnchor,
} from "@/architecture/anchor/AnchorResolution";
import { VERTICAL_NAVIGATION_RUNTIME } from "@/architecture/anchor/VerticalNavigationRuntime";

const blocks = [
  { id: "p1-b0", page: 1, text: "Beginning of book" },
  { id: "p200-b0", page: 200, text: "New chapter begins here" },
];
const saved = {
  documentId: "book",
  sourcePage: 200,
  sourceBlockId: "p200-b0",
  wordIndex: 2,
  characterOffset: 12,
  blockProgress: 2 / 3,
  revision: 1,
  updatedAt: "2026-09-08",
};

beforeEach(() => useAnchorStore.getState().resetForDocument("book"));

test("document reset removes the previous in-memory resume even for the same document", () => {
  const controller = new AnchorController();
  controller.initialize(saved);
  useAnchorStore.getState().resetForDocument("book");
  expect(
    controller.initialize(pageStartAnchor("book", 1, blocks))?.sourcePage,
  ).toBe(1);
});

test("page start does not carry old precision or borrow a later extracted page", () => {
  expect(pageStartAnchor("book", 200, blocks)).toMatchObject({
    sourceBlockId: "p200-b0",
    wordIndex: 0,
    characterOffset: 0,
    blockProgress: 0,
  });
  expect(pageStartAnchor("book", 100, blocks)).toMatchObject({
    sourcePage: 100,
    sourceBlockId: undefined,
  });
});

test("malformed exact anchors degrade within their requested page", () => {
  expect(
    resolveAnchor({ ...saved, sourcePage: 1 }, "book", 200, blocks),
  ).toMatchObject({ sourcePage: 1, sourceBlockId: "p1-b0", wordIndex: 0 });
  expect(resolveAnchor(saved, "other", 200, blocks)).toBeNull();
  expect(resolveAnchor(saved, "book", 10, blocks)).toBeNull();
  expect(resolveAnchor(saved, "book", 200, blocks)).toMatchObject({
    wordIndex: 2,
    characterOffset: 12,
  });
});

test("desired navigation excludes observations and is persisted only on completion", () => {
  const controller = new AnchorController();
  const persist = jest.fn();
  controller.setPersistenceScheduler(persist);
  controller.initialize(pageStartAnchor("book", 1, blocks));
  const desired = controller.navigate(saved, "toc")!;
  controller.publish({ ...saved, sourcePage: 50 }, "reader-user");
  expect(controller.current()?.sourcePage).toBe(1);
  expect(persist).not.toHaveBeenCalled();
  controller.completeNavigation(desired);
  expect(controller.current()?.sourcePage).toBe(200);
  expect(persist).toHaveBeenCalledTimes(1);
});

test("running transitions reject observations even without a pending target", () => {
  const controller = new AnchorController();
  controller.initialize(saved);
  useAnchorStore
    .getState()
    .setTransition({ id: 10, phase: "capture", status: "running" });
  controller.publish({ ...saved, sourcePage: 1 }, "reader-user");
  expect(controller.current()?.sourcePage).toBe(200);
});

function runtime() {
  let nextFrame = 0;
  const frames = new Map<number, () => void>();
  const viewport: any = { scrollY: 0, innerWidth: 390, innerHeight: 800 };
  const document = { documentElement: { scrollHeight: 1000 } };
  new Function(
    "window",
    "document",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    VERTICAL_NAVIGATION_RUNTIME,
  )(
    viewport,
    document,
    (callback: () => void) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    (id: number) => frames.delete(id),
  );
  return {
    viewport,
    document,
    navigation: viewport.__readerNavigation,
    frame() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    },
  };
}

test("restoration waits for three stable frames including document height", () => {
  const r = runtime();
  const done = jest.fn();
  r.navigation.settle(r.navigation.begin(10), null, done);
  r.frame();
  r.frame();
  r.document.documentElement.scrollHeight += 3000;
  r.viewport.scrollY += 3000;
  r.frame();
  r.frame();
  r.frame();
  expect(done).not.toHaveBeenCalled();
  expect(r.navigation.suppressed).toBe(true);
  r.frame();
  expect(done).toHaveBeenCalledWith(true);
  expect(r.navigation.suppressed).toBe(false);
});

test("superseded layout/navigation and user cancellation invalidate queued completion", () => {
  const r = runtime();
  const old = jest.fn();
  r.navigation.settle(r.navigation.begin(9), null, old);
  r.navigation.begin(10);
  for (let i = 0; i < 5; i++) r.frame();
  expect(old).not.toHaveBeenCalled();
  r.navigation.settle(r.navigation.generation, null, old);
  r.navigation.cancel();
  for (let i = 0; i < 5; i++) r.frame();
  expect(old).not.toHaveBeenCalled();
  expect(r.navigation.suppressed).toBe(false);
});
