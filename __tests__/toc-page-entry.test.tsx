/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import ThreeLinesButton from '@/components/threelinesbutton';
const { act, create } = require('react-test-renderer');
jest.mock('@/components/readerui/ReaderGlassIconButton', () => 'MenuButton');
jest.mock('@/components/ui/drawer', () => ({ Drawer: 'Drawer', DrawerBackdrop: 'Backdrop', DrawerCloseButton: 'Close', DrawerContent: 'Content', DrawerHeader: 'Header' }));
jest.mock('@/components/ui/heading', () => ({ Heading: 'Heading' }));
jest.mock('@/components/ui/icon', () => ({ Icon: 'Icon', CloseIcon: 'CloseIcon', MenuIcon: 'MenuIcon' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('lucide-react-native', () => ({ BookOpen: 'BookOpen', ChevronDown: 'ChevronDown', ChevronRight: 'ChevronRight' }));
jest.mock('react-native', () => ({ FlatList: 'FlatList', Pressable: 'Pressable', TextInput: 'TextInput', View: 'View', StyleSheet: { create: (styles: any) => styles }, useColorScheme: () => 'light' }));

test('typing a destination waits for Go and submits the complete page once', () => {
  const onGoToPage = jest.fn();
  let tree: any;
  act(() => { tree = create(<ThreeLinesButton currentPage={560} totalPages={887} onGoToPage={onGoToPage} />); });
  act(() => tree.root.findByType('MenuButton').props.onPress());
  for (const digits of ['3', '31', '319']) {
    act(() => tree.root.findByType('TextInput').props.onChangeText(digits));
  }
  expect(onGoToPage).not.toHaveBeenCalled();
  act(() => tree.root.findByProps({ accessibilityLabel: 'Go to page' }).props.onPress());
  expect(onGoToPage).toHaveBeenCalledTimes(1);
  expect(onGoToPage).toHaveBeenCalledWith(319);
  expect(tree.root.findByType('Drawer').props.isOpen).toBe(false);
  act(() => tree.root.findByType('TextInput').props.onChangeText('999'));
  act(() => tree.root.findByType('TextInput').props.onSubmitEditing());
  expect(onGoToPage).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
