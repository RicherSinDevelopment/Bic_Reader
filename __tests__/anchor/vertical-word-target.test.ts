import { VERTICAL_WORD_TARGET } from '@/architecture/anchor/VerticalWordTarget';

function runtime(parts: string[]) {
  const nodes = parts.map(textContent => ({ textContent, isConnected: true, parentElement: { closest: () => null } }));
  let scrollY = 0;
  const window: any = { __readerTopBoundary: 140,
    scrollBy: ({ top }: { top: number }) => { scrollY += top; } };
  const document = {
    createTreeWalker: () => { let index = 0; return { nextNode: () => nodes[index++] ?? null }; },
    createRange: () => ({
      startContainer: null as any, startOffset: 0, endContainer: null as any, endOffset: 0,
      setStart(node: any, offset: number) { this.startContainer = node; this.startOffset = offset; },
      setEnd(node: any, offset: number) { this.endContainer = node; this.endOffset = offset; },
      getBoundingClientRect: () => ({ top: 500 - scrollY, bottom: 520 - scrollY }),
    }),
  };
  new Function('window', 'document', 'NodeFilter', VERTICAL_WORD_TARGET)(window, document, { SHOW_TEXT: 4 });
  return { window, nodes, resolve: (offset: number | undefined, index: number, progress: number) => window.__resolveReaderWord({}, offset, index, progress) };
}

test('exact offset wins over conflicting progress/index and repeated words', () => {
  const { resolve } = runtime(['same word same word same']);
  expect(resolve(15, 0, 0)).toMatchObject({ offset: 15, wordIndex: 3, word: 'word' });
});

test('a word split by annotation spans and soft hyphens retains one source identity', () => {
  const { resolve, nodes } = runtime(['same ca', 'paci\u00adties', ' same']);
  const result = resolve(5, 3, 1);
  expect(result).toMatchObject({ offset: 5, wordIndex: 1, word: 'capacities' });
  expect(result.range.startContainer).toBe(nodes[0]);
  expect(result.range.startOffset).toBe(5);
  expect(result.range.endContainer).toBe(nodes[1]);
  expect(result.range.endOffset).toBe(9);
});

test('initial zero-scroll restoration and toolbar resizing use the visible header boundary', () => {
  const { window, resolve } = runtime(['target']);
  const target = resolve(0, 0, 0);
  window.__activeProgrammaticRange = target.range;
  window.__alignActiveReaderDestination();
  expect(target.range.getBoundingClientRect().top).toBe(148);
  window.__readerTopBoundary = 180;
  window.__alignActiveReaderDestination();
  expect(target.range.getBoundingClientRect().top).toBe(188);
  window.__alignActiveReaderDestination();
  expect(target.range.getBoundingClientRect().top).toBe(188);
});
