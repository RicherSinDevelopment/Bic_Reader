import fs from 'fs';
import path from 'path';

// Execute the shipped scroll listener, including its real timers and guards.
const source = fs.readFileSync(path.join(__dirname, '../../components/ReaderView.tsx'), 'utf8');
const start = source.indexOf('              let scrollTimer = null;');
const end = source.indexOf('              let selectionTimeout = null;', start);

function runtime() {
  let scroll: () => void = () => {};
  const report = jest.fn();
  const prune = jest.fn();
  const window = {
    scrollY: 0,
    __readerNavigation: { suppressed: false },
    __verticalScrollFlipRestoring: false,
    ReactNativeWebView: { postMessage: jest.fn() },
    addEventListener: (_: string, listener: () => void) => { scroll = listener; },
  };
  new Function('window', 'document', 'reportSwitchAnchor', 'pruneDistantSections',
    'redrawLineGuideDuringScroll', 'searchHighlightDismissArmed', 'sourcePageAtViewport', source.slice(start, end))(
    window, { documentElement: { scrollHeight: 50000 }, getElementById: () => null },
    report, prune, jest.fn(), false, () => 20,
  );
  return { window, scroll, report, prune };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('reports during continuous momentum and resumes without waiting for idle', () => {
  const r = runtime();
  for (let i = 0; i < 10; i++) {
    r.window.scrollY += 40;
    r.scroll();
    jest.advanceTimersByTime(80);
    expect(r.report).toHaveBeenCalledTimes(i + 1);
  }
  expect(r.prune).not.toHaveBeenCalled();
  jest.advanceTimersByTime(300);
  r.window.scrollY -= 10;
  r.scroll();
  jest.advanceTimersByTime(80);
  expect(r.report).toHaveBeenCalledTimes(11);
});

test('coalesces bursts and ignores navigation or rotation scrolls', () => {
  const r = runtime();
  r.scroll(); r.scroll(); r.scroll();
  jest.advanceTimersByTime(80);
  expect(r.report).toHaveBeenCalledTimes(1);
  r.scroll();
  r.window.__readerNavigation.suppressed = true;
  jest.advanceTimersByTime(80);
  r.scroll();
  jest.advanceTimersByTime(200);
  expect(r.report).toHaveBeenCalledTimes(1);
  r.window.__readerNavigation.suppressed = false;
  r.window.__verticalScrollFlipRestoring = true;
  r.scroll();
  jest.advanceTimersByTime(80);
  expect(r.report).toHaveBeenCalledTimes(1);
  r.window.__verticalScrollFlipRestoring = false;
  r.scroll();
  jest.advanceTimersByTime(80);
  expect(r.report).toHaveBeenCalledTimes(2);
});
