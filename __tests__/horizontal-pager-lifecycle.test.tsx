/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import HorizontalReaderPager from '@/components/HorizontalReaderPager';
const { act, create } = require('react-test-renderer');

let mockDelayViewability = false;
const mockScrollOffsets: number[] = [];
// Every bridge evaluation a mounted page pushes. Tests assert both that a page
// says nothing before its document exists and that the label update is guarded.
const injectedScripts: string[] = [];

jest.mock('@/modules/bic-pdf-reader', () => ({ hyphenateText: (text: string) => text }));
jest.mock('@/services/errorReporting', () => ({ addSafeBreadcrumb: jest.fn(), captureOperationalMessage: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 44, right: 44 }) }));
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef(function MockWebView(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (script: string) => { injectedScripts.push(script); },
      reload: jest.fn(),
    }));
    return React.createElement('NativeWebView', props);
  }) };
});
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  const React = require('react');
  const overrides = { useWindowDimensions: () => ({ width: 844, height: 390 }),
    FlatList: React.forwardRef(function MockList(props: any, ref: any) {
      const [index, setIndex] = React.useState(props.initialScrollIndex ?? 0);
      React.useImperativeHandle(ref, () => ({
        scrollToIndex: ({ index: next }: any) => setIndex(next),
        scrollToOffset: ({ offset }: any) => { mockScrollOffsets.push(offset); setIndex(Math.round(offset / props.getItemLayout(null, 0).length)); },
      }));
      const { data, onViewableItemsChanged } = props;
      const previousData = React.useRef(data);
      React.useLayoutEffect(() => {
        const old = previousData.current;
        previousData.current = data;
        if (!props.maintainVisibleContentPosition || old === data || !old[index]) return;
        const key = props.keyExtractor(old[index], index);
        const next = data.findIndex((item: any, position: number) => props.keyExtractor(item, position) === key);
        if (next >= 0 && next !== index) setIndex(next);
      }, [data]);
      React.useEffect(() => {
        if (mockDelayViewability) return;
        onViewableItemsChanged({ viewableItems: [{ index, isViewable: true, item: data[index] }] });
      }, [index, data, onViewableItemsChanged]);
      return React.createElement('PagerList', props,
        props.data[index] ? props.renderItem({ item: props.data[index], index }) : null);
    }),
  };
  return Object.create(native, Object.getOwnPropertyDescriptors(overrides));
});

const blocks = Array.from({ length: 30 }, (_, index) => ({
  id: `block-${index}`, page: index + 1, kind: 'paragraph', text: 'Some words to read on this source page. '.repeat(25),
}));
const defaults: any = { blocks, fontFamily: 'Georgia', fontSize: 20, lineHeight: 1.5,
  paragraphSpacing: 1, letterSpacing: 0, wordSpacing: 0, bold: false,
  automaticHyphenation: false, verticalMarginPreset: 'comfortable',
  horizontalMarginPreset: 'comfortable', backgroundColor: '#fff', textColor: '#111' };
let tree: any;
const list = () => tree.root.findByType('PagerList');
const layout = (width: number, height: number) => {
  const root = tree.root.findAll((node: any) => node.props.onLayout && node.props.onTouchStart)[0];
  act(() => root.props.onLayout({ nativeEvent: { layout: { width, height } } }));
  act(() => jest.advanceTimersByTime(100));
};
beforeEach(() => { mockScrollOffsets.length = 0; mockDelayViewability = false; injectedScripts.length = 0; jest.useFakeTimers(); });
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });

test('cold open waits for matching page paint after native load', () => {
  const onReady = jest.fn();
  act(() => { tree = create(<HorizontalReaderPager {...defaults} onReady={onReady} />); });
  layout(756, 390);
  act(() => tree.root.findByType('NativeWebView').props.onLoadEnd());
  expect(onReady).not.toHaveBeenCalled();
  const page = tree.root.findByType('NativeWebView');
  const selectable = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  act(() => page.props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'horizontalPagePainted', layoutKey: 'stale' }) } }));
  expect(onReady).not.toHaveBeenCalled();
  act(() => page.props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'horizontalPagePainted', layoutKey: selectable.props.layoutKey }) } }));
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Preparing reading layout' })).toHaveLength(0);
});

