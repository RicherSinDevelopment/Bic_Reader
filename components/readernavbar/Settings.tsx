import React from "react";
import { Text, View } from "react-native";

export default function Settings() {
  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">Reader Settings</Text>
      <Text className="mt-2 text-sm text-slate-600">
        Open reader settings to control page layout, navigation behavior, and
        general reading preferences.
      </Text>
    </View>
  );
}
