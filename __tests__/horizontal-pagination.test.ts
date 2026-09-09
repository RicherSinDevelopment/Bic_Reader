import { buildPages } from '@/components/HorizontalReaderPager';
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
