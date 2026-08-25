import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { AccessibilityInfo, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

const EDGE_PADDING = 32;
type Props = { onInteraction?: () => void };
type MockMode = "reader" | "original";

export function PdfComparisonSlider({ onInteraction }: Props) {
  const hasAnimated = useRef(false);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const sliderX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const comparisonWidth = useSharedValue(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setLayoutWidth(width);
    comparisonWidth.value = width;
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      sliderX.value = width * 0.35;
      void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
        sliderX.value = reduceMotion ? width * 0.5 : withSequence(
          withTiming(width * 0.66, { duration: 850 }),
          withTiming(width * 0.5, { duration: 650 }),
        );
      });
    }
  };

  const panGesture = Gesture.Pan().minDistance(1)
    .onBegin(() => { gestureStartX.value = sliderX.value; })
    .onUpdate((event) => {
      sliderX.value = Math.max(EDGE_PADDING, Math.min(
        comparisonWidth.value - EDGE_PADDING,
        gestureStartX.value + event.translationX,
      ));
    })
    .onEnd(() => { if (onInteraction) runOnJS(onInteraction)(); });

  const readerRevealStyle = useAnimatedStyle(() => ({ width: sliderX.value }));
  const dividerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sliderX.value - 1 }] }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View accessibilityLabel="Drag to compare Reader Mode on the left with the original PDF on the right" accessibilityRole="adjustable" onLayout={onLayout} style={styles.comparison}>
        <OriginalPreview />
        <Animated.View style={[styles.readerReveal, readerRevealStyle]}>
          <ReaderPreview width={layoutWidth} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.divider, dividerStyle]}>
          <View style={styles.handle}><View style={styles.handleLine} /><View style={styles.handleLine} /></View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function MockReaderChrome({ mode }: { mode: MockMode }) {
  return (
    <View style={styles.chrome}>
      <View style={styles.chromeTopRow}>
        <Ionicons name="arrow-back" size={19} color="#20221F" />
        <View style={styles.modeTabs}>
          {(["reader", "original"] as const).map((tab) => (
            <View key={tab} style={[styles.modeTab, mode === tab && styles.modeTabActive]}>
              <Text style={[styles.modeTabText, mode === tab && styles.modeTabTextActive]}>{tab === "reader" ? "Reader" : "Original"}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chromeActions}>
          <Ionicons name="search-outline" size={20} color="#20221F" />
          <Ionicons name="menu-outline" size={22} color="#20221F" />
        </View>
      </View>
      <View style={styles.documentMeta}>
        <Text numberOfLines={1} style={styles.fileName}>scanned_no_ocr_5_pages</Text>
        <Text style={styles.pageCount}>1/5</Text>
      </View>
    </View>
  );
}

function OriginalPreview() {
  return (
    <View style={[styles.preview, styles.originalPreview]}>
      <MockReaderChrome mode="original" />
      <View style={styles.originalCanvas}>
        <View style={styles.paperPage}>
          <View style={styles.paperBorder}>
            <View style={styles.paperTitleRow}><View style={styles.paperHighlight} /><Text style={styles.paperTitle}>The Printing Press: A Short History</Text></View>
            <View style={styles.paperRule} />
            <Text style={styles.paperHeading}>Introduction</Text>
            <Text style={styles.paperText}>The printing press changed the way knowledge moved through society. Before movable type became widespread in Europe, books were usually copied by hand or produced with labor-intensive block-printing methods.</Text>
            <Text style={styles.paperHeading}>A New Method</Text>
            <Text style={styles.paperText}>In the fifteenth century, Johannes Gutenberg developed a practical system that combined movable metal type, durable ink, and a press mechanism.</Text>
            <Text style={styles.paperHeading}>Why It Mattered</Text>
            <Text style={styles.paperText}>Once text could be reproduced at scale, ideas traveled farther and faster.</Text>
            <Text style={styles.paperFooter}>Historical Technology Notes · Page 1</Text>
          </View>
        </View>
        <View style={styles.nextPage}><Text style={styles.nextPageTitle}>How Movable Type Worked</Text></View>
      </View>
    </View>
  );
}

function ReaderPreview({ width }: { width: number }) {
  return (
    <View style={[styles.preview, styles.readerPreview, width > 0 && { width }]}>
      <MockReaderChrome mode="reader" />
      <View style={styles.readerContent}>
        <View style={styles.readerTitleRow}>
          <View style={styles.readerHighlight} />
          <Text style={styles.readerTitleLead}>The</Text><Text style={styles.readerTitle}> Printing Press: A Short History</Text>
        </View>
        <Text style={styles.readerBody}><Text style={styles.readerIntro}>Introduction </Text>The printing press changed the way knowledge moved through society. Before movable type became widespread in Europe, books were usually copied by hand.</Text>
        <Text style={styles.readerBody}>A new method made books faster to reproduce, easier to share, and far more accessible to readers everywhere.</Text>
        <View style={styles.readerToolbar}>
          <Text style={styles.toolbarAa}>Aa</Text>
          <Ionicons name="image-outline" size={18} color="#639922" />
          <Ionicons name="ear-outline" size={18} color="#639922" />
          <Ionicons name="sparkles-outline" size={19} color="#639922" />
          <Ionicons name="settings-outline" size={19} color="#639922" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  comparison: { flex: 1, minHeight: 350, overflow: "hidden", borderWidth: 1, borderColor: "#D9DDD4", borderRadius: 24, backgroundColor: "#F2F2EF" },
  preview: { ...StyleSheet.absoluteFillObject },
  readerReveal: { position: "absolute", top: 0, bottom: 0, left: 0, overflow: "hidden", backgroundColor: "#F8FAFC" },
  readerPreview: { backgroundColor: "#F8FAFC" },
  originalPreview: { backgroundColor: "#F2F2EF" },
  chrome: { height: 91, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDDED9", backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingTop: 10 },
  chromeTopRow: { height: 45, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modeTabs: { width: 153, height: 40, borderRadius: 17, flexDirection: "row", padding: 3, backgroundColor: "#ECEBE5" },
  modeTab: { flex: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeTabActive: { backgroundColor: "#639922", shadowColor: "#456E17", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
  modeTabText: { color: "#7B7D76", fontFamily: "Lato_700Bold", fontSize: 12 },
  modeTabTextActive: { color: "#FFFFFF" },
  chromeActions: { width: 53, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  documentMeta: { height: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fileName: { maxWidth: "78%", color: "#858B80", fontFamily: "Lato_700Bold", fontSize: 10.5 },
  pageCount: { color: "#6F746B", fontFamily: "Lato_700Bold", fontSize: 11 },
  originalCanvas: { flex: 1, alignItems: "center", paddingTop: 8, backgroundColor: "#EEEFEC" },
  paperPage: { width: "94%", height: "94%", padding: 5, backgroundColor: "#FAFAF8", shadowColor: "#30332E", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
  paperBorder: { flex: 1, borderWidth: 1, borderColor: "#D9D9D2", paddingHorizontal: 19, paddingTop: 19 },
  paperTitleRow: { flexDirection: "row", alignItems: "center" },
  paperHighlight: { position: "absolute", left: -1, width: 27, height: 16, backgroundColor: "#F8DA61" },
  paperTitle: { color: "#242522", fontFamily: "Lato_700Bold", fontSize: 9.5 },
  paperRule: { height: 1, marginTop: 7, marginBottom: 9, backgroundColor: "#92948E" },
  paperHeading: { marginTop: 8, color: "#30312E", fontFamily: "Lato_700Bold", fontSize: 7.5 },
  paperText: { marginTop: 2, color: "#4D4E4A", fontFamily: "SourceSans3_400Regular", fontSize: 6.3, lineHeight: 8.2 },
  paperFooter: { position: "absolute", bottom: 8, alignSelf: "center", color: "#777973", fontFamily: "SourceSans3_400Regular", fontSize: 5 },
  nextPage: { position: "absolute", top: "97%", width: "94%", height: 80, borderWidth: 1, borderColor: "#DEDED8", padding: 20, backgroundColor: "#FAFAF8" },
  nextPageTitle: { color: "#282926", fontFamily: "Lato_700Bold", fontSize: 10 },
  readerContent: { flex: 1, overflow: "hidden", paddingHorizontal: 20, paddingTop: 18, backgroundColor: "#F8FAFC" },
  readerTitleRow: { flexDirection: "row", flexWrap: "wrap" },
  readerHighlight: { position: "absolute", top: 1, left: -1, width: 34, height: 28, borderRadius: 3, backgroundColor: "#F8D967" },
  readerTitleLead: { zIndex: 1, color: "#1E293B", fontFamily: "SourceSans3_400Regular", fontSize: 24, lineHeight: 29 },
  readerTitle: { flexShrink: 1, color: "#1E293B", fontFamily: "SourceSans3_400Regular", fontSize: 24, lineHeight: 29 },
  readerBody: { marginTop: 16, color: "#1E293B", fontFamily: "SourceSans3_400Regular", fontSize: 14.5, lineHeight: 23 },
  readerIntro: { fontFamily: "Lato_700Bold" },
  readerToolbar: { position: "absolute", right: 14, bottom: 13, left: 14, height: 54, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.07)", borderRadius: 21, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#FFFFFF", shadowColor: "#000000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  toolbarAa: { color: "#639922", fontFamily: "Lato_700Bold", fontSize: 15 },
  divider: { position: "absolute", top: 0, bottom: 0, left: 0, width: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#729D39" },
  handle: { width: 38, height: 48, borderWidth: 1, borderColor: "#D4E2BD", borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#FFFFFF", shadowColor: "#355313", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 7, elevation: 4 },
  handleLine: { width: 2, height: 14, borderRadius: 1, backgroundColor: "#7E9D56" },
});
