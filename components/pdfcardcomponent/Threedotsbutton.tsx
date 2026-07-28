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
  View,
} from "react-native";

type ThreeDotsButtonProps = {
  fileName: string;
  onDelete: () => void;
  onRename: (name: string) => void;
};

export default function ThreeDotsButton({
  fileName,
  onDelete,
  onRename,
}: ThreeDotsButtonProps) {
  const buttonRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(fileName);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 12 });

  const openMenu = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({
        top: y + height + 4,
        right: Math.max(12, Dimensions.get("window").width - x - width),
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
        hitSlop={10}
        onPress={openMenu}
        className="h-8 w-6 items-center justify-center rounded-md active:bg-black/10"
      >
        <EllipsisVertical size={18} color="rgba(0, 0, 0, 0.6)" />
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
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="absolute min-w-44 rounded-md border border-black/10 bg-white p-1 shadow-lg"
        >
          <Pressable
            accessibilityRole="menuitem"
            onPress={() => {
              setIsMenuOpen(false);
              openRenameDialog();
            }}
            className="h-11 flex-row items-center gap-3 rounded px-3 active:bg-black/5"
          >
            <Icon as={EditIcon} size="sm" className="text-black/70" />
            <Text className="text-base text-black">Rename</Text>
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

          <View className="rounded-lg bg-white p-5 shadow-lg">
            <Text className="font-lato-bold text-lg text-black">Rename PDF</Text>

            <TextInput
              autoFocus
              selectTextOnFocus
              value={draftName}
              onChangeText={setDraftName}
              onSubmitEditing={saveName}
              returnKeyType="done"
              className="mt-4 h-12 rounded-md border border-black/20 px-3 text-base text-black"
            />

            <View className="mt-5 flex-row justify-end gap-3">
              <Pressable
                onPress={() => setIsRenameOpen(false)}
                className="h-10 justify-center px-3"
              >
                <Text className="font-lato-bold text-black/60">Cancel</Text>
              </Pressable>

              <Pressable
                disabled={!draftName.trim()}
                onPress={saveName}
                className="h-10 justify-center rounded-md bg-green-400 px-4 disabled:opacity-40"
              >
                <Text className="font-lato-bold text-black">Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
