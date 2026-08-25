import { EditIcon, Icon, TrashIcon } from "@/components/ui/icon";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";

type ThreeDotsButtonProps = {
  fileName: string;
  onDelete: () => void;
  onRename: (name: string) => void;
};

const BUTTON_SIZE = 44;
const MENU_WIDTH = 176;
const MENU_HEIGHT = 96;
const MENU_GAP = 4;
const SCREEN_PADDING = 12;
const MENU_DISMISS_DELAY = 140;

export default function ThreeDotsButton({ fileName, onDelete, onRename }: ThreeDotsButtonProps) {
  const buttonRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState(fileName);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: SCREEN_PADDING });
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isDark = useColorScheme() === "dark";
  const canUseGlass = isGlassEffectAPIAvailable();

  const openMenu = () => {
    if (isMenuOpen) return;

    buttonRef.current?.measureInWindow((x, y, width, height) => {
      const belowButton = y + height + MENU_GAP;
      const top = belowButton + MENU_HEIGHT <= screenHeight - SCREEN_PADDING
        ? belowButton
        : Math.max(SCREEN_PADDING, y - MENU_HEIGHT - MENU_GAP);
      const left = Math.min(
        Math.max(SCREEN_PADDING, x + width - MENU_WIDTH),
        screenWidth - MENU_WIDTH - SCREEN_PADDING,
      );

      // Freeze the anchor before mounting the modal so opening it cannot move the trigger.
      setMenuPosition({ top, left });
      setIsMenuOpen(true);
      void Haptics.selectionAsync();
    });
  };

  const closeMenu = () => setIsMenuOpen(false);

  const openRenameDialog = () => {
    closeMenu();
    setDraftName(fileName);
    setTimeout(() => setIsRenameOpen(true), MENU_DISMISS_DELAY);
  };

  const confirmDelete = () => {
    closeMenu();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => {
      Alert.alert("Delete PDF?", `\"${fileName}\" will be removed from your library.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]);
    }, MENU_DISMISS_DELAY);
  };

  const saveName = () => {
    const nextName = draftName.trim();
    if (!nextName) return;
    onRename(nextName);
    setIsRenameOpen(false);
  };

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityLabel={`More options for ${fileName}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isMenuOpen }}
        hitSlop={4}
        onPress={openMenu}
        style={styles.trigger}
      >
        <SymbolView
          name="ellipsis"
          size={20}
          weight="semibold"
          tintColor={isDark ? "rgba(255, 255, 255, 0.68)" : "rgba(0, 0, 0, 0.62)"}
          style={styles.triggerIcon}
        />
      </Pressable>

      <Modal
        animationType="none"
        transparent
        visible={isMenuOpen}
        onRequestClose={closeMenu}
      >
        <Pressable
          accessibilityLabel="Close PDF menu"
          onPress={closeMenu}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityRole="menu"
          style={[
            styles.menu,
            { top: menuPosition.top, left: menuPosition.left },
            !canUseGlass && (isDark ? styles.fallbackDark : styles.fallbackLight),
          ]}
        >
          {canUseGlass ? (
            <GlassView
              colorScheme={isDark ? "dark" : "light"}
              glassEffectStyle="regular"
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
          ) : null}

          <Pressable
            accessibilityRole="menuitem"
            onPress={openRenameDialog}
            className="h-11 flex-row items-center gap-3 rounded-xl px-3 active:bg-black/5 dark:active:bg-white/10"
          >
            <Icon as={EditIcon} size="sm" className="text-black/70 dark:text-white/70" />
            <Text className="text-base text-black dark:text-[#F4F5F1]">Rename</Text>
          </Pressable>
          <Pressable
            accessibilityRole="menuitem"
            onPress={confirmDelete}
            className="h-11 flex-row items-center gap-3 rounded-xl px-3 active:bg-red-500/10"
          >
            <Icon as={TrashIcon} size="sm" className="text-red-600" />
            <Text className="text-base text-red-600">Delete</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={isRenameOpen} onRequestClose={() => setIsRenameOpen(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center px-6">
          <Pressable
            accessibilityLabel="Close rename dialog"
            className="absolute inset-0 bg-black/40"
            onPress={() => setIsRenameOpen(false)}
          />
          <View className="rounded-xl bg-white p-5 shadow-lg dark:bg-[#1A1E18]">
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
              <Pressable onPress={() => setIsRenameOpen(false)} className="h-10 justify-center px-3">
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

const styles = StyleSheet.create({
  trigger: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerIcon: {
    width: 20,
    height: 20,
    transform: [{ rotate: "90deg" }],
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    height: MENU_HEIGHT,
    overflow: "hidden",
    borderRadius: 18,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  fallbackLight: {
    backgroundColor: "rgba(248,248,248,0.96)",
    borderColor: "rgba(0,0,0,0.10)",
  },
  fallbackDark: {
    backgroundColor: "rgba(28,28,30,0.96)",
    borderColor: "rgba(255,255,255,0.12)",
  },
});
