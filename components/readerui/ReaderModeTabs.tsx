import React, { useEffect } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export type ReaderMode = "reader" | "original";

type ReaderModeTabsProps = {
  value: ReaderMode;
  onValueChange: (value: ReaderMode) => void;
};

const TWO_TAB_WIDTH = 156;
const CONTROL_HEIGHT = 44;
const CONTROL_PADDING = 3;
const SEGMENT_HEIGHT = CONTROL_HEIGHT - CONTROL_PADDING * 2;
const SEGMENT_WIDTH = (TWO_TAB_WIDTH - CONTROL_PADDING * 2) / 2;
const READER_MODES: { value: ReaderMode; label: string }[] = [
  { value: "reader", label: "Reader" },
  { value: "original", label: "Original" },
];

export default function ReaderModeTabs({
  value,
  onValueChange,
}: ReaderModeTabsProps) {
  const isDark = useColorScheme() === "dark";
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);
  const modes = READER_MODES;
  const controlWidth = TWO_TAB_WIDTH;
  const modeWidths = modes.map(() => SEGMENT_WIDTH);
  const selectedIndex = Math.max(
    0,
    modes.findIndex((mode) => mode.value === value),
  );
  const selectedOffset = modeWidths
    .slice(0, selectedIndex)
    .reduce((total, width) => total + width, 0);
  const selectedWidth = modeWidths[selectedIndex] ?? SEGMENT_WIDTH;
  const indicatorX = useSharedValue(selectedOffset);
  const indicatorWidth = useSharedValue(selectedWidth);

  useEffect(() => {
    const spring = {
      damping: 28,
      stiffness: 340,
      mass: 0.72,
    };
    indicatorX.value = withSpring(selectedOffset, spring);
    indicatorWidth.value = withSpring(selectedWidth, spring);
  }, [indicatorWidth, indicatorX, selectedOffset, selectedWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View style={[styles.surface, { width: controlWidth }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, indicatorStyle]}
      />

      <View style={styles.buttons}>
        {modes.map((mode, index) => {
          const isSelected = value === mode.value;

          return (
            <Pressable
              key={mode.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${mode.label} view`}
              onPress={() => {
                if (!isSelected) onValueChange(mode.value);
              }}
              style={({ pressed }) => [
                styles.button,
                { width: modeWidths[index] },
                pressed && styles.pressedButton,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.label, isSelected && styles.selectedLabel]}
              >
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    surface: {
      height: CONTROL_HEIGHT,
      borderRadius: 15,
      backgroundColor: isDark ? "#262B24" : "#eeece3",
      overflow: "hidden",
    },
    indicator: {
      position: "absolute",
      top: CONTROL_PADDING,
      left: CONTROL_PADDING,
      height: SEGMENT_HEIGHT,
      borderRadius: 12,
      backgroundColor: "#639922",
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 3,
    },
    buttons: {
      position: "absolute",
      top: CONTROL_PADDING,
      left: CONTROL_PADDING,
      flexDirection: "row",
    },
    button: {
      height: SEGMENT_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    pressedButton: {
      transform: [{ scale: 0.97 }],
    },
    label: {
      color: isDark ? "#A6ADA1" : "#77786f",
      fontFamily: Platform.OS === "ios" ? undefined : "Lato_700Bold",
      fontSize: 14,
      fontWeight: "500",
      letterSpacing: -0.15,
    },
    selectedLabel: {
      color: "#ffffff",
      fontWeight: "700",
    },
  });
