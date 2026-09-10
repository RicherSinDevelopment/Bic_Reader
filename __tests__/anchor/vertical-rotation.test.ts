import { VERTICAL_SCROLL_FLIP_SCRIPT } from "@/architecture/VerticalScroolFlip";
import { VERTICAL_NAVIGATION_RUNTIME } from "@/architecture/anchor/VerticalNavigationRuntime";
import { VERTICAL_ANCHOR_PROBE } from "@/architecture/anchor/VerticalAnchorProbe";

function renderer() {
  let id = 0;
  const frames = new Map<number, () => void>();
  const listeners = new Map<string, (() => void)[]>();
  const text = { textContent: "one two three", nodeType: 3 };
  const block = {
    contains: (node: unknown) => node === text,
    getBoundingClientRect: () => ({ left: 24, right: 366 }),
  };
  let wordDocumentTop = 600;
  const window: any = {
    innerWidth: 390,
    innerHeight: 844,
    scrollY: 400,
    __readerTopBoundary: 128,
    __readerTransition: "scroll",
    ReactNativeWebView: { postMessage: jest.fn() },
    __reportSwitchAnchor: jest.fn(),
    addEventListener: (name: string, callback: () => void) =>
      listeners.set(name, [...(listeners.get(name) ?? []), callback]),
    scrollBy: jest.fn((_x, y) => {
      window.scrollY += y;
    }),
    scrollTo: jest.fn((_x, y) => {
      window.scrollY = y;
    }),
  };
  const document: any = {
    documentElement: { scrollHeight: 4000, dir: "ltr" },
    querySelector: jest.fn(() => block),
    querySelectorAll: jest.fn(() => {
      throw new Error("whole-document scan");
    }),
    createTreeWalker: () => {
      let read = false;
      return {
        nextNode: () => {
          if (read) return null;
          read = true;
          return text;
        },
      };
    },
    createRange: jest.fn(() => ({
      setStart: jest.fn(),
      setEnd: jest.fn(),
      getBoundingClientRect: () => ({
        top: wordDocumentTop - window.scrollY,
        bottom: wordDocumentTop - window.scrollY + 20,
        height: 20,
        width: 30,
        left: 24,
        right: 54,
      }),
    })),
    elementFromPoint: jest.fn(() => ({ closest: () => block })),
    caretRangeFromPoint: jest.fn(() => ({
      startContainer: text,
      startOffset: 4,
    })),
  };
  const run = (script: string) =>
    new Function(
      "window",
      "document",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "NodeFilter",
      "CSS",
      script,
    )(
      window,
      document,
      (cb: () => void) => {
        frames.set(++id, cb);
        return id;
      },
      (key: number) => frames.delete(key),
      { SHOW_TEXT: 4 },
      { escape: (value: string) => value },
    );
  run(VERTICAL_NAVIGATION_RUNTIME);
  run(VERTICAL_SCROLL_FLIP_SCRIPT);
  return {
    window,
    document,
    run,
    setWordTop(top: number) {
      wordDocumentTop = top;
    },
    emit(name: string) {
      listeners.get(name)?.forEach((callback) => callback());
    },
    settle() {
      for (let i = 0; i < 12; i++) {
        const batch = [...frames.values()];
        frames.clear();
        batch.forEach((callback) => callback());
      }
    },
    remember(extra = {}) {
      window.__rememberVerticalAnchor({
        blockId: "b1",
        offset: 4,
        length: 3,
        edgeOffset: 8,
        documentStart: false,
        ...extra,
      });
    },
  };
}

test("portrait-to-landscape restores the saved word against the new chrome boundary", () => {
  const r = renderer();
  r.remember();
  r.window.innerWidth = 844;
  r.window.innerHeight = 390;
  r.window.__readerTopBoundary = 0;
  r.emit("resize");
  r.settle();
  expect(r.window.scrollY).toBe(592);
  expect(r.window.scrollBy).toHaveBeenCalledTimes(1);
  expect(r.document.querySelectorAll).not.toHaveBeenCalled();
  expect(
    JSON.parse(r.window.ReactNativeWebView.postMessage.mock.calls[0][0]).ok,
  ).toBe(true);
});