test('safe-area landscape swipes update pagination after a destination and resize coincide', () => {
  const onPageChange = jest.fn();
  const destination = { page: 1, blockId: 'block-0', switchHighlightOffset: 0, nonce: 1 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} onPageChange={onPageChange} />); });
  layout(756, 390);
  onPageChange.mockClear();
  act(() => list().props.onScrollBeginDrag({ nativeEvent: { contentOffset: { x: 0 } } }));
  act(() => list().props.onScroll({ nativeEvent: { contentOffset: { x: 756 } } }));
  expect(onPageChange).toHaveBeenLastCalledWith(2, expect.any(Number), expect.any(Number), expect.any(Object));
});

test('TOC commands reach their source page after reflow and page count returns after rotation', () => {
  const onPageChange = jest.fn();
  let props = { ...defaults, onPageChange, destination: { page: 1, blockId: 'block-0', switchHighlightOffset: 0, nonce: 1 } };
  act(() => { tree = create(<HorizontalReaderPager {...props} />); });
  layout(756, 390);
  const originalTotal = list().props.data.length;
  layout(390, 700);
  props = { ...props, destination: { page: 20, blockId: 'block-19', switchHighlightOffset: 0, nonce: 2 } };
  act(() => tree.update(<HorizontalReaderPager {...props} />));
  layout(756, 390);
  expect(onPageChange.mock.calls.at(-1)[2]).toBe(20);
  layout(756, 390);
  expect(list().props.data.length).toBe(originalTotal);
  expect(onPageChange.mock.calls.at(-1)[2]).toBe(20);
});

test('clearing a consumed word destination and using the page picker preserve the current pagination', () => {
  const onPageChange = jest.fn();
  const destination = { page: 10, blockId: 'block-9', switchHighlightOffset: 200, nonce: 4 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} onPageChange={onPageChange} />); });
  layout(756, 390);
  const pages = list().props.data;
  act(() => tree.update(<HorizontalReaderPager {...defaults} destination={null} onPageChange={onPageChange} />));
  expect(list().props.data).toBe(pages);
  act(() => tree.update(<HorizontalReaderPager {...defaults} destination={{ page: 10, readerPage: 8, nonce: 5 }} onPageChange={onPageChange} />));
  expect(list().props.data).toBe(pages);
  expect(onPageChange.mock.calls.at(-1)[0]).toBe(8);
});

test('a cancelled rotation cannot install an intermediate viewport or inflate the page total', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  layout(756, 390);
  const pages = list().props.data;
  const root = tree.root.findAll((node: any) => node.props.onLayout && node.props.onTouchStart)[0];
  act(() => root.props.onLayout({ nativeEvent: { layout: { width: 390, height: 390 } } }));
  act(() => root.props.onLayout({ nativeEvent: { layout: { width: 756, height: 390 } } }));
  act(() => jest.advanceTimersByTime(100));
  expect(list().props.getItemLayout(null, 0).length).toBe(756);
  expect(list().props.data).toBe(pages);
});

test('a handoff arriving before native viewability survives the first measured layout', () => {
  const onPageChange = jest.fn();
  act(() => { tree = create(<HorizontalReaderPager {...defaults} onPageChange={onPageChange} />); });
  mockDelayViewability = true;
  const destination = { page: 20, blockId: 'block-19', switchHighlightOffset: 200, nonce: 99 };
  act(() => tree.update(<HorizontalReaderPager {...defaults} onPageChange={onPageChange} destination={destination} />));
  layout(756, 390);
  const props = list().props;
  expect(props.data[props.initialScrollIndex][0].blockId).toBe('block-19');
  expect(props.data[props.initialScrollIndex][0].startOffset).toBe(200);
});

