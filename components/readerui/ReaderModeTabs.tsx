import React, { useEffect, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type ReaderMode = "reader" | "translated" | "original";

type ReaderModeTabsProps = {
  value: ReaderMode;
  onValueChange: (value: ReaderMode) => void;
  showTranslated?: boolean;
};

const TWO_TAB_WIDTH = 156;
const CONTROL_HEIGHT = 44;
const CONTROL_PADDING = 3;
const SEGMENT_HEIGHT = CONTROL_HEIGHT - CONTROL_PADDING * 2;
const SEGMENT_WIDTH = (TWO_TAB_WIDTH - CONTROL_PADDING * 2) / 2;
const TRANSLATED_SEGMENT_WIDTH = 100;
const THREE_TAB_WIDTH =
  SEGMENT_WIDTH * 2 + TRANSLATED_SEGMENT_WIDTH + CONTROL_PADDING * 2;

const READER_MODES: { value: ReaderMode; label: string }[] = [
  { value: "reader", label: "Reader" },
  { value: "translated", label: "Translated" },
  { value: "original", label: "Original" },
];

export default function ReaderModeTabs({
  value,
  onValueChange,
  showTranslated = false,
}: ReaderModeTabsProps) {
  const modes = showTranslated
    ? READER_MODES
    : READER_MODES.filter((mode) => mode.value !== "translated");
  const controlWidth = showTranslated ? THREE_TAB_WIDTH : TWO_TAB_WIDTH;
  const modeWidths = modes.map((mode) =>
    mode.value === "translated" ? TRANSLATED_SEGMENT_WIDTH : SEGMENT_WIDTH,
  );
  const selectedIndex = Math.max(
    0,
    modes.findIndex((mode) => mode.value === value),
  );
  const selectedOffset = modeWidths
    .slice(0, selectedIndex)
    .reduce((total, width) => total + width, 0);
  const selectedWidth = modeWidths[selectedIndex] ?? SEGMENT_WIDTH;
  const [indicatorX] = useState(
    () => new Animated.Value(selectedOffset),
  );

  useEffect(() => {
    const animation = Animated.spring(indicatorX, {
      toValue: selectedOffset,
      damping: 25,
      stiffness: 300,
      mass: 0.75,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [indicatorX, selectedOffset]);

  return (
    <View style={[styles.surface, { width: controlWidth }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          { width: selectedWidth, transform: [{ translateX: indicatorX }] },
        ]}
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
                style={[
                  styles.label,
                  isSelected && styles.selectedLabel,
                ]}
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

const styles = StyleSheet.create({
  surface: {
    height: CONTROL_HEIGHT,
    borderRadius: 15,
    backgroundColor: "#eeece3",
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
    top: CONTROL_PADDING,
    left: CONTROL_PADDING,
    height: SEGMENT_HEIGHT,
    borderRadius: 12,
    backgroundColor: "#171914",
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
    color: "#77786f",
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
