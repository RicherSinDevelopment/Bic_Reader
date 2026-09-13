import { captureVisiblePosition } from '@/architecture/anchor/VisiblePosition';
const saved = { documentId: 'book', sourcePage: 1, revision: 20, updatedAt: '' };
const reader = { ...saved, sourcePage: 117, sourceBlockId: 'p117-b2', characterOffset: 36, wordIndex: 5, revision: 19 };
const original = { ...saved, sourcePage: 125, sourceBlockId: 'p125-b1' };
test('exit captures Original scroll position rather than the hidden Reader position', () => {
  expect(captureVisiblePosition('book', 'original', reader, original, saved)).toEqual(original);
});
test('exit captures the visible Reader word even before its saved revision catches up', () => {
  expect(captureVisiblePosition('book', 'reader', reader, original, saved)).toEqual(reader);
});
test('captured position is immutable and cannot leak across documents', () => {
  const snapshot = captureVisiblePosition('book', 'reader', reader, original, saved)!;
  expect(snapshot).not.toBe(reader);
  expect(captureVisiblePosition('other', 'reader', reader, original, saved)).toBeNull();
});
