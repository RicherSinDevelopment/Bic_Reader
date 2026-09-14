import React from 'react';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
const { act, create } = require('react-test-renderer');

// Exercise the actual navigator below the same memo boundary as Expo SQLite.
const source = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
const navigatorSource = source.slice(source.indexOf('function RootNavigator('));
const compiled = ts.transpileModule(navigatorSource, { compilerOptions: {
  jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020,
} }).outputText;

let completeFonts: (result: [boolean, Error | null]) => void;
function useFonts() {
  const [state, update] = React.useState<[boolean, Error | null]>([false, null]);
  completeFonts = update;
  return state;
}
const Stack: any = ({ children }: any) => React.createElement('Navigator', null, children);
Stack.Screen = () => null;
Stack.Protected = ({ children }: any) => children;
const RootNavigator = new Function('React', 'useFonts', 'useEffect', 'useAuth',
  'StartupLoadingScreen', 'Stack', 'Lato_400Regular', 'Lato_700Bold', 'SourceSans3_400Regular',
  compiled + '; return RootNavigator;')(
    React, useFonts, React.useEffect, () => ({ isLoading: false, session: null }),
    () => React.createElement('Loading'), Stack, 1, 2, 3);
const DatabaseBoundary = React.memo(({ children }: any) => children, () => true);

test('font completion opens navigation even when SQLite ignores parent updates', () => {
  let tree: any;
  act(() => { tree = create(<DatabaseBoundary><RootNavigator /></DatabaseBoundary>); });
  expect(tree.root.findAllByType('Loading')).toHaveLength(1);
  act(() => completeFonts([true, null]));
  expect(tree.root.findAllByType('Loading')).toHaveLength(0);
  expect(tree.root.findAllByType('Navigator')).toHaveLength(1);
  act(() => tree.unmount());
});
