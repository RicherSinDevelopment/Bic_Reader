import { homepageDepth } from "@/components/HomePageui/depthStyles";
import * as Haptics from "expo-haptics";
import { PlusCircle } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

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
    <View style={[homepageDepth.primary, { borderRadius: 12 }]}>
      <Pressable
        accessibilityLabel="Add PDF"
        accessibilityRole="button"
        disabled={isPicking}
        onPress={handlePickPdf}
        style={({ pressed }) => ({
          height: 64,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 12,
          backgroundColor: "#22C55E",
          opacity: isPicking ? 0.65 : 1,
          transform: [{ translateY: pressed && !isPicking ? 2 : 0 }],
        })}
      >
        {isPicking ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <PlusCircle color="#FFFFFF" size={20} fill="rgba(255,255,255,0.18)" />
        )}
        <Text
          style={{
            color: "#FFFFFF",
            fontFamily: "Lato_700Bold",
            fontSize: 17,
          }}
        >
          {isPicking ? "Adding PDF" : "Add PDF"}
        </Text>
      </Pressable>
    </View>
  );
}
