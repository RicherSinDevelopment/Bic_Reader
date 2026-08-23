import ReaderToolbar, {
  ReaderBottomNavItem,
} from "@/components/Readertoolbar";
import HorizontalReaderPager from "@/components/HorizontalReaderPager";

import AI from "@/components/readernavbar/AI";
import BackgroundSettings from "@/components/readernavbar/BackgroundSettings";
import FontSettings from "@/components/readernavbar/FontSettings";
import Settings from "@/components/readernavbar/Settings";
import TTS, {
  type TranslationLanguage,
} from "@/components/readernavbar/TTS";
import { usePageTransition } from "@/hooks/pagetransition";
import {
  BottomSheet,
  BottomSheetBackdrop,
  BottomSheetContent,
  BottomSheetDragIndicator,
  BottomSheetPortal,
  type BottomSheetRef,
} from "@/components/ui/bottomsheet";
import { BottomSheetHandle as NativeBottomSheetHandle } from "@gorhom/bottom-sheet";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";

import { useReaderSettingsStore } from '@/stores/readerSettingsStore';
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import {
  appleSpeech,
  clearAppleSpeechSleepTimer,
  isAppleSpeechAvailable,
} from "@/services/appleSpeechService";
import { Lato_700Bold } from "@expo-google-fonts/lato";
import { SourceSans3_400Regular } from "@expo-google-fonts/source-sans-3/400Regular";
import { useAssets } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

type ReaderViewProps = {
  isActive?: boolean;
  isLandscape: boolean;
  blocks: ExtractedPdfBlock[];
  pageCount: number;
  sourcePageCount?: number;
  destination?: {
    page: number;
    readerPage?: number;
    blockId?: string;
    searchQuery?: string;
    searchMatchIndex?: number;
    switchHighlightOffset?: number;
    switchHighlightWordIndex?: number;
    switchHighlightWordProgress?: number;
    switchHighlightQuery?: string;
    nonce: number;
  } | null;
  stationarySwitchHighlight?: {
    blockId: string;
    offset: number;
    nonce: number;
  } | null;
  onPageChange?: (page: number) => void;
  onPaginationChange?: (currentPage: number, totalPages: number) => void;
  onPageMapChange?: (pageMap: Record<number, number>) => void;
  onSwitchAnchorChange?: (blockId: string, word: string, wordIndex: number) => void;
  showSwitchHighlight?: boolean;
  onReady?: () => void;
  translationLanguage?: TranslationLanguage;
  onTranslationLanguageChange?: (language?: TranslationLanguage) => void;
  useTranslatedTextDirection?: boolean;
};

const readerMenuItems = [
  { key: "highlight", label: "Highlight" },
  { key: "askAI", label: "Ask AI" },
];

const highlightColors = [
  "#fde68a",
  "#f9a8d4",
  "#c4b5fd",
  "#93c5fd",
  "#86efac",
  "#fdba74",
];

