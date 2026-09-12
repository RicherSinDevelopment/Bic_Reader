import { VERTICAL_LOADED_BOUNDARY } from '../../architecture/anchor/VerticalLoadedBoundary';

function reader() {
  const listeners: Record<string, Function> = {};
  const window: any = {
    scrollY: 2000, innerWidth: 390, innerHeight: 800,
    __readerTransition: 'scroll', __readerNavigation: { suppressed: false },
    ReactNativeWebView: { postMessage: jest.fn() },
    addEventListener: (name: string, fn: Function) => { listeners[name] = fn; },
    scrollTo: jest.fn((_: number, y: number) => { window.scrollY = y; }),
  };
  const sections = [0, 1, 2, 3, 4].map((index) => ({
    dataset: { sourcePageSection: String(268 + index), readerPlaceholder: index === 0 || index === 4 ? 'true' : undefined },
    getBoundingClientRect: () => ({ top: index * 1000 - window.scrollY, bottom: (index + 1) * 1000 - window.scrollY }),
    closest() { return this; },
  }));
  const document = {
    getElementById: () => ({ children: sections }),
    elementFromPoint: () => sections[Math.min(4, Math.floor(window.scrollY / 1000))],
  };
  new Function('window', 'document', VERTICAL_LOADED_BOUNDARY)(window, document);
  return { window, sections, listeners, document };
}

test('fast upward momentum stops at the first mounted page and requests delivery', () => {
  const { window, listeners } = reader();
  window.scrollY = 200;
  listeners.scroll();
  expect(window.scrollY).toBe(1000);
  expect(JSON.parse(window.ReactNativeWebView.postMessage.mock.calls.find(([message]: [string]) => JSON.parse(message).type === 'readerWindowPage')[0]).page).toBe(269);
});

test('downward momentum keeps the viewport above the next empty placeholder', () => {
  const { window, listeners } = reader();
  window.scrollY = 4200;
  listeners.scroll();
  expect(window.scrollY).toBe(3200);
});

test('the upward boundary opens when the previous page finishes mounting', () => {
  const { window, sections, listeners } = reader();
  window.scrollY = 200;
  listeners.scroll();
  delete sections[0].dataset.readerPlaceholder;
  window.scrollY = 200;
  listeners.scroll();
  expect(window.scrollY).toBe(200);
});

test('a finger drag into unloaded pages is prevented but reversing remains possible', () => {
  const { window, listeners } = reader();
  window.scrollY = 1000;
  listeners.touchstart({ touches: [{ clientY: 200 }] });
  const preventDefault = jest.fn();
  listeners.touchmove({ touches: [{ clientY: 300 }], cancelable: true, preventDefault });
  expect(preventDefault).toHaveBeenCalledTimes(1);
  listeners.touchmove({ touches: [{ clientY: 250 }], cancelable: true, preventDefault });
  expect(preventDefault).toHaveBeenCalledTimes(1);
});

test('explicit navigation and rotation can cross unloaded regions', () => {
  const { window, listeners } = reader();
  window.__readerNavigation.suppressed = true;
  window.scrollY = 4000;
  listeners.scroll();
  expect(window.scrollTo).not.toHaveBeenCalled();
});

test('a TOC destination cannot scroll back into an earlier loaded island across missing sections', () => {
  const { window, sections, listeners } = reader();
  // The DOM has page 51 immediately before 188: pages 52–187 were never mounted.
  sections[0].dataset.sourcePageSection = '50';
  sections[1].dataset.sourcePageSection = '51';
  sections[2].dataset.sourcePageSection = '188';
  sections[3].dataset.sourcePageSection = '189';
  window.__readerTextPages = [50, 51, 52, 187, 188, 189];
  window.scrollY = 1900;
  listeners.scroll();
  expect(window.scrollY).toBe(2000);
  expect(JSON.parse(window.ReactNativeWebView.postMessage.mock.calls.find(([message]: [string]) => JSON.parse(message).type === 'readerWindowPage')[0]).page).toBe(188);
});

test('the old loaded island also cannot scroll forward across unmounted text', () => {
  const { window, sections, listeners } = reader();
  sections[3].dataset.sourcePageSection = '400';
  window.__readerTextPages = [268, 269, 270, 271, 400];
  window.scrollY = 3100;
  listeners.scroll();
  expect(window.scrollY).toBe(2200);
});

