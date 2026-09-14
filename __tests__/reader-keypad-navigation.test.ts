import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../app/Reader/index.tsx'), 'utf8');
const body = source.split('const goToDisplayedPage = useCallback(')[1]
  .split('(page: number) => {')[1].split('\n    },')[0];

test.each(['reader', 'original'])('keypad in horizontal %s uses source-page navigation for loading and restoration', mode => {
  const navigate = jest.fn();
  const reader = jest.fn();
  new Function('page', 'activeTab', 'readerTransition', 'goToNavigationPage', 'goToReaderPage', body)(117, mode, 'pager', navigate, reader);
  expect(navigate).toHaveBeenCalledWith(117);
  expect(reader).not.toHaveBeenCalled();
});

test('vertical reader keeps its existing keypad navigation', () => {
  const navigate = jest.fn();
  const reader = jest.fn();
  new Function('page', 'activeTab', 'readerTransition', 'goToNavigationPage', 'goToReaderPage', body)(117, 'reader', 'scroll', navigate, reader);
  expect(reader).toHaveBeenCalledWith(117);
  expect(navigate).not.toHaveBeenCalled();
});
