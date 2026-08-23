import { ChevronDownIcon, Icon } from "@/components/ui/icon";
import { Check } from "lucide-react-native";
import { homepageDepth } from "@/components/HomePageui/depthStyles";
import React, { useRef, useState } from "react";
import { Dimensions, Modal, Pressable, Text, useColorScheme, View } from "react-native";

export type PdfSortOption = "newest" | "oldest" | "closest" | "furthest";

type SortButtonProps = {
  value: PdfSortOption;
  onValueChange: (value: PdfSortOption) => void;
};

const sortOptions: { label: string; value: PdfSortOption }[] = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Most Read", value: "closest" },
  { label: "Least Read", value: "furthest" },
];

export default function SortButton({ value, onValueChange }: SortButtonProps) {
  const buttonRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 20 });
  const isDark = useColorScheme() === "dark";

  const selectedLabel =
    sortOptions.find((option) => option.value === value)?.label ?? "Newest";

  const openMenu = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      const menuWidth = 220;

      setMenuPosition({
        top: y + height + 4,
        left: Math.min(Math.max(12, x), screenWidth - menuWidth - 12),
      });
      setIsOpen(true);
    });
  };

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityLabel={`Sort PDFs by ${selectedLabel}`}
        accessibilityRole="button"
        onPress={openMenu}
        className="h-10 max-w-full flex-row items-center gap-2 rounded-md border border-black/10 bg-white px-3 active:translate-y-0.5 active:bg-black/5 dark:border-white/10 dark:bg-[#1A1E18] dark:active:bg-white/5"
        style={homepageDepth.control}
      >
        <Text
          numberOfLines={1}
          className="shrink font-lato-bold text-sm text-black dark:text-[#F4F5F1]"
        >
          Sort by: {selectedLabel}
        </Text>
        <Icon as={ChevronDownIcon} size="xs" className="text-black/60 dark:text-white/60" />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close sort menu"
          className="absolute inset-0"
          onPress={() => setIsOpen(false)}
        />

        <View
          style={{ top: menuPosition.top, left: menuPosition.left, width: 220 }}
          className="absolute rounded-md border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#1A1E18]"
        >
          {sortOptions.map((option) => {
            const isSelected = option.value === value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                onPress={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                className="h-11 flex-row items-center justify-between rounded px-3 active:bg-black/5 dark:active:bg-white/5"
              >
                <Text className="text-base text-black dark:text-[#F4F5F1]">{option.label}</Text>
                {isSelected && <Check size={16} color={isDark ? "#F4F5F1" : "#000000"} />}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}
