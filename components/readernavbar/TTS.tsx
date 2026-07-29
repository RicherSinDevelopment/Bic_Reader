import { Button, ButtonText } from "@/components/ui/button";
import { ChevronDownIcon, Icon } from "@/components/ui/icon";
import { Check } from "lucide-react-native";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

type TTSProps = {
  text: string;
};
const speedOptions = [
  { label: "0.5x", value: 0.5 },
  { label: "0.75x", value: 0.75 },
  { label: "1x", value: 1 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
] as const;

const splitForSpeech = (text: string) => {
  const maxLength = Math.min(Speech.maxSpeechInputLength, 3500);
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    const candidate = remaining.slice(0, maxLength);
    const splitAt = Math.max(
      candidate.lastIndexOf(". ") + 1,
      candidate.lastIndexOf(" ")
    );
    const end = splitAt > 0 ? splitAt : maxLength;

    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
};

export default function TTS({ text }: TTSProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>();
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Speech.getAvailableVoicesAsync()
      .then((availableVoices) => {
        if (isMounted) setVoices(availableVoices);
      })
      .catch((error) => console.error("Failed to load TTS voices:", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const stopSpeaking = useCallback(async () => {
    await Speech.stop();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      void Speech.stop();
    };
  }, []);

  const handleTTS = async () => {
    if (isSpeaking) {
      await stopSpeaking();
      return;
    }

    if (!text.trim()) return;

    const chunks = splitForSpeech(text);
    setIsSpeaking(true);

    chunks.forEach((chunk, index) => {
      const isLastChunk = index === chunks.length - 1;

      Speech.speak(chunk, {
        voice: selectedVoice,
        rate: speechRate,
        onDone: isLastChunk ? () => setIsSpeaking(false) : undefined,
        onStopped: () => setIsSpeaking(false),
        onError: () => {
          void Speech.stop();
          setIsSpeaking(false);
        },
      });
    });
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
            Choose a voice
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

            {voices.map((voice) => {
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
                      {voice.language}
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
      <Button
        variant="default"
        size="lg"
        onPress={handleTTS}
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
