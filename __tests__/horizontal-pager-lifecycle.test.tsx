/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import HorizontalReaderPager from '@/components/HorizontalReaderPager';
const { act, create } = require('react-test-renderer');

let mockDelayViewability = false;

jest.mock('@/modules/bic-pdf-reader', () => ({ hyphenateText: (text: string) => text }));
jest.mock('@/services/errorReporting', () => ({ addSafeBreadcrumb: jest.fn(), captureOperationalMessage: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 44, right: 44 }) }));
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef(function MockWebView(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn(), reload: jest.fn() }));
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
        scrollToOffset: ({ offset }: any) => setIndex(Math.round(offset / props.getItemLayout(null, 0).length)),
      }));
      const { data, onViewableItemsChanged } = props;
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
beforeEach(() => { mockDelayViewability = false; jest.useFakeTimers(); });
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });

test('cold open becomes ready on native load without requiring visible paint frames', () => {
  const onReady = jest.fn();
  act(() => { tree = create(<HorizontalReaderPager {...defaults} onReady={onReady} />); });
  layout(756, 390);
  act(() => tree.root.findByType('NativeWebView').props.onLoadEnd());
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