test('genuinely blank source pages do not create a permanent scroll barrier', () => {
  const { window, sections, listeners } = reader();
  sections[1].dataset.sourcePageSection = '260';
  window.__readerBlankPages = new Set([261, 262, 263, 264, 265, 266, 267, 268, 269]);
  window.scrollY = 1500;
  listeners.scroll();
  expect(window.scrollY).toBe(1500);
});

test('filling a missing section reconnects the loaded islands', () => {
  const { window, sections, listeners } = reader();
  sections[1].dataset.sourcePageSection = '266';
  window.__readerBlankPages = new Set([268, 269]);
  window.scrollY = 1500;
  listeners.scroll();
  expect(window.scrollY).toBe(2000);
  sections.splice(2, 0, {
    dataset: { sourcePageSection: '267', readerPlaceholder: undefined },
    getBoundingClientRect: () => ({ top: 1750 - window.scrollY, bottom: 2000 - window.scrollY }),
    closest() { return this; },
  });
  window.scrollY = 1500;
  listeners.scroll();
  expect(window.scrollY).toBe(1500);
});


test('partial extraction cannot misclassify a large unknown gap as blank', () => {
  const { window, sections, listeners } = reader();
  sections[1].dataset.sourcePageSection = '50';
  sections[2].dataset.sourcePageSection = '188';
  sections[3].dataset.sourcePageSection = '189';
  // This is the real TOC case: even the extracted text inventory is sparse.
  window.__readerTextPages = [50, 188, 189];
  window.__readerBlankPages = new Set([51]);
  window.scrollY = 1900;
  listeners.scroll();
  expect(window.scrollY).toBe(2000);
  expect(window.ReactNativeWebView.postMessage).toHaveBeenCalledWith(
    JSON.stringify({ type: 'readerBoundaryPage', page: 187 })
  );
});


test('the end of the loaded DOM stops scrolling even without a following placeholder', () => {
  const { window, sections, listeners } = reader();
  sections.pop();
  window.__readerHasMore = true;
  window.scrollY = 4100;
  listeners.scroll();
  expect(window.scrollY).toBe(3200);
});

test('the bottom limit expands when another page is mounted', () => {
  const { window, sections, listeners } = reader();
  window.__readerHasMore = true;
  window.scrollY = 4100;
  listeners.scroll();
  expect(window.scrollY).toBe(3200);
  delete sections[4].dataset.readerPlaceholder;
  window.scrollY = 4100;
  listeners.scroll();
  expect(window.scrollY).toBe(4100);
});


test('a new finger landing after native overshoot cannot adopt the old loaded island', () => {
  const { window, sections, listeners } = reader();
  sections[1].dataset.sourcePageSection = '54';
  sections[2].dataset.sourcePageSection = '188';
  sections[3].dataset.sourcePageSection = '189';
  window.scrollY = 1900;
  listeners.touchstart({ touches: [{ clientY: 200 }] });
  expect(window.scrollY).toBe(2000);
  window.scrollY = 1800;
  listeners.scroll();
  expect(window.scrollY).toBe(2000);
});

test('a reverse drag cannot capture an already overshot section before its scroll event', () => {
  const { window, sections, listeners } = reader();
  sections[1].dataset.sourcePageSection = '54';
  sections[2].dataset.sourcePageSection = '188';
  sections[3].dataset.sourcePageSection = '189';
  listeners.touchstart({ touches: [{ clientY: 300 }] });
  window.scrollY = 1900;
  listeners.touchmove({ touches: [{ clientY: 100 }], cancelable: true, preventDefault: jest.fn() });
  listeners.scroll();
  expect(window.scrollY).toBe(2000);
});

test('margin hit tests update the anchor before its former section is pruned', () => {
  const { window, sections, listeners, document } = reader();
  document.elementFromPoint = () => null as any;
  window.scrollY = 1100;
  listeners.scroll();
  sections[2].dataset.readerPlaceholder = 'true';
  window.scrollY = 200;
  listeners.scroll();
  expect(window.scrollY).toBe(1000);
});

test('explicit navigation settlement can deliberately transfer boundary ownership', () => {
  const { window, sections, listeners } = reader();
  sections[1].dataset.sourcePageSection = '54';
  sections[2].dataset.sourcePageSection = '188';
  window.__readerNavigation.suppressed = true;
  window.scrollY = 1100;
  listeners.scroll();
  window.__captureReaderLoadedBoundary();
  window.__readerNavigation.suppressed = false;
  window.scrollY = 1900;
  listeners.scroll();
  expect(window.scrollY).toBe(1200);
});
