import React from "react";
import { Host, HStack, Image, Menu, Text, Toggle } from "@expo/ui/swift-ui";
import {
  allowsTightening,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  frame,
  lineLimit,
  minimumScaleFactor,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";

export type PdfSortOption = "newest" | "oldest" | "closest" | "furthest";

type SortButtonProps = {
  value: PdfSortOption;
  onValueChange: (value: PdfSortOption) => void;
};

const sortOptions: {
  label: string;
  value: PdfSortOption;
  systemImage: React.ComponentProps<typeof Toggle>["systemImage"];
}[] = [
  { label: "Newest", value: "newest", systemImage: "calendar.badge.clock" },
  { label: "Oldest", value: "oldest", systemImage: "calendar" },
  {
    label: "Most Read",
    value: "closest",
    systemImage: "chart.bar.fill",
  },
  {
    label: "Least Read",
    value: "furthest",
    systemImage: "chart.bar",
  },
];

export default function SortButton({ value, onValueChange }: SortButtonProps) {
  const selectedLabel =
    sortOptions.find((option) => option.value === value)?.label ?? "Newest";

  const selectOption = (option: PdfSortOption) => {
    void Haptics.selectionAsync();
    onValueChange(option);
  };

  return (
    <Host matchContents>
      <Menu
        label={
          <HStack
            spacing={7}
            alignment="center"
            modifiers={[
              frame({ width: 164, minHeight: 30, alignment: "leading" }),
            ]}
          >
            <Image systemName="arrow.up.arrow.down" size={16} />
            <Text
              modifiers={[
                font({ size: 16, weight: "semibold" }),
                lineLimit(1),
                allowsTightening(true),
                minimumScaleFactor(0.85),
              ]}
            >
              Sort by: {selectedLabel}
            </Text>
          </HStack>
        }
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("roundedRectangle", 10),
          controlSize("regular"),
        ]}
      >
        {sortOptions.map((option) => (
          <Toggle
            key={option.value}
            label={option.label}
            systemImage={option.systemImage}
            isOn={option.value === value}
            onIsOnChange={() => selectOption(option.value)}
          />
        ))}
      </Menu>
    </Host>
  );
}
