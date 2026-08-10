import React, { useState } from "react";
import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  frame,
  labelStyle,
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
        <Menu
          label={
            <Image
              systemName="ellipsis"
              size={18}
              color="rgba(0, 0, 0, 0.6)"
              modifiers={[
                rotationEffect(90),
                frame({ width: 24, height: 32, alignment: "center" }),
              ]}
            />
          }
          modifiers={[
            buttonStyle("plain"),
            labelStyle("iconOnly"),
            accessibilityLabel(`More options for ${fileName}`),
          ]}
        >
          <Button
            label="Rename"
            systemImage="pencil"
            onPress={openRenameDialog}
          />
          <Button
            label="Delete"
            systemImage="trash"
            role="destructive"
            onPress={confirmDelete}
          />
        </Menu>
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
