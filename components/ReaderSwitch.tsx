import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

import { Text } from "@/components/ui/text";

export default function ReaderSwitch() {
  const [mode, setMode] = useState<"reader" | "original">("reader");

  const translateX = useSharedValue(0);

  const switchMode = (newMode: "reader" | "original") => {
    setMode(newMode);

    translateX.value = withSpring(
      newMode === "reader" ? 0 : 100,
      {
        damping: 15,
        stiffness: 120,
      }
    );
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: translateX.value,
        },
      ],
    };
  });

  return (
    <View className="items-center justify-center">

      <View
        className="
          relative
          flex-row
          h-12
          w-56
          rounded-full
          bg-muted
          p-1
        "
      >

        {/* Sliding background */}
        <Animated.View
          className="
            absolute
            left-1
            top-1
            h-10
            w-28
            rounded-full
            bg-white
            shadow-lg
        "
          style={animatedStyle}
        />


        {/* Reader button */}
        <Pressable
          className="h-10 w-28 items-center justify-center"
          onPress={() => switchMode("reader")}
        >
          <Text
            className={
              mode === "reader"
                ? "font-semibold"
                : "text-muted-foreground"
            }
          >
            Reader
          </Text>
        </Pressable>


        {/* Original button */}
        <Pressable
          className="h-10 w-28 items-center justify-center"
          onPress={() => switchMode("original")}
        >
          <Text
            className={
              mode === "original"
                ? "font-semibold"
                : "text-muted-foreground"
            }
          >
            Original
          </Text>
        </Pressable>

      </View>

    </View>
  );
}