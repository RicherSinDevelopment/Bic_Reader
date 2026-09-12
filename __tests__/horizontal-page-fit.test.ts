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

/* Minimal DOM double for the in-place clip. The fit script drops the overflow
   instead of letting the pager rewrite the document, so the surgery has to run
   against real parent/child bookkeeping. */
function element(tag: string): any {
  const detach = (child: any) => {
    const parent = child.parentNode;
    if (!parent || parent === undefined) return;
    const index = parent.childNodes.indexOf(child);
    if (index >= 0) parent.childNodes.splice(index, 1);
  };
  const node: any = {
    nodeType: 1, tagName: tag.toUpperCase(), className: '', dataset: {}, attributes: {},
    childNodes: [], parentNode: null,
    appendChild(child: any) { detach(child); this.childNodes.push(child); child.parentNode = this; return child; },
    insertBefore(child: any, reference: any) {
      detach(child);
      const index = reference ? this.childNodes.indexOf(reference) : this.childNodes.length;
      this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, child);
      child.parentNode = this;
      return child;
    },
    setAttribute(name: string, value: string) { this.attributes[name] = value; },
    getAttribute(name: string) { return this.attributes[name] ?? null; },
    removeChild(child: any) {
      const index = this.childNodes.indexOf(child);
      if (index >= 0) this.childNodes.splice(index, 1);
      child.parentNode = null;
      return child;
    },
  };
  Object.defineProperty(node, 'textContent', { get() { return this.childNodes.map((child: any) => child.textContent ?? '').join(''); } });
  Object.defineProperty(node, 'nextSibling', { get() {
    const parent = this.parentNode;
    if (!parent) return null;
    return parent.childNodes[parent.childNodes.indexOf(this) + 1] ?? null;
  } });
  Object.defineProperty(node, 'nextElementSibling', { get() {
    const parent = this.parentNode;
    if (!parent) return null;
    return parent.childNodes.slice(parent.childNodes.indexOf(this) + 1).find((sibling: any) => sibling.nodeType === 1) ?? null;
  } });
  return node;
}

function textNode(value: string): any {
  const node: any = { nodeType: 3, textContent: value, parentNode: null };
  node.splitText = (offset: number) => {
    const tail = textNode(value.slice(offset));
    node.textContent = value.slice(0, offset);
    const parent = node.parentNode;
    const index = parent.childNodes.indexOf(node);
    tail.parentNode = parent;
    parent.childNodes.splice(index + 1, 0, tail);
    return tail;
  };
  return node;
}

function overflowingPage(raw: string, overflowingAt: number) {
  const body = element('body');
  const first = element('div');
  const second = element('div');
  first.className = 'segment';
  first.dataset = { start: '100', blockId: 'b' };
  first.getBoundingClientRect = () => ({ bottom: 150 });
  second.className = 'segment';
  second.dataset = { start: '200', blockId: 'c' };
  second.getBoundingClientRect = () => ({ bottom: 40 });
  body.appendChild(first);
  body.appendChild(second);
  first.appendChild(textNode(raw));
  const messages: any[] = [];
  const window = { innerHeight: 100, __readerFitLayoutKey: 'landscape', ReactNativeWebView: { postMessage: (value: string) => messages.push(JSON.parse(value)) } };
  const document = {
    querySelectorAll: () => [first, second],
    createTreeWalker: () => { let read = false; return { nextNode: () => read ? null : (read = true, first.childNodes[0]) }; },
    createRange: () => { let start = 0; return {
      setStart: (_node: unknown, offset: number) => { start = offset; }, setEnd: () => {},
      getClientRects: () => [{ bottom: start >= overflowingAt ? 95 : 60 }],
    }; },
    createElement: (tag: string) => element(tag),
  };
  new Function('window', 'document', 'NodeFilter', HORIZONTAL_PAGE_FIT_SCRIPT + '\nwindow.__reportHorizontalPageFit(20);')(window, document, { SHOW_TEXT: 4 });
  return { first, second, messages };
}

test('removes the overflowing tail in place so the page never has to reload', () => {
  const { first, second, messages } = overflowingPage('one two three four', 8);
  expect(messages).toEqual([
    { type: 'horizontalPageOverflow', layoutKey: 'landscape', blockId: 'b', blockOffset: 108 },
  ]);
  // The moved text leaves the document, so selection offsets cannot reach it.
  expect(first.childNodes).toHaveLength(1);
  expect(first.textContent).toBe('one two ');
  expect(second.parentNode).toBeNull();
});

test('never empties a page whose first word already overflows', () => {
  const { first, second, messages } = overflowingPage('one two three four', 0);
  expect(first.textContent).toBe('one two three four');
  expect(second.parentNode).not.toBeNull();
  expect(messages).toHaveLength(1);
});