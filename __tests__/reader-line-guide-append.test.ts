import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../components/ReaderView.tsx'), 'utf8');
const correction = source.match(/window\.__correctReaderGuideForAppend = function\(delta\) \{([\s\S]*?)\n              \};/)![1];

function corrected(mode: string | null, position: number | null, delta: number) {
  return new Function('readerGuideMode', 'currentGuideDocumentTop', 'delta',
    correction + '; return currentGuideDocumentTop;')(mode, position, delta);
}

test('line guide keeps its viewport position through repeated loading above it', () => {
  let documentTop = 52600;
  let scrollY = 52357;
  const visibleTop = documentTop - scrollY;
  for (const delta of [3895.84375, 4776.6875, 6889.171875, -1200]) {
    documentTop = corrected('line', documentTop, delta);
    scrollY += delta;
    expect(documentTop - scrollY).toBeCloseTo(visibleTop);
  }
  expect(source.indexOf('window.__correctReaderGuideForAppend?.(insertedOffset)'))
    .toBeLessThan(source.indexOf('window.scrollBy(0, insertedOffset)'));
});

test('append correction leaves word guide and inactive guides alone', () => {
  expect(corrected('word', 100, 4000)).toBe(100);
  expect(corrected(null, 100, 4000)).toBe(100);
  expect(corrected('line', null, 4000)).toBeNull();
  expect(corrected('line', 100, NaN)).toBe(100);
});
