import React, { useState } from "react";
import { Button, ContextMenu, Host, Image } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  frame,
  rotationEffect,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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

const MENU_DISMISS_DELAY = 180;

export default function ThreeDotsButton({
  fileName,
  onDelete,
  onRename,
}: ThreeDotsButtonProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(fileName);
  const isDark = useColorScheme() === "dark";

  const openRenameDialog = () => {
    void Haptics.selectionAsync();
    setDraftName(fileName);
    setTimeout(() => setIsRenameOpen(true), MENU_DISMISS_DELAY);
  };

  const confirmDelete = () => {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning
    );

    setTimeout(() => {
      Alert.alert(
        "Delete PDF?",
        `\"${fileName}\" will be removed from your library.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ]
      );
    }, MENU_DISMISS_DELAY);
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
      <Host style={{ width: 24, height: 32 }}>
        <ContextMenu activationMethod="singlePress">
          <ContextMenu.Items>
            <Button systemImage="pencil" onPress={openRenameDialog}>
              Rename
            </Button>
            <Button
              systemImage="trash"
              role="destructive"
              onPress={confirmDelete}
            >
              Delete
            </Button>
          </ContextMenu.Items>

          <ContextMenu.Trigger>
            <Image
              systemName="ellipsis"
              size={18}
              color={isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.6)"}
              modifiers={[
                rotationEffect(90),
                frame({ width: 24, height: 32, alignment: "center" }),
                accessibilityLabel(`More options for ${fileName}`),
              ]}
            />
          </ContextMenu.Trigger>
        </ContextMenu>
      </Host>

      <Modal
        animationType="fade"
        transparent
        visible={isRenameOpen}
        onRequestClose={() => setIsRenameOpen(false)}
      >
        <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center px-6">
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
