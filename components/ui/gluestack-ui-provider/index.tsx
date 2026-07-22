import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import React, { useEffect } from 'react';
import { Appearance, ColorSchemeName, View, ViewProps } from 'react-native';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({
  mode = 'system',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) {
  useEffect(() => {
    Appearance.setColorScheme(mode as ColorSchemeName);
  }, [mode]);

  return (
    <OverlayProvider>
      <ToastProvider>
        <View
          style={[
            { flex: 1 },
            props.style,
          ]}
        >
          {props.children}
        </View>
      </ToastProvider>
    </OverlayProvider>
  );
}
