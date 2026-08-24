import { Button, ButtonText } from "@/components/ui/button";
import SteppedSlider from "@/components/ui/SteppedSlider";
import {
  appleSpeech,
  clearAppleSpeechSleepTimer,
  getAppleSpeechSleepTimerRemainingSeconds,
  isAppleSpeechAvailable,
  startAppleSpeechSleepTimer,
  type AppleSpeechVoice,
} from "@/services/appleSpeechService";
import { Check, ChevronDown } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

type TTSProps = {
  text: string;
  startOffset: number;
  getStartOffset?: () => number;
  onSpeechStartOffsetChange: (offset: number) => void;
  onClearHighlight: () => void;
  translationLanguage?: TranslationLanguage;
  onTranslationLanguageChange: (language?: TranslationLanguage) => void;
};

export type TranslationLanguage = {
  code: string;
  label: string;
};

export const translationLanguages: TranslationLanguage[] = [
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "es", label: "Spanish" },
  { code: "tr", label: "Turkish" },
];
const speedOptions = [
  { label: "0.5x", value: 0.5 },
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
] as const;
const sleepTimerOptions = [15, 30, 45, 60, 90, 120] as const;
const speedLevels = speedOptions.map((option) => option.value);
const sleepTimerLevels = [0, ...sleepTimerOptions] as const;

function detectTextLanguage(text: string) {
  const sample = text.slice(0, 12_000);
  if (/[\u0600-\u06ff]/u.test(sample)) return "ar";
  if (/[\u3040-\u30ff]/u.test(sample)) return "ja";
  if (/[\uac00-\ud7af]/u.test(sample)) return "ko";
  if (/[\u4e00-\u9fff]/u.test(sample)) return "zh";
  if (/[\u0900-\u097f]/u.test(sample)) return "hi";
  if (/[\u0400-\u04ff]/u.test(sample)) return "ru";

  const normalized = ` ${sample.toLocaleLowerCase().replace(/[^\p{L}]+/gu, " ")} `;
  const languageWords: Record<string, string[]> = {
    en: [" the ", " and ", " of ", " to ", " in ", " that ", " is "],
    fr: [" le ", " la ", " les ", " de ", " des ", " et ", " une "],
    de: [" der ", " die ", " das ", " und ", " ist ", " nicht ", " von "],
    es: [" el ", " la ", " los ", " las ", " de ", " que ", " y "],
    it: [" il ", " lo ", " la ", " gli ", " che ", " di ", " e "],
    pt: [" o ", " a ", " os ", " as ", " de ", " que ", " e "],
    nl: [" de ", " het ", " een ", " en ", " van ", " dat ", " is "],
    tr: [" bir ", " ve ", " bu ", " için ", " ile ", " olan ", " değil "],
  };
  let bestLanguage = "en";
  let bestScore = -1;
  Object.entries(languageWords).forEach(([language, words]) => {
    const score = words.reduce(
      (total, word) => total + normalized.split(word).length - 1,
      0,
    );
    if (score > bestScore) {
      bestLanguage = language;
      bestScore = score;
    }
  });
  return bestLanguage;
}

