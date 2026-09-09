/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { usePdfKitHighlight } from '@/hooks/usePdfKitHighlight';
const { act, create } = require('react-test-renderer');
const target: any = { page: 20, sourceBounds: { left: 10, top: 20, right: 30, bottom: 40 }, pageSize: { width: 600, height: 800 } };
test('PDFKit waits for a measured viewport and reapplies the same word for a new handoff or viewport', () => {
  jest.useFakeTimers();
  const setHighlight = jest.fn();
  let hook: ReturnType<typeof usePdfKitHighlight>;
  function Probe({ viewportKey, requestId }: { viewportKey?: string; requestId: number }) {
    hook = usePdfKitHighlight({ documentKey: 'book', target, viewportKey, requestId });
    hook.pdfRef.current = { setHighlight, clearHighlight: jest.fn() } as any;
    return null;
  }
  let tree: any;
  act(() => { tree = create(<Probe requestId={1} />); });
  act(() => hook.markDocumentReady());
  act(() => jest.advanceTimersByTime(20));
  expect(setHighlight).not.toHaveBeenCalled();
  act(() => tree.update(<Probe viewportKey="390:600" requestId={1} />));
  act(() => jest.advanceTimersByTime(20));
  expect(setHighlight).toHaveBeenCalledTimes(1);
  act(() => tree.update(<Probe viewportKey="390:600" requestId={2} />));
  act(() => jest.advanceTimersByTime(20));
  expect(setHighlight).toHaveBeenCalledTimes(2);
  act(() => tree.update(<Probe viewportKey="800:300" requestId={2} />));
  act(() => jest.advanceTimersByTime(20));
  expect(setHighlight).toHaveBeenCalledTimes(3);
  act(() => tree.unmount());
  jest.useRealTimers();
});
