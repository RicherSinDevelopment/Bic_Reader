import {
  Brain,
  CaseSensitive,
  Settings,
  Speech,
  Wallpaper,
} from "lucide-react-native";
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export type ReaderBottomNavItem =
  | "font"
  | "background"
  | "tts"
  | "ai"
  | "settings";

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

type Props = {
  activeItem: ReaderBottomNavItem;
  onSelectItem: (item: ReaderBottomNavItem) => void;
};

export default function ReaderToolbar({
  activeItem,
  onSelectItem,
}: Props) {
  const greyColor = "#737373";

  const renderIcon = (
    item: ReaderBottomNavItem,
    isFocused: boolean
  ) => {
    const iconProps = {
      size: 22,
      color: greyColor,
      strokeWidth: isFocused ? 2.5 : 2,
    };

    switch (item) {
      case "font":
        return <CaseSensitive {...iconProps} />;

      case "background":
        return <Wallpaper {...iconProps} />;

      case "tts":
        return <Speech {...iconProps} />;

      case "ai":
        return <Brain {...iconProps} />;

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
            key={item.id}
            onPress={() => onSelectItem(item.id)}
            style={({ pressed }) => [
              styles.tabbarItem,
              pressed && styles.pressedItem,
            ]}
            accessibilityRole="button"
            accessibilityState={{
              selected: isFocused,
            }}
          >
            {/* Icon */}
            {renderIcon(item.id, isFocused)}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    position: "absolute",

    bottom: 25,
    left: 20,
    right: 20,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    backgroundColor: "white",

    paddingVertical: 15,
    paddingHorizontal: 10,

    borderRadius: 25,

    shadowColor: "black",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowRadius: 10,
    shadowOpacity: 0.1,

    elevation: 8,
  },

  tabbarItem: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    position: "relative",

    paddingVertical: 8,
    minHeight: 36,
  },

  pressedItem: {
    opacity: 0.7,
  },

});

