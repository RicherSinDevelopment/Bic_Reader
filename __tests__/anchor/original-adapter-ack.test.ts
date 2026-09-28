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

test('a same-page Original handoff waits for its new positioning acknowledgement', async () => {
  jest.useFakeTimers();
  try {
    let acknowledged = false;
    const adapter = createOriginalAnchorAdapter({ isReady: () => true, restore: jest.fn(),
      currentPage: () => 2, isDestinationAcknowledged: () => acknowledged });
    const anchor: any = { documentId: 'book', sourcePage: 2 };
    await adapter.restore(anchor, 10);
    const complete = jest.fn();
    const verification = adapter.verify!(anchor, 10).then(result => { complete(result); return result; });
    await jest.advanceTimersByTimeAsync(120);
    expect(complete).not.toHaveBeenCalled();
    acknowledged = true;
    await jest.advanceTimersByTimeAsync(40);
    expect(await verification).toMatchObject({ ok: true });
  } finally { jest.useRealTimers(); }
});
