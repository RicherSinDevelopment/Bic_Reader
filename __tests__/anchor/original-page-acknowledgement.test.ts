import fs from 'fs';
import path from 'path';

// Execute the screen's callback guards before any page state is committed.
const screen = fs.readFileSync(path.join(__dirname, '../../app/Reader/index.tsx'), 'utf8');
const start = screen.indexOf('      const previousPage = originalCurrentPageRef.current;');
const end = screen.indexOf('      const completedProgrammaticNavigation', start);
const accepts = new Function('page', 'originalCurrentPageRef', 'pendingOriginalPageRef',
  'originalUserInteractedRef', 'originalHandoffAnchorRef', screen.slice(start, end) + '\nreturn true;');
function accept(page: number, pending: number | null, interacted: boolean) {
  return accepts(page, { current: 20 }, { current: pending }, { current: interacted },
    { current: { sourcePage: 20 } }) === true;
}

test('a passive adjacent-page notification cannot undo a visible handoff acknowledgement', () => {
  expect(accept(20, 20, false)).toBe(true);
  expect(accept(21, null, false)).toBe(false);
  expect(accept(20, null, false)).toBe(true);
});

test('user scrolling and a new explicit destination still update Original normally', () => {
  expect(accept(21, null, true)).toBe(true);
  expect(accept(80, 80, false)).toBe(true);
  expect(accept(21, 80, false)).toBe(false);
});
