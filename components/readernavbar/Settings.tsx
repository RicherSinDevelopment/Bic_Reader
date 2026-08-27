import { Center } from "@/components/ui/center";
import { BottomSheetScrollView } from "@/components/ui/bottomsheet";
import SteppedSlider from "@/components/ui/SteppedSlider";
import { Switch } from "@/components/ui/switch";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import { Pressable, Text, View } from "react-native";

const dimmingLevels = Array.from({ length: 9 }, (_, index) => (index + 1) * 10);
const marginPresets = [
  { label: "Small", value: "compact" },
  { label: "Default", value: "comfortable" },
  { label: "Big", value: "relaxed" },
] as const;

type SettingsProps = {
  onTransitionChange?: () => void;
};

export default function Settings({ onTransitionChange }: SettingsProps) {
  const disableRotation = useReaderSettingsStore(
    (state) => state.disableRotation
  );
  const toggleDisableRotation = useReaderSettingsStore(
    (state) => state.toggleDisableRotation
  );
  const hideTopBarOnScroll = useReaderSettingsStore(
    (state) => state.hideTopBarOnScroll
  );
  const setHideTopBarOnScroll = useReaderSettingsStore(
    (state) => state.setHideTopBarOnScroll
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
  const verticalMarginPreset = useReaderSettingsStore((state) => state.verticalMarginPreset);
  const horizontalMarginPreset = useReaderSettingsStore((state) => state.horizontalMarginPreset);
  const setVerticalMarginPreset = useReaderSettingsStore((state) => state.setVerticalMarginPreset);
  const setHorizontalMarginPreset = useReaderSettingsStore((state) => state.setHorizontalMarginPreset);

  return (
    <BottomSheetScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-lg font-semibold text-slate-900 dark:text-[#F4F5F1]">
        Reader Settings
      </Text>

      <View className="mt-6 flex-row items-center justify-between">
        <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Disable rotation:</Text>
        <Center>
          <Switch
            size="md"
            value={disableRotation}
            onValueChange={toggleDisableRotation}
            isDisabled={false}
            trackColor={{
              false: "#d4d4d4",
              true: "#639922",
            }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Horizontal swipe:</Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
            Turn off to read with vertical scrolling.
          </Text>
        </View>
        <Center>
          <Switch
            accessibilityLabel="Horizontal swipe"
            size="md"
            value={transition === "pager"}
            onValueChange={(enabled) => {
              setTransition(enabled ? "pager" : "scroll");
              onTransitionChange?.();
            }}
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#639922" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Hide top bar:</Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
            Hide the header and iPhone status icons while scrolling down.
          </Text>
        </View>
        <Center>
          <Switch
            accessibilityLabel="Hide top bar while scrolling"
            size="md"
            value={hideTopBarOnScroll}
            onValueChange={setHideTopBarOnScroll}
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#639922" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Automatic hyphenation:</Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
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
            trackColor={{ false: "#d4d4d4", true: "#639922" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Line guide:</Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
            Tap anywhere to move down one line.
          </Text>
        </View>
        <Center>
          <Switch
            size="md"
            value={lineGuideEnabled}
            onValueChange={(enabled) => {
              setLineGuideEnabled(enabled);
            }}
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#639922" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Word guide:</Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
            Tap above or below to move one word.
          </Text>
        </View>
        <Center>
          <Switch
            size="md"
            value={wordGuideEnabled}
            onValueChange={(enabled) => {
              setWordGuideEnabled(enabled);
            }}
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#639922" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

      <View className="mt-5">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">
              Background dimming:
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
              Adjust the area outside the active guide.
            </Text>
          </View>
          <Text className="min-w-12 text-right text-base font-semibold text-[#639922]">
            {guideBackgroundDimming}%
          </Text>
        </View>
        <View className="mt-3">
          <SteppedSlider
            accessibilityLabel="Background dimming"
            levels={dimmingLevels}
            value={guideBackgroundDimming}
            onChange={setGuideBackgroundDimming}
            formatValue={(value) => `${value}%`}
          />
        </View>
      </View>

      {transition === "pager" ? (
        <View className="mt-6 border-t border-slate-200 pt-5 dark:border-white/10">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">
            Top & bottom margin
          </Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
            Controls the breathing room above and below the text.
          </Text>
          <View className="mt-3 flex-row gap-2">
            {marginPresets.map((preset) => {
              const selected = verticalMarginPreset === preset.value;
              return (
                <Pressable
                  key={preset.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${preset.label} top and bottom margin`}
                  onPress={() => setVerticalMarginPreset(preset.value)}
                  className={`flex-1 rounded-lg border px-2 py-2 ${selected ? "border-[#639922] bg-[#639922]" : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#1A1E18]"}`}
                >
                  <Text className={`text-center text-xs font-semibold ${selected ? "text-white" : "text-slate-600 dark:text-[#D8DDD3]"}`}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View className={transition === "pager" ? "mt-5" : "mt-6 border-t border-slate-200 pt-5 dark:border-white/10"}>
        <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">
          Left & right margin
        </Text>
        <Text className="mt-1 text-xs text-slate-500 dark:text-[#9EA69A]">
          Controls the line length and side space for reading.
        </Text>
        <View className="mt-3 flex-row gap-2">
          {marginPresets.map((preset) => {
            const selected = horizontalMarginPreset === preset.value;
            return (
              <Pressable
                key={preset.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${preset.label} left and right margin`}
                onPress={() => setHorizontalMarginPreset(preset.value)}
                className={`flex-1 rounded-lg border px-2 py-2 ${selected ? "border-[#639922] bg-[#639922]" : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#1A1E18]"}`}
              >
                <Text className={`text-center text-xs font-semibold ${selected ? "text-white" : "text-slate-600 dark:text-[#D8DDD3]"}`}>
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

    </BottomSheetScrollView>
  );
}
