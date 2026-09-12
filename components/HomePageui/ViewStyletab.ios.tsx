import React, { useState } from "react";
import { Animated, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";

interface PdfLayoutTabsProps {
  initialColumns?: 1 | 2 | 3;
  onColumnsChange: (columns: 1 | 2 | 3) => void;
}

const SEGMENT_WIDTH = 44;
const CONTROL_HEIGHT = 48;
const CONTROL_PADDING = 4;
const CONTROL_WIDTH = SEGMENT_WIDTH * 3 + CONTROL_PADDING * 2;

const COLUMN_OPTIONS = [
  {
    columns: 1,
    label: "One-column PDF layout",
    icon: "rectangle.portrait",
  },
  {
    columns: 2,
    label: "Two-column PDF layout",
    icon: "rectangle.split.2x1",
  },
  {
    columns: 3,
    label: "PDF list layout",
    icon: "list.bullet",
  },
] as const;

export default function PdfLayoutTabs({ initialColumns = 1, onColumnsChange }: PdfLayoutTabsProps) {
  const [selectedColumns, setSelectedColumns] = useState<1 | 2 | 3>(initialColumns);
  const [indicatorX] = useState(() => new Animated.Value((initialColumns - 1) * SEGMENT_WIDTH));
  const canUseGlass = isGlassEffectAPIAvailable();
  const isDark = useColorScheme() === "dark";

  const selectColumns = (columns: 1 | 2 | 3) => {
    if (columns === selectedColumns) {
      return;
    }

    setSelectedColumns(columns);
    onColumnsChange(columns);
    void Haptics.selectionAsync();

    Animated.spring(indicatorX, {
      toValue: (columns - 1) * SEGMENT_WIDTH,
      damping: 19,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.depthShell}>
      <View style={styles.container}>
        {canUseGlass ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.fallbackBackground,
              isDark && styles.fallbackBackgroundDark,
            ]}
          />
        )}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { transform: [{ translateX: indicatorX }] },
          ]}
        />

        <View style={styles.buttons}>
          {COLUMN_OPTIONS.map((option) => {
            const isSelected = option.columns === selectedColumns;

            return (
              <Pressable
                key={option.columns}
                accessibilityLabel={option.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                onPress={() => selectColumns(option.columns)}
                style={styles.button}
              >
                <SymbolView
                  name={option.icon}
                  size={20}
                  weight={isSelected ? "semibold" : "regular"}
                  tintColor={isDark
                    ? isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.78)"
                    : isSelected ? "#07120A" : "rgba(0, 0, 0, 0.58)"}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  depthShell: {
    width: CONTROL_WIDTH,
    height: CONTROL_HEIGHT,
    borderRadius: 14,
    shadowColor: "#173A21",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 5,
  },
  container: {
    width: CONTROL_WIDTH,
    height: CONTROL_HEIGHT,
    borderRadius: 14,
    overflow: "hidden",
  },
  fallbackBackground: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.84)",
  },
  fallbackBackgroundDark: {
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(26, 30, 24, 0.9)",
  },
  indicator: {
    position: "absolute",
    top: CONTROL_PADDING,
    left: CONTROL_PADDING,
    width: SEGMENT_WIDTH,
    height: CONTROL_HEIGHT - CONTROL_PADDING * 2,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#639922",
  },
  buttons: {
    position: "absolute",
    top: CONTROL_PADDING,
    left: CONTROL_PADDING,
    flexDirection: "row",
  },
  button: {
    width: SEGMENT_WIDTH,
    height: CONTROL_HEIGHT - CONTROL_PADDING * 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