test('a handoff delivered during a queued resize keeps its exact word boundary', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  const root = tree.root.findAll((node: any) => node.props.onLayout && node.props.onTouchStart)[0];
  act(() => root.props.onLayout({ nativeEvent: { layout: { width: 756, height: 390 } } }));
  const destination = { page: 20, blockId: 'block-19', switchHighlightOffset: 200, nonce: 100 };
  act(() => tree.update(<HorizontalReaderPager {...defaults} destination={destination} />));
  act(() => jest.advanceTimersByTime(100));
  const props = list().props;
  expect(props.data[props.initialScrollIndex][0].blockId).toBe('block-19');
  expect(props.data[props.initialScrollIndex][0].startOffset).toBe(200);
});

test('a TOC jump preserves the page numbering already displayed in the outline', () => {
  const onPageChange = jest.fn();
  const destination = { page: 10, blockId: 'block-9', switchHighlightOffset: 200, nonce: 101 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} onPageChange={onPageChange} />); });
  layout(756, 390);
  const pages = list().props.data;
  const chapterPage = pages.findIndex((page: any) => page[0].sourcePage === 20) + 1;
  act(() => tree.update(<HorizontalReaderPager {...defaults} onPageChange={onPageChange}
    destination={{ page: 20, blockId: 'block-19', searchMatchIndex: 0, pageTop: true, nonce: 102 }} />));
  expect(list().props.data).toBe(pages);
  expect(onPageChange.mock.calls.at(-1)[0]).toBe(chapterPage);
});

test('TOC waits for the requested source page instead of consuming a later extracted page', () => {
  const onPageChange = jest.fn();
  const partialBlocks = blocks.filter((block) => block.page !== 20);
  const destination = { page: 20, blockId: 'block-19', pageTop: true, nonce: 105 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} blocks={partialBlocks} destination={destination} onPageChange={onPageChange} />); });
  expect(onPageChange).not.toHaveBeenCalled();
  act(() => tree.update(<HorizontalReaderPager {...defaults} destination={destination} onPageChange={onPageChange} />));
  layout(756, 390);
  expect(onPageChange.mock.calls.at(-1)[2]).toBe(20);
});

test('font and spacing changes keep the first visible word with a consumed destination', () => {
  const destination = { page: 20, blockId: 'block-19', switchHighlightOffset: 200, nonce: 110 };
  const onPageChange = jest.fn();
  let props = { ...defaults, destination, onPageChange };
  act(() => { tree = create(<HorizontalReaderPager {...props} />); });
  layout(756, 390);
  for (const fontSize of [30, 14, 24, 18]) {
    props = { ...props, fontSize, lineHeight: fontSize === 14 ? 1.8 : 1.4, paragraphSpacing: 1.2 };
    act(() => tree.update(<HorizontalReaderPager {...props} />));
    const last = onPageChange.mock.calls.at(-1);
    const first = list().props.data[last[0] - 1][0];
    expect(first.blockId).toBe('block-19');
    expect(first.startOffset).toBe(200);
  }
});

test('measured overflow moves the remaining text to the next page without changing the first word', () => {
  const onPageChange = jest.fn();
  act(() => { tree = create(<HorizontalReaderPager {...defaults} onPageChange={onPageChange} />); });
  layout(756, 390);
  const before = list().props.data;
  const web = tree.root.findByType('NativeWebView');
  act(() => web.props.onLoadEnd());
  // The page component receives the geometry generation used by its WebView.
  const page = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  act(() => web.props.onMessage({ nativeEvent: { data: JSON.stringify({
    type: 'horizontalPageOverflow', layoutKey: page.props.layoutKey, blockId: 'block-0', blockOffset: 200,
  }) } }));
  const after = list().props.data;
  expect(after[0][0].startOffset).toBe(0);
  expect(after[1][0].startOffset).toBe(200);
  expect(after.flat().map((segment: any) => segment.text).join(' ').replace(/\s+/g, ' '))
    .toBe(before.flat().map((segment: any) => segment.text).join(' ').replace(/\s+/g, ' '));
});

