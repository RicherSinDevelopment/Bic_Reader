/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { useReaderAnchor } from '@/hooks/useReaderAnchor';
const { act, create } = require('react-test-renderer');
let mockRevision = 1;
jest.mock('@/architecture/anchor/AnchorController', () => ({ anchorController: {
  current: () => ({ revision: mockRevision }),
  publish: () => ({ revision: ++mockRevision }),
} }));
jest.mock('@/architecture/anchor/AnchorStore', () => ({ useAnchorStore: {
  getState: () => ({ transition: { id: 1, status: 'complete' } }),
} }));
test('the live word retains its committed revision for the next layout handoff', () => {
  jest.useFakeTimers();
  let reader: ReturnType<typeof useReaderAnchor>;
  const blocks: any = [{ id: 'b', page: 20, text: 'one two three four' }];
  function Probe() {
    reader = useReaderAnchor({ documentId: 'book', isActive: true, blocks });
    return null;
  }
  let tree: any;
  act(() => { tree = create(<Probe />); });
  act(() => { reader.reportReaderAnchor('b', 'three', 2); jest.advanceTimersByTime(230); });
  expect(reader!.actualReaderAnchor.current).toMatchObject({ revision: 2, sourcePage: 20, wordIndex: 2, characterOffset: 8 });
  act(() => tree.unmount());
  jest.useRealTimers();
});
