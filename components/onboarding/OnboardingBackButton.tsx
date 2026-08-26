import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";

export function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Go to the previous onboarding screen"
      accessibilityRole="button"
      hitSlop={11}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" color="#747D6D" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 20,
    width: 26,
    height: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(93, 105, 82, 0.16)",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 1,
    backgroundColor: "rgba(255, 254, 250, 0.58)",
  },
  pressed: { opacity: 0.55, transform: [{ scale: 0.94 }] },
});