test('typography changes after a manual swipe preserve that page, not the old destination', () => {
  const onPageChange = jest.fn();
  act(() => { tree = create(<HorizontalReaderPager {...defaults} onPageChange={onPageChange} />); });
  layout(756, 390);
  act(() => list().props.onScrollBeginDrag({ nativeEvent: { contentOffset: { x: 0 } } }));
  act(() => list().props.onScroll({ nativeEvent: { contentOffset: { x: 756 * 4 } } }));
  const anchor = onPageChange.mock.calls.at(-1)[3];
  act(() => tree.update(<HorizontalReaderPager {...defaults} fontSize={32} lineHeight={1.8} onPageChange={onPageChange} />));
  const first = list().props.data[onPageChange.mock.calls.at(-1)[0] - 1][0];
  expect(first.blockId).toBe(anchor.blockId);
  expect(first.startOffset).toBe(anchor.blockOffset);
});

test('a stale native viewability item cannot confirm a repaginated destination', () => {
  const onPageChange = jest.fn();
  const destination = { page: 20, blockId: 'block-19', switchHighlightOffset: 200, nonce: 500 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} onPageChange={onPageChange} destination={destination} />); });
  layout(756, 390);
  const index = onPageChange.mock.calls.at(-1)[0] - 1;
  const currentItem = list().props.data[index];
  const staleItem = currentItem.map((segment: any, i: number) => i === 0
    ? { ...segment, startOffset: segment.startOffset - 10 } : segment);
  expect(list().props.keyExtractor(staleItem, index)).not.toBe(list().props.keyExtractor(currentItem, index));
  onPageChange.mockClear();
  act(() => list().props.onViewableItemsChanged({ viewableItems: [{ index, isViewable: true, item: staleItem }] }));
  expect(onPageChange).not.toHaveBeenCalled();
});

test('an unchanged visible page confirms a repeated handoff without a new viewability event', () => {
  const onPageChange = jest.fn();
  const destination = { page: 20, blockId: 'block-19', switchHighlightOffset: 200, nonce: 600 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} onPageChange={onPageChange} />); });
  layout(756, 390);
  const index = onPageChange.mock.calls.at(-1)[0] - 1;
  const visible = list().props.data[index].map((segment: any) => ({ ...segment }));
  mockDelayViewability = true;
  act(() => list().props.onViewableItemsChanged({ viewableItems: [{ index, isViewable: true, item: visible }] }));
  onPageChange.mockClear();
  act(() => tree.update(<HorizontalReaderPager {...defaults} destination={{ ...destination, nonce: 601 }} onPageChange={onPageChange} />));
  expect(onPageChange).toHaveBeenCalled();
  expect(onPageChange.mock.calls.at(-1)[3]).toMatchObject({ blockId: 'block-19', blockOffset: 200 });
});

test('a suppressed rotation highlight preserves the exact destination word', () => {
  const onPageChange = jest.fn();
  const destination = { page: 20, blockId: 'block-19', switchHighlightOffset: 200,
    switchHighlightWordIndex: 40, suppressSwitchHighlight: true, nonce: 700 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} onPageChange={onPageChange} />); });
  layout(756, 390);
  expect(onPageChange.mock.calls.at(-1)[3]).toMatchObject({ blockId: 'block-19', blockOffset: 200 });
  layout(390, 700);
  expect(onPageChange.mock.calls.at(-1)[3]).toMatchObject({ blockId: 'block-19', blockOffset: 200 });
});

test('newly extracted earlier pages do not reload the visible page just to renumber it', () => {
  const props = { ...defaults, destination: { page: 20, blockId: 'block-19', switchHighlightOffset: 0, nonce: 900 } };
  act(() => { tree = create(<HorizontalReaderPager {...props} />); });
  layout(756, 390);
  const before = tree.root.findByType('NativeWebView').props.source.html;
  const expanded = [{ ...blocks[0], id: 'earlier-page', page: 0 }, ...blocks];
  act(() => { tree.update(<HorizontalReaderPager {...props} blocks={expanded} />); });
  expect(tree.root.findByType('NativeWebView').props.source.html).toBe(before);
});

test('a mounted page sends nothing to its WebView before the document loads', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  layout(756, 390);
  // WKWebView evaluates injectJavaScript immediately, before the page document
  // exists. Anything sent here would address a missing DOM.
  expect(injectedScripts).toHaveLength(0);
  act(() => tree.root.findByType('NativeWebView').props.onLoadEnd());
  expect(injectedScripts.some((script) => script.includes('label.textContent='))).toBe(true);
});

