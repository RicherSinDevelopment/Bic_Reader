import { Box } from "@/components/ui/box";
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsTrigger,
  TabsTriggerText,
} from "@/components/ui/tabs";

import { useReaderSettingsStore } from "@/stores/readerSettingsStore";

import React from "react";
import {
  Pressable,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const colorPresets = [
  { name: "Classic", background: "#ffffff", text: "#000000" },
  { name: "Night", background: "#000000", text: "#ffffff" },
  { name: "Paper", background: "#fffaf0", text: "#443c35" },
  { name: "Sepia", background: "#f4efe5", text: "#713f12" },
  { name: "Baby Blue", background: "#dbeafe", text: "#30465a" },
  { name: "Ocean", background: "#e0f2fe", text: "#0369a1" },
  { name: "Mint", background: "#ccfbf1", text: "#0f766e" },
  { name: "Sage", background: "#eef4ec", text: "#29443d" },
  { name: "Lavender", background: "#ede9fe", text: "#4338ca" },
  { name: "Blush", background: "#fce7f3", text: "#be185d" },
  { name: "Peach", background: "#ffedd5", text: "#c2410c" },
  { name: "Lemon", background: "#fef9c3", text: "#713f12" },
];

const textColors = [
  "#000000", // Black
  "#ffffff", // White
  "#1e293b", // Slate
  "#443c35", // Warm brown
  "#29443d", // Deep sage
  "#30465a", // Muted navy
  "#2563eb", // Playful blue
  "#0369a1", // Ocean blue
  "#0f766e", // Teal
  "#15803d", // Green
  "#7e22ce", // Purple
  "#be185d", // Berry pink
  "#c2410c", // Burnt orange
  "#b91c1c", // Soft red
  "#713f12", // Golden brown
  "#4a3f4d", // Muted plum
  "#475569", // Blue gray
  "#57534e", // Warm gray
  "#4338ca", // Indigo
  "#a21caf", // Playful magenta
  "#0e7490", // Lagoon
];

const backgroundColors = [
  "#ffffff", // White
  "#000000", // Black
  "#f8fafc", // Cool white
  "#fffaf0", // Warm white
  "#f4efe5", // Soft sepia
  "#eef4ec", // Soft sage
  "#dbeafe", // Baby blue
  "#e0f2fe", // Sky blue
  "#e0f7f4", // Mint
  "#ecfccb", // Lime cream
  "#ede9fe", // Lavender
  "#fae8ff", // Lilac pink
  "#fce7f3", // Baby pink
  "#ffe4e6", // Soft rose
  "#ffedd5", // Peach
  "#fef3c7", // Butter yellow
  "#e2e8f0", // Mist gray
  "#dbe4f0", // Powder blue
  "#e0e7ff", // Periwinkle
  "#ccfbf1", // Aqua mint
  "#fef9c3", // Lemon cream
];

const CIRCLE_SIZE = 40;
const CIRCLE_RING_SIZE = 2;

type BackgroundSettingsProps = {
  onSelectedTypeChange?: (
    type: "presets" | "font" | "background",
  ) => void;
};

export default function BackgroundSettings({
  onSelectedTypeChange,
}: BackgroundSettingsProps) {

  // Controls which tab is selected
  const [selectedType, setSelectedType] =
    React.useState<"presets" | "font" | "background">("presets");

  // Zustand values
  const backgroundColor =
    useReaderSettingsStore(
      (state) => state.backgroundColor
    );

  const textColor =
    useReaderSettingsStore(
      (state) => state.textColor
    );

  // Zustand actions
  const setBackgroundColor =
    useReaderSettingsStore(
      (state) => state.setBackgroundColor
    );

  const setTextColor =
    useReaderSettingsStore(
      (state) => state.setTextColor
    );

  const setColorPreset =
    useReaderSettingsStore(
      (state) => state.setColorPreset
    );

  // Determine which color should be displayed as active
  const selectedColor =
    selectedType === "font"
      ? textColor
      : backgroundColor;

  const colors =
    selectedType === "font"
      ? textColors
      : backgroundColors;

  // Change the correct color in Zustand
  const handleColorPress = (color: string) => {

    if (selectedType === "font") {
      setTextColor(color);
    } else {
      setBackgroundColor(color);
    }

  };

  return (
    <View className="px-4 py-4">

      {/* TITLE */}

      <Text className="text-lg font-semibold text-slate-900">
        Select Color
      </Text>


      {/* TABS */}

      <Tabs
        value={selectedType}
        onValueChange={(value: string) => {

          if (
            value === "presets" ||
            value === "font" ||
            value === "background"
          ) {
            setSelectedType(value);
            onSelectedTypeChange?.(value);
          }

        }}
        variant="filled"
        className="w-full mt-3"
      >

        <Box className="relative w-full items-center">

          <TabsList className="p-2 rounded-xl">

            <TabsTrigger
              value="presets"
              className="px-4 py-3"
            >
              <TabsTriggerText>
                Presets
              </TabsTriggerText>
            </TabsTrigger>

            {/* FONT COLOR TAB */}

            <TabsTrigger
              value="font"
              className="px-4 py-3"
            >
              <TabsTriggerText>
                Font
              </TabsTriggerText>
            </TabsTrigger>


            {/* BACKGROUND COLOR TAB */}

            <TabsTrigger
              value="background"
              className="px-4 py-3"
            >
              <TabsTriggerText>
                Background
              </TabsTriggerText>
            </TabsTrigger>


            {/* SLIDING INDICATOR */}

            <TabsIndicator />

          </TabsList>

        </Box>

      </Tabs>


      {/* COLOR TITLE */}

      {selectedType === "presets" ? (
        <View className="mt-6 flex-row flex-wrap justify-between">
          {colorPresets.map((preset) => {
            const isActive =
              backgroundColor === preset.background &&
              textColor === preset.text;

            return (
              <Pressable
                key={preset.name}
                accessibilityLabel={`${preset.name} reading color preset`}
                accessibilityRole="button"
                onPress={() => setColorPreset(preset.background, preset.text)}
                style={{ width: "31%", marginBottom: 14 }}
              >
                <View
                  style={{
                    height: 76,
                    justifyContent: "center",
                    gap: 7,
                    borderRadius: 14,
                    borderWidth: isActive ? 3 : 1,
                    borderColor: isActive ? "#2563eb" : "#cbd5e1",
                    backgroundColor: preset.background,
                    paddingHorizontal: 12,
                  }}
                >
                  {(["82%", "100%", "68%", "90%"] as const).map((width, index) => (
                    <View
                      key={index}
                      style={{
                        width,
                        height: 4,
                        borderRadius: 999,
                        backgroundColor: preset.text,
                      }}
                    />
                  ))}
                </View>
                <Text className="mt-1 text-center text-xs text-slate-600">
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <Text className="mt-6 mb-4 text-base font-medium text-slate-700">
            {selectedType === "font" ? "Font Color" : "Background Color"}
          </Text>


      {/* COLOR SELECTION */}

      <View className="flex-row flex-wrap justify-between">

        {colors.map((item) => {

          const isActive =
            selectedColor === item;

          return (

            <TouchableWithoutFeedback
              key={item}
              onPress={() =>
                handleColorPress(item)
              }
            >

              <View
                style={{
                  width:
                    CIRCLE_SIZE +
                    CIRCLE_RING_SIZE * 4,

                  height:
                    CIRCLE_SIZE +
                    CIRCLE_RING_SIZE * 4,

                  borderRadius: 9999,

                  backgroundColor: "white",

                  borderWidth:
                    CIRCLE_RING_SIZE,

                  borderColor:
                    isActive
                      ? item
                      : "#cbd5e1",

                  marginBottom: 12,
                }}
              >

                <View
                  style={{
                    width: CIRCLE_SIZE,

                    height: CIRCLE_SIZE,

                    borderRadius: 9999,

                    position: "absolute",

                    top: CIRCLE_RING_SIZE,

                    left: CIRCLE_RING_SIZE,

                    backgroundColor: item,
                  }}
                />

              </View>

            </TouchableWithoutFeedback>

          );

        })}

      </View>
        </>
      )}

    </View>
  );
}
