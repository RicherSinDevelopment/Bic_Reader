import React from "react";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  Image,
  Text,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  frame,
  shadow,
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
  systemImage: React.ComponentProps<typeof Button>["systemImage"];
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
      <ContextMenu
        activationMethod="singlePress"
        modifiers={[
          buttonStyle("glass"),
          shadow({ color: "#173A212E", radius: 9, x: 0, y: 5 }),
          shadow({ color: "#FFFFFF70", radius: 1, x: -1, y: -1 }),
        ]}
      >
        <ContextMenu.Items>
          {sortOptions.map((option) => (
            <Button
              key={option.value}
              systemImage={
                option.value === value ? "checkmark" : option.systemImage
              }
              onPress={() => selectOption(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </ContextMenu.Items>

        <ContextMenu.Trigger>
          <HStack
            spacing={7}
            alignment="center"
            modifiers={[
              frame({ width: 164, minHeight: 30, alignment: "leading" }),
            ]}
          >
            <Image systemName="arrow.up.arrow.down" size={16} />
            <Text size={16} weight="semibold" lineLimit={1}>
              {`Sort by: ${selectedLabel}`}
            </Text>
          </HStack>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
