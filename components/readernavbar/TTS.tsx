import React from "react";
import { Text, View } from "react-native";

export default function TTS() {
  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">Text to Speech</Text>
      <Text className="mt-2 text-sm text-slate-600">
        Control the text-to-speech settings for reading aloud, including voice,
        speed, and pause/resume options.
      </Text>
    </View>
  );
}
