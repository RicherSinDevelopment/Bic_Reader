import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReadingCustomizationShowcase } from "@/components/onboarding/ReadingCustomizationShowcase";
import { OnboardingBackButton } from "@/components/onboarding/OnboardingBackButton";

export default function CustomizationOnboardingScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 730;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <OnboardingBackButton onPress={() => router.back()} />
        <View style={[styles.copy, compact && styles.copyCompact]}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Read your way.</Text>
          <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
            Customize fonts, colors, and spacing to create a reading experience that feels right for you.
          </Text>
        </View>

        <View style={[styles.previewArea, compact && styles.previewAreaCompact]}>
          <ReadingCustomizationShowcase />
        </View>

        <Text style={[styles.supportingText, compact && styles.supportingTextCompact]}>
          From night reading to relaxed spacing, Bic Reader adapts to you.
        </Text>

        <View style={[styles.footer, compact && styles.footerCompact]}>
          <View style={[styles.pagination, compact && styles.paginationCompact]} accessibilityLabel="Onboarding page 3 of 5">
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.activeDot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <Pressable
            accessibilityLabel="Continue to the next step"
            accessibilityRole="button"
            onPress={() => router.push("/onboarding/features")}
            style={({ pressed }) => [
              styles.continueButton,
              compact && styles.continueButtonCompact,
              pressed && styles.continuePressed,
            ]}
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
  container: { flex: 1, paddingHorizontal: 20 },
  copy: { alignItems: "center", paddingTop: 15, paddingHorizontal: 18 },
  copyCompact: { paddingTop: 7 },
  title: { textAlign: "center", color: "#1D221A", fontFamily: "Lato_700Bold", fontSize: 31, lineHeight: 37, letterSpacing: -0.55 },
  titleCompact: { fontSize: 28, lineHeight: 33 },
  subtitle: { maxWidth: 360, marginTop: 8, textAlign: "center", color: "#65705D", fontFamily: "SourceSans3_400Regular", fontSize: 15.5, lineHeight: 21 },
  subtitleCompact: { marginTop: 6, fontSize: 14, lineHeight: 18 },
  previewArea: { flex: 1, minHeight: 350, maxHeight: 480, marginTop: 10 },
  previewAreaCompact: { minHeight: 300, marginTop: 4 },
  supportingText: { marginTop: 4, textAlign: "center", color: "#737C6C", fontFamily: "SourceSans3_400Regular", fontSize: 13.5, lineHeight: 19 },
  supportingTextCompact: { marginTop: 0, fontSize: 12.5, lineHeight: 17 },
  footer: { paddingTop: 11, paddingBottom: 10 },
  footerCompact: { paddingTop: 4, paddingBottom: 4 },
  pagination: { height: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 12 },
  paginationCompact: { marginBottom: 6 },
  activeDot: { width: 22, height: 7, borderRadius: 4, backgroundColor: "#639922" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D4D8CE" },
  continueButton: { height: 58, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#639922", shadowColor: "#4C741C", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5 },
  continueButtonCompact: { height: 52 },
  continuePressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  continueText: { color: "#FFFFFF", fontFamily: "Lato_700Bold", fontSize: 17 },
});