export default function TTS({
  text,
  startOffset,
  getStartOffset,
  onSpeechStartOffsetChange,
  onClearHighlight,
  translationLanguage,
  onTranslationLanguageChange,
}: TTSProps) {
  const isDark = useColorScheme() === "dark";
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<AppleSpeechVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>();
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number>();
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const detectedLanguage = useMemo(() => detectTextLanguage(text), [text]);
  const visibleVoices = useMemo(() => {
    const allowedLanguages = new Set([
      detectedLanguage,
      ...(translationLanguage?.code ? [translationLanguage.code] : []),
    ]);
    return voices.filter((voice) =>
      allowedLanguages.has(voice.language.toLocaleLowerCase().split("-")[0]),
    );
  }, [detectedLanguage, translationLanguage?.code, voices]);

  useEffect(() => {
    if (
      selectedVoice &&
      !visibleVoices.some((voice) => voice.identifier === selectedVoice)
    ) {
      setSelectedVoice(undefined);
    }
  }, [selectedVoice, visibleVoices]);

  const loadVoices = useCallback(async () => {
    if (!isAppleSpeechAvailable) return;
    try {
      const availableVoices = await appleSpeech.getVoices();
      const qualityRank = { Premium: 0, Enhanced: 1, Default: 2 } as const;
      const preferredLanguage = translationLanguage?.code ?? "en";
      const languageRank = (language: string) => {
        const baseLanguage = language.toLocaleLowerCase().split("-")[0];
        if (baseLanguage === preferredLanguage) return 0;
        if (baseLanguage === "en") return 1;
        return 2;
      };
      setVoices(
        availableVoices.sort(
          (a, b) =>
            languageRank(a.language) - languageRank(b.language) ||
            qualityRank[a.quality] - qualityRank[b.quality] ||
            a.language.localeCompare(b.language) ||
            a.name.localeCompare(b.name),
        ),
      );
      setSpeechError(null);
    } catch (error) {
      setSpeechError(
        error instanceof Error
          ? `Unable to load Apple voices: ${error.message}`
          : "Unable to load Apple voices.",
      );
      throw error;
    }
  }, [translationLanguage?.code]);

  useEffect(() => {
    let isMounted = true;

    void loadVoices()
      .then(() => {
        if (!isMounted) return;
      })
      .catch((error) => console.error("Failed to load Apple voices:", error));

    if (!isAppleSpeechAvailable) return () => undefined;

    const subscriptions = [
      appleSpeech.addListener("speechStarted", () => setIsSpeaking(true)),
      appleSpeech.addListener("speechFinished", () => {
        clearAppleSpeechSleepTimer();
        setSleepTimerRemaining(0);
        onClearHighlight();
        setIsSpeaking(false);
      }),
      appleSpeech.addListener("speechStopped", () => {
        clearAppleSpeechSleepTimer();
        setSleepTimerRemaining(0);
        onClearHighlight();
        setIsSpeaking(false);
      }),
      appleSpeech.addListener("voicesChanged", () => void loadVoices()),
    ];
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") void loadVoices();
      },
    );

    return () => {
      isMounted = false;
      subscriptions.forEach((subscription) => subscription.remove());
      appStateSubscription.remove();
    };
  }, [loadVoices, onClearHighlight]);

  useEffect(() => {
    const updateRemaining = () => {
      setSleepTimerRemaining(getAppleSpeechSleepTimerRemainingSeconds());
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1_000);
    return () => clearInterval(interval);
  }, []);

  const stopSpeaking = useCallback(async () => {
    clearAppleSpeechSleepTimer();
    setSleepTimerRemaining(0);
    await appleSpeech.stop();
    onClearHighlight();
    setIsSpeaking(false);
  }, [onClearHighlight]);

  useEffect(() => {
    let isMounted = true;

    if (!isAppleSpeechAvailable) return () => undefined;

    appleSpeech.isSpeaking().then((speaking) => {
      if (isMounted) setIsSpeaking(speaking);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleTTS = async () => {
    try {
      setSpeechError(null);
      if (isSpeaking) {
        await stopSpeaking();
        return;
      }

      if (!text.trim()) return;

      onClearHighlight();
      const requestedStartOffset = getStartOffset?.() ?? startOffset;
      const safeStartOffset = Math.max(
        0,
        Math.min(text.length, Math.floor(requestedStartOffset)),
      );
      const visibleText = text.slice(safeStartOffset).trimStart();
      const leadingWhitespace = text
        .slice(safeStartOffset)
        .length - visibleText.length;
      const speechOffset = safeStartOffset + leadingWhitespace;
      if (!visibleText) return;
      onSpeechStartOffsetChange(speechOffset);
      await appleSpeech.speak(visibleText, selectedVoice, speechRate);
      if (sleepTimerMinutes) {
        startAppleSpeechSleepTimer(sleepTimerMinutes);
        setSleepTimerRemaining(sleepTimerMinutes * 60);
      }
      setIsSpeaking(true);
    } catch (error) {
      setSpeechError(
        error instanceof Error ? error.message : "Unable to start Apple speech.",
      );
      setIsSpeaking(false);
    }
  };

  const selectedVoiceName =
    voices.find((voice) => voice.identifier === selectedVoice)?.name ??
    "System default";

  const handleSleepTimerChange = useCallback((minutes: number) => {
    if (minutes === 0) {
      setSleepTimerMinutes(undefined);
      clearAppleSpeechSleepTimer();
      setSleepTimerRemaining(0);
      return;
    }
    setSleepTimerMinutes(minutes);
    if (isSpeaking) {
      startAppleSpeechSleepTimer(minutes);
      setSleepTimerRemaining(minutes * 60);
    }
  }, [isSpeaking]);

  const formatSleepTimer = useCallback((minutes: number) => {
    if (minutes === 0) return "Off";
    if (sleepTimerRemaining > 0 && minutes === sleepTimerMinutes) {
      return `${Math.ceil(sleepTimerRemaining / 60)} min left`;
    }
    return minutes < 60
      ? `${minutes} min`
      : `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`;
  }, [sleepTimerMinutes, sleepTimerRemaining]);

  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900 dark:text-[#F4F5F1]">
        Text to Speech
      </Text>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Translated to:</Text>
        <Pressable
          accessibilityLabel={`Choose translation language. Current language: ${translationLanguage?.label ?? "Original"}`}
          accessibilityRole="button"
          onPress={() => setIsLanguageMenuOpen(true)}
          style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={styles.pickerText}>
            {translationLanguage?.label ?? "Original"}
          </Text>
          <ChevronDown color={isDark ? "#F4F5F1" : "#111827"} size={20} />
        </Pressable>
      </View>
      <Modal
        animationType="fade"
        transparent
        visible={isLanguageMenuOpen}
        onRequestClose={() => setIsLanguageMenuOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsLanguageMenuOpen(false)}
        >
          <Pressable
            accessibilityRole="menu"
            onPress={(event) => event.stopPropagation()}
            style={styles.menu}
          >
            <Text style={styles.menuTitle}>Translate to</Text>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityState={{ selected: !translationLanguage }}
              onPress={() => {
                onTranslationLanguageChange(undefined);
                setIsLanguageMenuOpen(false);
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.menuItemText}>Original</Text>
              {!translationLanguage && <Check size={18} color={isDark ? "#F4F5F1" : "#111827"} />}
            </Pressable>
            {translationLanguages.map((language) => {
              const isSelected = language.code === translationLanguage?.code;

              return (
                <Pressable
                  key={language.code}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onTranslationLanguageChange(language);
                    setIsLanguageMenuOpen(false);
                  }}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                >
                  <Text style={styles.menuItemText}>{language.label}</Text>
                  {isSelected && <Check size={18} color={isDark ? "#F4F5F1" : "#111827"} />}
                </Pressable>
              );
            })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">Voice:</Text>
        <Pressable
          accessibilityLabel={`Choose voice. Current voice: ${selectedVoiceName}`}
          accessibilityRole="button"
          onPress={() => setIsVoiceMenuOpen(true)}
          style={({ pressed }) => [styles.picker, styles.voicePicker, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={styles.pickerText}>
            {voices.length ? selectedVoiceName : "Loading voices..."}
          </Text>
          <ChevronDown color={isDark ? "#F4F5F1" : "#111827"} size={20} />
        </Pressable>
      </View>
      {voices.length > 0 && (
        <View className="mt-2 flex-row items-center justify-end gap-3">
          <Text className="text-xs text-slate-500 dark:text-[#9EA69A]">
            {visibleVoices.length} relevant Apple voices · {visibleVoices.filter(
              (voice) => voice.quality !== "Default",
            ).length} high quality
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh installed Apple voices"
            onPress={() => void loadVoices()}
          >
            <Text className="text-xs font-semibold text-green-700">Refresh</Text>
          </Pressable>
        </View>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={isVoiceMenuOpen}
        onRequestClose={() => setIsVoiceMenuOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsVoiceMenuOpen(false)}
        >
          <Pressable
            accessibilityRole="menu"
            onPress={(event) => event.stopPropagation()}
            style={styles.menu}
          >
            <Text style={styles.menuTitle}>Choose a voice</Text>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityState={{ selected: !selectedVoice }}
              onPress={() => {
                setSelectedVoice(undefined);
                setIsVoiceMenuOpen(false);
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.menuItemText}>System default</Text>
              {!selectedVoice && <Check size={18} color={isDark ? "#F4F5F1" : "#111827"} />}
            </Pressable>

            {visibleVoices.map((voice) => {
              const isSelected = voice.identifier === selectedVoice;

              return (
                <Pressable
                  key={voice.identifier}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    setSelectedVoice(voice.identifier);
                    setIsVoiceMenuOpen(false);
                  }}
                  style={({ pressed }) => [styles.voiceMenuItem, pressed && styles.menuItemPressed]}
                >
                  <View style={styles.voiceDetails}>
                    <Text style={styles.menuItemText}>{voice.name}</Text>
                    <Text style={styles.menuItemDescription}>
                      {voice.language} · {voice.quality}
                    </Text>
                  </View>
                  {isSelected && <Check size={18} color={isDark ? "#F4F5F1" : "#111827"} />}
                </Pressable>
              );
            })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View className="mt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">
            Voice speed:
          </Text>
          <Text className="text-sm font-semibold text-[#639922]">
            {speechRate}x
          </Text>
        </View>
        <View>
          <SteppedSlider
            accessibilityLabel="Voice speed"
            levels={speedLevels}
            value={speechRate}
            onChange={setSpeechRate}
            formatValue={(value) => `${value}x`}
          />
        </View>
      </View>

      <View className="mt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-m text-slate-600 dark:text-[#A6ADA1]">
            Sleep timer:
          </Text>
          <Text
            className="text-sm font-semibold text-[#639922]"
            numberOfLines={1}
          >
            {formatSleepTimer(sleepTimerMinutes ?? 0)}
          </Text>
        </View>
        <View>
          <SteppedSlider
            accessibilityLabel="Sleep timer"
            levels={sleepTimerLevels}
            value={sleepTimerMinutes ?? 0}
            onChange={handleSleepTimerChange}
            formatValue={formatSleepTimer}
          />
        </View>
      </View>
      {!isAppleSpeechAvailable && (
        <Text className="mt-4 text-sm text-amber-700">
          Apple voices require the updated iOS development build.
        </Text>
      )}
      {speechError && (
        <Text className="mt-4 text-sm text-red-600">{speechError}</Text>
      )}
      <Button
        variant="default"
        size="lg"
        onPress={handleTTS}
        isDisabled={!isAppleSpeechAvailable || !text.trim()}
        className="mt-5 h-14 flex-row items-center justify-center rounded-xl bg-[#639922] px-5"
        accessibilityLabel={
          isSpeaking ? "Stop text to speech" : "Start text to speech"
        }
      >
        <ButtonText
          className="font-lato-bold text-white"
          style={{ fontFamily: "Lato_700Bold" }}
        >
          {isSpeaking ? "STOP TTS" : "START TTS"}
        </ButtonText>
      </Button>
    </View>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  pressed: { opacity: 0.65 },
  picker: {
    alignItems: "center",
    borderColor: isDark ? "#42483F" : "#E2E0DB",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    height: 40,
    justifyContent: "space-between",
    maxWidth: "62%",
    minWidth: 150,
    paddingHorizontal: 12,
  },
  voicePicker: { maxWidth: 256 },
  pickerText: {
    color: isDark ? "#F4F5F1" : "#17202B",
    flexShrink: 1,
    fontSize: 14,
    marginRight: 8,
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  menu: {
    backgroundColor: isDark ? "#1A1E18" : "#FFFEFC",
    borderRadius: 20,
    maxHeight: "68%",
    padding: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    width: "100%",
  },
  menuTitle: {
    color: isDark ? "#F4F5F1" : "#111827",
    fontSize: 20,
    fontWeight: "600",
    padding: 14,
  },
  menuItem: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    height: 50,
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  voiceMenuItem: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  menuItemPressed: { backgroundColor: isDark ? "#2A3027" : "#F3F2EF" },
  menuItemText: { color: isDark ? "#F4F5F1" : "#111827", fontSize: 17 },
  menuItemDescription: {
    color: isDark ? "#9EA69A" : "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  voiceDetails: { flexShrink: 1, marginRight: 12 },
});
