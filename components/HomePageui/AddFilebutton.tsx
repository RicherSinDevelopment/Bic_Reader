import React from "react";
import { View } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { AddIcon, Icon } from "@/components/ui/icon";

import { useDocumentPicker } from "@/hooks/useDocumentPicker";

export default function SignIn() {
  const { pickPdf } = useDocumentPicker();

  const handlePickPdf = async () => {
    try {
      const pdf = await pickPdf();

      if (!pdf) {
        console.log("User cancelled");
        return;
      }

      console.log("Selected PDF:", pdf);
    } catch (error) {
      console.error("Failed to pick PDF:", error);
    }
  };

  return (
    <View>

      <Button
        variant="default"
        size="lg"
        onPress={handlePickPdf}
        className="h-14 px-5 rounded-xl flex-row items-center justify-center bg-green-400"
      >
        <Icon
          as={AddIcon}
          size="md"
          className="mr-2"
        />

        <ButtonText
          className="font-lato-bold"
          style={{
            fontFamily: "Lato_700Bold",
          }}
        >
          ADD
        </ButtonText>
      </Button>
    </View>
  );
}
