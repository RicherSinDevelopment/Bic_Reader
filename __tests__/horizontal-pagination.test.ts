import { buildPages, cachedBuildPages } from '@/components/HorizontalReaderPager';
import type { ExtractedPdfBlock } from '@/modules/bic-pdf-reader';

jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));

jest.mock('@/modules/bic-pdf-reader', () => ({ hyphenateText: (text: string) => text }));
jest.mock('@/services/errorReporting', () => ({ addSafeBreadcrumb: jest.fn(), captureOperationalMessage: jest.fn() }));

const text = 'and several anonymous reviewers for their comments, and Emmanuel Espejo, Maggie Hatcher, Justin Henderson, Danielle Hoofnick, Pilyoung Kim and Cindy Moon for their assistance';
const block = { id: 'paragraph', page: 193, kind: 'paragraph', text } as ExtractedPdfBlock;

test.each([18, 48, 90])('restores the first word at a page boundary at width %i without losing earlier content', (width) => {
  const offset = text.indexOf('Espejo');
  const pages = buildPages([block], width, 160, 24, 20, 1, {
    blockId: block.id, blockOffset: offset, wordIndex: 10,
  });
  const target = pages.findIndex(page => page[0].startOffset === offset);
  expect(target).toBeGreaterThan(0);
  expect(pages[target][0].text.startsWith('Espejo')).toBe(true);
  expect(pages.flat().map(segment => segment.text).join(' ').replace(/\s+/g, ' ')).toBe(text);
  for (const segment of pages.flat()) {
    expect(text.slice(segment.startOffset, segment.startOffset + segment.text.length)).toBe(segment.text);
  }
});

test('a boundary at block start keeps earlier blocks on the previous page', () => {
  const preceding = { ...block, id: 'earlier', text: 'Already read.' };
  const pages = buildPages([preceding, block], 100, 1000, 24, 20, 1,
    { blockId: block.id, blockOffset: 0, wordIndex: 0 });
  expect(pages).toHaveLength(2);
  expect(pages[0][0].blockId).toBe('earlier');
  expect(pages[1][0].text).toBe(text);
});

test('missing anchors leave normal pagination unchanged', () => {
  const normal = buildPages([block], 48, 160, 24, 20, 1);
  expect(buildPages([block], 48, 160, 24, 20, 1,
    { blockId: 'absent', blockOffset: 50, wordIndex: 8 })).toEqual(normal);
});

test('multiple measured breaks in one source block retain every word in order', () => {
  const offsets = ['Emmanuel', 'Espejo', 'Justin'].map(word => text.indexOf(word));
  const pages = buildPages([block], 100, 1000, 24, 20, 1, undefined,
    offsets.map(blockOffset => ({ blockId: block.id, blockOffset, wordIndex: 0 })));
  expect(pages.map(page => page[0].startOffset)).toEqual([0, ...offsets]);
  expect(pages.flat().map(segment => segment.text).join(' ')).toBe(text);
});

test('a temporarily short viewport does not create one-character pages', () => {
  const pages = buildPages([block], 30, 1, 24, 20, 1);
  expect(pages.length).toBeLessThan(text.length / 4);
});


test('source-page caching preserves titles, paragraph context, and measured boundaries', () => {
  const blocks = [
    { ...block, id: 'heading', page: 1, kind: 'heading', text: 'First Chapter' },
    { ...block, id: 'one', page: 1 },
    { ...block, id: 'two', page: 2 },
    { ...block, id: 'heading2', page: 3, kind: 'heading', text: 'Second Chapter' },
    { ...block, id: 'three', page: 3 },
  ] as ExtractedPdfBlock[];
  const boundary = { blockId: 'two', blockOffset: text.indexOf('Espejo'), wordIndex: 10 };
  const breaks = [{ blockId: 'three', blockOffset: text.indexOf('Justin'), wordIndex: 15 }];
  expect(cachedBuildPages(blocks, 48, 160, 24, 20, 1, boundary, breaks))
    .toEqual(buildPages(blocks, 48, 160, 24, 20, 1, boundary, breaks));
});

test('a fit correction in a 4000-page book reuses every unaffected source page', () => {
  const blocks = Array.from({ length: 4000 }, (_, index) => ({
    ...block, id: `page-${index + 1}`, page: index + 1,
  }));
  const initial = cachedBuildPages(blocks, 100, 1000, 24, 20, 1);
  expect(initial).toHaveLength(4000);
  const correction = { blockId: 'page-2000', blockOffset: text.indexOf('Espejo'), wordIndex: 10 };
  const updated = cachedBuildPages(blocks, 100, 1000, 24, 20, 1, undefined, [correction]);
  expect(updated).toHaveLength(4001);
  for (let index = 0; index < 4000; index++) {
    if (index === 1999) continue;
    expect(updated[index < 1999 ? index : index + 1]).toBe(initial[index]);
  }
  expect(updated.flat().map(segment => segment.text).join(' ').replace(/\s+/g, ' '))
    .toBe(initial.flat().map(segment => segment.text).join(' ').replace(/\s+/g, ' '));
});

test('typography changes invalidate cached source-page layout', () => {
  const blocks = [block];
  const initial = cachedBuildPages(blocks, 100, 1000, 24, 20, 1);
  const smaller = cachedBuildPages(blocks, 30, 160, 24, 20, 1);
  expect(smaller).toEqual(buildPages(blocks, 30, 160, 24, 20, 1));
  expect(smaller[0]).not.toBe(initial[0]);
});

test('background extraction with cloned blocks preserves existing horizontal page objects', () => {
  const session = {};
  const first = Array.from({ length: 4000 }, (_, index) => ({ ...block, id: `source-${index}`, page: index + 1 }));
  const before = cachedBuildPages(first, 100, 1000, 24, 20, 1, undefined, [], session);
  const updated = [...first.map(item => ({ ...item })), { ...block, id: 'new-page', page: 4001 }];
  const after = cachedBuildPages(updated, 100, 1000, 24, 20, 1, undefined, [], session);
  expect(after.length).toBe(before.length + 1);
  before.forEach((page, index) => expect(after[index]).toBe(page));
  const changed = updated.map(item => item.page === 2000 ? { ...item, text: 'Revised content.' } : { ...item });
  const revised = cachedBuildPages(changed, 100, 1000, 24, 20, 1, undefined, [], session);
  expect(revised[1999]).not.toBe(after[1999]);
  expect(revised[1998]).toBe(after[1998]);
  expect(revised[2000]).toBe(after[2000]);
});
