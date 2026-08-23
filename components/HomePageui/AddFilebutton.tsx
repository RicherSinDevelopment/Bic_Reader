import React, { useState } from "react";
import { View } from "react-native";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { AddIcon, Icon } from "@/components/ui/icon";
import { homepageDepth } from "@/components/HomePageui/depthStyles";

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
    <View style={homepageDepth.primary}>
      <Button
        variant="default"
        size="lg"
        onPress={handlePickPdf}
        isDisabled={isPicking}
        className="h-16 flex-row items-center justify-center rounded-xl bg-[#639922] px-5 active:translate-y-0.5"
      >
        {isPicking ? (
          <ButtonSpinner color="#FFFFFF" />
        ) : (
          <Icon as={AddIcon} size="md" className="mr-2 text-white" />
        )}

        <ButtonText
          className="font-lato-bold text-white"
          style={{
            fontFamily: "Lato_700Bold",
          }}
        >
          {isPicking ? "ADDING" : "ADD"}
        </ButtonText>
      </Button>
    </View>
  );
}
