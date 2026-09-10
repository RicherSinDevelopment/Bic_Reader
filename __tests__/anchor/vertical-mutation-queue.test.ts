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

test('queued batches drain individually rather than rebuilding the whole window at once', () => {
  const { window, listeners } = runtime();
  const first = jest.fn(), second = jest.fn();
  listeners.touchstart();
  window.__deferReaderAppend(1, first);
  window.__deferReaderAppend(2, second);
  listeners.touchend();
  jest.advanceTimersByTime(180);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  jest.advanceTimersByTime(180);
  expect(second).toHaveBeenCalledTimes(1);
});
