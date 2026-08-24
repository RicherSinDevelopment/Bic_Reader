import { Center } from "@/components/ui/center";
import SteppedSlider from "@/components/ui/SteppedSlider";
import { Switch } from "@/components/ui/switch";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import { Text, View } from "react-native";

const dimmingLevels = Array.from({ length: 9 }, (_, index) => (index + 1) * 10);

export default function Settings() {
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

  return (
    <View className="px-4 py-4">
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
            onValueChange={(enabled) =>
              setTransition(enabled ? "pager" : "scroll")
            }
            isDisabled={false}
            trackColor={{ false: "#d4d4d4", true: "#639922" }}
            thumbColor="#fafafa"
            ios_backgroundColor="#d4d4d4"
          />
        </Center>
      </View>

    </View>
  );
}
