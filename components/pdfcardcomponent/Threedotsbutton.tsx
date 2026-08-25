import { EditIcon, Icon, TrashIcon } from "@/components/ui/icon";
import { EllipsisVertical } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

type ThreeDotsButtonProps = {
  fileName: string;
  onDelete: () => void;
  onRename: (name: string) => void;
};

const MENU_WIDTH = 176;
const MENU_HEIGHT = 98;
const MENU_GAP = 4;
const SCREEN_PADDING = 12;

export default function ThreeDotsButton({
  fileName,
  onDelete,
  onRename,
}: ThreeDotsButtonProps) {
  const buttonRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(fileName);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: SCREEN_PADDING });
  const isDark = useColorScheme() === "dark";

  const openMenu = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      const { width: screenWidth, height: screenHeight } =
        Dimensions.get("window");
      const belowButton = y + height + MENU_GAP;
      const hasRoomBelow =
        belowButton + MENU_HEIGHT <= screenHeight - SCREEN_PADDING;

      setMenuPosition({
        top: hasRoomBelow
          ? belowButton
          : Math.max(SCREEN_PADDING, y - MENU_HEIGHT - MENU_GAP),
        left: Math.min(
          Math.max(SCREEN_PADDING, x + width - MENU_WIDTH),
          screenWidth - MENU_WIDTH - SCREEN_PADDING
        ),
      });
      setIsMenuOpen(true);
    });
  };

  const openRenameDialog = () => {
    setDraftName(fileName);
    setTimeout(() => setIsRenameOpen(true), 160);
  };

  const confirmDelete = () => {
    setTimeout(() => {
      Alert.alert(
        "Delete PDF?",
        `\"${fileName}\" will be removed from your library.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ]
      );
    }, 160);
  };

  const saveName = () => {
    const nextName = draftName.trim();

    if (!nextName) {
      return;
    }

    onRename(nextName);
    setIsRenameOpen(false);
  };

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityLabel={`More options for ${fileName}`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={openMenu}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-black/10 dark:active:bg-white/10"
      >
        <EllipsisVertical size={18} color={isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.6)"} />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isMenuOpen}
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close PDF menu"
          className="absolute inset-0"
          onPress={() => setIsMenuOpen(false)}
        />

        <View
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: MENU_WIDTH,
          }}
          className="absolute rounded-md border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#1A1E18]"
        >
          <Pressable
            accessibilityRole="menuitem"
            onPress={() => {
              setIsMenuOpen(false);
              openRenameDialog();
            }}
            className="h-11 flex-row items-center gap-3 rounded px-3 active:bg-black/5 dark:active:bg-white/5"
          >
            <Icon as={EditIcon} size="sm" className="text-black/70 dark:text-white/70" />
            <Text className="text-base text-black dark:text-[#F4F5F1]">Rename</Text>
          </Pressable>

          <Pressable
            accessibilityRole="menuitem"
            onPress={() => {
              setIsMenuOpen(false);
              confirmDelete();
            }}
            className="h-11 flex-row items-center gap-3 rounded px-3 active:bg-red-50"
          >
            <Icon as={TrashIcon} size="sm" className="text-red-600" />
            <Text className="text-base text-red-600">Delete</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isRenameOpen}
        onRequestClose={() => setIsRenameOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-center px-6"
        >
          <Pressable
            accessibilityLabel="Close rename dialog"
            className="absolute inset-0 bg-black/40"
            onPress={() => setIsRenameOpen(false)}
          />

          <View className="rounded-lg bg-white p-5 shadow-lg dark:bg-[#1A1E18]">
            <Text className="font-lato-bold text-lg text-black dark:text-[#F4F5F1]">Rename PDF</Text>

            <TextInput
              autoFocus
              selectTextOnFocus
              value={draftName}
              onChangeText={setDraftName}
              onSubmitEditing={saveName}
              returnKeyType="done"
              placeholderTextColor={isDark ? "#9EA69A" : "#737270"}
              className="mt-4 h-12 rounded-md border border-black/20 px-3 text-base text-black dark:border-white/20 dark:text-[#F4F5F1]"
            />

            <View className="mt-5 flex-row justify-end gap-3">
              <Pressable
                onPress={() => setIsRenameOpen(false)}
                className="h-10 justify-center px-3"
              >
                <Text className="font-lato-bold text-black/60 dark:text-white/60">Cancel</Text>
              </Pressable>

              <Pressable
                disabled={!draftName.trim()}
                onPress={saveName}
                className="h-10 justify-center rounded-md bg-[#639922] px-4 disabled:opacity-40"
              >
                <Text className="font-lato-bold text-white">Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
