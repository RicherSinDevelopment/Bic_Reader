import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export function ReaderFeatureShowcase() {
  const reduceMotion = useReducedMotion();
  const aiOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const aiOffset = useSharedValue(reduceMotion ? 0 : 8);
  const progress = useSharedValue(reduceMotion ? 0.68 : 0.12);
  const syncScale = useSharedValue(reduceMotion ? 1 : 0.8);
  const syncOpacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;

    aiOpacity.value = withDelay(180, withTiming(1, { duration: 360 }));
    aiOffset.value = withDelay(180, withTiming(0, { duration: 360 }));
    progress.value = withDelay(480, withTiming(0.68, { duration: 800 }));
    syncOpacity.value = withDelay(900, withTiming(1, { duration: 280 }));
    syncScale.value = withDelay(900, withTiming(1, { duration: 280 }));
  }, [aiOffset, aiOpacity, progress, reduceMotion, syncOpacity, syncScale]);

  const aiStyle = useAnimatedStyle(() => ({
    opacity: aiOpacity.value,
    transform: [{ translateY: aiOffset.value }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const syncStyle = useAnimatedStyle(() => ({
    opacity: syncOpacity.value,
    transform: [{ scale: syncScale.value }],
  }));

  return (
    <View style={styles.stage} accessibilityLabel="Reader preview with AI, text to speech, highlighting, and cloud sync">
      <View style={styles.backGlow} />

      <View style={styles.reader}>
        <View style={styles.readerHeader}>
          <View>
            <Text style={styles.chapter}>CHAPTER 4</Text>
            <Text style={styles.documentName}>The focused mind</Text>
          </View>
          <View style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={17} color="#697161" />
          </View>
        </View>

        <Text style={styles.title}>Building better reading habits</Text>
        <Text style={styles.paragraph}>
          Deep reading gives ideas the time they need to connect. A calm environment
          makes it easier to notice patterns and remember what matters.
        </Text>

        <View style={styles.highlightWrap}>
          <View style={styles.highlight} />
          <Text style={styles.highlightText}>
            Attention grows stronger when reading feels effortless.
          </Text>
        </View>

        <Text style={styles.paragraphSmall}>
          Small adjustments to type, spacing, and rhythm can transform a difficult
          document into a comfortable place to think.
        </Text>

        <View style={styles.readerToolbar}>
          <Ionicons name="text-outline" size={18} color="#68725F" />
          <Ionicons name="color-wand-outline" size={18} color="#639922" />
          <Ionicons name="bookmark-outline" size={18} color="#68725F" />
        </View>
      </View>

      <Animated.View style={[styles.aiBubble, aiStyle]}>
        <View style={styles.aiIcon}>
          <Ionicons name="sparkles" size={15} color="#FFFFFF" />
        </View>
        <View style={styles.aiCopy}>
          <Text style={styles.featureEyebrow}>AI ASSISTANT</Text>
          <Text style={styles.aiText}>Ask anything about this PDF</Text>
        </View>
        <Ionicons name="arrow-forward" size={15} color="#76934F" />
      </Animated.View>

      <Animated.View style={[styles.syncPill, syncStyle]}>
        <Ionicons name="cloud-done-outline" size={16} color="#5F8C29" />
        <Text style={styles.syncText}>Synced</Text>
      </Animated.View>

      <View style={styles.ttsControl}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={15} color="#FFFFFF" />
        </View>
        <View style={styles.audioBody}>
          <View style={styles.audioLabels}>
            <Text style={styles.featureEyebrow}>TEXT TO SPEECH</Text>
            <Text style={styles.speed}>1.0×</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 355, alignItems: "center", justifyContent: "center" },
  backGlow: { position: "absolute", width: "88%", height: "80%", borderRadius: 38, transform: [{ rotate: "-3deg" }], backgroundColor: "#E3EBCD" },
  reader: { width: "79%", height: "78%", minHeight: 300, borderWidth: 1, borderColor: "#E4E4DC", borderRadius: 24, paddingHorizontal: 21, paddingTop: 19, backgroundColor: "#FFFEFA", shadowColor: "#2C371F", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.11, shadowRadius: 20, elevation: 6 },
  readerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chapter: { color: "#7A9A4D", fontFamily: "Lato_700Bold", fontSize: 8, letterSpacing: 1.2 },
  documentName: { marginTop: 3, color: "#7A8174", fontFamily: "SourceSans3_400Regular", fontSize: 11 },
  moreButton: { width: 31, height: 31, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F3EC" },
  title: { maxWidth: 225, marginTop: 19, color: "#20251D", fontFamily: "Lato_700Bold", fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  paragraph: { marginTop: 13, color: "#51594B", fontFamily: "SourceSans3_400Regular", fontSize: 12.5, lineHeight: 18 },
  highlightWrap: { marginTop: 13, alignSelf: "flex-start" },
  highlight: { ...StyleSheet.absoluteFillObject, top: 4, bottom: 1, borderRadius: 3, transform: [{ rotate: "-0.6deg" }], backgroundColor: "#DDEBAD" },
  highlightText: { paddingHorizontal: 2, color: "#34402C", fontFamily: "SourceSans3_400Regular", fontSize: 12.5, lineHeight: 18 },
  paragraphSmall: { marginTop: 13, color: "#66705F", fontFamily: "SourceSans3_400Regular", fontSize: 11.5, lineHeight: 17 },
  readerToolbar: { position: "absolute", right: 16, bottom: 13, left: 16, height: 38, borderTopWidth: 1, borderTopColor: "#E7E8E1", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingBottom: 2 },
  aiBubble: { position: "absolute", top: "6%", left: 0, width: "78%", minHeight: 62, borderWidth: 1, borderColor: "#E1E5D8", borderRadius: 18, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, backgroundColor: "#FFFFFF", shadowColor: "#2D381F", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 5 },
  aiIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#719F37" },
  aiCopy: { flex: 1, marginLeft: 10 },
  featureEyebrow: { color: "#799155", fontFamily: "Lato_700Bold", fontSize: 8, letterSpacing: 0.8 },
  aiText: { marginTop: 3, color: "#30362B", fontFamily: "Lato_700Bold", fontSize: 12 },
  syncPill: { position: "absolute", top: "17%", right: 0, height: 34, borderWidth: 1, borderColor: "#DCE5CF", borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, backgroundColor: "#F8FBF3", shadowColor: "#334322", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 7, elevation: 3 },
  syncText: { color: "#567B2C", fontFamily: "Lato_700Bold", fontSize: 11 },
  ttsControl: { position: "absolute", right: 0, bottom: "3%", width: "84%", height: 66, borderWidth: 1, borderColor: "#DDE1D5", borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, backgroundColor: "#FFFFFF", shadowColor: "#2C371F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 15, elevation: 6 },
  playButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingLeft: 2, backgroundColor: "#639922" },
  audioBody: { flex: 1, marginLeft: 12 },
  audioLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  speed: { color: "#697461", fontFamily: "Lato_700Bold", fontSize: 10 },
  progressTrack: { height: 4, marginTop: 9, overflow: "hidden", borderRadius: 2, backgroundColor: "#E3E6DD" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: "#84AC50" },
});
