import React from "react";
import { Text, View } from "react-native";

export default function FontSettings() {
  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">Font Settings</Text>
      <Text className="mt-2 text-sm text-slate-600">
        Adjust font size, weight, and spacing so the reader content is comfortable
        and easy to scan.
      </Text>
    </View>
  );
}
