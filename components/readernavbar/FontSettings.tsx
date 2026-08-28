import { BottomSheetScrollView } from "@/components/ui/bottomsheet";
import { Switch } from "@/components/ui/switch";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import { Check, ChevronDown, Minus, Plus } from "lucide-react-native";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

const fontOptions = [
  { label: "Source Sans 3", value: "SourceSans3_400Regular" },
  { label: "Lato", value: "Lato_700Bold" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Baskerville", value: "Baskerville, Georgia, serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
] as const;

const spacingPresets = [
  { label: "Compact", value: "compact" },
  { label: "Comfortable", value: "comfortable" },
  { label: "Relaxed", value: "relaxed" },
] as const;

type AdjustmentControlProps = {
  label: string;
  valueLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
};

function AdjustmentControl({
  label,
  valueLabel,
  decreaseLabel,
  increaseLabel,
  decreaseDisabled = false,
  increaseDisabled = false,
  onDecrease,
  onIncrease,
}: AdjustmentControlProps) {
  const isDark = useColorScheme() === "dark";
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);
  const renderButton = (
    direction: "decrease" | "increase",
    buttonLabel: string,
    disabled: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityLabel={`${buttonLabel} ${label}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.adjustmentButton,
        pressed && !disabled && styles.adjustmentButtonPressed,
        disabled && styles.adjustmentButtonDisabled,
      ]}
    >
      {direction === "decrease" ? (
        <Minus color={isDark ? "#E5E8E1" : "#334155"} size={19} strokeWidth={2.2} />
      ) : (
        <Plus color={isDark ? "#E5E8E1" : "#334155"} size={19} strokeWidth={2.2} />
      )}
      <Text style={styles.adjustmentButtonText}>{buttonLabel}</Text>
    </Pressable>
  );

  return (
    <View style={styles.settingSection}>
      <View style={styles.settingHeading}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.valueLabel}>{valueLabel}</Text>
      </View>
      <View style={styles.adjustmentRow}>
        {renderButton("decrease", decreaseLabel, decreaseDisabled, onDecrease)}
        {renderButton("increase", increaseLabel, increaseDisabled, onIncrease)}
      </View>
    </View>
  );
}

export default function FontSettings() {
  const [fontMenuVisible, setFontMenuVisible] = useState(false);
  const isDark = useColorScheme() === "dark";
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);
  const fontFamily = useReaderSettingsStore((state) => state.fontFamily);
  const fontSize = useReaderSettingsStore((state) => state.fontSize);
  const lineHeight = useReaderSettingsStore((state) => state.lineHeight);
  const spacingPreset = useReaderSettingsStore((state) => state.spacingPreset);
  const letterSpacing = useReaderSettingsStore((state) => state.letterSpacing);
  const wordSpacing = useReaderSettingsStore((state) => state.wordSpacing);
  const setFontFamily = useReaderSettingsStore((state) => state.setFontFamily);
  const increaseFontSize = useReaderSettingsStore((state) => state.increaseFontSize);
  const decreaseFontSize = useReaderSettingsStore((state) => state.decreaseFontSize);
  const increaseLineHeight = useReaderSettingsStore((state) => state.increaseLineHeight);
  const decreaseLineHeight = useReaderSettingsStore((state) => state.decreaseLineHeight);
  const setSpacingPreset = useReaderSettingsStore((state) => state.setSpacingPreset);
  const increaseLetterSpacing = useReaderSettingsStore((state) => state.increaseLetterSpacing);
  const decreaseLetterSpacing = useReaderSettingsStore((state) => state.decreaseLetterSpacing);
  const increaseWordSpacing = useReaderSettingsStore((state) => state.increaseWordSpacing);
  const decreaseWordSpacing = useReaderSettingsStore((state) => state.decreaseWordSpacing);
  const bold = useReaderSettingsStore((state) => state.bold);
  const toggleBold = useReaderSettingsStore((state) => state.toggleBold);
  const selectedLabel =
    fontOptions.find((option) => option.value === fontFamily)?.label ?? "Source Sans 3";

  return (
    <>
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Font Settings</Text>

        <View style={styles.fontRow}>
          <Text style={styles.settingLabel}>Font Style</Text>
          <Pressable
            accessibilityLabel={`Choose font. Current font: ${selectedLabel}`}
            accessibilityRole="button"
            onPress={() => setFontMenuVisible(true)}
            style={({ pressed }) => [styles.fontPicker, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.fontPickerText, { fontFamily }]}>
              {selectedLabel}
            </Text>
            <ChevronDown color={isDark ? "#F4F5F1" : "#111827"} size={20} />
          </Pressable>
        </View>

        <AdjustmentControl label="Font Size" valueLabel={`${fontSize} pt`} decreaseLabel="Smaller" increaseLabel="Larger" decreaseDisabled={fontSize <= 10} increaseDisabled={fontSize >= 40} onDecrease={decreaseFontSize} onIncrease={increaseFontSize} />

        <View style={styles.presetSection}>
          <View style={styles.settingHeading}>
            <Text style={styles.settingLabel}>Reading Spacing</Text>
            <Text style={styles.valueLabel}>
              {spacingPreset === "custom"
                ? "Custom"
                : spacingPresets.find((preset) => preset.value === spacingPreset)?.label}
            </Text>
          </View>
          <View style={styles.presetRow}>
            {spacingPresets.map((preset) => {
              const selected = preset.value === spacingPreset;
              return (
                <Pressable
                  accessibilityLabel={`${preset.label} reading spacing`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={preset.value}
                  onPress={() => setSpacingPreset(preset.value)}
                  style={({ pressed }) => [
                    styles.presetButton,
                    selected && styles.presetButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[
                    styles.presetButtonText,
                    selected && styles.presetButtonTextSelected,
                  ]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.presetDescription}>
            Comfortable uses balanced 1.5× line spacing with book-style paragraph rhythm.
          </Text>
        </View>

        <AdjustmentControl label="Line Spacing" valueLabel={`${lineHeight.toFixed(1)}×`} decreaseLabel="Tighter" increaseLabel="Looser" decreaseDisabled={lineHeight <= 1} increaseDisabled={lineHeight >= 3} onDecrease={decreaseLineHeight} onIncrease={increaseLineHeight} />
        <AdjustmentControl label="Character Spacing" valueLabel={`${letterSpacing.toFixed(1)} px`} decreaseLabel="Less" increaseLabel="More" decreaseDisabled={letterSpacing <= 0} increaseDisabled={letterSpacing >= 5} onDecrease={decreaseLetterSpacing} onIncrease={increaseLetterSpacing} />
        <AdjustmentControl label="Word Spacing" valueLabel={`${wordSpacing.toFixed(0)} px`} decreaseLabel="Less" increaseLabel="More" decreaseDisabled={wordSpacing <= 0} increaseDisabled={wordSpacing >= 10} onDecrease={decreaseWordSpacing} onIncrease={increaseWordSpacing} />

        <View style={styles.boldRow}>
          <View>
            <Text style={styles.settingLabel}>Bold Text</Text>
            <Text style={styles.settingDescription}>Use a heavier reading weight</Text>
          </View>
          <Switch
            accessibilityLabel="Bold text"
            ios_backgroundColor="#D4D4D4"
            onValueChange={toggleBold}
            thumbColor="#FAFAFA"
            trackColor={{ false: "#D4D4D4", true: "#639922" }}
            value={bold}
          />
        </View>
      </BottomSheetScrollView>

      <Modal animationType="fade" transparent visible={fontMenuVisible} onRequestClose={() => setFontMenuVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFontMenuVisible(false)}>
          <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={styles.fontMenu}>
            <Text style={styles.menuTitle}>Choose a font</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {fontOptions.map((option) => {
                const optionFontFamily = option.value;

                return (
                  <Pressable
                    accessibilityRole="menuitem"
                    key={option.label}
                    onPress={() => {
                      setFontFamily(optionFontFamily);
                      setFontMenuVisible(false);
                    }}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  >
                    <Text style={[styles.menuItemText, { fontFamily: optionFontFamily }]}>{option.label}</Text>
                    {optionFontFamily === fontFamily && <Check color={isDark ? "#F4F5F1" : "#111827"} size={18} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  content: { paddingBottom: 20, paddingHorizontal: 16, paddingTop: 16 },
  title: { color: isDark ? "#F4F5F1" : "#0F172A", fontSize: 18, fontWeight: "600", marginBottom: 16 },
  pressed: { opacity: 0.65 },
  fontRow: { alignItems: "center", borderBottomColor: isDark ? "#343A31" : "#E5E3DE", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", paddingBottom: 14 },
  settingLabel: { color: isDark ? "#E5E8E1" : "#16202C", fontSize: 15, fontWeight: "400" },
  fontPicker: { alignItems: "center", borderColor: isDark ? "#42483F" : "#E2E0DB", borderRadius: 8, borderWidth: 1, flexDirection: "row", height: 40, justifyContent: "space-between", maxWidth: "62%", minWidth: 150, paddingHorizontal: 12 },
  fontPickerText: { color: isDark ? "#F4F5F1" : "#17202B", flexShrink: 1, fontSize: 14, marginRight: 8 },
  settingSection: { borderBottomColor: isDark ? "#343A31" : "#E5E3DE", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  presetSection: { borderBottomColor: isDark ? "#343A31" : "#E5E3DE", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  presetRow: { flexDirection: "row", gap: 8, marginTop: 11 },
  presetButton: { alignItems: "center", backgroundColor: isDark ? "#222720" : "#F8FAFC", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 6 },
  presetButtonSelected: { backgroundColor: isDark ? "#35412F" : "#E9F4E5", borderColor: isDark ? "#79936D" : "#5F7E53" },
  presetButtonText: { color: isDark ? "#C7CCC3" : "#475569", fontSize: 13, fontWeight: "600" },
  presetButtonTextSelected: { color: isDark ? "#DDEBD7" : "#36532D" },
  presetDescription: { color: isDark ? "#9EA69A" : "#7A8797", fontSize: 12, lineHeight: 17, marginTop: 9 },
  settingHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  valueLabel: { color: isDark ? "#A6ADA1" : "#64748B", fontSize: 13, fontVariant: ["tabular-nums"] },
  adjustmentRow: { flexDirection: "row", gap: 10, marginTop: 11 },
  adjustmentButton: { alignItems: "center", backgroundColor: isDark ? "#222720" : "#F8FAFC", borderColor: isDark ? "#42483F" : "#DDE2E8", borderRadius: 10, borderWidth: 1, flex: 1, flexDirection: "row", height: 48, justifyContent: "center", gap: 8 },
  adjustmentButtonPressed: { backgroundColor: isDark ? "#2A3027" : "#EEF1F4", transform: [{ scale: 0.98 }] },
  adjustmentButtonDisabled: { opacity: 0.38 },
  adjustmentButtonText: { color: isDark ? "#E5E8E1" : "#334155", fontSize: 15, fontWeight: "600" },
  boldRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 16 },
  settingDescription: { color: isDark ? "#9EA69A" : "#94A3B8", fontSize: 12, marginTop: 3 },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.28)", flex: 1, justifyContent: "center", padding: 24 },
  fontMenu: { backgroundColor: isDark ? "#1A1E18" : "#FFFEFC", borderRadius: 20, maxHeight: "68%", padding: 8, shadowColor: "#000000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, width: "100%" },
  menuTitle: { color: isDark ? "#F4F5F1" : "#111827", fontSize: 20, fontWeight: "600", padding: 14 },
  menuItem: { alignItems: "center", borderRadius: 12, flexDirection: "row", height: 50, justifyContent: "space-between", paddingHorizontal: 14 },
  menuItemPressed: { backgroundColor: isDark ? "#2A3027" : "#F3F2EF" },
  menuItemText: { color: isDark ? "#F4F5F1" : "#111827", fontSize: 17 },
});
