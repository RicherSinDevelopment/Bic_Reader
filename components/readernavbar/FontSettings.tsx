import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { Switch } from '@/components/ui/switch';
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
  const increaseLineHeight = useReaderSettingsStore(
  (state) => state.increaseLineHeight
  );

  const decreaseLineHeight = useReaderSettingsStore(
  (state) => state.decreaseLineHeight
  );

  const increaseLetterSpacing = useReaderSettingsStore(
  (state) => state.increaseLetterSpacing
  );

const decreaseLetterSpacing = useReaderSettingsStore(
  (state) => state.decreaseLetterSpacing
  );

  const increaseWordSpacing = useReaderSettingsStore(
  (state) => state.increaseWordSpacing
);

const decreaseWordSpacing = useReaderSettingsStore(
  (state) => state.decreaseWordSpacing
);

const bold = useReaderSettingsStore(
  (state) => state.bold
);

const toggleBold = useReaderSettingsStore(
  (state) => state.toggleBold
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
            <Button variant="default" size="default" onPress={increaseLineHeight}>
              <ButtonText>A</ButtonText>
            </Button>
            <Button variant="default" size="default" onPress={decreaseLineHeight}>
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
            <Button variant="default" size="default" onPress={increaseLetterSpacing}>
              <ButtonText>A</ButtonText>
            </Button>
            <Button variant="default" size="default" onPress={decreaseLetterSpacing}>
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
            <Button variant="default" size="default"  onPress={increaseWordSpacing}>
              <ButtonText>A</ButtonText>
            </Button>
            <Button variant="default" size="default" onPress={decreaseWordSpacing}>
              <ButtonText>a</ButtonText>
          </Button>
          </View>
        </View>
      </View>
      <View className="flex-1 mt-4">
          <View className="mt-4 flex-row items-center justify-between">
            <Text className="text-m text-slate-600">
              Bold: 
            </Text>
          <Center>
      <Switch
    size="md"
    value={bold}
    onValueChange={toggleBold}
    isDisabled={false}
    trackColor={{
      false: '#d4d4d4',
      true: '#525252',
    }}
    thumbColor="#fafafa"
    ios_backgroundColor="#d4d4d4"
  />
    </Center>
        </View>
      </View>
    </View>
  );
}
