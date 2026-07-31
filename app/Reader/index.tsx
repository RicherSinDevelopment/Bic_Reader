import BackButton from "@/components/Backbutton";
import OriginalPDF from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
import ThreeLinesButton from "@/components/threelinesbutton";
import { Box } from "@/components/ui/box";
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsTrigger,
  TabsTriggerText,
} from "@/components/ui/tabs";
import { useScreenRotation } from "@/hooks/screenRotation";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { Animated, View } from "react-native";

export default function ReaderScreen() {
  const [headerVisibility] = useState(() => new Animated.Value(1));
  const [activeTab, setActiveTab] = useState("reader");
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);

  useScreenRotation(setIsLandscape);

  useEffect(() => {
    const animation = Animated.timing(headerVisibility, {
      toValue: isLandscape ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    });

    animation.start();
    return () => animation.stop();
  }, [headerVisibility, isLandscape]);

  const handleTabChange = (value: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(value);
  };

  return (
    <Box className="flex-1">
      <Animated.View
        pointerEvents={isLandscape ? "none" : "auto"}
        accessibilityElementsHidden={isLandscape}
        importantForAccessibility={isLandscape ? "no-hide-descendants" : "auto"}
        style={{
          height: headerHeight
            ? headerVisibility.interpolate({
                inputRange: [0, 1],
                outputRange: [0, headerHeight],
              })
            : undefined,
          overflow: "hidden",
          transform: [
            {
              translateY: headerVisibility.interpolate({
                inputRange: [0, 1],
                outputRange: [-Math.max(headerHeight, 120), 0],
              }),
            },
          ],
        }}
      >
        <View
          className="pb-4 pt-12"
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height;

            if (measuredHeight > headerHeight) {
              setHeaderHeight(measuredHeight);
            }
          }}
        >
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            variant="filled"
            className="w-full"
          >
            <Box className="relative w-full items-center">
              <Box className="absolute left-2 top-1/2 -translate-y-1/2">
                <BackButton />
              </Box>

              <Box className="absolute right-2 top-1/2 -translate-y-1/2">
                <ThreeLinesButton />
              </Box>

              <TabsList className="rounded-xl p-2">
                <TabsTrigger value="reader" className="px-6 py-3">
                  <TabsTriggerText>Reader</TabsTriggerText>
                </TabsTrigger>

                <TabsTrigger value="original" className="px-6 py-3">
                  <TabsTriggerText>Original</TabsTriggerText>
                </TabsTrigger>

                <TabsIndicator />
              </TabsList>
            </Box>
          </Tabs>
        </View>
      </Animated.View>

      <View className="flex-1">
        {activeTab === "reader" ? (
          <ReaderView isLandscape={isLandscape} />
        ) : (
          <OriginalPDF />
        )}
      </View>
    </Box>
  );
}