const rightToLeftLanguageCodes = new Set(["ar", "fa", "he", "ur"]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function blockTag(block: ExtractedPdfBlock) {
  switch (block.kind) {
    case "title": return "h1";
    case "heading": return "h2";
    case "listItem": return "li";
    case "footnote": return "aside";
    default: return "p";
  }
}

function blocksToMarkup(blocks: ExtractedPdfBlock[]) {
  const pages = new Map<number, ExtractedPdfBlock[]>();
  blocks.forEach((block) => pages.set(block.page, [...(pages.get(block.page) ?? []), block]));
  return Array.from(pages.entries()).map(([page, pageBlocks]) => `
    <section class="source-page" data-source-page-section="${page}" aria-label="Page ${page}">
      ${pageBlocks.map((block) => {
        const tag = blockTag(block);
        return `<${tag} data-reader-block data-block-id="${escapeHtml(block.id)}" data-source-page="${block.page}">${escapeHtml(block.text)}</${tag}>`;
      }).join("\n")}
      <div class="page-divider"><span>Page ${page}</span></div>
    </section>`).join("\n");
}

const ReaderView = ({
  isActive = true,
  isLandscape,
  blocks,
  pageCount,
  sourcePageCount,
  destination,
  stationarySwitchHighlight,
  onPageChange,
  onPaginationChange,
  onPageMapChange,
  onSwitchAnchorChange,
  showSwitchHighlight = false,
  onReady,
  translationLanguage,
  onTranslationLanguageChange,
  useTranslatedTextDirection = false,
}: ReaderViewProps) => {
  const { height: windowHeight } = useWindowDimensions();
  const isDark = useColorScheme() === "dark";
  const [fontAssets] = useAssets([Lato_700Bold, SourceSans3_400Regular]);
  const [latoBoldBase64, setLatoBoldBase64] = useState<string | null>(null);
  const [sourceSansBase64, setSourceSansBase64] = useState<string | null>(null);
  const [activeItem, setActiveItem] =
    useState<ReaderBottomNavItem>("font");
  const [aiExpanded, setAiExpanded] = useState(false);
  const [backgroundSettingsTab, setBackgroundSettingsTab] = useState<
    "presets" | "font" | "background"
  >("presets");
  const [readerText, setReaderText] = useState("");
  const [ttsStartOffset, setTtsStartOffset] = useState(0);
  const speechStartOffsetRef = useRef(0);
  const readerLanguageCode = useTranslatedTextDirection
    ? translationLanguage?.code ?? "en"
    : "en";
  const readerDirection = useTranslatedTextDirection &&
    rightToLeftLanguageCodes.has(readerLanguageCode)
    ? "rtl"
    : "ltr";
  const ttsText = useMemo(
    () => readerText.trim() || blocks.map((block) => block.text).join("\n\n"),
    [blocks, readerText],
  );
  const [initialBlocks] = useState(() => {
    const firstPage = blocks[0]?.page ?? 1;
    return blocks.filter((block) => block.page < firstPage + 5);
  });
  const readerMarkup = useMemo(() => blocksToMarkup(initialBlocks), [initialBlocks]);
  const appendedBlockCount = useRef(initialBlocks.length);
  const sentBlockIds = useRef(new Set(initialBlocks.map((block) => block.id)));
  const lastSourcePageRef = useRef(1);
  const modeTextAnchorRef = useRef<{
    blockId: string;
    blockOffset: number;
    wordIndex: number;
  } | null>(null);
  const pendingPagerAnchorRef = useRef(false);
  const [currentSourcePage, setCurrentSourcePage] = useState(1);
  const [pagerModeDestination, setPagerModeDestination] = useState<{
    page: number;
    blockId?: string;
    searchMatchIndex?: number;
    switchHighlightOffset?: number;
    nonce: number;
  } | null>(null);
  const recoveryPageRef = useRef<number | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [appendPass, setAppendPass] = useState(0);
  const [highlightPickerVisible, setHighlightPickerVisible] = useState(false);
  const [selectedAIText, setSelectedAIText] = useState("");

  useEffect(() => {
    const latoUri = fontAssets?.[0]?.localUri;
    const sourceSansUri = fontAssets?.[1]?.localUri;
    if (!latoUri || !sourceSansUri) return;
    let cancelled = false;
    void Promise.all([
      FileSystem.readAsStringAsync(latoUri, {
        encoding: FileSystem.EncodingType.Base64,
      }),
      FileSystem.readAsStringAsync(sourceSansUri, {
        encoding: FileSystem.EncodingType.Base64,
      }),
    ]).then(([latoBase64, sourceBase64]) => {
      if (cancelled) return;
      setLatoBoldBase64(latoBase64);
      setSourceSansBase64(sourceBase64);
    });
    return () => {
      cancelled = true;
    };
  }, [fontAssets]);

  // Bottom Sheet reference
  const bottomSheetRef =
    useRef<BottomSheetRef>(null);

  useEffect(() => {
    if (isLandscape) {
      bottomSheetRef.current?.close();
    }
  }, [isLandscape]);
  // WebView reference
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (!webViewReady) return;
    const remaining = blocks.filter((block) => !sentBlockIds.current.has(block.id));
    const destinationBlocks = destination
      ? remaining.filter((block) => destination.blockId
          ? block.id === destination.blockId
          : block.page === destination.page)
      : [];
    const appended = destinationBlocks.length
      ? destinationBlocks.slice(0, 220)
      : remaining.slice(0, 220);
    const highestAvailablePage = blocks.reduce(
      (highest, block) => Math.max(highest, block.page),
      0,
    );
    const hasMore =
      highestAvailablePage < (sourcePageCount ?? pageCount) ||
      remaining.length > appended.length;
    if (!appended.length) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: "appendBlocks",
        html: "",
        hasMore,
      }));
      return;
    }
    webViewRef.current?.postMessage(JSON.stringify({
      type: "appendBlocks",
      html: blocksToMarkup(appended),
      hasMore,
    }));
    appended.forEach((block) => sentBlockIds.current.add(block.id));
    appendedBlockCount.current = blocks.length;
    if (remaining.length > appended.length) {
      const timer = setTimeout(() => setAppendPass((value) => value + 1), 45);
      return () => clearTimeout(timer);
    }
  }, [
    appendPass,
    blocks,
    destination,
    pageCount,
    sourcePageCount,
    webViewReady,
  ]);

  useEffect(() => {
    if (!webViewReady || !destination) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "goToSourcePage",
      ...destination,
    }));
  }, [destination, webViewReady]);
  const transition = useReaderSettingsStore((state) => state.transition);
  const { isPaged, syncPageTransition } = usePageTransition({
    webViewRef,
    transition,
  });

  const highlightSpokenWord = useCallback(
    (charIndex: number, charLength: number) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "ttsHighlight",
          charIndex,
          charLength,
        })
      );
    },
    []
  );

  const clearSpokenWordHighlight = useCallback(() => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: "ttsClearHighlight",
      })
    );
  }, []);

  useEffect(() => {
    if (!isAppleSpeechAvailable || !isActive) return;

    const subscriptions = [
      appleSpeech.addListener("speechBoundary", (event) => {
        highlightSpokenWord(
          speechStartOffsetRef.current + event.charIndex,
          event.charLength,
        );
      }),
      appleSpeech.addListener("speechFinished", () => {
        clearAppleSpeechSleepTimer();
        clearSpokenWordHighlight();
      }),
      appleSpeech.addListener("speechStopped", () => {
        clearAppleSpeechSleepTimer();
        clearSpokenWordHighlight();
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [clearSpokenWordHighlight, highlightSpokenWord, isActive]);

  const handleCustomMenuSelection = useCallback(
    (event: { nativeEvent: { key: string; selectedText?: string } }) => {
      if (event.nativeEvent.key === "highlight") {
        setHighlightPickerVisible(true);
        return;
      }
      if (event.nativeEvent.key === "askAI") {
        setSelectedAIText(event.nativeEvent.selectedText?.trim() ?? "");
        setActiveItem("ai");
        bottomSheetRef.current?.open(0);
      }
    },
    []
  );

  const applyHighlightColor = useCallback((color: string) => {
    setHighlightPickerVisible(false);
    webViewRef.current?.injectJavaScript(`
      window.__applyReaderHighlight?.(${JSON.stringify(color)});
      true;
    `);
  }, []);

  const fontSize = useReaderSettingsStore(
  (state) => state.fontSize
  );
  const fontFamily = useReaderSettingsStore(
    (state) => state.fontFamily
  );
  const lineHeight = useReaderSettingsStore(
  (state) => state.lineHeight
  );
  const paragraphSpacing = useReaderSettingsStore(
    (state) => state.paragraphSpacing
  );
  const letterSpacing = useReaderSettingsStore(
  (state) => state.letterSpacing
);

const wordSpacing = useReaderSettingsStore(
  (state) => state.wordSpacing
);

const bold = useReaderSettingsStore(
  (state) => state.bold
);

const automaticHyphenation = useReaderSettingsStore(
  (state) => state.automaticHyphenation
);

const configuredBackgroundColor = useReaderSettingsStore(
  (state) => state.backgroundColor
);

const configuredTextColor =
  useReaderSettingsStore(
    (state) => state.textColor
  );
const colorsCustomized = useReaderSettingsStore(
  (state) => state.colorsCustomized
);
const backgroundColor = isDark && !colorsCustomized
  ? "#151814"
  : configuredBackgroundColor;
const textColor = isDark && !colorsCustomized
  ? "#E5E8E1"
  : configuredTextColor;

  const lineGuideEnabled = useReaderSettingsStore(
    (state) => state.lineGuideEnabled
  );
  const setLineGuideEnabled = useReaderSettingsStore(
    (state) => state.setLineGuideEnabled
  );
  const wordGuideEnabled = useReaderSettingsStore(
    (state) => state.wordGuideEnabled
  );
  const setWordGuideEnabled = useReaderSettingsStore(
    (state) => state.setWordGuideEnabled
  );
  const guideBackgroundDimming = useReaderSettingsStore(
    (state) => state.guideBackgroundDimming
  );
  const readerGuideMode = lineGuideEnabled
    ? "line"
    : wordGuideEnabled
      ? "word"
      : null;

  useEffect(() => {
    if (!readerGuideMode) return;
    bottomSheetRef.current?.close();
  }, [readerGuideMode]);

  const moveLineGuide = useCallback((direction: 1 | -1) => {
    webViewRef.current?.injectJavaScript(
      `window.__moveReaderGuide?.(${direction}); true;`
    );
  }, []);

  const closeReaderGuide = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `window.__setReaderGuideMode?.(null); true;`
    );
    setLineGuideEnabled(false);
    setWordGuideEnabled(false);
  }, [setLineGuideEnabled, setWordGuideEnabled]);

  const handlePagerPageChange = useCallback((
    current: number,
    total: number,
    sourcePage: number,
    anchor?: { blockId: string; blockOffset: number; wordIndex: number },
  ) => {
    lastSourcePageRef.current = sourcePage;
    if (anchor) {
      modeTextAnchorRef.current = anchor;
      const block = blocks.find((candidate) => candidate.id === anchor.blockId);
      const word = block
        ? Array.from(block.text.matchAll(/\S+/g))[anchor.wordIndex]?.[0] ?? ""
        : "";
      onSwitchAnchorChange?.(anchor.blockId, word, anchor.wordIndex);
    }
    setCurrentSourcePage(sourcePage);
    onPaginationChange?.(current, total);
    onPageChange?.(sourcePage);
  }, [blocks, onPageChange, onPaginationChange, onSwitchAnchorChange]);

  const previousPagedModeRef = useRef(isPaged);
  useEffect(() => {
    const wasPaged = previousPagedModeRef.current;
    previousPagedModeRef.current = isPaged;
    if (!wasPaged && isPaged) {
      pendingPagerAnchorRef.current = true;
      webViewRef.current?.injectJavaScript(
        `window.__reportSwitchAnchor?.(true); true;`,
      );
      const timer = setTimeout(() => {
        if (!pendingPagerAnchorRef.current) return;
        pendingPagerAnchorRef.current = false;
        const anchor = modeTextAnchorRef.current;
        setPagerModeDestination({
          page: Math.max(1, lastSourcePageRef.current),
          blockId: anchor?.blockId,
          searchMatchIndex: anchor?.blockOffset,
          switchHighlightOffset: anchor?.blockOffset,
          nonce: Date.now(),
        });
      }, 300);
      return () => clearTimeout(timer);
    }
    if (!wasPaged || isPaged || !webViewReady) return;

    const sourcePage = Math.max(1, lastSourcePageRef.current);
    const anchor = modeTextAnchorRef.current;
    onPaginationChange?.(sourcePage, pageCount);
    onPageChange?.(sourcePage);
    const timer = setTimeout(() => {
      webViewRef.current?.postMessage(JSON.stringify({
        type: "goToSourcePage",
        page: sourcePage,
        blockId: anchor?.blockId,
        switchHighlightWordIndex: anchor?.wordIndex,
      }));
    }, 0);
    return () => clearTimeout(timer);
  }, [isPaged, onPageChange, onPaginationChange, pageCount, webViewReady]);

  const effectivePagerDestination = useMemo(() => {
    if (isPaged && !previousPagedModeRef.current) {
      const anchor = modeTextAnchorRef.current;
      return {
        page: Math.max(1, currentSourcePage),
        blockId: anchor?.blockId,
        searchMatchIndex: anchor?.blockOffset,
        switchHighlightOffset: anchor?.blockOffset,
        nonce: Number.MAX_SAFE_INTEGER,
      };
    }
    if (!pagerModeDestination) return destination;
    if (!destination) return pagerModeDestination;
    return destination.nonce > pagerModeDestination.nonce
      ? destination
      : pagerModeDestination;
  }, [currentSourcePage, destination, isPaged, pagerModeDestination]);


  const sendReaderSettings = useCallback(() => {
    webViewRef.current?.postMessage(
    JSON.stringify({
      type: 'readerSettings',
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      paragraphSpacing: paragraphSpacing,
      letterSpacing: letterSpacing,
      wordSpacing: wordSpacing,
      bold: bold,
      automaticHyphenation: automaticHyphenation,
      backgroundColor: backgroundColor,
      textColor: textColor,
    })
    );
  }, [fontFamily, fontSize, lineHeight, paragraphSpacing, letterSpacing, wordSpacing, bold, automaticHyphenation, backgroundColor, textColor]);

  useEffect(() => {
    sendReaderSettings();
  }, [sendReaderSettings]);

  useEffect(() => {
    if (!webViewReady) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setSwitchHighlightVisible",
      visible: showSwitchHighlight,
    }));
  }, [showSwitchHighlight, webViewReady]);

  useEffect(() => {
    if (!webViewReady) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setReaderGuideMode",
      mode: readerGuideMode,
    }));
  }, [readerGuideMode, webViewReady]);

  useEffect(() => {
    if (!webViewReady) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setGuideBackgroundDimming",
      percentage: guideBackgroundDimming,
    }));
  }, [guideBackgroundDimming, webViewReady]);

  const handleReaderLoadEnd = useCallback(() => {
    setWebViewReady(true);
    onReady?.();
    sendReaderSettings();
    syncPageTransition();
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setSwitchHighlightVisible",
      visible: showSwitchHighlight,
    }));
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setReaderGuideMode",
      mode: readerGuideMode,
    }));
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setGuideBackgroundDimming",
      percentage: guideBackgroundDimming,
    }));
    const recoveryPage = recoveryPageRef.current;
    if (recoveryPage !== null) {
      recoveryPageRef.current = null;
      setTimeout(() => {
        webViewRef.current?.postMessage(JSON.stringify({
          type: "goToSourcePage",
          page: recoveryPage,
        }));
      }, 0);
    }
  }, [guideBackgroundDimming, onReady, readerGuideMode, sendReaderSettings, showSwitchHighlight, syncPageTransition]);
  // Toolbar animation
  const [toolbarTranslateY] = useState(() => new Animated.Value(0));

  // Previous scroll position
  const lastScrollY =
    useRef(0);

  // Track toolbar visibility
  const toolbarHidden =
    useRef(false);

  // Prevent multiple animations from running
  const toolbarAnimation =
    useRef<Animated.CompositeAnimation | null>(null);

  // --------------------------------
  // HTML READER
  // --------------------------------

  const htmlContent = useMemo(() => `
    <!DOCTYPE html>

    <html lang="${readerLanguageCode}" dir="${readerDirection}">

      <head>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />

        <style>

          @font-face {
            font-family: 'LatoReaderBold';
            src: url('data:font/ttf;base64,${latoBoldBase64 ?? ""}') format('truetype');
            font-style: normal;
            font-weight: 700;
            font-display: block;
          }

          @font-face {
            font-family: 'SourceSansReader';
            src: url('data:font/ttf;base64,${sourceSansBase64 ?? ""}') format('truetype');
            font-style: normal;
            font-weight: 400;
            font-display: block;
          }

          * {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
          }

          :root {
            --paragraph-spacing: 0.65em;
            --reader-side-padding: clamp(24px, 5vw, 32px);
          }

          html,
          body {
            margin: 0;
            padding: 0;

            background-color: #f8fafc;

            width: 100%;
            min-height: 100%;

            overscroll-behavior-y: auto;
            touch-action: pan-y;
          }

          body {
            padding: 24px var(--reader-side-padding);
            padding-bottom: 160px;

            color: #1e293b;

            font-family: 'SourceSansReader', Arial, sans-serif;

            font-size: 18px;

            line-height: 1.6;

            /*
             * Allow text selection.
             */
            -webkit-user-select: text;
            user-select: text;

            /*
             * Allow the native selection menu.
             */
            -webkit-touch-callout: default;

            /*
             * Improve text rendering.
             */
            -webkit-font-smoothing: antialiased;

            /*
             * Prevent accidental horizontal scrolling.
             */
            overflow-x: hidden;
          }

          html[dir="rtl"] body {
            direction: rtl;
            text-align: right;
          }

          html[dir="rtl"] [data-reader-block] {
            direction: rtl;
            text-align: right;
            unicode-bidi: plaintext;
          }

          html[dir="rtl"] li {
            margin-right: 1.2em;
            margin-left: 0;
          }

          html.reader-paged,
          html.reader-paged body {
            width: 100%;
            height: 100%;
            min-height: 100%;
            overflow: hidden;
            overscroll-behavior: none;
          }

          body.reader-paged {
            padding: 20px var(--reader-side-padding);
            padding-bottom: 20px;
          }

          #reader-pages {
            min-height: 100%;
            margin-inline: auto;
            max-width: 680px;
          }

          #reader-pages.reader-paged {
            height: 100%;
            min-height: 0;
            margin-inline: 0;
            max-width: none;
            column-width: calc(100vw - var(--reader-side-padding) - var(--reader-side-padding));
            column-gap: calc(var(--reader-side-padding) + var(--reader-side-padding));
            column-fill: auto;
            transform-style: preserve-3d;
            backface-visibility: hidden;
            will-change: transform, opacity;
          }
          p {
            margin: 0 0 var(--paragraph-spacing);
            orphans: 3;
            widows: 3;
          }
          h1 {
            font-size: 1.7em;
            font-weight: inherit;
            line-height: 1.18;
            margin: 0 0 0.7em;
            break-after: avoid;
            -webkit-column-break-after: avoid;
          }
          h2 {
            font-size: 1.3em;
            font-weight: inherit;
            line-height: 1.25;
            margin: 1.5em 0 0.55em;
            break-after: avoid;
            -webkit-column-break-after: avoid;
          }
          li {
            margin: 0 0 0.45em 1.2em;
          }
          aside {
            font-size: 0.82em;
            line-height: 1.45;
            opacity: 0.78;
            margin-bottom: 1em;
          }
          .source-page { position: relative; }
          .page-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            clear: both;
            margin: 34px 0 30px;
            color: rgba(71, 85, 105, 0.65);
            font-size: 12px;
            white-space: nowrap;
          }
          .page-divider::before, .page-divider::after {
            content: '';
            height: 1px;
            flex: 1;
            background: rgba(100, 116, 139, 0.25);
          }
          body.reader-paged .page-divider { display: none; }
          #reader-loader {
            padding: 28px 12px 150px;
            color: rgba(71, 85, 105, 0.7);
            font-size: 13px;
            text-align: center;
          }
          body.reader-paged #reader-loader { display: none; }
          .tts-word-active {
            background-color: #fde047;
            border-radius: 4px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            padding: 1px 2px;
            margin: 0 -2px;
          }
          .reader-user-highlight {
            background-color: #fde68a;
            border-radius: 3px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            padding: 1px 0;
          }
          .reader-search-highlight {
            border-radius: 3px;
            background-color: #facc15;
            color: inherit;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            padding: 1px 2px;
            margin: 0 -2px;
          }
          #reader-switch-highlight {
            position: absolute;
            z-index: 12;
            border-radius: 3px;
            background-color: rgba(250, 204, 21, 0.62);
            pointer-events: none;
          }
          #reader-line-guide,
          #reader-word-guide {
            display: none;
            position: fixed;
            z-index: 30;
            pointer-events: none;
            border-radius: 4px;
            background: rgba(245, 158, 11, 0.3);
            box-shadow:
              0 0 0 9999px color-mix(
                in srgb,
                var(--reader-background, #f8fafc) var(--guide-dimming, 60%),
                transparent
              ),
              inset 0 0 0 1px rgba(217, 119, 6, 0.38);
            transition: left 90ms ease, top 90ms ease, width 90ms ease, height 90ms ease;
          }

          /*
           * Text selection highlight.
           */
          ::selection {
            background-color: #93c5fd;
            color: #1e293b;
          }

          /*
           * Remove selection highlight on elements
           * that aren't text.
           */
          img,
          button {
            -webkit-user-select: none;
            user-select: none;
          }

        </style>

      </head>

      <body>

        <div id="reader-line-guide" aria-hidden="true"></div>
        <div id="reader-word-guide" aria-hidden="true"></div>
        <main id="reader-pages">
          ${readerMarkup}
        </main>
        <div id="reader-loader">Scroll down to load more pages</div>


        <script>
  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'appendBlocks') {
        const container = document.getElementById('reader-pages');
        if (!container) return;
        const viewportAnchor = document
          .elementFromPoint(Math.max(1, window.innerWidth / 2), 12)
          ?.closest?.('[data-source-page-section]');
        const anchorTop = viewportAnchor?.getBoundingClientRect().top;
        if (message.html) {
          const template = document.createElement('template');
          template.innerHTML = message.html;
          Array.from(template.content.children).forEach(function(section) {
            const page = Number(section.dataset.sourcePageSection);
            const next = Array.from(container.children).find(function(candidate) {
              return Number(candidate.dataset.sourcePageSection) > page;
            });
            container.insertBefore(section, next || null);
          });
        }
        if (viewportAnchor && Number.isFinite(anchorTop)) {
          const nextAnchorTop = viewportAnchor.getBoundingClientRect().top;
          const insertedOffset = nextAnchorTop - anchorTop;
          if (Math.abs(insertedOffset) > 0.5) {
            window.scrollBy({ top: insertedOffset, left: 0, behavior: 'auto' });
          }
        }
        window.__readerHasMore = Boolean(message.hasMore);
        const loader = document.getElementById('reader-loader');
        if (loader) {
          loader.textContent = !window.__readerHasMore
            ? 'End of book'
            : 'Preparing the rest of the book…';
        }
        if (
          window.__readerTransition !== 'scroll' &&
          window.__refreshReaderPages
        ) {
          requestAnimationFrame(window.__refreshReaderPages);
        }
        window.__tryPendingSourceDestination?.();
        return;
      }

      if (message.type === 'setSwitchHighlightVisible') {
        window.__showReaderSwitchHighlight = Boolean(message.visible);
        if (!window.__showReaderSwitchHighlight) {
          window.__clearReaderSwitchHighlight?.();
        } else {
          window.__reportSwitchAnchor?.();
        }
        return;
      }

      if (message.type === 'setReaderGuideMode') {
        window.__setReaderGuideMode?.(message.mode);
        return;
      }

      if (message.type === 'setGuideBackgroundDimming') {
        const percentage = Math.max(0, Math.min(90, Number(message.percentage) || 0));
        document.documentElement.style.setProperty(
          '--guide-dimming',
          percentage + '%'
        );
        return;
      }

      if (message.type === 'moveLineGuide') {
        window.__moveLineGuide?.(message.direction < 0 ? -1 : 1);
        return;
      }

      if (message.type === 'requestReaderText') {
        const allBlocks = Array.from(
          document.querySelectorAll('[data-reader-block]')
        );
        let offset = 0;
        const allText = allBlocks.map(function(block) {
          const text = (block.textContent || '').trim();
          block.dataset.ttsStart = String(offset);
          block.dataset.ttsEnd = String(offset + text.length);
          offset += text.length + 2;
          return text;
        }).join('\\n\\n');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'readerText',
          text: allText
        }));
        window.__reportSwitchAnchor?.();
        return;
      }

      if (message.type === 'pageNavigate') {
        if (window.__navigateReaderPage) {
          window.__navigateReaderPage(message.direction);
        }
        return;
      }
      window.__tryPendingSourceDestination = window.__tryPendingSourceDestination || function() {
        const pending = window.__pendingSourceDestination;
        if (!pending) return;
        const block = pending.blockId
          ? document.querySelector('[data-block-id="' + CSS.escape(pending.blockId) + '"]')
          : null;
        const target = block || document.querySelector('[data-source-page-section="' + pending.page + '"]');
        let resolvedTarget = target;
        if (!resolvedTarget && window.__readerHasMore === false) {
          const sections = Array.from(
            document.querySelectorAll('[data-source-page-section]')
          );
          resolvedTarget = sections.find(function(section) {
            return Number(section.dataset.sourcePageSection) >= Number(pending.page);
          }) || sections[sections.length - 1];
        }
        if (!resolvedTarget) return;
        window.__pendingSourceDestination = null;
        const searchHighlight = window.__highlightReaderSearch?.(
          resolvedTarget,
          pending.searchQuery,
          pending.searchMatchIndex
        );
        const destinationTarget = searchHighlight || resolvedTarget;
        if (window.__readerTransition === 'scroll') {
          window.__pinnedSourcePage = Number(pending.page);
          destinationTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
          requestAnimationFrame(function() {
            window.__reportSourcePage?.(pending.page);
          });
        } else if (window.__goToElementPage) {
          window.__goToElementPage(destinationTarget);
        }
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            window.__reportSwitchAnchor?.();
          });
        });
        setTimeout(function() {
          window.__reportSwitchAnchor?.();
          const hasSwitchTarget =
            pending.switchHighlightWordIndex !== undefined ||
            pending.switchHighlightWordProgress !== undefined ||
            Boolean(pending.switchHighlightQuery);
          if (hasSwitchTarget) {
            window.__highlightSwitchWordAtIndex?.(
              resolvedTarget,
              pending.switchHighlightWordIndex,
              pending.switchHighlightWordProgress,
              pending.switchHighlightQuery
            );
          } else {
            window.__clearReaderSwitchHighlight?.();
          }
        }, 100);
      };
      if (message.type === 'goToSourcePage') {
        window.__pendingSourceDestination = message;
        window.__tryPendingSourceDestination();
        return;
      }
      if (message.type === 'pageTransition') {
        if (window.__applyReaderTransition) {
          window.__applyReaderTransition(message.transition, true);
        }
        return;
      }
       if (message.type === 'ttsHighlight') {
         const readerBlocks = Array.from(
           document.querySelectorAll('[data-reader-block]')
         );
         let targetBlock = readerBlocks.find(function(block) {
           const start = Number(block.dataset.ttsStart);
           const end = Number(block.dataset.ttsEnd);
           return message.charIndex >= start && message.charIndex < end;
         });
         if (!targetBlock) {
           targetBlock = readerBlocks.find(function(block) {
             return Number(block.dataset.ttsStart) >= message.charIndex;
           }) || readerBlocks[readerBlocks.length - 1];
         }

         if (targetBlock && window.__activeTtsBlock !== targetBlock) {
           if (window.__activeTtsBlock) {
             const previousText = window.__activeTtsBlock.textContent || '';
             window.__activeTtsBlock.replaceChildren(
               document.createTextNode(previousText)
             );
           }

           const blockText = targetBlock.textContent || '';
           const blockStart = Number(targetBlock.dataset.ttsStart);
           const fragment = document.createDocumentFragment();
           const wordPattern = /\\S+/g;
           let cursor = 0;
           let match;

           while ((match = wordPattern.exec(blockText)) !== null) {
             if (match.index > cursor) {
               fragment.appendChild(
                 document.createTextNode(blockText.slice(cursor, match.index))
               );
             }

             const word = document.createElement('span');
             word.textContent = match[0];
             word.dataset.ttsStart = String(blockStart + match.index);
             word.dataset.ttsEnd = String(
               blockStart + match.index + match[0].length
             );
             fragment.appendChild(word);
             cursor = match.index + match[0].length;
           }

           if (cursor < blockText.length) {
             fragment.appendChild(
               document.createTextNode(blockText.slice(cursor))
             );
           }

           targetBlock.replaceChildren(fragment);
           window.__activeTtsBlock = targetBlock;
         }

         const words = targetBlock
           ? Array.from(targetBlock.querySelectorAll('[data-tts-start]'))
           : [];
        let activeWord = words.find(function(word) {
          const start = Number(word.dataset.ttsStart);
          const end = Number(word.dataset.ttsEnd);

          return message.charIndex >= start && message.charIndex < end;
        });
        if (!activeWord && words.length) {
          activeWord = words.find(function(word) {
            return Number(word.dataset.ttsStart) >= message.charIndex;
          }) || words[words.length - 1];
        }

        document
          .querySelector('.tts-word-active')
          ?.classList.remove('tts-word-active');

        if (activeWord) {
          activeWord.classList.add('tts-word-active');

          const bounds = activeWord.getBoundingClientRect();

          if (
            window.__readerTransition !== 'scroll' &&
            window.__goToReaderPage
          ) {
            const wordDocumentLeft =
              bounds.left +
              (window.__readerCurrentPage || 0) * window.innerWidth;
            const wordPage = Math.floor(
              wordDocumentLeft / window.innerWidth
            );
            window.__goToReaderPage(wordPage);
          } else {
            const isNearBottom =
              bounds.bottom > window.innerHeight * 0.78;
            const isAboveView =
              bounds.top < window.innerHeight * 0.12;

            if (isNearBottom || isAboveView) {
              const nextScrollTop =
                window.scrollY + bounds.top - window.innerHeight * 0.3;
              if (window.__ttsScrollFrame) {
                cancelAnimationFrame(window.__ttsScrollFrame);
              }
              window.__ttsScrollFrame = requestAnimationFrame(function() {
                window.scrollTo({
                  top: nextScrollTop,
                  behavior: 'auto'
                });
                window.__ttsScrollFrame = null;
              });
            }
          }
        }
        return;
      }

      if (message.type === 'ttsClearHighlight') {
        if (window.__ttsScrollFrame) {
          cancelAnimationFrame(window.__ttsScrollFrame);
          window.__ttsScrollFrame = null;
        }
        document
          .querySelector('.tts-word-active')
          ?.classList.remove('tts-word-active');
        return;
      }
      if (message.type === 'readerSettings') {

        const anchorElement = document.elementFromPoint(
          window.innerWidth / 2,
          window.innerHeight * 0.3
        )?.closest?.('[data-reader-block]');
        const anchorTop = anchorElement?.getBoundingClientRect().top || 0;

        document.body.style.fontFamily = message.fontFamily === 'Lato_700Bold'
          ? 'LatoReaderBold'
          : message.fontFamily === 'SourceSans3_400Regular'
            ? 'SourceSansReader'
            : message.fontFamily;

        document.body.style.fontSize =
          message.fontSize + 'px';

        document.body.style.lineHeight =
          message.lineHeight;

        document.documentElement.style.setProperty(
          '--paragraph-spacing',
          message.paragraphSpacing + 'em'
        );

        document.body.style.letterSpacing =
          message.letterSpacing + 'px';

        document.body.style.wordSpacing =
          message.wordSpacing + 'px';

        document.body.style.fontWeight =
          message.bold ? 'bold' : 'normal';

        document.body.style.hyphens =
          message.automaticHyphenation ? 'auto' : 'manual';
        document.body.style.webkitHyphens =
          message.automaticHyphenation ? 'auto' : 'manual';

        document.body.style.backgroundColor =
          message.backgroundColor;

        document.documentElement.style.backgroundColor =
          message.backgroundColor;

        document.documentElement.style.setProperty(
          '--reader-background',
          message.backgroundColor
        );
        
        document.body.style.color =
          message.textColor;

        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            if (window.__readerTransition !== 'scroll') {
              window.__refreshReaderPages?.();
            }
            if (anchorElement) {
              if (window.__readerTransition === 'scroll') {
                const nextTop = anchorElement.getBoundingClientRect().top;
                window.scrollBy(0, nextTop - anchorTop);
              } else {
                window.__goToElementPage?.(anchorElement);
              }
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'settingsApplied'
            }));
          });
        });
        return;
      }

    } catch (error) {
      console.error(
        'Error processing message:',
        error
      );
    }
  }

  document.addEventListener(
    'message',
    handleMessage
  );

  window.addEventListener(
    'message',
    handleMessage
  );

  window.__applyReaderHighlight = function(color) {
    const selection = window.getSelection();
    const liveRange = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null;
    const range = liveRange && !liveRange.collapsed
      ? liveRange.cloneRange()
      : window.__readerSelectionRange;

    if (!range || range.collapsed) return;

    const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = root.nodeType === Node.TEXT_NODE ? root : walker.nextNode();

    while (node) {
      if (
        range.intersectsNode(node) &&
        !node.parentElement?.closest('.reader-user-highlight')
      ) {
        textNodes.push(node);
      }
      node = walker.nextNode();
    }

    textNodes.reverse().forEach(function(textNode) {
      const start = textNode === range.startContainer ? range.startOffset : 0;
      const end = textNode === range.endContainer
        ? range.endOffset
        : (textNode.textContent || '').length;
      if (start >= end) return;

      const highlightRange = document.createRange();
      highlightRange.setStart(textNode, start);
      highlightRange.setEnd(textNode, end);
      const marker = document.createElement('mark');
      marker.className = 'reader-user-highlight';
      marker.style.backgroundColor = color || '#fde68a';
      highlightRange.surroundContents(marker);
    });

    selection?.removeAllRanges();
    window.__readerSelectionRange = null;
  };
</script>
      </body>

    </html>
  `, [latoBoldBase64, readerDirection, readerLanguageCode, readerMarkup, sourceSansBase64]);

  const webViewSource = useMemo(() => ({ html: htmlContent }), [htmlContent]);

  // --------------------------------
  // SHOW / HIDE TOOLBAR
  // --------------------------------

  const showToolbar = useCallback(() => {
    if (!toolbarHidden.current) {
      return;
    }

    toolbarHidden.current = false;

    toolbarAnimation.current?.stop();

    toolbarAnimation.current =
      Animated.timing(
        toolbarTranslateY,
        {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }
      );

    toolbarAnimation.current.start();
  }, [toolbarTranslateY]);

  const hideToolbar = useCallback(() => {
    if (toolbarHidden.current) {
      return;
    }

    toolbarHidden.current = true;

    toolbarAnimation.current?.stop();

    toolbarAnimation.current =
      Animated.timing(
        toolbarTranslateY,
        {
          toValue: 120,
          duration: 250,
          useNativeDriver: true,
        }
      );

    toolbarAnimation.current.start();
  }, [toolbarTranslateY]);

  // --------------------------------
  // WEBVIEW MESSAGE HANDLER
  // --------------------------------

  const handleWebViewMessage = (
    event: any
  ) => {
    try {
      const data =
        JSON.parse(
          event.nativeEvent.data
        );

      // ------------------------------
      // SCROLL
      // ------------------------------

      if (data.type === "scroll") {

        if (typeof data.sourcePage === "number") {
          lastSourcePageRef.current = data.sourcePage;
          setCurrentSourcePage(data.sourcePage);
          if (!isPaged) {
            onPageChange?.(data.sourcePage);
            onPaginationChange?.(data.sourcePage, pageCount);
          }
        }

        const currentScrollY =
          data.scrollY;

        const difference =
          currentScrollY -
          lastScrollY.current;

        /*
         * Ignore tiny movements.
         */
        if (Math.abs(difference) < 8) {
          return;
        }

        /*
         * Scrolling DOWN
         */
        if (
          difference > 0 &&
          currentScrollY > 30
        ) {
          hideToolbar();
        }

        /*
         * Scrolling UP
         */
        else if (difference < 0) {
          showToolbar();
        }

        lastScrollY.current =
          currentScrollY;

        return;
      }

      // ------------------------------
      // TEXT SELECTION
      // ------------------------------

      if (data.type === "selection") {

        console.log(
          "Selected text:",
          data.text
        );

        return;
      }

      if (data.type === "readerText") {
        setReaderText(typeof data.text === "string" ? data.text : "");
        return;
      }

      if (data.type === "sourcePage" && typeof data.page === "number") {
        lastSourcePageRef.current = data.page;
        setCurrentSourcePage(data.page);
        if (!isPaged) {
          onPageChange?.(data.page);
          onPaginationChange?.(data.page, pageCount);
        }
        return;
      }


      if (data.type === "askAI") {
        setSelectedAIText(typeof data.text === "string" ? data.text.trim() : "");
        setActiveItem("ai");
        bottomSheetRef.current?.open(0);
        return;
      }

      if (data.type === "switchAnchor" && typeof data.blockId === "string") {
        const wordIndex = typeof data.wordIndex === "number"
          ? Math.max(0, data.wordIndex)
          : 0;
        const sourceBlock = blocks.find((block) => block.id === data.blockId);
        const wordAtIndex = sourceBlock
          ? Array.from(sourceBlock.text.matchAll(/\S+/g))[wordIndex]
          : undefined;
        const blockOffset = typeof data.blockOffset === "number"
          ? data.blockOffset
          : wordAtIndex?.index;
        if (blockOffset !== undefined) {
          modeTextAnchorRef.current = {
            blockId: data.blockId,
            blockOffset,
            wordIndex,
          };
          if (pendingPagerAnchorRef.current) {
            pendingPagerAnchorRef.current = false;
            setPagerModeDestination({
              page: Math.max(1, sourceBlock?.page ?? lastSourcePageRef.current),
              blockId: data.blockId,
              searchMatchIndex: blockOffset,
              switchHighlightOffset: blockOffset,
              nonce: Date.now(),
            });
          }
        }
        if (typeof data.ttsOffset === "number") {
          setTtsStartOffset(Math.max(0, data.ttsOffset));
        }
        onSwitchAnchorChange?.(
          data.blockId,
          typeof data.word === "string" ? data.word : "",
          typeof data.wordIndex === "number" ? data.wordIndex : 0,
        );
        return;
      }

    } catch (error) {

      console.log(
        "WebView message error:",
        error
      );

    }
  };

  useEffect(() => {
    if (isPaged) {
      hideToolbar();
    } else {
      showToolbar();
    }
  }, [hideToolbar, isPaged, showToolbar]);

  useEffect(() => {
    if (!isActive || isPaged || pageCount < 1) return;
    onPaginationChange?.(
      Math.max(1, Math.min(currentSourcePage, pageCount)),
      pageCount,
    );
  }, [currentSourcePage, isActive, isPaged, onPaginationChange, pageCount]);

  // --------------------------------
  // TOOLBAR BUTTON
  // --------------------------------

  const handleToolbarPress = (
    item: ReaderBottomNavItem
  ) => {

    /*
     * Update selected toolbar item.
     */
    setActiveItem(item);

    if (item === "ai") {
      setAiExpanded(false);
    }

    if (item === "tts") {
      webViewRef.current?.postMessage(JSON.stringify({ type: "requestReaderText" }));
    }

    /*
     * Make sure toolbar is visible
     * when user interacts with it.
     */
    showToolbar();

    /*
     * Open Bottom Sheet.
     */
    bottomSheetRef.current?.open(0);
  };

  // --------------------------------
  // BOTTOM SHEET CONTENT
  // --------------------------------

  const renderBottomSheetContent = () => {

    switch (activeItem) {

      case "font":
        return <FontSettings />;

      case "background":
        return (
          <BackgroundSettings
            onSelectedTypeChange={setBackgroundSettingsTab}
          />
        );

      case "tts":
        return (
          <TTS
            text={ttsText}
            startOffset={ttsStartOffset}
            onSpeechStartOffsetChange={(offset) => {
              speechStartOffsetRef.current = offset;
            }}
            onClearHighlight={clearSpokenWordHighlight}
            translationLanguage={translationLanguage}
            onTranslationLanguageChange={(language) =>
              onTranslationLanguageChange?.(language)
            }
          />
        );

      case "ai":
        return (
          <AI
            selectedText={selectedAIText}
            currentPage={currentSourcePage}
            pageCount={pageCount}
            blocks={blocks}
            isExpanded={aiExpanded}
            onComposerActive={(reason) => {
              setAiExpanded(true);
              if (reason === "suggestion") {
                requestAnimationFrame(() => {
                  bottomSheetRef.current?.snapToIndex(1);
                });
              }
            }}
          />
        );

      case "settings":
        return <Settings />;

      default:
        return null;
    }

  };

  const usesFixedSettingsSheet =
    activeItem === "tts" ||
    (activeItem === "background" && backgroundSettingsTab !== "presets");

  const bottomSheetSnapPoints =
    activeItem === "ai"
      ? ["40%", "90%"]
      : activeItem === "font"
      ? ["40%", "82%"]
      : usesFixedSettingsSheet
        ? ["40%"]
        : ["40%", "82%"];

  if (!latoBoldBase64 || !sourceSansBase64) {
    return <View style={{ flex: 1, backgroundColor }} />;
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      defaultSnapIndex={0}
    >

      <View className="flex-1">

        <Modal
          animationType="fade"
          transparent
          visible={highlightPickerVisible}
          onRequestClose={() => setHighlightPickerVisible(false)}
        >
          <Pressable
            accessibilityLabel="Close highlight color picker"
            onPress={() => setHighlightPickerVisible(false)}
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Pressable
              accessibilityRole="menu"
              onPress={(event) => event.stopPropagation()}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 30,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.85)",
                backgroundColor: "rgba(248, 250, 252, 0.96)",
                shadowColor: "#000000",
                shadowOpacity: 0.22,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
              }}
            >
              <View style={{ flexDirection: "row", gap: 14 }}>
                {highlightColors.map((color, index) => (
                  <Pressable
                    key={color}
                    accessibilityLabel={`Highlight color ${index + 1}`}
                    accessibilityRole="menuitem"
                    onPress={() => applyHighlightColor(color)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "rgba(15, 23, 42, 0.08)",
                      backgroundColor: color,
                    }}
                  />
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ========================= */}
        {/* HTML READER */}
        {/* ========================= */}

        <SafeAreaView
          edges={isLandscape ? ["left", "right"] : []}
          style={{ flex: 1, backgroundColor }}
        >
          <View className="flex-1">
          {isPaged && (
            <View style={StyleSheet.absoluteFill}>
              <HorizontalReaderPager
                blocks={blocks}
                destination={effectivePagerDestination}
                stationarySwitchHighlight={stationarySwitchHighlight}
                fontFamily={fontFamily.split(",")[0].replaceAll("'", "").trim()}
                fontSize={fontSize}
                lineHeight={lineHeight}
                paragraphSpacing={paragraphSpacing}
                letterSpacing={letterSpacing}
                wordSpacing={wordSpacing}
                bold={bold}
                automaticHyphenation={automaticHyphenation}
                backgroundColor={backgroundColor}
                textColor={textColor}
                onPageChange={handlePagerPageChange}
                onPageMapChange={onPageMapChange}
                onReaderTap={() => {
                  if (toolbarHidden.current) {
                    showToolbar();
                  } else {
                    hideToolbar();
                  }
                }}
                onSwipeStart={hideToolbar}
              />
            </View>
          )}
          <View
            pointerEvents={isPaged ? "none" : "auto"}
            style={[StyleSheet.absoluteFill, { opacity: isPaged ? 0 : 1 }]}
          >
          <WebView
            ref={webViewRef}

          source={webViewSource}

          style={{
            flex: 1,
            backgroundColor,
          }}

          onLoadEnd={handleReaderLoadEnd}

          onContentProcessDidTerminate={() => {
            recoveryPageRef.current = lastSourcePageRef.current;
            appendedBlockCount.current = initialBlocks.length;
            sentBlockIds.current = new Set(initialBlocks.map((block) => block.id));
            setWebViewReady(false);
            webViewRef.current?.reload();
          }}

          /*
           * Native scrolling.
           */
          scrollEnabled={!isPaged}

          /*
           * Native bounce behavior.
           */
          bounces={!isPaged}

          /*
           * Smooth iOS scrolling.
           */
          decelerationRate="normal"

          /*
           * Android overscroll.
           */
          overScrollMode={isPaged ? "never" : "always"}

          showsVerticalScrollIndicator={!isPaged}

          /*
           * JavaScript required for:
           * - scroll detection
           * - text selection
           */
          javaScriptEnabled={true}

          /*
           * Keep WebView content from navigating
           * unexpectedly.
           */
          onShouldStartLoadWithRequest={() => {
            return true;
          }}

          /*
           * Receive messages from HTML.
           */
          onMessage={
            handleWebViewMessage
          }

          menuItems={readerMenuItems}

          onCustomMenuSelection={handleCustomMenuSelection}

          /*
           * Injected JavaScript.
           */
          injectedJavaScript={`
            (function() {

              /*
               * Prevent this script from being
               * installed multiple times.
               */
              if (window.__readerInitialized) {
                return;
              }

              window.__readerInitialized = true;
              window.__readerHasMore = true;
              window.__showReaderSwitchHighlight = false;
              const paragraphs = Array.from(
                document.querySelectorAll('[data-reader-block]')
              );
              const paragraphTexts = paragraphs.map(function(paragraph) {
                return (paragraph.textContent || '').trim();
              });
              const readerText = paragraphTexts.join('\\n\\n');

              const readerPages = document.getElementById('reader-pages');

              let globalOffset = 0;

              paragraphs.forEach(function(paragraph, paragraphIndex) {
                const paragraphText = paragraphTexts[paragraphIndex];
                paragraph.dataset.ttsStart = String(globalOffset);
                paragraph.dataset.ttsEnd = String(
                  globalOffset + paragraphText.length
                );
                globalOffset += paragraphText.length + 2;
              });

              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  type: 'readerText',
                  text: readerText
                })
              );


              let lastSwitchAnchorKey = null;
              function clearReaderSwitchHighlight() {
                document.getElementById('reader-switch-highlight')?.remove();
              }
              window.__clearReaderSwitchHighlight = clearReaderSwitchHighlight;

              function drawReaderSwitchHighlight(range) {
                clearReaderSwitchHighlight();
                if (!range) return;
                const rect = Array.from(range.getClientRects()).find(function(item) {
                  return item.width > 0 && item.height > 0;
                });
                if (!rect) return;
                const marker = document.createElement('div');
                marker.id = 'reader-switch-highlight';
                marker.style.left = (rect.left + window.scrollX) + 'px';
                marker.style.top = (rect.top + window.scrollY) + 'px';
                marker.style.width = rect.width + 'px';
                marker.style.height = rect.height + 'px';
                document.body.appendChild(marker);
              }

              window.__highlightSwitchWordAtIndex = function(
                block,
                wordIndex,
                wordProgress,
                translatedQuery
              ) {
                if (!block) return;
                const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                const words = [];
                let textNode = walker.nextNode();
                while (textNode) {
                  const text = textNode.textContent || '';
                  Array.from(text.matchAll(/\\S+/g)).forEach(function(match) {
                    words.push({ node: textNode, match: match });
                  });
                  textNode = walker.nextNode();
                }
                if (!words.length) return;

                function normalizeForMatch(value) {
                  return String(value || '')
                    .toLocaleLowerCase()
                    .replace(/[\u064B-\u065F\u0670]/g, '')
                    .replace(/[^\\p{L}\\p{N}]/gu, '');
                }

                const normalizedQuery = normalizeForMatch(translatedQuery);
                let selected = normalizedQuery
                  ? words.find(function(item) {
                      const normalizedWord = normalizeForMatch(item.match[0]);
                      return normalizedWord.includes(normalizedQuery) ||
                        normalizedQuery.includes(normalizedWord);
                    })
                  : null;

                if (!selected) {
                  const progress = Number(wordProgress);
                  const fallbackIndex = Number.isFinite(progress)
                    ? Math.round(Math.max(0, Math.min(1, progress)) * (words.length - 1))
                    : Math.max(
                        0,
                        Math.min(words.length - 1, Number(wordIndex) || 0)
                      );
                  selected = words[fallbackIndex];
                }
                if (!selected) return;

                const range = document.createRange();
                range.setStart(selected.node, selected.match.index);
                range.setEnd(
                  selected.node,
                  selected.match.index + selected.match[0].length
                );
                drawReaderSwitchHighlight(range);
                if (window.__readerTransition === 'scroll') {
                  const rect = range.getBoundingClientRect();
                  window.scrollBy({
                    top: rect.top - window.innerHeight * 0.28,
                    left: 0,
                    behavior: 'auto'
                  });
                }
              };

              function reportPreciseSwitchAnchor(force) {
                const isRtl = document.documentElement.dir === 'rtl';
                const blocksInView = Array.from(
                  document.querySelectorAll('[data-reader-block]')
                ).filter(function(block) {
                  const rect = block.getBoundingClientRect();
                  return rect.bottom > 0 && rect.top < window.innerHeight &&
                    rect.right > 0 && rect.left < window.innerWidth;
                }).sort(function(first, second) {
                  const firstRect = first.getBoundingClientRect();
                  const secondRect = second.getBoundingClientRect();
                  const vertical = Math.max(0, firstRect.top) - Math.max(0, secondRect.top);
                  if (Math.abs(vertical) > 1) return vertical;
                  return isRtl
                    ? secondRect.right - firstRect.right
                    : firstRect.left - secondRect.left;
                }).slice(0, 4);

                let selected = null;
                blocksInView.forEach(function(block) {
                  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                  let textNode = walker.nextNode();
                  while (textNode) {
                    const text = textNode.textContent || '';
                    Array.from(text.matchAll(/\\S+/g)).forEach(function(match) {
                      const range = document.createRange();
                      range.setStart(textNode, match.index);
                      range.setEnd(textNode, match.index + match[0].length);
                      const rect = Array.from(range.getClientRects()).find(function(item) {
                        return item.width > 0 && item.height > 0 && item.bottom > 0 &&
                          item.top < window.innerHeight && item.right > 0 &&
                          item.left < window.innerWidth;
                      });
                      if (!rect) return;
                      const visibleTop = Math.max(0, rect.top);
                      const horizontal = isRtl ? -rect.right : rect.left;
                      if (!selected || visibleTop < selected.visibleTop - 1 ||
                        (Math.abs(visibleTop - selected.visibleTop) <= 1 &&
                          horizontal < selected.horizontal)) {
                        selected = { block, textNode, match, range, visibleTop, horizontal };
                      }
                    });
                    textNode = walker.nextNode();
                  }
                });
                if (!selected) return false;

                const prefix = document.createRange();
                prefix.selectNodeContents(selected.block);
                prefix.setEnd(selected.textNode, selected.match.index);
                const characterOffset = prefix.toString().length;
                const wordIndex = (prefix.toString().match(/\\S+/g) || []).length;
                const blockId = selected.block.dataset.blockId;
                const anchorKey = blockId + ':' + wordIndex;
                if (blockId && window.__showReaderSwitchHighlight) {
                  drawReaderSwitchHighlight(selected.range);
                }
                if (blockId && (force || anchorKey !== lastSwitchAnchorKey)) {
                  lastSwitchAnchorKey = anchorKey;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'switchAnchor',
                    blockId: blockId,
                    word: selected.match[0],
                    wordIndex: wordIndex,
                    blockOffset: characterOffset,
                    ttsOffset: Number(selected.block.dataset.ttsStart || 0) + characterOffset
                  }));
                }
                return Boolean(blockId);
              }

              function reportSwitchAnchor(force) {
                if (reportPreciseSwitchAnchor(force)) return;
                let block = null;
                for (let y = 12; y < window.innerHeight && !block; y += 36) {
                  const edgeX = document.documentElement.dir === 'rtl'
                    ? window.innerWidth - 24
                    : 24;
                  const edgeHit = document.elementFromPoint(edgeX, y);
                  const centerHit = document.elementFromPoint(window.innerWidth / 2, y);
                  block = edgeHit?.closest?.('[data-reader-block]') ||
                    centerHit?.closest?.('[data-reader-block]') || null;
                }
                if (!block) return;
                const blockRect = block.getBoundingClientRect();
                const probeX = Math.max(8, Math.min(
                  window.innerWidth - 8,
                  document.documentElement.dir === 'rtl'
                    ? blockRect.right - 8
                    : Math.max(0, blockRect.left) + 8
                ));
                const probeY = Math.max(8, Math.min(
                  window.innerHeight - 8,
                  Math.max(0, blockRect.top) + 8
                ));
                const caret = document.caretRangeFromPoint
                  ? document.caretRangeFromPoint(probeX, probeY)
                  : null;
                const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                let textNode = caret && caret.startContainer.nodeType === Node.TEXT_NODE &&
                  block.contains(caret.startContainer)
                    ? caret.startContainer
                    : walker.nextNode();
                let localOffset = textNode === caret?.startContainer ? caret.startOffset : 0;
                while (textNode && !(textNode.textContent || '').trim()) {
                  textNode = walker.nextNode();
                  localOffset = 0;
                }
                let highlightedWord = '';
                let highlightedWordIndex = 0;
                let highlightedCharacterOffset = 0;
                let switchHighlightRange = null;
                if (textNode) {
                  const text = textNode.textContent || '';
                  const matches = Array.from(text.matchAll(/\\S+/g));
                  const match = matches.find(function(candidate) {
                    return candidate.index + candidate[0].length > localOffset;
                  }) || matches[0];
                  if (match) {
                    const prefix = document.createRange();
                    prefix.selectNodeContents(block);
                    prefix.setEnd(textNode, match.index);
                    highlightedCharacterOffset = prefix.toString().length;
                    highlightedWordIndex = (prefix.toString().match(/\\S+/g) || []).length;
                    highlightedWord = match[0];
                    switchHighlightRange = document.createRange();
                    switchHighlightRange.setStart(textNode, match.index);
                    switchHighlightRange.setEnd(textNode, match.index + match[0].length);
                  }
                }

                const blockId = block.dataset.blockId;
                const anchorKey = blockId + ':' + highlightedWordIndex;
                if (blockId && window.__showReaderSwitchHighlight) {
                  drawReaderSwitchHighlight(switchHighlightRange);
                }
                if (blockId && (force || anchorKey !== lastSwitchAnchorKey)) {
                  lastSwitchAnchorKey = anchorKey;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'switchAnchor',
                    blockId: blockId,
                    word: highlightedWord,
                    wordIndex: highlightedWordIndex,
                    blockOffset: highlightedCharacterOffset,
                    ttsOffset:
                      Number(block.dataset.ttsStart || 0) +
                      highlightedCharacterOffset
                  }));
                }
              }
              window.__reportSwitchAnchor = reportSwitchAnchor;
              requestAnimationFrame(reportSwitchAnchor);

              let searchHighlightDismissArmed = false;
              let searchHighlightArmTimer = null;

              function clearReaderSearchHighlight() {
                document.querySelectorAll('.reader-search-highlight').forEach(function(mark) {
                  const parent = mark.parentNode;
                  mark.replaceWith(document.createTextNode(mark.textContent || ''));
                  parent?.normalize();
                });
                searchHighlightDismissArmed = false;
                clearTimeout(searchHighlightArmTimer);
              }
              window.__clearReaderSearchHighlight = clearReaderSearchHighlight;

              window.__highlightReaderSearch = function(block, query, matchIndex) {
                clearReaderSearchHighlight();

                if (!block || !query) return null;
                const blockText = block.textContent || '';
                let start = Number(matchIndex);
                if (!Number.isFinite(start) || start < 0) {
                  start = blockText.toLocaleLowerCase().indexOf(
                    String(query).toLocaleLowerCase()
                  );
                }
                if (start < 0) return null;
                const end = Math.min(blockText.length, start + String(query).length);
                if (end <= start) return null;

                const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                const portions = [];
                let offset = 0;
                let node = walker.nextNode();
                while (node) {
                  const length = (node.textContent || '').length;
                  const portionStart = Math.max(0, start - offset);
                  const portionEnd = Math.min(length, end - offset);
                  if (portionStart < portionEnd) {
                    portions.push({ node: node, start: portionStart, end: portionEnd });
                  }
                  offset += length;
                  if (offset >= end) break;
                  node = walker.nextNode();
                }

                let firstMarker = null;
                portions.reverse().forEach(function(portion) {
                  const range = document.createRange();
                  range.setStart(portion.node, portion.start);
                  range.setEnd(portion.node, portion.end);
                  const marker = document.createElement('mark');
                  marker.className = 'reader-search-highlight';
                  range.surroundContents(marker);
                  firstMarker = marker;
                });
                searchHighlightArmTimer = setTimeout(function() {
                  searchHighlightDismissArmed = true;
                }, 450);
                return firstMarker;
              };

              // --------------------------------
              // WORD-ACCURATE LINE GUIDE
              // --------------------------------

              let readerGuideMode = null;
              let currentGuideDocumentTop = null;
              let currentGuideLeft = null;
              const lineGuide = document.getElementById('reader-line-guide');
              const wordGuide = document.getElementById('reader-word-guide');
              let currentWordNode = null;
              let currentWordStart = -1;
              let currentWordEnd = -1;

              function isGuideTextNode(node) {
                return Boolean(
                  node &&
                  (node.textContent || '').trim() &&
                  !node.parentElement?.closest('.page-divider')
                );
              }

              function wordMatches(node) {
                return Array.from((node.textContent || '').matchAll(/\\S+/g));
              }

              function wordRange(node, match) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                return range;
              }

              function drawWordGuide(node, match) {
                if (!wordGuide || !node || !match) return false;
                const range = wordRange(node, match);
                const rect = Array.from(range.getClientRects()).find(function(item) {
                  return item.width > 0 && item.height > 0;
                });
                if (!rect) return false;
                currentWordNode = node;
                currentWordStart = match.index;
                currentWordEnd = match.index + match[0].length;
                wordGuide.style.display = 'block';
                wordGuide.style.left = Math.max(0, rect.left - 3) + 'px';
                wordGuide.style.top = Math.max(0, rect.top - 2) + 'px';
                wordGuide.style.width = Math.max(1, rect.width + 6) + 'px';
                wordGuide.style.height = Math.max(1, rect.height + 4) + 'px';
                return true;
              }

              function initializeWordGuide() {
                let block = null;
                for (let y = 12; y < window.innerHeight - 72 && !block; y += 24) {
                  block = document.elementFromPoint(window.innerWidth / 2, y)
                    ?.closest?.('[data-reader-block]') || null;
                }
                if (!block) return;
                const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                let node = walker.nextNode();
                while (node) {
                  if (isGuideTextNode(node)) {
                    const matches = wordMatches(node);
                    const match = matches.find(function(item) {
                      const rect = wordRange(node, item).getBoundingClientRect();
                      return rect.bottom >= 12 && rect.top <= window.innerHeight - 72;
                    });
                    if (match && drawWordGuide(node, match)) return;
                  }
                  node = walker.nextNode();
                }
              }

              function adjacentWord(direction) {
                if (!currentWordNode || !readerPages) return null;
                const matches = wordMatches(currentWordNode);
                const currentIndex = matches.findIndex(function(match) {
                  return match.index === currentWordStart;
                });
                const sameNodeMatch = matches[currentIndex + direction];
                if (sameNodeMatch) {
                  return { node: currentWordNode, match: sameNodeMatch };
                }

                const walker = document.createTreeWalker(
                  readerPages,
                  NodeFilter.SHOW_TEXT,
                  {
                    acceptNode: function(node) {
                      return isGuideTextNode(node)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                    }
                  }
                );
                walker.currentNode = currentWordNode;
                let node = direction < 0 ? walker.previousNode() : walker.nextNode();
                while (node) {
                  const nodeMatches = wordMatches(node);
                  if (nodeMatches.length) {
                    return {
                      node: node,
                      match: direction < 0
                        ? nodeMatches[nodeMatches.length - 1]
                        : nodeMatches[0]
                    };
                  }
                  node = direction < 0 ? walker.previousNode() : walker.nextNode();
                }
                return null;
              }

              function moveWordGuide(direction) {
                if (!currentWordNode) {
                  initializeWordGuide();
                  return;
                }
                const target = adjacentWord(direction);
                if (!target) return;
                const targetRect = wordRange(target.node, target.match).getBoundingClientRect();
                const topLimit = 12;
                const bottomLimit = window.innerHeight - 76;
                if (targetRect.top >= topLimit && targetRect.bottom <= bottomLimit) {
                  drawWordGuide(target.node, target.match);
                  return;
                }
                const currentRange = document.createRange();
                currentRange.setStart(currentWordNode, currentWordStart);
                currentRange.setEnd(currentWordNode, currentWordEnd);
                const currentRect = currentRange.getBoundingClientRect();
                const scrollDistance = direction < 0
                  ? Math.min(0, currentRect.bottom - bottomLimit)
                  : Math.max(0, currentRect.top - 16);
                window.scrollBy({ top: scrollDistance, left: 0, behavior: 'smooth' });
              }

              function redrawWordGuide() {
                if (!currentWordNode || currentWordStart < 0) return;
                const match = wordMatches(currentWordNode).find(function(item) {
                  return item.index === currentWordStart;
                });
                if (match) drawWordGuide(currentWordNode, match);
              }

              function collectReaderLines() {
                if (!readerPages) return [];
                const lines = [];
                const walker = document.createTreeWalker(
                  readerPages,
                  NodeFilter.SHOW_TEXT,
                  {
                    acceptNode: function(node) {
                      return (
                        (node.textContent || '').trim() &&
                        !node.parentElement?.closest('.page-divider')
                      )
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                    }
                  }
                );
                let node = walker.nextNode();

                while (node) {
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  Array.from(range.getClientRects()).forEach(function(rect) {
                    if (
                      rect.width < 1 ||
                      rect.height < 1 ||
                      rect.bottom < -4 ||
                      rect.top > window.innerHeight + 4
                    ) return;

                    let line = lines.find(function(candidate) {
                      return Math.abs(candidate.top - rect.top) < 2.5;
                    });
                    if (!line) {
                      line = {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom
                      };
                      lines.push(line);
                    } else {
                      line.left = Math.min(line.left, rect.left);
                      line.right = Math.max(line.right, rect.right);
                      line.top = Math.min(line.top, rect.top);
                      line.bottom = Math.max(line.bottom, rect.bottom);
                    }
                  });
                  node = walker.nextNode();
                }

                return lines
                  .map(function(line) {
                    return {
                      left: line.left,
                      right: line.right,
                      top: line.top,
                      bottom: line.bottom,
                      documentTop: line.top + window.scrollY
                    };
                  })
                  .sort(function(a, b) { return a.top - b.top; });
              }

              function collectGuideItems() {
                return collectReaderLines();
              }

              function drawLineGuide(line) {
                if (!lineGuide || !line) return;
                currentGuideDocumentTop = line.documentTop;
                currentGuideLeft = line.left;
                lineGuide.style.display = 'block';
                lineGuide.style.left = Math.max(0, line.left - 3) + 'px';
                lineGuide.style.top = Math.max(0, line.top - 2) + 'px';
                lineGuide.style.width = Math.max(1, line.right - line.left + 6) + 'px';
                lineGuide.style.height = Math.max(1, line.bottom - line.top + 4) + 'px';
              }

              function closestCurrentLine(lines) {
                if (
                  currentGuideDocumentTop === null ||
                  currentGuideLeft === null
                ) return null;
                return lines.reduce(function(closest, line) {
                  if (!closest) return line;
                  const lineDistance =
                    Math.abs(line.documentTop - currentGuideDocumentTop) * 1000 +
                    Math.abs(line.left - currentGuideLeft);
                  const closestDistance =
                    Math.abs(closest.documentTop - currentGuideDocumentTop) * 1000 +
                    Math.abs(closest.left - currentGuideLeft);
                  return lineDistance < closestDistance
                      ? line
                      : closest;
                }, null);
              }

              function initializeLineGuide() {
                const firstLine = collectGuideItems().find(function(line) {
                  return line.top >= 12 && line.bottom <= window.innerHeight - 72;
                });
                if (firstLine) drawLineGuide(firstLine);
              }

              window.__setReaderGuideMode = function(mode) {
                readerGuideMode = mode === 'line' || mode === 'word' ? mode : null;
                currentGuideDocumentTop = null;
                currentGuideLeft = null;
                currentWordNode = null;
                currentWordStart = -1;
                currentWordEnd = -1;
                if (lineGuide) lineGuide.style.display = 'none';
                if (wordGuide) wordGuide.style.display = 'none';
                if (!readerGuideMode) {
                  return;
                }
                requestAnimationFrame(function() {
                  requestAnimationFrame(
                    readerGuideMode === 'word'
                      ? initializeWordGuide
                      : initializeLineGuide
                  );
                });
              };

              window.__moveReaderGuide = function(direction) {
                if (readerGuideMode === 'word') {
                  moveWordGuide(direction < 0 ? -1 : 1);
                  return;
                }
                window.__moveLineGuide?.(direction < 0 ? -1 : 1);
              };

              window.__moveLineGuide = function(direction) {
                if (readerGuideMode !== 'line') return;
                const lines = collectGuideItems();
                if (!lines.length || currentGuideDocumentTop === null) {
                  initializeLineGuide();
                  return;
                }

                const currentLine = closestCurrentLine(lines);
                if (!currentLine) return;
                const currentIndex = lines.indexOf(currentLine);
                const nextLine = lines[currentIndex + (direction < 0 ? -1 : 1)];
                const topLimit = 12;
                const bottomLimit = window.innerHeight - 76;

                if (
                  nextLine &&
                  nextLine.top >= topLimit &&
                  nextLine.bottom <= bottomLimit
                ) {
                  drawLineGuide(nextLine);
                  return;
                }

                const scrollDistance = direction < 0
                  ? Math.min(0, currentLine.bottom - bottomLimit)
                  : Math.max(0, currentLine.top - 16);
                window.scrollBy({ top: scrollDistance, left: 0, behavior: 'smooth' });
              };

              let lineGuideRedrawFrame = null;
              function redrawLineGuideDuringScroll() {
                if (readerGuideMode === 'word') {
                  redrawWordGuide();
                  return;
                }
                if (readerGuideMode !== 'line' || currentGuideDocumentTop === null) return;
                if (lineGuideRedrawFrame) cancelAnimationFrame(lineGuideRedrawFrame);
                lineGuideRedrawFrame = requestAnimationFrame(function() {
                  const currentLine = closestCurrentLine(collectGuideItems());
                  if (currentLine) drawLineGuide(currentLine);
                  lineGuideRedrawFrame = null;
                });
              }

              // --------------------------------
              // PAGINATED READER
              // --------------------------------

              const pagedContent =
                document.getElementById('reader-pages');
              let currentPage = 0;
              let pageCount = 1;
              let pageAnimationRunning = false;

              window.__readerTransition = 'scroll';
              window.__readerCurrentPage = 0;

              function pageTransform(page, rotation) {
                return (
                  'translate3d(' +
                  -page * window.innerWidth +
                  'px, 0, 0) perspective(900px) rotateY(' +
                  rotation +
                  'deg)'
                );
              }

              function refreshReaderPages() {
                if (
                  window.__readerTransition === 'scroll' ||
                  !pagedContent
                ) {
                  pageCount = 1;
                  currentPage = 0;
                  window.__readerCurrentPage = 0;
                  reportSourcePage();
                  return;
                }

                pageCount = Math.max(
                  1,
                  Math.ceil(
                    pagedContent.scrollWidth / window.innerWidth
                  )
                );
                currentPage = Math.min(currentPage, pageCount - 1);
                window.__readerCurrentPage = currentPage;
                pagedContent.style.transition = 'none';
                pagedContent.style.transform = pageTransform(
                  currentPage,
                  0
                );
                reportSourcePage();
              }

              function finishPageChange(targetPage) {
                currentPage = targetPage;
                window.__readerCurrentPage = currentPage;
                pagedContent.style.transform = pageTransform(
                  currentPage,
                  0
                );
                reportSourcePage();
              }

              function sourcePageAtViewport() {
                const sections = Array.from(
                  document.querySelectorAll('[data-source-page-section]')
                );
                if (!sections.length) return lastReportedSourcePage || 1;

                // Use the reading area's top edge as the page boundary. An
                // elementFromPoint probe farther down can still hit the prior
                // section when a page starts with whitespace or a divider.
                const anchorY = Math.min(48, window.innerHeight * 0.1);
                // Adjacent sections may overlap because their first/last text
                // margins collapse. Choose the latest section that has crossed
                // the anchor, not the first section whose rectangle contains it.
                let section = null;
                sections.forEach(function(item) {
                  if (item.getBoundingClientRect().top <= anchorY) {
                    section = item;
                  }
                });
                if (!section) {
                  section = sections.find(function(item) {
                    return item.getBoundingClientRect().top > anchorY;
                  }) || sections[sections.length - 1];
                }
                return Number(section?.dataset.sourcePageSection) ||
                  lastReportedSourcePage || 1;
              }

              let lastReportedSourcePage = 0;
              function reportSourcePage(requestedPage) {
                const numericRequestedPage = Number(requestedPage);
                const pinnedSourcePage = Number(window.__pinnedSourcePage);
                const page = Number.isFinite(numericRequestedPage) &&
                  numericRequestedPage >= 1
                  ? numericRequestedPage
                  : Number.isFinite(pinnedSourcePage) && pinnedSourcePage >= 1
                    ? pinnedSourcePage
                  : sourcePageAtViewport();
                if (page === lastReportedSourcePage) return page;
                lastReportedSourcePage = page;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'sourcePage',
                  page: page
                }));
                return page;
              }
              window.__reportSourcePage = reportSourcePage;

              window.__goToElementPage = function(element) {
                if (!element || window.__readerTransition === 'scroll') return;
                const rect = element.getBoundingClientRect();
                const documentLeft = rect.left + currentPage * window.innerWidth;
                goToReaderPage(Math.floor(documentLeft / window.innerWidth));
              };

              function goToReaderPage(targetPage) {
                if (
                  window.__readerTransition === 'scroll' ||
                  pageAnimationRunning ||
                  !pagedContent
                ) {
                  return;
                }

                const nextPage = Math.max(
                  0,
                  Math.min(targetPage, pageCount - 1)
                );

                if (nextPage === currentPage) {
                  return;
                }

                pageAnimationRunning = true;
                finishPageChange(nextPage);
                pageAnimationRunning = false;
              }

              function applyReaderTransition(mode, resetPage) {
                window.__readerTransition = 'scroll';

                const paged = window.__readerTransition !== 'scroll';
                document.documentElement.classList.toggle(
                  'reader-paged',
                  paged
                );
                document.body.classList.toggle('reader-paged', paged);
                pagedContent?.classList.toggle('reader-paged', paged);
                pageAnimationRunning = false;

                if (resetPage) {
                  currentPage = 0;
                }

                window.__readerCurrentPage = currentPage;

                if (pagedContent) {
                  pagedContent.style.transition = 'none';
                  pagedContent.style.opacity = '1';
                  pagedContent.style.transform = paged
                    ? pageTransform(currentPage, 0)
                    : 'none';
                }

                window.scrollTo(0, 0);

                requestAnimationFrame(function() {
                  requestAnimationFrame(refreshReaderPages);
                });
              }

              window.__refreshReaderPages = refreshReaderPages;
              window.__goToReaderPage = goToReaderPage;
              window.__navigateReaderPage = function(direction) {
                goToReaderPage(
                  currentPage + (direction > 0 ? 1 : -1)
                );
              };
              window.__applyReaderTransition = applyReaderTransition;

              window.addEventListener('resize', function() {
                setTimeout(function() {
                  refreshReaderPages();
                  if (readerGuideMode) {
                    if (readerGuideMode === 'word') {
                      currentWordNode = null;
                      currentWordStart = -1;
                      currentWordEnd = -1;
                      initializeWordGuide();
                    } else {
                      currentGuideDocumentTop = null;
                      currentGuideLeft = null;
                      initializeLineGuide();
                    }
                  }
                }, 50);
              });
              // --------------------------------
              // SCROLL HANDLING
              // --------------------------------

              function releaseProgrammaticSourcePage() {
                window.__pinnedSourcePage = null;
              }
              window.addEventListener(
                'touchstart',
                releaseProgrammaticSourcePage,
                { passive: true }
              );
              window.addEventListener(
                'pointerdown',
                releaseProgrammaticSourcePage,
                { passive: true }
              );
              window.addEventListener(
                'wheel',
                releaseProgrammaticSourcePage,
                { passive: true }
              );

              let scrollTimer = null;

              window.addEventListener(
                'scroll',
                function() {

                  redrawLineGuideDuringScroll();

                  if (searchHighlightDismissArmed) {
                    clearReaderSearchHighlight();
                  }

                  if (window.__showReaderSwitchHighlight) {
                    window.__showReaderSwitchHighlight = false;
                    clearReaderSwitchHighlight();
                  }
                  if (
                    !window.__pinnedSourcePage &&
                    document.getElementById('reader-switch-highlight')
                  ) {
                    clearReaderSwitchHighlight();
                  }

                  /*
                   * Wait for the next animation frame.
                   *
                   * This prevents sending a message
                   * to React Native for every single
                   * scroll event.
                   */
                  if (!scrollTimer) {
                    scrollTimer = setTimeout(
                      function() {

                        window.ReactNativeWebView.postMessage(
                          JSON.stringify({
                            type: 'scroll',
                            scrollY: window.scrollY,
                            sourcePage: reportSourcePage()
                          })
                        );

                        reportSwitchAnchor();

                        scrollTimer = null;

                      },
                      80
                    );
                  }

                },
                {
                  passive: true
                }
              );


              // --------------------------------
              // TEXT SELECTION
              // --------------------------------

              let selectionTimeout = null;

              document.addEventListener(
                'selectionchange',
                function() {

                  /*
                   * Debounce selection events.
                   */
                  clearTimeout(
                    selectionTimeout
                  );

                  selectionTimeout =
                    setTimeout(
                      function() {

                        const selection =
                          window.getSelection();

                        const text =
                          selection
                            ? selection.toString().trim()
                            : '';

                        if (text.length > 0) {

                          if (selection.rangeCount > 0) {
                            window.__readerSelectionRange =
                              selection.getRangeAt(0).cloneRange();
                          }

                          window.ReactNativeWebView.postMessage(
                            JSON.stringify({
                              type: 'selection',
                              text: text
                            })
                          );

                        }

                      },
                      100
                    );

                }
              );

            })();

            true;
          `}

          />
          </View>
          </View>
        </SafeAreaView>

        {/* ========================= */}
        {/* ANIMATED READER TOOLBAR */}
        {/* ========================= */}

        {!isLandscape && !readerGuideMode && (
  <Animated.View
    style={{
      transform: [
        {
          translateY:
            toolbarTranslateY,
        },
      ],
    }}
  >
    <ReaderToolbar
      activeItem={activeItem}
      onSelectItem={handleToolbarPress}
    />
  </Animated.View>
)}

        {readerGuideMode && (
          <View
            pointerEvents="box-none"
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              accessibilityLabel="Move reading line guide. Tap upper half for up, lower half for down"
              accessibilityRole="button"
              onPress={(event) => {
                moveLineGuide(
                  event.nativeEvent.pageY < windowHeight / 2 ? -1 : 1
                );
              }}
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              accessibilityLabel="Close line guide"
              accessibilityRole="button"
              hitSlop={12}
              onPress={closeReaderGuide}
              style={styles.lineGuideClose}
            >
              <Text style={styles.lineGuideCloseText}>×</Text>
            </Pressable>
          </View>
        )}
        {/* ========================= */}
        {/* BOTTOM SHEET */}
        {/* ========================= */}

        <BottomSheetPortal
          snapPoints={bottomSheetSnapPoints}
          handleComponent={
            activeItem === "ai"
              ? (props) => (
                  <NativeBottomSheetHandle
                    {...props}
                    accessibilityLabel="Resize AI panel"
                    style={{
                      borderTopLeftRadius: 12,
                      borderTopRightRadius: 12,
                      paddingVertical: 12,
                    }}
                  />
                )
              : () => null
          }
          keyboardBehavior={activeItem === "ai" ? "interactive" : undefined}
          keyboardBlurBehavior={activeItem === "ai" ? "restore" : undefined}
          android_keyboardInputMode={activeItem === "ai" ? "adjustResize" : undefined}
          enableContentPanningGesture
          enableHandlePanningGesture
          backdropComponent={
            BottomSheetBackdrop
          }
        >

          {activeItem !== "ai" && <BottomSheetDragIndicator />}

          {activeItem === "ai" ? (
            renderBottomSheetContent()
          ) : (
            <BottomSheetContent>
              {renderBottomSheetContent()}
            </BottomSheetContent>
          )}

        </BottomSheetPortal>

      </View>

    </BottomSheet>
  );
};

export default ReaderView;

const styles = StyleSheet.create({
  lineGuideClose: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  lineGuideCloseText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 34,
  },
});
