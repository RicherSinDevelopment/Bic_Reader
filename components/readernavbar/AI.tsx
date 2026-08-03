import React from "react";
import { Text, View } from "react-native";

type AIProps = {
  selectedText?: string;
};

export default function AI({ selectedText = "" }: AIProps) {
  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">AI Tools</Text>
      {selectedText ? (
        <View className="mt-3 rounded-xl bg-slate-100 px-4 py-3">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Selected text
          </Text>
          <Text className="mt-2 text-sm leading-5 text-slate-800" numberOfLines={6}>
            {selectedText}
          </Text>
        </View>
      ) : null}
      <Text className="mt-2 text-sm text-slate-600">
        Use AI options to summarize, translate, or ask questions about the current
        text. Tap a feature to continue.
      </Text>
    </View>
  );
}
