import { Button, ButtonText } from '@/components/ui/button';
import { useReaderSettingsStore } from '@/stores/readerSettingsStore';
import React from "react";
import { Text, View } from "react-native";
export default function FontSettings() {
  const increaseFontSize = useReaderSettingsStore(
    (state) => state.increaseFontSize
  );

  const decreaseFontSize = useReaderSettingsStore(
    (state) => state.decreaseFontSize
  );
  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">Font Settings</Text>

      <View className="flex-1">
        <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600">
          Font-style: 
        </Text>
        <Text>hello</Text>
        </View>
      </View>
      <View className="flex-1 mt-4">
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-m text-slate-600">
              Font-Size: 
            </Text>
          <View className='flex-row gap-4'>
            <Button variant="default" size="default" onPress={increaseFontSize}>
              <ButtonText>A+</ButtonText>
            </Button>
            <Button variant="default" size="default" onPress={decreaseFontSize}>
              <ButtonText>a-</ButtonText>
          </Button>
          </View>
        </View>
      </View>
      <View className="flex-1 mt-4">
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-m text-slate-600">
              Line-space: 
            </Text>
          <View className='flex-row gap-4'>
            <Button variant="default" size="default">
              <ButtonText>A</ButtonText>
            </Button>
            <Button variant="default" size="default">
              <ButtonText>a</ButtonText>
          </Button>
          </View>
        </View>
      </View>
      <View className="flex-1 mt-4">
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-m text-slate-600">
              Character-spacing: 
            </Text>
          <View className='flex-row gap-4'>
            <Button variant="default" size="default">
              <ButtonText>A</ButtonText>
            </Button>
            <Button variant="default" size="default">
              <ButtonText>a</ButtonText>
          </Button>
          </View>
        </View>
      </View>
      <View className="flex-1 mt-4">
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-m text-slate-600">
              Word-spacing: 
            </Text>
          <View className='flex-row gap-4'>
            <Button variant="default" size="default">
              <ButtonText>A</ButtonText>
            </Button>
            <Button variant="default" size="default">
              <ButtonText>a</ButtonText>
          </Button>
          </View>
        </View>
      </View>
    </View>
  );
}
