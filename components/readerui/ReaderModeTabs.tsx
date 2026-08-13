import React, { useEffect, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

export type ReaderMode = "reader" | "original";

type ReaderModeTabsProps = {
  value: ReaderMode;
  onValueChange: (value: ReaderMode) => void;
};

const CONTROL_WIDTH = 156;
const CONTROL_HEIGHT = 44;
const CONTROL_PADDING = 3;
const SEGMENT_WIDTH = (CONTROL_WIDTH - CONTROL_PADDING * 2) / 2;
const SEGMENT_HEIGHT = CONTROL_HEIGHT - CONTROL_PADDING * 2;

const READER_MODES = [
  { value: "reader", label: "Reader" },
  { value: "original", label: "Original" },
] as const;

export default function ReaderModeTabs({
  value,
  onValueChange,
}: ReaderModeTabsProps) {
  const [indicatorX] = useState(
    () => new Animated.Value(value === "original" ? SEGMENT_WIDTH : 0),
  );

  useEffect(() => {
    const animation = Animated.spring(indicatorX, {
      toValue: value === "original" ? SEGMENT_WIDTH : 0,
      damping: 25,
      stiffness: 300,
      mass: 0.75,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [indicatorX, value]);

  return (
    <View style={styles.surface}>
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { transform: [{ translateX: indicatorX }] }]}
      />

      <View style={styles.buttons}>
        {READER_MODES.map((mode) => {
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
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={[styles.label, isSelected && styles.selectedLabel]}>
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
    width: CONTROL_WIDTH,
    height: CONTROL_HEIGHT,
    borderRadius: 15,
    backgroundColor: "#eeece3",
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
    top: CONTROL_PADDING,
    left: CONTROL_PADDING,
    width: SEGMENT_WIDTH,
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
    width: SEGMENT_WIDTH,
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
