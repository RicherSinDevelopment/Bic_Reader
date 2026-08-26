import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReaderFeatureShowcase } from "@/components/onboarding/ReaderFeatureShowcase";
import { OnboardingBackButton } from "@/components/onboarding/OnboardingBackButton";

export default function FeaturesOnboardingScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <OnboardingBackButton onPress={() => router.back()} />
        <View style={styles.copy}>
          <Text style={styles.title}>Read. Listen. Understand.</Text>
          <Text style={styles.subtitle}>Everything you need to get more from your PDFs.</Text>
        </View>

        <View style={styles.previewArea}>
          <ReaderFeatureShowcase />
        </View>

        <Text style={styles.supportingText}>
          Your reading tools, always within reach.
        </Text>

        <View style={styles.footer}>
          <View style={styles.pagination} accessibilityLabel="Onboarding page 4 of 5">
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.activeDot} />
            <View style={styles.dot} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue to sign in"
            onPress={() => router.push("/onboarding/premium")}
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
  container: { flex: 1, paddingHorizontal: 20 },
  copy: { alignItems: "center", paddingTop: 19, paddingHorizontal: 18 },
  title: { textAlign: "center", color: "#1D221A", fontFamily: "Lato_700Bold", fontSize: 31, lineHeight: 37, letterSpacing: -0.55 },
  subtitle: { maxWidth: 350, marginTop: 9, textAlign: "center", color: "#65705D", fontFamily: "SourceSans3_400Regular", fontSize: 16, lineHeight: 22 },
  previewArea: { flex: 1, minHeight: 355, maxHeight: 500, marginTop: 15 },
  supportingText: { marginTop: 4, textAlign: "center", color: "#737C6C", fontFamily: "SourceSans3_400Regular", fontSize: 14, lineHeight: 20 },
  footer: { paddingTop: 15, paddingBottom: 10 },
  pagination: { height: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 14 },
  activeDot: { width: 22, height: 7, borderRadius: 4, backgroundColor: "#639922" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D4D8CE" },
  continueButton: { height: 58, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#639922", shadowColor: "#4C741C", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5 },
  continuePressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  continueText: { color: "#FFFFFF", fontFamily: "Lato_700Bold", fontSize: 17 },
});
