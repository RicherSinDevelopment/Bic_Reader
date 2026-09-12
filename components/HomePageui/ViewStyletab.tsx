import React, { useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { homepageDepth } from "@/components/HomePageui/depthStyles";

interface PdfLayoutTabsProps {
  initialColumns?: 1 | 2 | 3;
  onColumnsChange: (columns: 1 | 2 | 3) => void;
}

const SEGMENT_WIDTH = 44;
const SEGMENT_HEIGHT = 40;
const CONTAINER_PADDING = 4;

export default function PdfLayoutTabs({ initialColumns = 1, onColumnsChange }: PdfLayoutTabsProps) {
  const [selectedColumns, setSelectedColumns] = useState<1 | 2 | 3>(initialColumns);
  const [indicatorX] = useState(() => new Animated.Value((initialColumns - 1) * SEGMENT_WIDTH));

  const selectColumns = (columns: 1 | 2 | 3) => {
    setSelectedColumns(columns);
    onColumnsChange(columns);

    Animated.timing(indicatorX, {
      toValue: (columns - 1) * SEGMENT_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={homepageDepth.control}>
      <View
        style={{
          width: SEGMENT_WIDTH * 3 + CONTAINER_PADDING * 2,
          height: SEGMENT_HEIGHT + CONTAINER_PADDING * 2,
        }}
        className="relative overflow-hidden rounded-full border border-[#E1E4D9] bg-[#FFFDF8] dark:border-white/10 dark:bg-[#1A1E18]"
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: CONTAINER_PADDING,
            top: CONTAINER_PADDING,
            bottom: CONTAINER_PADDING,
            width: SEGMENT_WIDTH,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#639922",
            backgroundColor: "#639922",
            transform: [{ translateX: indicatorX }],
          }}
        />

        <View
          style={{
            position: "absolute",
            left: CONTAINER_PADDING,
            right: CONTAINER_PADDING,
            top: CONTAINER_PADDING,
            bottom: CONTAINER_PADDING,
            flexDirection: "row",
          }}
        >
          {([1, 2, 3] as const).map((columns) => (
            <Pressable
              key={columns}
              accessibilityLabel={`Show PDFs in ${columns} column${columns === 1 ? "" : "s"}`}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedColumns === columns }}
              onPress={() => selectColumns(columns)}
              style={{ width: SEGMENT_WIDTH, height: "100%" }}
              className="items-center justify-center"
            >
              <Text
                className={`font-lato-bold text-sm ${
                  selectedColumns === columns
                    ? "text-white"
                    : "text-black dark:text-[#F4F5F1]"
                }`}
              >
                {columns === 3 ? "☰" : columns}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
