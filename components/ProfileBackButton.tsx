import * as Haptics from "expo-haptics";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, useColorScheme } from "react-native";

export default function ProfileBackButton({ onPress }: { onPress: () => void }) {
  const isDark = useColorScheme() === "dark";
  return (
    <Pressable
      accessibilityLabel="Back to library"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: isDark ? "rgba(31, 36, 29, 0.9)" : "rgba(255, 255, 255, 0.9)" },
        pressed && styles.pressed,
      ]}
    >
      <ArrowLeft color={isDark ? "#F4F5F1" : "#2C2C2A"} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127, 127, 127, 0.28)",
  },
  pressed: { opacity: 0.62, transform: [{ scale: 0.94 }] },
});
