import { Button, Host } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  shadow,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";

export default function ProfileBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Host style={{ width: 44, height: 44 }}>
      <Button
        systemImage="chevron.left"
        controlSize="regular"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        modifiers={[
          buttonStyle("glass"),
          accessibilityLabel("Back to library"),
          shadow({ color: "#173A212E", radius: 9, x: 0, y: 5 }),
          shadow({ color: "#FFFFFF70", radius: 1, x: -1, y: -1 }),
        ]}
      />
    </Host>
  );
}
