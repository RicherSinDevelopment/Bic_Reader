import React from "react";
import { Text, View } from "react-native";

export default function AI() {
  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">AI Tools</Text>
      <Text className="mt-2 text-sm text-slate-600">
        Use AI options to summarize, translate, or ask questions about the current
        text. Tap a feature to continue.
      </Text>
    </View>
  );
}