test('the page number label update cannot throw when the label node is absent', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  layout(756, 390);
  act(() => tree.root.findByType('NativeWebView').props.onLoadEnd());
  const labels = injectedScripts.filter((script) => script.includes('.page-number'));
  expect(labels.length).toBeGreaterThan(0);
  for (const script of labels) {
    // This exact unguarded form threw "TypeError: null is not an object" in
    // WKWebView for every page that mounted before its first document.
    expect(script).not.toContain("document.querySelector('.page-number').textContent=");
    expect(script).toContain('if(label)');
    expect(script).toContain('label.textContent="1"');
  }
});

test('a renumbered page updates its label in place without reloading the WebView', () => {
  const props = { ...defaults, destination: { page: 20, blockId: 'block-19', switchHighlightOffset: 0, nonce: 901 } };
  act(() => { tree = create(<HorizontalReaderPager {...props} />); });
  layout(756, 390);
  const before = tree.root.findByType('NativeWebView').props.source.html;
  act(() => tree.root.findByType('NativeWebView').props.onLoadEnd());
  injectedScripts.length = 0;
  const expanded = [{ ...blocks[0], id: 'earlier-page', page: 0 }, ...blocks];
  act(() => { tree.update(<HorizontalReaderPager {...props} blocks={expanded} />); });
  expect(tree.root.findByType('NativeWebView').props.source.html).toBe(before);
  expect(injectedScripts.some((script) => script.includes('label.textContent='))).toBe(true);
});

test('a measured reflow that only trims this page keeps the loaded document', () => {
  const onPageChange = jest.fn();
  act(() => { tree = create(<HorizontalReaderPager {...defaults} onPageChange={onPageChange} />); });
  layout(756, 390);
  const web = () => tree.root.findByType('NativeWebView');
  act(() => web().props.onLoadEnd());
  const before = web().props.source.html;
  const page = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  act(() => web().props.onMessage({ nativeEvent: { data: JSON.stringify({
    type: 'horizontalPageOverflow', layoutKey: page.props.layoutKey, blockId: 'block-0', blockOffset: 200,
  }) } }));
  // The overflow still moves to the next generated page...
  expect(list().props.data[1][0].startOffset).toBe(200);
  // ...but the page the reader is looking at is not navigated again: WKWebView
  // blanks itself whenever its HTML is replaced.
  expect(web().props.source.html).toBe(before);
});

test('a typography change patches the page document', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  layout(756, 390);
  const web = () => tree.root.findByType('NativeWebView');
  act(() => web().props.onLoadEnd());
  const before = web().props.source.html;
  act(() => { tree.update(<HorizontalReaderPager {...defaults} fontSize={32} />); });
  expect(web().props.source.html).toBe(before);
  expect(injectedScripts.some(script => script.includes("DOMParser"))).toBe(true);
});

test('a highlight update patches content without navigating the page document', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  layout(756, 390);
  const web = () => tree.root.findByType('NativeWebView');
  act(() => web().props.onLoadEnd());
  const before = web().props.source.html;
  const userHighlights = [{ blockId: 'block-0', offset: 4, length: 6, color: '#fde68a' }];
  act(() => { tree.update(<HorizontalReaderPager {...defaults} userHighlights={userHighlights} />); });
  expect(web().props.source.html).toBe(before);
  expect(injectedScripts.some(script => script.includes("DOMParser") && script.includes("reader-user-highlight"))).toBe(true);
  const patch = injectedScripts.filter(script => script.includes('DOMParser')).pop()!;
  const content = { innerHTML: 'old text' };
  const label = { textContent: '' };
  const head = { innerHTML: 'unchanged styles' };
  const document = { head, fonts: {}, getElementById: () => content, querySelector: () => label };
  const parse = jest.fn(() => ({
    head: { innerHTML: 'unchanged styles' },
    getElementById: () => ({ innerHTML: '<mark>updated text</mark>' }),
    querySelector: () => ({ textContent: 'Chapter' }),
  }));
  new Function('document', 'window', 'DOMParser', 'requestAnimationFrame', patch)(
    document, {}, class { parseFromString = parse; }, jest.fn(),
  );
  expect(content.innerHTML).toBe('<mark>updated text</mark>');
  expect(head.innerHTML).toBe('unchanged styles');

});
test('a 4000-page horizontal book opens immediately with only its nearby pages', () => {
  const onRequestPage = jest.fn();
  const props = { ...defaults, sourcePageCount: 4000, extractedPageCount: 25, onRequestPage };
  act(() => { tree = create(<HorizontalReaderPager {...props} />); });
  layout(756, 390);
  expect(tree.root.findAllByType('PagerList')).toHaveLength(1);
  expect(Math.max(...list().props.data.flat().map((item: any) => item.sourcePage))).toBeLessThanOrEqual(21);
  expect(onRequestPage).toHaveBeenCalledWith(1);
  expect(onRequestPage).toHaveBeenCalledWith(21);
  expect(onRequestPage).not.toHaveBeenCalledWith(22);
});

