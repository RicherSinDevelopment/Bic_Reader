import React from "react";
import { Pressable, type PressableProps, StyleSheet, View } from "react-native";

type ReaderGlassIconButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: React.ReactNode;
  grouped?: boolean;
};

export default function ReaderGlassIconButton({
  children,
  grouped = false,
  ...pressableProps
}: ReaderGlassIconButtonProps) {
  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={pressableProps.accessibilityRole ?? "button"}
      style={({ pressed }) => [
        styles.pressable,
        grouped ? styles.groupedPressable : styles.soloPressable,
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
  pressablePressed: {
    backgroundColor: "#f0efe9",
    borderRadius: 14,
  },
});
