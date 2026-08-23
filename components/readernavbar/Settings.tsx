import { Center } from "@/components/ui/center";
import { ChevronDownIcon, Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import { Check } from "lucide-react-native";
import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

const dimmingOptions = Array.from({ length: 10 }, (_, index) => index * 10);

export default function Settings() {
  const [isDimmingMenuOpen, setIsDimmingMenuOpen] = React.useState(false);
  const disableRotation = useReaderSettingsStore(
    (state) => state.disableRotation
  );
  const toggleDisableRotation = useReaderSettingsStore(
    (state) => state.toggleDisableRotation
  );
  const transition = useReaderSettingsStore((state) => state.transition);
  const automaticHyphenation = useReaderSettingsStore(
    (state) => state.automaticHyphenation
  );
  const setAutomaticHyphenation = useReaderSettingsStore(
    (state) => state.setAutomaticHyphenation
  );
  const lineGuideEnabled = useReaderSettingsStore(
    (state) => state.lineGuideEnabled
  );
  const setLineGuideEnabled = useReaderSettingsStore(
    (state) => state.setLineGuideEnabled
  );
  const wordGuideEnabled = useReaderSettingsStore(
    (state) => state.wordGuideEnabled
  );
  const setWordGuideEnabled = useReaderSettingsStore(
    (state) => state.setWordGuideEnabled
  );
  const guideBackgroundDimming = useReaderSettingsStore(
    (state) => state.guideBackgroundDimming
  );
  const setGuideBackgroundDimming = useReaderSettingsStore(
    (state) => state.setGuideBackgroundDimming
  );
  const setTransition = useReaderSettingsStore((state) => state.setTransition);

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

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600">Automatic hyphenation:</Text>
          <Text className="mt-1 text-xs text-slate-500">
            Break long words at natural points when space is tight.
          </Text>
        </View>
        <Center>
          <Switch
            accessibilityLabel="Automatic hyphenation"
            size="md"
            value={automaticHyphenation}
            onValueChange={setAutomaticHyphenation}
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#525252" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600">Line guide:</Text>
          <Text className="mt-1 text-xs text-slate-500">
            Tap anywhere to move down one line.
          </Text>
        </View>
        <Center>
          <Switch
            size="md"
            value={lineGuideEnabled}
            onValueChange={(enabled) => {
              if (enabled) setTransition("scroll");
              setLineGuideEnabled(enabled);
            }}
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#525252" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600">Word guide:</Text>
          <Text className="mt-1 text-xs text-slate-500">
            Tap above or below to move one word.
          </Text>
        </View>
        <Center>
          <Switch
            size="md"
            value={wordGuideEnabled}
            onValueChange={(enabled) => {
              if (enabled) setTransition("scroll");
              setWordGuideEnabled(enabled);
            }}
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#525252" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600">Background dimming:</Text>
        <Pressable
          accessibilityLabel={`Choose background dimming. Current value: ${guideBackgroundDimming}%`}
          accessibilityRole="button"
          onPress={() => setIsDimmingMenuOpen(true)}
          className="h-10 min-w-24 flex-row items-center justify-between gap-2 rounded-md border border-black/20 bg-white px-3 active:bg-black/5"
        >
          <Text className="text-sm text-black">{guideBackgroundDimming}%</Text>
          <Icon as={ChevronDownIcon} size="xs" className="text-black/60" />
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600">Horizontal swipe:</Text>
          <Text className="mt-1 text-xs text-slate-500">
            Turn off to read with vertical scrolling.
          </Text>
        </View>
        <Center>
          <Switch
            accessibilityLabel="Horizontal swipe"
            size="md"
            value={transition === "pager"}
            onValueChange={(enabled) =>
              setTransition(enabled ? "pager" : "scroll")
            }
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#525252" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isDimmingMenuOpen}
        onRequestClose={() => setIsDimmingMenuOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close background dimming menu"
          className="absolute inset-0 bg-black/20"
          onPress={() => setIsDimmingMenuOpen(false)}
        />
        <View className="mx-6 my-auto overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-lg">
          <Text className="px-3 pb-2 pt-3 text-base font-semibold text-slate-900">
            Background dimming
          </Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {dimmingOptions.map((percentage) => {
              const isSelected = percentage === guideBackgroundDimming;
              return (
                <Pressable
                  key={percentage}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    setGuideBackgroundDimming(percentage);
                    setIsDimmingMenuOpen(false);
                  }}
                  className="h-10 flex-row items-center justify-between rounded px-3 active:bg-black/5"
                >
                  <Text className="text-base text-black">{percentage}%</Text>
                  {isSelected && <Check size={16} color="#000000" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