test('a distant destination opens its local window without waiting for the rest of the book', () => {
  const large = Array.from({ length: 4000 }, (_, index) => ({ ...blocks[0], id: `large-${index}`, page: index + 1 }));
  act(() => { tree = create(<HorizontalReaderPager {...defaults} blocks={large} sourcePageCount={4000}
    destination={{ page: 2000, pageTop: true, nonce: 910 }} />); });
  layout(756, 390);
  const sources = list().props.data.flat().map((item: any) => item.sourcePage);
  expect(Math.min(...sources)).toBe(1980);
  expect(Math.max(...sources)).toBe(2020);
});

test('unextracted gaps are excluded from the swipe window', () => {
  const sparse = [blocks[0], blocks[2]];
  act(() => { tree = create(<HorizontalReaderPager {...defaults} blocks={sparse} sourcePageCount={4000}
    preparedPages={{ 1: {}, 3: {} }} />); });
  layout(756, 390);
  expect(list().props.data.flat().every((item: any) => item.sourcePage === 1)).toBe(true);
});

test('repeated WebKit termination stops automatic reloads and offers retry', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  layout(756, 390);
  act(() => tree.root.findByType('NativeWebView').props.onContentProcessDidTerminate());
  expect(tree.root.findAllByType('NativeWebView')).toHaveLength(1);
  act(() => tree.root.findByType('NativeWebView').props.onContentProcessDidTerminate());
  expect(tree.root.findAllByType('NativeWebView')).toHaveLength(0);
  const retry = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.onPress)[0];
  act(() => retry.props.onPress());
  expect(tree.root.findAllByType('NativeWebView')).toHaveLength(1);
});


test('cold horizontal entry mounts no native page at guessed full-screen dimensions', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  expect(tree.root.findAllByType('NativeWebView')).toHaveLength(0);
  layout(756, 390);
  expect(tree.root.findAllByType('NativeWebView')).toHaveLength(1);
  const source = tree.root.findByType('NativeWebView').props.source;
  layout(756, 390);
  expect(tree.root.findByType('NativeWebView').props.source).toBe(source);
});


test('TOC prefetch preserves the visible cell as several earlier extraction batches arrive', () => {
  const destination = { page: 20, blockId: 'block-19', pageTop: true, nonce: 1200 };
  const props = { ...defaults, destination };
  act(() => { tree = create(<HorizontalReaderPager {...props} blocks={blocks.slice(19)} />); });
  layout(756, 390);
  const source = tree.root.findByType('NativeWebView').props.source;
  const selectable = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  act(() => selectable.props.onReady());
  for (const first of [16, 12, 8, 4, 0]) {
    act(() => { tree.update(<HorizontalReaderPager {...props} blocks={blocks.slice(first)} />); });
    expect(tree.root.findByType('NativeWebView').props.source).toBe(source);
  }
  expect(list().props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });
});


