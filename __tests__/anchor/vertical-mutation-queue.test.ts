import { VERTICAL_MUTATION_QUEUE } from '@/architecture/anchor/VerticalMutationQueue';
function runtime() {
  const listeners: Record<string, () => void> = {};
  const window: any = { __readerNavigation: { suppressed: false },
    addEventListener: (name: string, fn: () => void) => { listeners[name] = fn; } };
  new Function('window', VERTICAL_MUTATION_QUEUE)(window);
  return { window, listeners };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
test('defers batches throughout touch and momentum, applying each revision once after idle', () => {
  const { window, listeners } = runtime();
  const apply = jest.fn();
  listeners.touchstart();
  expect(window.__deferReaderAppend(1, apply)).toBe(true);
  window.__deferReaderAppend(1, apply);
  jest.advanceTimersByTime(1000);
  expect(apply).not.toHaveBeenCalled();
  listeners.touchend();
  for (let i = 0; i < 10; i++) {
    listeners.scroll();
    jest.advanceTimersByTime(80);
  }
  expect(apply).not.toHaveBeenCalled();
  jest.advanceTimersByTime(180);
  expect(apply).toHaveBeenCalledTimes(1);
});
test('explicit navigation and initial delivery do not wait for background idle', () => {
  const { window, listeners } = runtime();
  expect(window.__deferReaderAppend(1, jest.fn())).toBe(false);
  listeners.scroll();
  window.__readerNavigation.suppressed = true;
  expect(window.__deferReaderAppend(2, jest.fn())).toBe(false);
});
test('a cancelled touch releases pending work', () => {
  const { window, listeners } = runtime();
  const apply = jest.fn();
  listeners.touchstart(); window.__deferReaderAppend(1, apply);
  listeners.touchcancel(); jest.advanceTimersByTime(180);
  expect(apply).toHaveBeenCalledTimes(1);
});

test('rotation blocks background delivery even while navigation is suppressed', () => {
  const { window } = runtime();
  const apply = jest.fn();
  window.__readerNavigation.suppressed = true;
  window.__verticalScrollFlipRestoring = true;
  expect(window.__deferReaderAppend(1, apply)).toBe(true);
  jest.advanceTimersByTime(1000);
  expect(apply).not.toHaveBeenCalled();
  window.__verticalScrollFlipRestoring = false;
  window.__readerNavigation.suppressed = false;
  jest.advanceTimersByTime(180);
  expect(apply).toHaveBeenCalledTimes(1);
});

test('queued batches share a bounded transaction and restore the viewport once', () => {
  const { window, listeners } = runtime();
  const restore = jest.fn();
  const first = jest.fn(() => { window.__readerAppendBatch.restore = restore; });
  const second = jest.fn(() => { window.__readerAppendBatch.restore = restore; });
  listeners.touchstart();
  window.__deferReaderAppend(1, first);
  window.__deferReaderAppend(2, second);
  listeners.touchend();
  jest.advanceTimersByTime(180);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(restore).toHaveBeenCalledTimes(1);
  expect(window.__readerAppendBatch).toBeNull();
});


test('a long backlog yields after four messages so touch handling can resume', () => {
  const { window, listeners } = runtime();
  const apply = jest.fn();
  listeners.touchstart();
  for (let revision = 0; revision < 9; revision++) window.__deferReaderAppend(revision, apply);
  listeners.touchend();
  jest.advanceTimersByTime(180);
  expect(apply).toHaveBeenCalledTimes(4);
  listeners.touchstart();
  jest.advanceTimersByTime(360);
  expect(apply).toHaveBeenCalledTimes(4);
});
