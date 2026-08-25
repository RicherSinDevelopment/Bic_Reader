import {
  CaseSensitive,
  LockKeyhole,
  Settings,
  Sparkles,
  Speech,
  Wallpaper,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";

export type ReaderBottomNavItem =
  "font" | "background" | "tts" | "ai" | "settings";

type ToolbarItem = {
  id: ReaderBottomNavItem;
};

const toolbarItems: ToolbarItem[] = [
  { id: "font" },
  { id: "background" },
  { id: "tts" },
  { id: "ai" },
  { id: "settings" },
];

const toolbarLabels: Record<ReaderBottomNavItem, string> = {
  font: "Font settings",
  background: "Appearance settings",
  tts: "Text to speech",
  ai: "Ask AI",
  settings: "Reader settings",
};

type Props = {
  activeItem: ReaderBottomNavItem;
  isAiLocked?: boolean;
  onSelectItem: (item: ReaderBottomNavItem) => void;
};

export default function ReaderToolbar({ activeItem, isAiLocked = false, onSelectItem }: Props) {
  const isDark = useColorScheme() === "dark";
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);

  const renderIcon = (item: ReaderBottomNavItem) => {
    const iconProps = {
      size: 22,
      color: "#639922",
      strokeWidth: 2,
    };

    switch (item) {
      case "font":
        return <CaseSensitive {...iconProps} />;

      case "background":
        return <Wallpaper {...iconProps} />;

      case "tts":
        return <Speech {...iconProps} />;

      case "ai":
        return <Sparkles {...iconProps} />;

      case "settings":
        return <Settings {...iconProps} />;

      default:
        return null;
    }
  };

  return (
    <View style={styles.tabbar}>
      {toolbarItems.map((item) => {
        const isFocused = activeItem === item.id;

        return (
          <Pressable
            accessibilityLabel={toolbarLabels[item.id]}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            key={item.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelectItem(item.id);
            }}
            style={({ pressed }) => [
              styles.tabbarItem,
              pressed && styles.pressedItem,
            ]}
          >
            {renderIcon(item.id)}
            {item.id === "ai" && isAiLocked ? (
              <View style={styles.lockBadge}>
                <LockKeyhole color="#FFFFFF" size={9} strokeWidth={2.5} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  tabbar: {
    position: "absolute",

    bottom: 25,
    left: 20,
    right: 20,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    backgroundColor: isDark ? "#1A1E18" : "#ffffff",

    paddingVertical: 15,
    paddingHorizontal: 10,

    borderRadius: 25,
    borderColor: isDark ? "#343A31" : "rgba(0, 0, 0, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },

  tabbarItem: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    position: "relative",

    paddingVertical: 8,
    minHeight: 36,
    zIndex: 1,
  },

  pressedItem: {
    opacity: 0.62,
    transform: [{ scale: 0.94 }],
  },
  lockBadge: {
    position: "absolute",
    top: 2,
    right: "22%",
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#639922",
    borderWidth: 2,
    borderColor: isDark ? "#1A1E18" : "#FFFFFF",
  },
});
