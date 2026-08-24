import * as Haptics from "expo-haptics";
import React from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type SteppedSliderProps = {
  accessibilityLabel: string;
  levels: readonly number[];
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  showValue?: boolean;
};

export default function SteppedSlider({
  accessibilityLabel,
  levels,
  value,
  onChange,
  formatValue = String,
  showValue = false,
}: SteppedSliderProps) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const lastValueRef = React.useRef(value);
  const normalizedValue = levels.reduce((closest, level) =>
    Math.abs(level - value) < Math.abs(closest - value) ? level : closest
  );
  const selectedIndex = levels.indexOf(normalizedValue);
  const progress = levels.length > 1
    ? selectedIndex / (levels.length - 1)
    : 0;

  React.useEffect(() => {
    lastValueRef.current = normalizedValue;
    if (value !== normalizedValue) onChange(normalizedValue);
  }, [normalizedValue, onChange, value]);

  const selectLevel = React.useCallback((nextIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(levels.length - 1, nextIndex));
    const nextValue = levels[clampedIndex];
    if (nextValue === undefined || nextValue === lastValueRef.current) return;
    lastValueRef.current = nextValue;
    onChange(nextValue);
    void Haptics.selectionAsync();
  }, [levels, onChange]);

  const selectPosition = React.useCallback((locationX: number) => {
    if (trackWidth <= 0 || levels.length < 2) return;
    const nextIndex = Math.round(
      (Math.max(0, Math.min(trackWidth, locationX)) / trackWidth) *
        (levels.length - 1),
    );
    selectLevel(nextIndex);
  }, [levels.length, selectLevel, trackWidth]);

  const sliderGesture = React.useMemo(() =>
    Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => selectPosition(event.x))
      .onUpdate((event) => selectPosition(event.x)),
  [selectPosition]);

  return (
    <View>
      {showValue && (
        <Text className="text-right text-base font-semibold text-[#639922]">
          {formatValue(normalizedValue)}
        </Text>
      )}
      <GestureDetector gesture={sliderGesture}>
        <View
          accessible
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="adjustable"
          accessibilityValue={{
            min: levels[0],
            max: levels[levels.length - 1],
            now: normalizedValue,
            text: formatValue(normalizedValue),
          }}
          accessibilityActions={[
            { name: "increment", label: "Increase" },
            { name: "decrement", label: "Decrease" },
          ]}
          onAccessibilityAction={(event) => {
            selectLevel(
              selectedIndex +
                (event.nativeEvent.actionName === "increment" ? 1 : -1),
            );
          }}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          className="h-11 justify-center"
        >
          <View className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <View
              className="h-full rounded-full bg-[#639922]"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
          <View className="absolute left-0 right-0 flex-row justify-between">
            {levels.map((level, index) => {
              const isSelected = index === selectedIndex;
              const isReached = index <= selectedIndex;
              return (
                <View
                  key={`${level}-${index}`}
                  className={`h-2.5 w-2.5 rounded-full border-2 ${
                    isReached
                      ? "border-[#639922] bg-[#639922]"
                      : "border-[#D4D8CF] bg-[#F7F5EC] dark:border-[#596052] dark:bg-[#1A1E18]"
                  }`}
                  style={isSelected ? { transform: [{ scale: 1.5 }] } : undefined}
                />
              );
            })}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
