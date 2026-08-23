import React, { useState } from "react";
import { Animated, Pressable, Text, useColorScheme, View } from "react-native";
import { homepageDepth } from "@/components/HomePageui/depthStyles";

interface PdfLayoutTabsProps {
  onColumnsChange: (columns: 1 | 2 | 3) => void;
}

const SEGMENT_WIDTH = 44;
const SEGMENT_HEIGHT = 40;
const CONTAINER_PADDING = 4;

export default function PdfLayoutTabs({ onColumnsChange }: PdfLayoutTabsProps) {
  const [selectedColumns, setSelectedColumns] = useState<1 | 2 | 3>(1);
  const [indicatorX] = useState(() => new Animated.Value(0));
  const isDark = useColorScheme() === "dark";

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
        className="relative overflow-hidden rounded-md border border-black/10 bg-white dark:border-white/10 dark:bg-[#1A1E18]"
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: CONTAINER_PADDING,
            top: CONTAINER_PADDING,
            bottom: CONTAINER_PADDING,
            width: SEGMENT_WIDTH,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: isDark ? "#639922" : "#7eaa87",
            backgroundColor: isDark ? "#304426" : "#b9d8bf",
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
              <Text className="font-lato-bold text-sm text-black dark:text-[#F4F5F1]">
                {columns}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
