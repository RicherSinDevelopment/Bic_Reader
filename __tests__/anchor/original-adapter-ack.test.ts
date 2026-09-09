import { createOriginalAnchorAdapter } from '@/architecture/anchor/OriginalAnchorAdapter';

test('Original waits for the native page acknowledgement without another restore', async () => {
  jest.useFakeTimers();
  try {
    let page = 1;
    const restore = jest.fn();
    const adapter = createOriginalAnchorAdapter({ isReady: () => true, restore, currentPage: () => page });
    const anchor: any = { documentId: 'book', sourcePage: 20 };
    await adapter.restore(anchor, 1);
    const result = adapter.verify!(anchor, 1);
    setTimeout(() => { page = 20; }, 160);
    await jest.advanceTimersByTimeAsync(200);
    expect(await result).toMatchObject({ ok: true });
    expect(restore).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
