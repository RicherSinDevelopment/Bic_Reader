import { Center } from "@/components/ui/center";
import { Switch } from "@/components/ui/switch";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import React from "react";
import { Text, View } from "react-native";

export default function Settings() {
  const disableRotation = useReaderSettingsStore(
    (state) => state.disableRotation
  );
  const toggleDisableRotation = useReaderSettingsStore(
    (state) => state.toggleDisableRotation
  );

  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">
        Reader Settings
      </Text>

      <View className="mt-6 flex-row items-center justify-between">
        <Text className="text-m text-slate-600">Disable rotation:</Text>
        <Center>
          <Switch
            size="md"
            value={disableRotation}
            onValueChange={toggleDisableRotation}
            isDisabled={false}
            trackColor={{
              false: "#d4d4d4",
              true: "#525252",
            }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>
    </View>
  );
}