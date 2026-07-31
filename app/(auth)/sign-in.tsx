import { useDocumentPicker } from "@/hooks/useDocumentPicker";
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from "react-native";
const SignIn = () => {
  const { pickPdf } = useDocumentPicker();

  const handlePickPdf = async () => {
    const pdf = await pickPdf();

    if (!pdf) {
      console.log("User cancelled");
      return;
    }

    console.log("Selected PDF:", pdf);
  };
  return (
    <View>
      <Text>signin</Text>
      <Link href="/(auth)/sign-in">Sing up</Link>
        <Pressable
        onPress={handlePickPdf}
        className="bg-purple-600 px-6 py-4 rounded-xl"
      >
        <Text className="text-white font-semibold">
          Select PDF
        </Text>
        </Pressable>
    </View>
  )
}

export default SignIn