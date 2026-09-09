/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import ThreeLinesButton from '@/components/threelinesbutton';
const { act, create } = require('react-test-renderer');
jest.mock('@/components/readerui/ReaderGlassIconButton', () => 'MenuTrigger');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/heading', () => ({ Heading: 'Heading' }));
jest.mock('@/components/ui/icon', () => ({ Icon: 'Icon' }));
jest.mock('@/components/ui/drawer', () => ({ Drawer: 'Drawer', DrawerBackdrop: 'Backdrop', DrawerCloseButton: 'Close', DrawerContent: 'Content', DrawerHeader: 'Header' }));
jest.mock('lucide-react-native', () => ({ BookOpen: 'Book', ChevronDown: 'Down', ChevronRight: 'Right' }));
const chapter = { id: 'parent', title: 'Chapter', page: 40, sourcePage: 10,
  children: [{ id: 'child', title: 'Section', page: 43, sourcePage: 11 }] };

test('first tap on a parent chapter navigates; a separate control expands its sections', () => {
  jest.useFakeTimers();
  const navigate = jest.fn();
  let tree: any;
  act(() => { tree = create(<ThreeLinesButton chapters={[chapter]} currentPage={7} totalPages={100} onGoToChapter={navigate} />); });
  const button = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label }).find((node: any) => typeof node.props.onPress === 'function');
  act(() => button('Chapter, page 40').props.onPress());
  act(() => jest.advanceTimersByTime(20));
  expect(navigate).toHaveBeenCalledWith(chapter);
  navigate.mockClear();
  const stopPropagation = jest.fn();
  act(() => button('Expand Chapter').props.onPress({ stopPropagation }));
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();
  expect(button('Section, page 43')).toBeDefined();
  act(() => tree.unmount());
  jest.useRealTimers();
});
