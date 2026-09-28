import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../../components/ReaderView.tsx'), 'utf8');
const highlightStart = source.indexOf('              window.__highlightSwitchWordAtIndex = function(');
const highlightEnd = source.indexOf('              function readerVisibleTopBoundary()', highlightStart);
const restoreStart = source.indexOf('      window.__tryPendingSourceDestination =');
const restoreEnd = source.indexOf("      if (message.type === 'goToSourcePage')", restoreStart);

test.each([true, false])('vertical return preserves the viewport only when requested (%s)', async preserveViewport => {
  const range: any = { cloneRange: () => range, getBoundingClientRect: () => ({ top: 210 }) };
  const target: any = { dataset: { blockId: 'p2-b5' }, isConnected: true,
    getBoundingClientRect: () => ({ top: 210 }), scrollIntoView: jest.fn(), closest: () => target };
  const align = jest.fn();
  const draw = jest.fn(() => true);
  const report = jest.fn();
  const window: any = { __readerTransition: 'scroll', scrollY: 200, scrollTo: jest.fn(),
    __readerNavigation: { generation: 1, settle: (_: any, measure: any, done: any) => { measure(); done(); } },
    __resolveReaderWord: () => ({ range, wordIndex: 0, offset: 0 }),
    __alignActiveReaderDestination: align, __reportSwitchAnchor: report,
    ReactNativeWebView: { postMessage: jest.fn() },
    __pendingSourceDestination: { page: 2, blockId: 'p2-b5', nonce: 1, switchHighlightWordIndex: 0, preserveViewport },
  };
  const document = { fonts: { status: 'loaded', ready: Promise.resolve() }, querySelector: () => target };
  const frame = (callback: () => void) => callback();
  new Function('window', 'requestAnimationFrame', 'drawReaderSwitchHighlight', 'clearReaderSwitchHighlight',
    source.slice(highlightStart, highlightEnd))(window, frame, draw, jest.fn());
  new Function('window', 'document', 'CSS', 'requestAnimationFrame', source.slice(restoreStart, restoreEnd))(
    window, document, { escape: (value: string) => value }, frame);
  window.__tryPendingSourceDestination();
  await Promise.resolve();
  expect(draw).toHaveBeenCalled();
  expect(align).toHaveBeenCalledTimes(preserveViewport ? 0 : 2);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(target.scrollIntoView).not.toHaveBeenCalled();
  if (preserveViewport) expect(window.__activeProgrammaticRange).toBeNull();
});