test("rapid resize pulses keep the original semantic target and restore once", () => {
  const r = renderer();
  r.remember();
  for (const width of [600, 740, 844]) {
    r.window.innerWidth = width;
    r.emit("resize");
  }
  r.window.__rememberVerticalAnchor({ blockId: "wrong", offset: 0 });
  r.settle();
  expect(r.document.querySelector).toHaveBeenCalledWith('[data-block-id="b1"]');
  expect(r.window.scrollBy).toHaveBeenCalledTimes(1);
});

test("a second rotation uses the newly observed word and new header boundary", () => {
  const r = renderer();
  r.remember();
  r.window.innerWidth = 844;
  r.window.__readerTopBoundary = 0;
  r.emit("resize");
  r.settle();
  r.remember();
  r.setWordTop(900);
  r.window.innerWidth = 390;
  r.window.__readerTopBoundary = 128;
  r.emit("resize");
  r.settle();
  expect(r.window.scrollY).toBe(764);
  expect(r.window.scrollBy).toHaveBeenCalledTimes(2);
});

test("document start stays at absolute zero through rotation", () => {
  const r = renderer();
  r.remember({ documentStart: true });
  r.window.innerWidth = 844;
  r.emit("resize");
  r.settle();
  expect(r.window.scrollY).toBe(0);
});

test("touch takeover cancels queued rotation correction", () => {
  const r = renderer();
  r.remember();
  r.window.innerWidth = 844;
  r.emit("resize");
  r.emit("touchstart");
  r.window.__readerNavigation.cancel();
  r.settle();
  expect(r.window.scrollBy).not.toHaveBeenCalled();
  expect(r.window.__verticalScrollFlipRestoring).toBe(false);
});

test("height-only chrome changes do not rotate or restore", () => {
  const r = renderer();
  r.remember();
  r.window.innerHeight = 700;
  r.emit("resize");
  r.settle();
  expect(r.window.scrollBy).not.toHaveBeenCalled();
});

test("word probing has bounded range measurements and never scans document blocks", () => {
  const r = renderer();
  r.run(VERTICAL_ANCHOR_PROBE);
  const anchor = r.window.__probeReaderAnchor(128);
  expect(anchor.match[0]).toBe("two");
  expect(r.document.createRange.mock.calls.length).toBeLessThanOrEqual(56);
  expect(r.document.querySelectorAll).not.toHaveBeenCalled();
});

test("missing rotation anchors report failure without publishing the displaced viewport", () => {
  const r = renderer();
  r.window.innerWidth = 844;
  r.emit("resize");
  r.settle();
  expect(JSON.parse(r.window.ReactNativeWebView.postMessage.mock.calls[0][0]).ok).toBe(false);
  expect(r.window.__reportSwitchAnchor).not.toHaveBeenCalled();
});

test('deep-document rotation trims before restoring through the exact word resolver', () => {
  const r = renderer();
  r.window.scrollY = 108335;
  r.setWordTop(108535);
  r.window.__prepareVerticalRotation = jest.fn();
  r.window.__resolveReaderWord = jest.fn(() => ({ range: {
    getBoundingClientRect: () => ({ top: 108535 - r.window.scrollY, height: 20 }),
  } }));
  r.remember();
  r.window.innerWidth = 844;
  r.window.__readerTopBoundary = 0;
  r.emit('resize');
  expect(r.window.__prepareVerticalRotation).toHaveBeenCalledTimes(1);
  r.settle();
  expect(r.window.__resolveReaderWord).toHaveBeenCalledWith(expect.anything(), 4);
  expect(r.window.scrollY).toBe(108527);
  expect(r.window.scrollBy).toHaveBeenCalledTimes(1);
});
