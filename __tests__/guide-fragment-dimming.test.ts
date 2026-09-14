import { guideFragmentDimming } from '@/architecture/GuideFragmentDimming';

test('only the two word fragments remain clear, including the text between them', () => {
  const panels = guideFragmentDimming(400, 800, [
    { left: 270, top: 300, width: 100, height: 30 },
    { left: 20, top: 350, width: 50, height: 30 },
  ]);
  const coverage = (x: number, y: number) => panels.filter(r => x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height).length;
  expect(coverage(300, 315)).toBe(0);
  expect(coverage(40, 365)).toBe(0);
  expect(coverage(100, 315)).toBe(1);
  expect(coverage(200, 365)).toBe(1);
  expect(coverage(200, 340)).toBe(1);
  expect(panels.reduce((area, r) => area + r.width * r.height, 0)).toBe(400 * 800 - 150 * 30);
});
