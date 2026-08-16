import { requireOptionalNativeModule } from "expo";
import type { EventSubscription } from "expo-modules-core";

export type AppleVoiceQuality = "Premium" | "Enhanced" | "Default";

export type AppleSpeechVoice = {
  identifier: string;
  name: string;
  language: string;
  quality: AppleVoiceQuality;
  gender: "Male" | "Female" | "Neutral" | "Unspecified";
};

type BoundaryEvent = {
  charIndex: number;
  charLength: number;
};

type BicSpeechEvents = {
  speechStarted: () => void;
  speechBoundary: (event: BoundaryEvent) => void;
  speechFinished: () => void;
  speechStopped: () => void;
  voicesChanged: () => void;
};

type BicSpeechNative = {
  getVoices(): Promise<AppleSpeechVoice[]>;
  speak(text: string, voiceIdentifier: string | null, rate: number): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  isSpeaking(): Promise<boolean>;
  addListener<EventName extends keyof BicSpeechEvents>(
    eventName: EventName,
    listener: BicSpeechEvents[EventName],
  ): EventSubscription;
};

const native = requireOptionalNativeModule<BicSpeechNative>("BicSpeech");

export const isAppleSpeechAvailable = Boolean(native);

function requireNativeSpeech() {
  if (!native) {
    throw new Error(
      "Apple speech is available in the iOS development build.",
    );
  }
  return native;
}

export const appleSpeech = {
  getVoices: () => requireNativeSpeech().getVoices(),
  speak: (text: string, voiceIdentifier: string | undefined, rate: number) =>
    requireNativeSpeech().speak(text, voiceIdentifier ?? null, rate),
  stop: () => requireNativeSpeech().stop(),
  pause: () => requireNativeSpeech().pause(),
  resume: () => requireNativeSpeech().resume(),
  isSpeaking: () => requireNativeSpeech().isSpeaking(),
  addListener: <EventName extends keyof BicSpeechEvents>(
    eventName: EventName,
    listener: BicSpeechEvents[EventName],
  ) => requireNativeSpeech().addListener(eventName, listener),
};

let sleepTimer: ReturnType<typeof setTimeout> | undefined;
let sleepTimerDeadline: number | undefined;

export function startAppleSpeechSleepTimer(minutes: number) {
  clearAppleSpeechSleepTimer();
  sleepTimerDeadline = Date.now() + minutes * 60_000;
  sleepTimer = setTimeout(() => {
    sleepTimer = undefined;
    sleepTimerDeadline = undefined;
    void appleSpeech.stop();
  }, minutes * 60_000);
}

export function clearAppleSpeechSleepTimer() {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = undefined;
  sleepTimerDeadline = undefined;
}

export function getAppleSpeechSleepTimerRemainingSeconds() {
  if (!sleepTimerDeadline) return 0;
  return Math.max(0, Math.ceil((sleepTimerDeadline - Date.now()) / 1_000));
}
