import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../../components/ReaderView.tsx'), 'utf8');
const start = source.indexOf("      if (message.type === 'appendBlocks') {");
const end = source.indexOf("      if (message.type === 'setSwitchHighlightVisible')", start);
const script = source.slice(start, end)
  .replace(/\$\{PRESERVED_OPENING_PAGES\}/g, '5')
  .replace(/\$\{APPEND_BEHIND_PAGES\}/g, '12')
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
