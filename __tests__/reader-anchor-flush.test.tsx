import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
import { useReaderAnchor } from '@/hooks/useReaderAnchor';
import { anchorController } from '@/architecture/anchor/AnchorController';
import { useAnchorStore } from '@/architecture/anchor/AnchorStore';

test('closing immediately flushes the visible word before the publish debounce fires', () => {
  jest.useFakeTimers();
  useAnchorStore.getState().resetForDocument('book');
  anchorController.initialize({ documentId: 'book', sourcePage: 1 });
  let hook!: ReturnType<typeof useReaderAnchor>;
  function Reader() {
    hook = useReaderAnchor({ documentId: 'book', isActive: true, blocks: [{ id: 'p117', page: 117, text: 'first second third' }] as any });
    return null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<Reader />); });
  act(() => hook.reportReaderAnchor('p117', 'second', 1));
  expect(anchorController.current()?.sourcePage).toBe(1);
  anchorController.completeNavigation({ ...anchorController.current()! });
  act(() => hook.flushReaderAnchor());
  expect(anchorController.current()).toEqual(expect.objectContaining({ sourcePage: 117, sourceBlockId: 'p117', wordIndex: 1, characterOffset: 6 }));
  act(() => tree.unmount());
  jest.useRealTimers();
});
