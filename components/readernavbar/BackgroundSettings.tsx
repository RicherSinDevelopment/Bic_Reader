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
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const colors = [
  "#6874e7",
  "#b8304f",
  "#758E4F",
  "#fa3741",
  "#F26419",
  "#F6AE2D",
  "#DFAEB4",
  "#7A93AC",
  "#33658A",
  "#3d2b56",
  "#42273B",
  "#171A21",
];

const CIRCLE_SIZE = 40;
const CIRCLE_RING_SIZE = 2;

export default function BackgroundSettings() {

  // Controls which tab is selected
  const [selectedType, setSelectedType] =
    React.useState<"font" | "background">("font");

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

  // Determine which color should be displayed as active
  const selectedColor =
    selectedType === "font"
      ? textColor
      : backgroundColor;

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
            value === "font" ||
            value === "background"
          ) {
            setSelectedType(value);
          }

        }}
        variant="filled"
        className="w-full mt-3"
      >

        <Box className="relative w-full items-center">

          <TabsList className="p-2 rounded-xl">

            {/* FONT COLOR TAB */}

            <TabsTrigger
              value="font"
              className="px-6 py-3"
            >
              <TabsTriggerText>
                Font
              </TabsTriggerText>
            </TabsTrigger>


            {/* BACKGROUND COLOR TAB */}

            <TabsTrigger
              value="background"
              className="px-6 py-3"
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

      <Text className="mt-6 mb-4 text-base font-medium text-slate-700">

        {selectedType === "font"
          ? "Font Color"
          : "Background Color"}

      </Text>


      {/* COLOR SELECTION */}

      <View className="flex-row flex-wrap justify-center">

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
                      : "transparent",

                  marginRight: 8,

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

    </View>
  );
}

