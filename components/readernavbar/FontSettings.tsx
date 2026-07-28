import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { Switch } from '@/components/ui/switch';
import { ChevronDownIcon, Icon } from '@/components/ui/icon';
import { useReaderSettingsStore } from '@/stores/readerSettingsStore';
import { Check } from 'lucide-react-native';
import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

const fontOptions = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Gill Sans', value: '"Gill Sans", "Gill Sans MT", sans-serif' },
  { label: 'Century Gothic', value: '"Century Gothic", sans-serif' },
  { label: 'Franklin Gothic', value: '"Franklin Gothic Medium", Arial, sans-serif' },
  { label: 'Arial Narrow', value: '"Arial Narrow", Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Palatino', value: 'Palatino, "Palatino Linotype", serif' },
  { label: 'Book Antiqua', value: '"Book Antiqua", Palatino, serif' },
  { label: 'Baskerville', value: 'Baskerville, Georgia, serif' },
  { label: 'Didot', value: 'Didot, Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Lucida Console', value: '"Lucida Console", Monaco, monospace' },
  { label: 'Monaco', value: 'Monaco, "Courier New", monospace' },
  { label: 'Copperplate', value: 'Copperplate, "Copperplate Gothic Light", fantasy' },
  { label: 'Papyrus', value: 'Papyrus, fantasy' },
  { label: 'Brush Script MT', value: '"Brush Script MT", cursive' },
] as const;

function FontFamilyPicker() {
  const [isOpen, setIsOpen] = React.useState(false);
  const fontFamily = useReaderSettingsStore((state) => state.fontFamily);
  const setFontFamily = useReaderSettingsStore((state) => state.setFontFamily);
  const selectedLabel =
    fontOptions.find((option) => option.value === fontFamily)?.label ?? 'Arial';

  return (
    <>
      <Pressable
        accessibilityLabel={`Choose font. Current font: ${selectedLabel}`}
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        className="h-10 max-w-64 flex-row items-center gap-2 rounded-md border border-black/20 bg-white px-3 active:bg-black/5"
      >
        <Text numberOfLines={1} style={{ fontFamily }} className="shrink text-sm text-black">
          {selectedLabel}
        </Text>
        <Icon as={ChevronDownIcon} size="xs" className="text-black/60" />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close font menu"
          className="absolute inset-0 bg-black/20"
          onPress={() => setIsOpen(false)}
        />
        <View className="mx-6 my-auto max-h-[70%] overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-lg">
          <Text className="px-3 pb-2 pt-3 text-base font-semibold text-slate-900">
            Choose a font
          </Text>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerClassName="pb-1"
          >
            {fontOptions.map((option) => {
              const isSelected = option.value === fontFamily;

              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    setFontFamily(option.value);
                    setIsOpen(false);
                  }}
                  className="h-12 flex-row items-center justify-between rounded px-3 active:bg-black/5"
                >
                  <Text style={{ fontFamily: option.value }} className="text-base text-black">
                    {option.label}
                  </Text>
                  {isSelected && <Check size={16} color="#000000" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

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
        <FontFamilyPicker />
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
