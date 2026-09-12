import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../../components/ReaderView.tsx'), 'utf8');
const start = source.indexOf("      if (message.type === 'appendBlocks') {");
const end = source.indexOf("      if (message.type === 'setSwitchHighlightVisible')", start);
const script = source.slice(start, end)
  .replace(/\$\{PRESERVED_OPENING_PAGES\}/g, '5')
  .replace(/\$\{APPEND_BEHIND_PAGES\}/g, '48')
  .replace(/\$\{APPEND_AHEAD_PAGES\}/g, '24');

function append(navigating: boolean) {
  const sections: any[] = [1, 20, 100].map(page => ({
    dataset: { sourcePageSection: String(page) },
    getBoundingClientRect: () => ({ top: page === 20 ? 10 : 500, bottom: 800, height: 790 }),
    style: {}, replaceChildren: jest.fn(), remove: jest.fn(),
  }));
  const visible = sections[1];
  visible.closest = () => visible;
  const window = {
    innerWidth: 390, innerHeight: 800,
    __processedReaderRevisions: new Set(),
    __readerNavigation: { suppressed: navigating, generation: 1, begin: jest.fn(), settle: jest.fn() },
    __renderReaderAnnotations: jest.fn(),
    ReactNativeWebView: { postMessage: jest.fn() },
    scrollBy: jest.fn(),
  };
  const document = {
    documentElement: { dir: 'ltr' },
    getElementById: (id: string) => id === 'reader-pages' ? { children: sections } : null,
    elementFromPoint: () => visible,
  };
  new Function('window', 'document', 'message', script)(window, document, {
    type: 'appendBlocks', revision: 1, html: '', keepStart: 8, keepEnd: 44,
  });
  return { window, sections };
}

test('background delivery neither suppresses momentum reports nor prunes above/below the viewport', () => {
  const { window, sections } = append(false);
  expect(window.__readerNavigation.begin).not.toHaveBeenCalled();
  expect(window.__readerNavigation.settle).not.toHaveBeenCalled();
  expect(window.scrollBy).not.toHaveBeenCalled();
  sections.forEach(section => expect(section.remove).not.toHaveBeenCalled());
});

test('a covered destination can still bound the DOM without replacing navigation ownership', () => {
  const { window, sections } = append(true);
  expect(sections[2].remove).not.toHaveBeenCalled();
  expect(sections[2].replaceChildren).toHaveBeenCalled();
  expect(sections[2].style.minHeight).toBe('790px');
  expect(sections[2].dataset.readerPlaceholder).toBe('true');
  expect(sections[0].remove).not.toHaveBeenCalled();
  expect(sections[1].remove).not.toHaveBeenCalled();
  expect(window.__readerNavigation.begin).not.toHaveBeenCalled();
  expect(window.__readerNavigation.settle).not.toHaveBeenCalled();
});


test('queued prepends preserve one viewport anchor and compensate once for their combined height', () => {
  const { window, sections } = append(false);
  let top = 10;
  sections[1].getBoundingClientRect = () => ({ top, bottom: top + 790, height: 790 });
  const batch: any = {};
  (window as any).__readerAppendBatch = batch;
  window.__renderReaderAnnotations.mockImplementation(() => { top += 1500; });
  const document = {
    documentElement: { dir: 'ltr' },
    getElementById: (id: string) => id === 'reader-pages' ? { children: sections } : null,
    elementFromPoint: () => sections[1],
  };
  const deliver = new Function('window', 'document', 'message', script);
  for (const revision of [2, 3, 4]) {
    deliver(window, document, { type: 'appendBlocks', revision, html: '' });
  }
  expect(window.scrollBy).not.toHaveBeenCalled();
  batch.restore();
  expect(window.scrollBy).toHaveBeenCalledTimes(1);
  expect(window.scrollBy).toHaveBeenCalledWith(0, 4500);
});

test('prepend corrections do not trigger user-scroll reporting, but actual movement does', () => {
  const start = source.indexOf('                  // A prepend correction preserves');
  const end = source.indexOf('                  if (searchHighlightDismissArmed)', start);
  const report = jest.fn();
  const handle = new Function('window', 'redrawLineGuideDuringScroll', 'report',
    source.slice(start, end) + '\nreport();');
  const window = { scrollY: 4500, __readerAppendCorrectionY: 4500 as number | null };
  handle(window, jest.fn(), report);
  expect(report).not.toHaveBeenCalled();
  window.scrollY = 4600;
  handle(window, jest.fn(), report);
  expect(report).toHaveBeenCalledTimes(1);
});

test('idle pruning never opens a navigation-suppressed interval for native momentum', () => {
  const { window, sections } = append(false);
  (window as any).__readerTransition = 'scroll';
  const start = source.indexOf('              function pruneDistantSections(rotationRadius)');
  const end = source.indexOf('              window.__prepareVerticalRotation', start);
  const prune = source.slice(start, end)
    .replace(/\$\{PRUNE_BEHIND_PAGES\}/g, '48')
    .replace(/\$\{PRESERVED_OPENING_PAGES\}/g, '5');
  const document = {
    documentElement: { dir: 'ltr' },
    querySelectorAll: () => sections,
    elementFromPoint: () => sections[1],
  };
  new Function('window', 'document', 'readerVisibleTopBoundary', prune + '\npruneDistantSections(4);')(
    window, document, () => 0,
  );
  expect(sections[2].dataset.readerPlaceholder).toBe('true');
  expect(window.__readerNavigation.begin).not.toHaveBeenCalled();
  expect(window.__readerNavigation.settle).not.toHaveBeenCalled();
});
