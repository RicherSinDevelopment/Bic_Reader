import { Button, ButtonText } from "@/components/ui/button";
import { ChevronDownIcon, Icon } from "@/components/ui/icon";
import {
  appleSpeech,
  clearAppleSpeechSleepTimer,
  getAppleSpeechSleepTimerRemainingSeconds,
  isAppleSpeechAvailable,
  startAppleSpeechSleepTimer,
  type AppleSpeechVoice,
} from "@/services/appleSpeechService";
import { Check } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

type TTSProps = {
  text: string;
  startOffset: number;
  onSpeechStartOffsetChange: (offset: number) => void;
  onClearHighlight: () => void;
  translationLanguage?: TranslationLanguage;
  onTranslationLanguageChange: (language?: TranslationLanguage) => void;
};

export type TranslationLanguage = {
  code: string;
  label: string;
};

const translationLanguages: TranslationLanguage[] = [
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
  onSpeechStartOffsetChange,
  onClearHighlight,
  translationLanguage,
  onTranslationLanguageChange,
}: TTSProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<AppleSpeechVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>();
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number>();
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [isSleepTimerMenuOpen, setIsSleepTimerMenuOpen] = useState(false);
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
      const safeStartOffset = Math.max(
        0,
        Math.min(text.length, Math.floor(startOffset)),
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

  return (
    <View className="px-4 py-4">
      <Text className="text-lg font-semibold text-slate-900">
        Text to Speech
      </Text>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600">Translated to:</Text>
        <Pressable
          accessibilityLabel={`Choose translation language. Current language: ${translationLanguage?.label ?? "Original"}`}
          accessibilityRole="button"
          onPress={() => setIsLanguageMenuOpen(true)}
          className="h-10 min-w-36 flex-row items-center justify-between gap-2 rounded-md border border-black/20 bg-white px-3 active:bg-black/5"
        >
          <Text className="text-sm text-black">
            {translationLanguage?.label ?? "Original"}
          </Text>
          <Icon as={ChevronDownIcon} size="xs" className="text-black/60" />
        </Pressable>
      </View>
      <Modal
        animationType="fade"
        transparent
        visible={isLanguageMenuOpen}
        onRequestClose={() => setIsLanguageMenuOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close translation language menu"
          className="absolute inset-0 bg-black/20"
          onPress={() => setIsLanguageMenuOpen(false)}
        />
        <View className="mx-6 my-auto max-h-[70%] overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-lg">
          <Text className="px-3 pb-2 pt-3 text-base font-semibold text-slate-900">
            Translate to
          </Text>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityState={{ selected: !translationLanguage }}
              onPress={() => {
                onTranslationLanguageChange(undefined);
                setIsLanguageMenuOpen(false);
              }}
              className="h-12 flex-row items-center justify-between rounded px-3 active:bg-black/5"
            >
              <Text className="text-base text-black">Original</Text>
              {!translationLanguage && <Check size={16} color="#000000" />}
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
                  className="h-12 flex-row items-center justify-between rounded px-3 active:bg-black/5"
                >
                  <Text className="text-base text-black">{language.label}</Text>
                  {isSelected && <Check size={16} color="#000000" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600">Voice:</Text>
        <Pressable
          accessibilityLabel={`Choose voice. Current voice: ${selectedVoiceName}`}
          accessibilityRole="button"
          onPress={() => setIsVoiceMenuOpen(true)}
          className="h-10 max-w-64 flex-row items-center gap-2 rounded-md border border-black/20 bg-white px-3 active:bg-black/5"
        >
          <Text numberOfLines={1} className="shrink text-sm text-black">
            {voices.length ? selectedVoiceName : "Loading voices..."}
          </Text>
          <Icon as={ChevronDownIcon} size="xs" className="text-black/60" />
        </Pressable>
      </View>
      {voices.length > 0 && (
        <View className="mt-2 flex-row items-center justify-end gap-3">
          <Text className="text-xs text-slate-500">
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
          accessibilityLabel="Close voice menu"
          className="absolute inset-0 bg-black/20"
          onPress={() => setIsVoiceMenuOpen(false)}
        />
        <View className="mx-6 my-auto max-h-[70%] overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-lg">
          <Text className="px-3 pb-2 pt-3 text-base font-semibold text-slate-900">
            Apple AVFoundation voices
          </Text>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                setSelectedVoice(undefined);
                setIsVoiceMenuOpen(false);
              }}
              className="h-12 flex-row items-center justify-between rounded px-3 active:bg-black/5"
            >
              <Text className="text-base text-black">System default</Text>
              {!selectedVoice && <Check size={16} color="#000000" />}
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
                  className="min-h-12 flex-row items-center justify-between rounded px-3 py-2 active:bg-black/5"
                >
                  <View className="mr-3 shrink">
                    <Text className="text-base text-black">{voice.name}</Text>
                    <Text className="text-xs text-slate-500">
                      {voice.language} · {voice.quality}
                    </Text>
                  </View>
                  {isSelected && <Check size={16} color="#000000" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600">Voice speed:</Text>
        <Pressable
          accessibilityLabel={`Choose voice speed. Current speed: ${speechRate}x`}
          accessibilityRole="button"
          onPress={() => setIsSpeedMenuOpen(true)}
          className="h-10 min-w-24 flex-row items-center justify-between gap-2 rounded-md border border-black/20 bg-white px-3 active:bg-black/5"
        >
          <Text className="text-sm text-black">{speechRate}x</Text>
          <Icon as={ChevronDownIcon} size="xs" className="text-black/60" />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isSpeedMenuOpen}
        onRequestClose={() => setIsSpeedMenuOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close voice speed menu"
          className="absolute inset-0 bg-black/20"
          onPress={() => setIsSpeedMenuOpen(false)}
        />
        <View className="mx-6 my-auto overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-lg">
          <Text className="px-3 pb-2 pt-3 text-base font-semibold text-slate-900">
            Choose voice speed
          </Text>
          {speedOptions.map((option) => {
            const isSelected = option.value === speechRate;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                onPress={() => {
                  setSpeechRate(option.value);
                  setIsSpeedMenuOpen(false);
                }}
                className="h-12 flex-row items-center justify-between rounded px-3 active:bg-black/5"
              >
                <Text className="text-base text-black">{option.label}</Text>
                {isSelected && <Check size={16} color="#000000" />}
              </Pressable>
            );
          })}
        </View>
      </Modal>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-m text-slate-600">Sleep timer:</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose sleep timer. Current setting: ${sleepTimerMinutes ? `${sleepTimerMinutes} minutes` : "Off"}`}
          onPress={() => setIsSleepTimerMenuOpen(true)}
          className="h-10 min-w-28 flex-row items-center justify-between gap-2 rounded-md border border-black/20 bg-white px-3 active:bg-black/5"
        >
          <Text className="text-sm text-black">
            {sleepTimerRemaining > 0
              ? `${Math.ceil(sleepTimerRemaining / 60)} min left`
              : sleepTimerMinutes
                ? `${sleepTimerMinutes} min`
                : "Off"}
          </Text>
          <Icon as={ChevronDownIcon} size="xs" className="text-black/60" />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isSleepTimerMenuOpen}
        onRequestClose={() => setIsSleepTimerMenuOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close sleep timer menu"
          className="absolute inset-0 bg-black/20"
          onPress={() => setIsSleepTimerMenuOpen(false)}
        />
        <View className="mx-6 my-auto overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-lg">
          <Text className="px-3 pb-2 pt-3 text-base font-semibold text-slate-900">
            Stop speaking after
          </Text>
          <Pressable
            accessibilityRole="menuitem"
            accessibilityState={{ selected: !sleepTimerMinutes }}
            onPress={() => {
              setSleepTimerMinutes(undefined);
              clearAppleSpeechSleepTimer();
              setSleepTimerRemaining(0);
              setIsSleepTimerMenuOpen(false);
            }}
            className="h-12 flex-row items-center justify-between rounded px-3 active:bg-black/5"
          >
            <Text className="text-base text-black">Off</Text>
            {!sleepTimerMinutes && <Check size={16} color="#000000" />}
          </Pressable>
          {sleepTimerOptions.map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: sleepTimerMinutes === minutes }}
              onPress={() => {
                setSleepTimerMinutes(minutes);
                if (isSpeaking) {
                  startAppleSpeechSleepTimer(minutes);
                  setSleepTimerRemaining(minutes * 60);
                }
                setIsSleepTimerMenuOpen(false);
              }}
              className="h-12 flex-row items-center justify-between rounded px-3 active:bg-black/5"
            >
              <Text className="text-base text-black">
                {minutes < 60
                  ? `${minutes} minutes`
                  : `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`}
              </Text>
              {sleepTimerMinutes === minutes && <Check size={16} color="#000000" />}
            </Pressable>
          ))}
        </View>
      </Modal>
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
        className="mt-8 h-14 flex-row items-center justify-center rounded-xl bg-green-400 px-5"
        accessibilityLabel={
          isSpeaking ? "Stop text to speech" : "Start text to speech"
        }
      >
        <ButtonText
          className="font-lato-bold"
          style={{ fontFamily: "Lato_700Bold" }}
        >
          {isSpeaking ? "STOP TTS" : "START TTS"}
        </ButtonText>
      </Button>
    </View>
  );
}
