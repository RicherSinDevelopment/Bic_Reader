import React from "react";
import { Text, View } from "react-native";

export default function BackgroundSettings() {
  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">Background</Text>
      <Text className="mt-2 text-sm text-slate-600">
        Change the background style, brightness, or page color to make reading
        easier on your eyes.
      </Text>
    </View>
  );
}
