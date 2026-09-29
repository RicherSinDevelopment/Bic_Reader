import { createVerticalAnchorAdapter } from '@/architecture/anchor/VerticalAnchorAdapter';
import { createHorizontalAnchorAdapter } from '@/architecture/anchor/HorizontalAnchorAdapter';
import type { CanonicalAnchor } from '@/architecture/anchor/AnchorTypes';

const anchor: CanonicalAnchor = {
  documentId: 'book', sourcePage: 42, sourceBlockId: 'p42-b1',
  characterOffset: 164, wordIndex: 25, revision: 1,
  updatedAt: '2026-09-29T00:00:00.000Z',
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

 describe.each([
  ['vertical', createVerticalAnchorAdapter],
  ['horizontal', createHorizontalAnchorAdapter],
] as const)('%s transition latency', (_, createAdapter) => {
  test('confirms an already matching target within 50ms', async () => {
    const adapter = createAdapter({ isReady: () => true, restore: jest.fn(), actual: () => anchor });
    const complete = jest.fn();
    const verification = adapter.verify!(anchor, 1).then(complete);
    await jest.advanceTimersByTimeAsync(50);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    await verification;
  });

  test('still waits for delayed content and rejects a transient match', async () => {
    let actual: CanonicalAnchor | null = null;
    const adapter = createAdapter({ isReady: () => true, restore: jest.fn(), actual: () => actual });
    const complete = jest.fn();
    const verification = adapter.verify!(anchor, 1).then(complete);
    await jest.advanceTimersByTimeAsync(500);
    actual = anchor;
    await jest.advanceTimersByTimeAsync(16);
    actual = { ...anchor, characterOffset: 0 };
    await jest.advanceTimersByTimeAsync(100);
    expect(complete).not.toHaveBeenCalled();
    actual = anchor;
    await jest.advanceTimersByTimeAsync(50);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    await verification;
  });

  test('cancels a pending verification promptly', async () => {
    let current = true;
    const adapter = createAdapter({ isReady: () => true, restore: jest.fn(), actual: () => null,
      isTransitionCurrent: () => current });
    const complete = jest.fn();
    const verification = adapter.verify!(anchor, 1).then(complete);
    current = false;
    await jest.advanceTimersByTimeAsync(20);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    await verification;
  });
});
