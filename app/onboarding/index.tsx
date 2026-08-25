import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { completeOnboarding } from "@/lib/onboarding";

export default function WelcomeOnboardingScreen() {
  const openSignIn = () => {
    completeOnboarding();
    router.replace("/(auth)/sign-in");
  };
  const openNextStep = () => router.push("/onboarding/comfortable");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>B</Text>
            </View>
            <Text style={styles.brandName}>Bic Reader</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={12}
            onPress={openSignIn}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.hero} accessibilityElementsHidden>
          <View style={styles.glowLarge} />
          <View style={styles.glowSmall} />

          <View style={[styles.page, styles.backPage]}>
            <View style={[styles.line, styles.lineShort]} />
            <View style={styles.line} />
            <View style={[styles.line, styles.lineMedium]} />
          </View>

          <View style={[styles.page, styles.frontPage]}>
            <View style={styles.pageHeader}>
              <View style={styles.pdfBadge}>
                <Text style={styles.pdfBadgeText}>PDF</Text>
              </View>
              <View style={styles.sparkle}>
                <Ionicons name="sparkles" size={20} color="#639922" />
              </View>
            </View>
            <View style={[styles.line, styles.titleLine]} />
            <View style={styles.readableBlock}>
              <View style={[styles.readableLine, styles.readableLineLong]} />
              <View style={[styles.readableLine, styles.readableLineMedium]} />
              <View style={[styles.readableLine, styles.readableLineShort]} />
            </View>
            <View style={styles.controls}>
              <Text style={styles.smallA}>A</Text>
              <View style={styles.controlTrack}>
                <View style={styles.controlFill} />
                <View style={styles.controlThumb} />
              </View>
              <Text style={styles.largeA}>A</Text>
            </View>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>Your PDFs,{"\n"}made readable.</Text>
          <Text style={styles.description}>
            Turn difficult PDFs into a comfortable, customizable reading
            experience made for your phone.
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.pagination} accessibilityLabel="Onboarding page 1 of 4">
            <View style={styles.activeDot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue to the next step"
            onPress={openNextStep}
            style={({ pressed }) => [styles.continueButton, pressed && styles.continuePressed]}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Ionicons name="arrow-forward" size={21} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F5EC" },
  container: { flex: 1, paddingHorizontal: 24 },
  topBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#639922",
  },
  brandLetter: { color: "#FFFFFF", fontFamily: "Lato_700Bold", fontSize: 18 },
  brandName: { color: "#20251D", fontFamily: "Lato_700Bold", fontSize: 17 },
  skipButton: { paddingHorizontal: 4, paddingVertical: 8 },
  skipText: { color: "#5C6854", fontFamily: "Lato_700Bold", fontSize: 15 },
  pressed: { opacity: 0.55 },
  hero: {
    flex: 1,
    minHeight: 280,
    maxHeight: 390,
    alignItems: "center",
    justifyContent: "center",
  },
  glowLarge: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: "#E5EDCE",
  },
  glowSmall: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#D5E5AF",
  },
  page: {
    position: "absolute",
    width: 184,
    height: 238,
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#FFFDF8",
    shadowColor: "#30401E",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  backPage: { transform: [{ rotate: "-9deg" }, { translateX: -32 }], opacity: 0.72 },
  frontPage: { transform: [{ rotate: "3deg" }, { translateX: 19 }] },
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pdfBadge: { borderRadius: 7, backgroundColor: "#E9F1D8", paddingHorizontal: 9, paddingVertical: 6 },
  pdfBadgeText: { color: "#4F7D1A", fontFamily: "Lato_700Bold", fontSize: 11, letterSpacing: 0.8 },
  sparkle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F6E7" },
  line: { height: 7, borderRadius: 4, marginTop: 15, backgroundColor: "#D8D9D3" },
  lineShort: { width: "48%", marginTop: 45 },
  lineMedium: { width: "72%" },
  titleLine: { width: "62%", height: 9, marginTop: 20, backgroundColor: "#BFC4B8" },
  readableBlock: { marginTop: 19, gap: 8 },
  readableLine: { height: 6, borderRadius: 3, backgroundColor: "#DDE4D3" },
  readableLineLong: { width: "100%" },
  readableLineMedium: { width: "88%" },
  readableLineShort: { width: "68%" },
  controls: { marginTop: 23, flexDirection: "row", alignItems: "center", gap: 8 },
  smallA: { color: "#7B8474", fontFamily: "Lato_700Bold", fontSize: 11 },
  largeA: { color: "#526049", fontFamily: "Lato_700Bold", fontSize: 17 },
  controlTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#DDE4D3" },
  controlFill: { width: "62%", height: 4, borderRadius: 2, backgroundColor: "#8DB851" },
  controlThumb: { position: "absolute", left: "57%", top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: "#639922" },
  copy: { alignItems: "center", paddingHorizontal: 4 },
  title: {
    textAlign: "center",
    color: "#1D221A",
    fontFamily: "Lato_700Bold",
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -0.8,
  },
  description: {
    marginTop: 16,
    maxWidth: 340,
    textAlign: "center",
    color: "#65705D",
    fontFamily: "SourceSans3_400Regular",
    fontSize: 17,
    lineHeight: 25,
  },
  footer: { paddingTop: 24, paddingBottom: 10 },
  pagination: { height: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 18 },
  activeDot: { width: 22, height: 7, borderRadius: 4, backgroundColor: "#639922" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D4D8CE" },
  continueButton: {
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#639922",
    shadowColor: "#4C741C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  continuePressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  continueText: { color: "#FFFFFF", fontFamily: "Lato_700Bold", fontSize: 17 },
});
