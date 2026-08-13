import { Button, Host } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
  shadow,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

export default function SettingsButton() {
  const router = useRouter();

  const openSettings = () => {
    void Haptics.selectionAsync();
    router.push("/Profile");
  };

  return (
    <Host style={{ width: 40, height: 40 }}>
      <Button
        label="Open account settings"
        systemImage="gearshape.fill"
        onPress={openSettings}
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("roundedRectangle", 12),
          controlSize("regular"),
          labelStyle("iconOnly"),
          shadow({ color: "#173A212E", radius: 9, x: 0, y: 5 }),
          shadow({ color: "#FFFFFF70", radius: 1, x: -1, y: -1 }),
        ]}
      />
    </Host>
  );
}
