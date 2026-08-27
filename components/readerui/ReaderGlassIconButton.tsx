import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, type PressableProps, StyleSheet, View } from "react-native";

type ReaderGlassIconButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: React.ReactNode;
  compact?: boolean;
  compactWidth?: number;
  grouped?: boolean;
};

export default function ReaderGlassIconButton({
  children,
  compact = false,
  compactWidth = 30,
  grouped = false,
  onPress,
  ...pressableProps
}: ReaderGlassIconButtonProps) {
  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      hitSlop={pressableProps.hitSlop ?? 4}
      onPress={(event) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.pressable,
        grouped
          ? compact
            ? [styles.compactGroupedPressable, { width: compactWidth }]
            : styles.groupedPressable
          : styles.soloPressable,
        pressed && styles.pressablePressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function ReaderGlassControlGroup({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.groupSurface}>{children}</View>;
}

const styles = StyleSheet.create({
  groupSurface: {
    width: 88,
    height: 44,
    flexDirection: "row",
  },
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  soloPressable: {
    width: 44,
    height: 44,
  },
  groupedPressable: {
    width: 44,
    height: 44,
  },
  compactGroupedPressable: {
    height: 44,
  },
  pressablePressed: {
    opacity: 0.52,
    transform: [{ scale: 0.9 }],
  },
});
