import {
  CaseSensitive,
  Settings,
  Sparkles,
  Speech,
  Wallpaper,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";

type Panel = "background" | "font";
type Spacing = "Compact" | "Comfortable" | "Relaxed";

const themes = [
  { name: "Classic", background: "#FFFEFA", text: "#30362C", swatch: "#FFFFFF" },
  { name: "Night", background: "#20241F", text: "#F1F0E8", swatch: "#252A24" },
  { name: "Paper", background: "#F4EBD8", text: "#494033", swatch: "#EADCC1" },
  { name: "Sage", background: "#E8EEDC", text: "#34402D", swatch: "#C7D7AE" },
  { name: "Lavender", background: "#EEE9F4", text: "#433C4A", swatch: "#D7CBE5" },
] as const;

const spacingMultipliers: Record<Spacing, number> = {
  Compact: 1.3,
  Comfortable: 1.6,
  Relaxed: 1.9,
};

export function ReadingCustomizationShowcase() {
  const { height } = useWindowDimensions();
  const compact = height < 730;
  const reduceMotion = useReducedMotion();
  const interactedRef = useRef(false);
  const [activePanel, setActivePanel] = useState<Panel>("background");
  const [themeName, setThemeName] = useState<(typeof themes)[number]["name"]>("Paper");
  const [fontSize, setFontSize] = useState(14);
  const [spacing, setSpacing] = useState<Spacing>("Comfortable");
  const [bold, setBold] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;

    const themeTimer = setTimeout(() => {
      if (!interactedRef.current) setThemeName("Sage");
    }, 550);
    const panelTimer = setTimeout(() => {
      if (!interactedRef.current) setActivePanel("font");
    }, 1750);

    return () => {
      clearTimeout(themeTimer);
      clearTimeout(panelTimer);
    };
  }, [reduceMotion]);

  const selectPanel = (panel: Panel) => {
    interactedRef.current = true;
    setActivePanel(panel);
  };
  const theme = themes.find((item) => item.name === themeName) ?? themes[0];

  return (
    <View
      accessibilityLabel="Interactive reader customization preview"
      style={[styles.stage, compact && styles.stageCompact]}
    >
      <View style={[styles.backGlow, compact && styles.backGlowCompact]} />

      <View style={[styles.readerPreview, compact && styles.readerPreviewCompact, { backgroundColor: theme.background }]}>
        <View style={styles.readerMetaRow}>
          <Text style={[styles.readerEyebrow, { color: theme.text }]}>MINDFUL READING</Text>
          <View style={[styles.pagePill, { backgroundColor: `${theme.text}12` }]}>
            <Text style={[styles.pageNumber, { color: theme.text }]}>12</Text>
          </View>
        </View>
        <Text
          style={[
            styles.readerTitle,
            { color: theme.text, fontSize: fontSize + 3, fontWeight: bold ? "700" : "600" },
          ]}
        >
          A calmer way to read
        </Text>
        <Text
          numberOfLines={3}
          style={[
            styles.readerBody,
            {
              color: theme.text,
              fontFamily: bold ? "Lato_700Bold" : "SourceSans3_400Regular",
              fontSize,
              lineHeight: Math.round(fontSize * spacingMultipliers[spacing]),
            },
          ]}
        >
          The right colors, type, and rhythm make every page feel easier to follow.
        </Text>
      </View>

      <View style={[styles.toolbar, compact && styles.toolbarCompact]}>
        <ToolbarButton
          active={activePanel === "font"}
          icon={<CaseSensitive color={activePanel === "font" ? "#FFFFFF" : "#639922"} size={22} />}
          label="Font"
          onPress={() => selectPanel("font")}
        />
        <ToolbarButton
          active={activePanel === "background"}
          icon={<Wallpaper color={activePanel === "background" ? "#FFFFFF" : "#639922"} size={20} />}
          label="Background"
          onPress={() => selectPanel("background")}
        />
        <View style={styles.passiveTool}><Speech color="#9BA493" size={19} /></View>
        <View style={styles.passiveTool}><Sparkles color="#9BA493" size={19} /></View>
        <View style={styles.passiveTool}><Settings color="#9BA493" size={19} /></View>
      </View>

      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(220)}
        key={activePanel}
        style={[styles.panel, compact && styles.panelCompact]}
      >
        {activePanel === "background" ? (
          <BackgroundPanel
            selected={themeName}
            onSelect={(name) => {
              interactedRef.current = true;
              setThemeName(name);
            }}
          />
        ) : (
          <FontPanel
            bold={bold}
            fontSize={fontSize}
            spacing={spacing}
            onBoldChange={() => {
              interactedRef.current = true;
              setBold((current) => !current);
            }}
            onFontSizeChange={(change) => {
              interactedRef.current = true;
              setFontSize((current) => Math.max(12, Math.min(18, current + change)));
            }}
            onSpacingChange={(value) => {
              interactedRef.current = true;
              setSpacing(value);
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

function ToolbarButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} settings preview`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        active && styles.toolButtonActive,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function BackgroundPanel({
  selected,
  onSelect,
}: {
  selected: (typeof themes)[number]["name"];
  onSelect: (name: (typeof themes)[number]["name"]) => void;
}) {
  return (
    <>
      <View style={styles.panelHeadingRow}>
        <View>
          <Text style={styles.panelEyebrow}>BACKGROUND SETTINGS</Text>
          <Text style={styles.panelTitle}>Choose your atmosphere</Text>
        </View>
        <View style={styles.customColorPill}>
          <View style={styles.customColorDot} />
          <Text style={styles.customColorText}>Custom</Text>
        </View>
      </View>
      <View style={styles.themeRow}>
        {themes.map((theme) => {
          const isSelected = theme.name === selected;
          return (
            <Pressable
              accessibilityLabel={`${theme.name} reading theme`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={theme.name}
              onPress={() => onSelect(theme.name)}
              style={styles.themeOption}
            >
              <View
                style={[
                  styles.themeSwatch,
                  { backgroundColor: theme.swatch },
                  isSelected && styles.themeSwatchSelected,
                ]}
              >
                {isSelected ? <View style={styles.selectedThemeDot} /> : null}
              </View>
              <Text style={[styles.themeLabel, isSelected && styles.themeLabelSelected]}>
                {theme.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function FontPanel({
  bold,
  fontSize,
  spacing,
  onBoldChange,
  onFontSizeChange,
  onSpacingChange,
}: {
  bold: boolean;
  fontSize: number;
  spacing: Spacing;
  onBoldChange: () => void;
  onFontSizeChange: (change: number) => void;
  onSpacingChange: (spacing: Spacing) => void;
}) {
  return (
    <>
      <View style={styles.fontTopRow}>
        <View>
          <Text style={styles.panelEyebrow}>FONT SETTINGS</Text>
          <Text style={styles.panelTitle}>Source Sans 3</Text>
        </View>
        <View style={styles.fontSizeControl}>
          <Pressable accessibilityLabel="Decrease preview font size" hitSlop={6} onPress={() => onFontSizeChange(-1)}>
            <Text style={styles.fontSizeButton}>A</Text>
          </Pressable>
          <Text style={styles.fontSizeValue}>{fontSize}</Text>
          <Pressable accessibilityLabel="Increase preview font size" hitSlop={6} onPress={() => onFontSizeChange(1)}>
            <Text style={styles.fontSizeButtonLarge}>A</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.spacingRow}>
        {(["Compact", "Comfortable", "Relaxed"] as Spacing[]).map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: spacing === item }}
            key={item}
            onPress={() => onSpacingChange(item)}
            style={[styles.spacingOption, spacing === item && styles.spacingOptionSelected]}
          >
            <Text style={[styles.spacingText, spacing === item && styles.spacingTextSelected]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.fontDetailsRow}>
        <Text style={styles.detailText}>
          Line {spacingMultipliers[spacing].toFixed(1)}×
        </Text>
        <Text style={styles.detailDot}>•</Text>
        <Text style={styles.detailText}>Character</Text>
        <Text style={styles.detailDot}>•</Text>
        <Text style={styles.detailText}>Word</Text>
        <Pressable
          accessibilityLabel="Bold text preview"
          accessibilityRole="switch"
          accessibilityState={{ checked: bold }}
          hitSlop={6}
          onPress={onBoldChange}
          style={styles.boldControl}
        >
          <Text style={[styles.boldLabel, bold && styles.boldLabelOn]}>Bold</Text>
          <View style={[styles.switchTrack, bold && styles.switchTrackOn]}>
            <View style={[styles.switchThumb, bold && styles.switchThumbOn]} />
          </View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 350, justifyContent: "center", paddingHorizontal: 5 },
  stageCompact: { minHeight: 300 },
  backGlow: { position: "absolute", top: 9, right: 10, left: 10, height: 175, borderRadius: 30, transform: [{ rotate: "-2deg" }], backgroundColor: "#E1EACB" },
  backGlowCompact: { height: 145 },
  readerPreview: { height: 174, marginHorizontal: 17, borderWidth: 1, borderColor: "rgba(72, 82, 61, 0.12)", borderRadius: 24, paddingHorizontal: 19, paddingTop: 16, shadowColor: "#30401E", shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 5 },
  readerPreviewCompact: { height: 145, paddingTop: 12 },
  readerMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  readerEyebrow: { opacity: 0.58, fontFamily: "Lato_700Bold", fontSize: 8, letterSpacing: 1.15 },
  pagePill: { minWidth: 28, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pageNumber: { opacity: 0.62, fontFamily: "Lato_700Bold", fontSize: 9 },
  readerTitle: { marginTop: 12, fontFamily: "Lato_700Bold", letterSpacing: -0.25 },
  readerBody: { maxWidth: "93%", marginTop: 7, fontFamily: "SourceSans3_400Regular", opacity: 0.86 },
  toolbar: { zIndex: 3, height: 61, marginTop: -23, marginHorizontal: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "#E1E4DA", borderRadius: 22, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, backgroundColor: "#FFFFFF", shadowColor: "#29331F", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 8 },
  toolbarCompact: { height: 55, marginTop: -20 },
  toolButton: { minWidth: 63, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  toolButtonActive: { backgroundColor: "#639922" },
  toolLabel: { marginTop: 1, color: "#6D795F", fontFamily: "Lato_700Bold", fontSize: 7.5 },
  toolLabelActive: { color: "#FFFFFF" },
  passiveTool: { flex: 1, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  panel: { minHeight: 137, marginTop: 9, borderWidth: 1, borderColor: "#E4E5DE", borderRadius: 22, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 11, backgroundColor: "#FFFEFB", shadowColor: "#344123", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  panelCompact: { minHeight: 123, paddingTop: 10, paddingBottom: 8 },
  panelHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelEyebrow: { color: "#78934F", fontFamily: "Lato_700Bold", fontSize: 7.5, letterSpacing: 0.9 },
  panelTitle: { marginTop: 2, color: "#283025", fontFamily: "Lato_700Bold", fontSize: 13 },
  customColorPill: { height: 27, borderWidth: 1, borderColor: "#E1E4D9", borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, backgroundColor: "#F8FAF4" },
  customColorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#91B85D" },
  customColorText: { color: "#697461", fontFamily: "Lato_700Bold", fontSize: 9 },
  themeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  themeOption: { width: 51, alignItems: "center" },
  themeSwatch: { width: 36, height: 36, borderWidth: 1, borderColor: "rgba(60, 68, 53, 0.12)", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  themeSwatchSelected: { borderWidth: 2, borderColor: "#639922", transform: [{ scale: 1.04 }] },
  selectedThemeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#639922" },
  themeLabel: { marginTop: 4, color: "#7B8375", fontFamily: "SourceSans3_400Regular", fontSize: 8.5 },
  themeLabelSelected: { color: "#4F7D1A", fontFamily: "Lato_700Bold" },
  fontTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fontSizeControl: { height: 32, borderWidth: 1, borderColor: "#E0E4D8", borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, backgroundColor: "#F8FAF4" },
  fontSizeButton: { color: "#65705D", fontFamily: "Lato_700Bold", fontSize: 10 },
  fontSizeButtonLarge: { color: "#4F7D1A", fontFamily: "Lato_700Bold", fontSize: 16 },
  fontSizeValue: { color: "#30382A", fontFamily: "Lato_700Bold", fontSize: 11, fontVariant: ["tabular-nums"] },
  spacingRow: { height: 35, marginTop: 9, borderRadius: 11, flexDirection: "row", padding: 3, backgroundColor: "#F0F2EC" },
  spacingOption: { flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  spacingOptionSelected: { backgroundColor: "#FFFFFF", shadowColor: "#344123", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  spacingText: { color: "#7A8274", fontFamily: "SourceSans3_400Regular", fontSize: 9 },
  spacingTextSelected: { color: "#4F7D1A", fontFamily: "Lato_700Bold" },
  fontDetailsRow: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  detailText: { color: "#8A9183", fontFamily: "SourceSans3_400Regular", fontSize: 8.5 },
  detailDot: { marginHorizontal: 4, color: "#CDD1C8", fontSize: 8 },
  boldControl: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 },
  boldLabel: { color: "#5E6857", fontFamily: "Lato_700Bold", fontSize: 9 },
  boldLabelOn: { color: "#4F7D1A" },
  switchTrack: { width: 29, height: 17, borderRadius: 9, justifyContent: "center", paddingHorizontal: 2, backgroundColor: "#D9DDD4" },
  switchTrackOn: { backgroundColor: "#639922" },
  switchThumb: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#FFFFFF" },
  switchThumbOn: { alignSelf: "flex-end" },
});