test('reopened destination snaps to its measured boundary once after paint', () => {
  const destination = { page: 20, blockId: 'block-19', pageTop: true, nonce: 1400 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} />); });
  layout(756, 390);
  const index = list().props.data.findIndex((page: any[]) => page[0].blockId === 'block-19');
  const page = tree.root.findByType('NativeWebView');
  const selectable = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  expect(list().props.maintainVisibleContentPosition).toBeUndefined();
  expect(list().props.automaticallyAdjustContentInsets).toBe(false);
  expect(page.props.automaticallyAdjustContentInsets).toBe(false);
  expect(page.props.contentInsetAdjustmentBehavior).toBe('never');
  mockScrollOffsets.length = 0;
  const paint = () => act(() => page.props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'horizontalPagePainted', layoutKey: selectable.props.layoutKey }) } }));
  paint();
  expect(list().props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });
  expect(mockScrollOffsets).toEqual([index * 756]);
  paint();
  expect(mockScrollOffsets).toEqual([index * 756]);
});

test('first paint still completes restore when prefetch moves the memoized page index', () => {
  const onReady = jest.fn();
  const destination = { page: 20, blockId: 'block-19', pageTop: true, nonce: 1500 };
  const props = { ...defaults, sourcePageCount: 30, destination, onReady };
  act(() => { tree = create(<HorizontalReaderPager {...props} blocks={blocks.slice(18)} />); });
  layout(756, 390);
  const source = tree.root.findByType('NativeWebView').props.source;
  act(() => { tree.update(<HorizontalReaderPager {...props} blocks={blocks.slice(15)} />); });
  expect(tree.root.findByType('NativeWebView').props.source).toBe(source);
  const page = tree.root.findByType('NativeWebView');
  const selectable = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  act(() => page.props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'horizontalPagePainted', layoutKey: selectable.props.layoutKey }) } }));
  expect(onReady).toHaveBeenCalledTimes(1);
  const index = list().props.data.findIndex((item: any[]) => item[0].blockId === 'block-19');
  expect(mockScrollOffsets[mockScrollOffsets.length - 1]).toBe(index * 756);
});


test('startup corrects native partial-page drift after paint but leaves user drags alone', () => {
  const destination = { page: 20, blockId: 'block-19', pageTop: true, nonce: 1600 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} />); });
  layout(756, 390);
  const selectable = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  act(() => selectable.props.onReady());
  const index = list().props.data.findIndex((page: any[]) => page[0].blockId === 'block-19');
  mockScrollOffsets.length = 0;
  act(() => list().props.onScroll({ nativeEvent: { contentOffset: { x: index * 756 + 30 } } }));
  expect(mockScrollOffsets).toEqual([index * 756]);
  act(() => list().props.onScrollBeginDrag({ nativeEvent: { contentOffset: { x: index * 756 } } }));
  mockScrollOffsets.length = 0;
  act(() => list().props.onScroll({ nativeEvent: { contentOffset: { x: index * 756 + 30 } } }));
  expect(mockScrollOffsets).toEqual([]);
});

test('paint acknowledges the restored source when native viewability is delayed', () => {
  mockDelayViewability = true;
  const onPageChange = jest.fn();
  const destination = { page: 20, blockId: 'block-19', pageTop: true, nonce: 1700 };
  act(() => { tree = create(<HorizontalReaderPager {...defaults} destination={destination} onPageChange={onPageChange} />); });
  layout(756, 390);
  onPageChange.mockClear();
  const selectable = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  act(() => selectable.props.onReady());
  expect(onPageChange).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 20, expect.objectContaining({ blockId: 'block-19' }));
});


test('opening page owns its margins inside a full-width document', () => {
  act(() => { tree = create(<HorizontalReaderPager {...defaults} />); });
  layout(414, 896);
  const selectable = tree.root.findAll((node: any) => node.props.layoutKey && node.props.onOverflow)[0];
  expect(selectable.props.horizontalContentInset).toBe(30);
  expect(selectable.parent.props.style).toEqual(expect.objectContaining({ left: 0, right: 0 }));
  const html = tree.root.findByType('NativeWebView').props.source.html;
  expect(html).toContain('body{padding:68px 30px');
  expect(html).toContain('position:fixed;z-index:2;left:30px;right:30px');
});
