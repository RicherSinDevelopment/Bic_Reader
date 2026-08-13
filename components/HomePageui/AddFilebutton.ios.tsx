import { Button, Host, HStack, Image, Text } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  frame,
  shadow,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useState } from "react";

import { type PickedPdf, useDocumentPicker } from "@/hooks/useDocumentPicker";

type AddButtonProps = {
  onPdfPicked: (pdf: PickedPdf) => void | Promise<void>;
};

export default function AddButton({ onPdfPicked }: AddButtonProps) {
  const { pickPdf } = useDocumentPicker();
  const [isPicking, setIsPicking] = useState(false);

  const handlePickPdf = async () => {
    if (isPicking) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPicking(true);

    try {
      const pdf = await pickPdf();

      if (!pdf) {
        return;
      }

      await onPdfPicked(pdf);
    } catch (error) {
      console.error("Failed to pick PDF:", error);
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <Host style={{ width: "100%", height: 48 }}>
      <Button
        onPress={handlePickPdf}
        modifiers={[
          buttonStyle("glassProminent"),
          buttonBorderShape("roundedRectangle", 12),
          controlSize("large"),
          tint("#4ADE80"),
          shadow({ color: "#176C3440", radius: 15, x: 0, y: 9 }),
          shadow({ color: "#FFFFFF80", radius: 1, x: -1, y: -1 }),
          disabled(isPicking),
        ]}
      >
        <HStack
          spacing={8}
          alignment="center"
          modifiers={[
            frame({
              maxWidth: 10_000,
              minHeight: 38,
              alignment: "center",
            }),
          ]}
        >
          <Image
            systemName={isPicking ? "hourglass" : "plus.circle.fill"}
            size={20}
          />
          <Text modifiers={[font({ size: 17, weight: "semibold" })]}>
            {isPicking ? "Adding PDF" : "Add PDF"}
          </Text>
        </HStack>
      </Button>
    </Host>
  );
}
