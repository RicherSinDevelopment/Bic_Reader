import { HORIZONTAL_PAGE_FIT_SCRIPT } from '@/architecture/HorizontalPageFit';

function measure(raw: string, overflowingAt: number, bottomPadding = 20) {
  const messages: any[] = [];
  const node = { textContent: raw };
  const segment = { dataset: { start: '100', blockId: 'b' }, getBoundingClientRect: () => ({ bottom: 150 }) };
  const window = { innerHeight: 100, __readerFitLayoutKey: 'landscape', ReactNativeWebView: { postMessage: (value: string) => messages.push(JSON.parse(value)) } };
  const document = {
    querySelectorAll: () => [segment],
    createTreeWalker: () => { let read = false; return { nextNode: () => read ? null : (read = true, node) }; },
    createRange: () => { let start = 0; return {
      setStart: (_node: unknown, offset: number) => { start = offset; }, setEnd: () => {},
      getClientRects: () => [{ bottom: start >= overflowingAt ? 95 : 60 }],
    }; },
  };
  new Function('window', 'document', 'NodeFilter', HORIZONTAL_PAGE_FIT_SCRIPT + '\nwindow.__reportHorizontalPageFit(' + bottomPadding + ');')(window, document, { SHOW_TEXT: 4 });
  return messages;
}

test('finds the first word crossing the reserved footer space', () => {
  expect(measure('one two three four', 8)).toEqual([
    { type: 'horizontalPageOverflow', layoutKey: 'landscape', blockId: 'b', blockOffset: 108 },
  ]);
});

test('soft hyphens do not shift source offsets', () => {
  expect(measure('hy\u00adphen word tail', 8)[0].blockOffset).toBe(107);
});

test('does not split text that fits above the footer', () => {
  expect(measure('one two three', 99)).toEqual([]);
});
