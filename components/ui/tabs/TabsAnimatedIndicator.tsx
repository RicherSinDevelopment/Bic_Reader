import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { LayoutData } from '@gluestack-ui/core/tabs/creator';
import { tabsAnimationConfig } from './animation-config';
import { Platform } from 'react-native';

interface TabsAnimatedIndicatorProps {
  selectedKey: any;
  orientation: 'horizontal' | 'vertical';
  triggerLayouts: Map<any, LayoutData>;
  scrollOffset?: number;
  className?: string;
  style?: any;
}
const isWeb = Platform.OS === 'web';

export const TabsAnimatedIndicator = React.forwardRef<
  any,
  TabsAnimatedIndicatorProps
>(
  (
    {
      selectedKey,
      orientation,
      triggerLayouts,
      scrollOffset = 0,
      className,
      style,
    },
    ref
  ) => {
    const animatedX = useSharedValue(0);
    const animatedY = useSharedValue(0);
    const animatedWidth = useSharedValue(0);
    const animatedHeight = useSharedValue(0);
    const [hasLayout, setHasLayout] = useState(false);
    const previousSelectedKey = useRef(selectedKey);
    // Create a shared value for scroll offset to use in worklet
    const scrollOffsetShared = useSharedValue(scrollOffset);

    // Update scroll offset shared value when scrollOffset changes
    useEffect(() => {
      scrollOffsetShared.value = scrollOffset;
    }, [scrollOffset, scrollOffsetShared]);

    useEffect(() => {
      if (selectedKey && triggerLayouts.has(selectedKey)) {
        const layout = triggerLayouts.get(selectedKey);

        if (layout && layout.width > 0) {
          // Determine if this is the first time we're setting values
          const selectionChanged = previousSelectedKey.current !== selectedKey;
          const duration = hasLayout && selectionChanged
            ? tabsAnimationConfig.indicatorDuration
            : 0;

          previousSelectedKey.current = selectedKey;

          // Store the absolute x position (not adjusted for scroll)
          animatedX.value = withDelay(
            20,
            withTiming(layout.x, {
              duration: duration,
              easing: Easing.ease,
            })
          );
          animatedY.value = withTiming(layout.y, {
            duration: duration,
            easing: Easing.ease,
          });
          animatedWidth.value = withTiming(layout.width, {
            duration: duration,
            easing: Easing.ease,
          });
          animatedHeight.value = withTiming(layout.height, {
            duration: duration,
            easing: Easing.ease,
          });

          if (!hasLayout) {
            setHasLayout(true);
          }
        }
      }
    }, [
      selectedKey,
      triggerLayouts,
      hasLayout,
      animatedX,
      animatedY,
      animatedWidth,
      animatedHeight,
    ]);

    const animatedStyle = useAnimatedStyle(() => {
      'worklet';

      const scrollOffsetValue = scrollOffsetShared.value;

      const xPos = orientation === 'horizontal'
        ? animatedX.value - scrollOffsetValue
        : animatedX.value;

      // Web: react-native-reanimated does not reliably flush the transform
      // array to a CSS transform string, so use left/top instead.
      // Native: keep transform for GPU-accelerated UI-thread animation.
      if (isWeb) {
        return {
          left: xPos,
          top: animatedY.value,
          width: animatedWidth.value,
          height: animatedHeight.value,
        };
      }

      return {
        transform: [
          { translateX: xPos } as { translateX: number },
          { translateY: animatedY.value } as { translateY: number },
        ],
        width: animatedWidth.value,
        height: animatedHeight.value,
      };
    }, [orientation, animatedX, animatedY, animatedWidth, animatedHeight]);

    // Don't render indicator until we have valid layout data
    if (!hasLayout) {
      return null;
    }

    return (
      <Animated.View
        ref={ref}
        className={className}
        style={[
          animatedStyle,
          style,
          {
            position: 'absolute',
            zIndex: 1,
          },
        ]}
      />
    );
  }
);

TabsAnimatedIndicator.displayName = 'TabsAnimatedIndicator';
