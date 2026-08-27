import ReaderToolbar, {
  ReaderBottomNavItem,
} from "@/components/Readertoolbar";
import HorizontalReaderPager, { type ReaderNote } from "@/components/HorizontalReaderPager";
import PremiumFeatureModal from "@/components/PremiumFeatureModal";

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

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { useRevenueCat } from "@/providers/RevenueCatProvider";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  loadReaderAnnotations,
  saveReaderAnnotations,
} from "@/database/readerAnnotationRepository";

type ReaderDestination = {
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
};

type ReaderViewProps = {
  documentId: string;
  annotationScope: string;
  isActive?: boolean;
  isLandscape: boolean;
  headerOverlayHeight?: number;
  topBarVisible?: boolean;
  blocks: ExtractedPdfBlock[];
  pageCount: number;
  sourcePageCount?: number;
  destination?: ReaderDestination | null;
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
  onToolbarVisibilityChange?: (visible: boolean) => void;
  translationLanguage?: TranslationLanguage;
  onTranslationLanguageChange?: (language?: TranslationLanguage) => void;
  useTranslatedTextDirection?: boolean;
};

const readerMenuItems = [
  { key: "highlight", label: "Highlight" },
  { key: "addNote", label: "Add Note" },
  { key: "removeHighlight", label: "Remove Highlight" },
  { key: "askAI", label: "Ask AI" },
];
const readerMenuItemsWithoutRemove = readerMenuItems.filter(
  (item) => item.key !== "removeHighlight",
);

const MemoizedFontSettings = React.memo(FontSettings);
const MemoizedBackgroundSettings = React.memo(BackgroundSettings);
const MemoizedSettings = React.memo(Settings);
const HiddenBottomSheetHandle = () => null;
const aiBottomSheetHandleStyle = {
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  paddingVertical: 12,
} as const;
const ReaderAiBottomSheetHandle = (
  props: React.ComponentProps<typeof NativeBottomSheetHandle>,
) => (
  <NativeBottomSheetHandle
    {...props}
    accessibilityLabel="Resize AI panel"
    style={aiBottomSheetHandleStyle}
  />
);

const highlightColors = [
  "#fde68a",
  "#f9a8d4",
  "#c4b5fd",
  "#93c5fd",
  "#86efac",
  "#fdba74",
];

const rightToLeftLanguageCodes = new Set(["ar", "fa", "he", "ur"]);

function containsRightToLeftText(blocks: ExtractedPdfBlock[]) {
  const sample = blocks.slice(0, 80).map((block) => block.text).join(" ");
  const rtlCharacters = sample.match(/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g)?.length ?? 0;
  const letterCharacters = sample.match(/\p{L}/gu)?.length ?? 0;
  return letterCharacters > 0 && rtlCharacters / letterCharacters >= 0.3;
}

function ttsPositionForBlock(
  blocks: ExtractedPdfBlock[],
  blockId: string,
  blockOffset: number,
) {
  let globalOffset = 0;
  for (const block of blocks) {
    const text = block.text.trim();
    if (block.id === blockId) {
      const leadingWhitespace = block.text.length - block.text.trimStart().length;
      return globalOffset + Math.max(0, Math.min(text.length, blockOffset - leadingWhitespace));
    }
    globalOffset += text.length + 2;
  }
  return 0;
}

function spokenWordForTtsOffset(
  blocks: ExtractedPdfBlock[],
  charIndex: number,
  charLength: number,
) {
  let globalOffset = 0;
  for (const block of blocks) {
    const text = block.text.trim();
    const blockEnd = globalOffset + text.length;
    if (charIndex >= globalOffset && charIndex < blockEnd) {
      const leadingWhitespace = block.text.length - block.text.trimStart().length;
      const localOffset = charIndex - globalOffset;
      const word = Array.from(text.matchAll(/\S+/g)).find((match) =>
        localOffset >= (match.index ?? 0) &&
        localOffset < (match.index ?? 0) + match[0].length
      );
      return {
        blockId: block.id,
        offset: leadingWhitespace + (word?.index ?? localOffset),
        length: word?.[0].length ?? charLength,
      };
    }
    globalOffset = blockEnd + 2;
  }
  return null;
}

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
  documentId,
  annotationScope,
  isActive = true,
  isLandscape,
  headerOverlayHeight = 0,
  topBarVisible = true,
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
  onToolbarVisibilityChange,
  translationLanguage,
  onTranslationLanguageChange,
  useTranslatedTextDirection = false,
}: ReaderViewProps) => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const readerResizeOpacity = useRef(new Animated.Value(1)).current;
  const previousWindowWidth = useRef(windowWidth);
  const db = useSQLiteContext();
  const isDark = useColorScheme() === "dark";
  const { isPremium } = useRevenueCat();
  const router = useRouter();
  const [fontAssets] = useAssets([Lato_700Bold, SourceSans3_400Regular]);

  useLayoutEffect(() => {
    if (Math.abs(previousWindowWidth.current - windowWidth) < 1) return;
    previousWindowWidth.current = windowWidth;
    readerResizeOpacity.stopAnimation();
    readerResizeOpacity.setValue(0.08);
    const timer = setTimeout(() => {
      Animated.timing(readerResizeOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }, 100);
    return () => clearTimeout(timer);
  }, [readerResizeOpacity, windowWidth]);
  const [latoBoldBase64, setLatoBoldBase64] = useState<string | null>(null);
  const [sourceSansBase64, setSourceSansBase64] = useState<string | null>(null);
  const [activeItem, setActiveItem] =
    useState<ReaderBottomNavItem>("font");
  const [aiExpanded, setAiExpanded] = useState(false);
  const [showAiPremiumPrompt, setShowAiPremiumPrompt] = useState(false);
  const [backgroundSettingsTab, setBackgroundSettingsTab] = useState<
    "presets" | "font" | "background"
  >("presets");
  const [ttsStartOffset, setTtsStartOffset] = useState(0);
  const ttsStartOffsetRef = useRef(0);
  const [spokenWordHighlight, setSpokenWordHighlight] = useState<{
    blockId: string;
    offset: number;
    length: number;
  } | null>(null);
  const speechStartOffsetRef = useRef(0);
  const readerLanguageCode = useTranslatedTextDirection
    ? translationLanguage?.code ?? "en"
    : "en";
  const originalTextIsRtl = useMemo(() => containsRightToLeftText(blocks), [blocks]);
  const readerDirection = (useTranslatedTextDirection &&
    rightToLeftLanguageCodes.has(readerLanguageCode)) ||
    (!useTranslatedTextDirection && originalTextIsRtl)
    ? "rtl"
    : "ltr";
  const ttsText = useMemo(
    () => blocks.map((block) => block.text.trim()).join("\n\n"),
    [blocks],
  );
  const [initialBlocks] = useState(() => {
    const firstPage = blocks[0]?.page ?? 1;
    return blocks.filter((block) => block.page < firstPage + 5);
  });
  const readerMarkup = useMemo(() => blocksToMarkup(initialBlocks), [initialBlocks]);
  const appendedBlockCount = useRef(initialBlocks.length);
  const sentBlockIds = useRef(new Set(initialBlocks.map((block) => block.id)));
  const annotationDeliveryRevisionRef = useRef(0);
  const lastSourcePageRef = useRef(1);
  const modeTextAnchorRef = useRef<{
    blockId: string;
    blockOffset: number;
    wordIndex: number;
  } | null>(null);
  const [currentSourcePage, setCurrentSourcePage] = useState(1);
  const recoveryPageRef = useRef<number | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [appendPass, setAppendPass] = useState(0);
  const [highlightPickerVisible, setHighlightPickerVisible] = useState(false);
  const [pagerHighlights, setPagerHighlights] = useState<Array<{
    blockId: string;
    offset: number;
    length: number;
    color: string;
  }>>([]);
  const pendingPagerHighlightRef = useRef<Array<{
    blockId: string;
    offset: number;
    length: number;
  }> | null>(null);
  const [selectedAIText, setSelectedAIText] = useState("");
  const [selectionHasHighlight, setSelectionHasHighlight] = useState(false);
  const [readerNotes, setReaderNotes] = useState<ReaderNote[]>([]);
  const annotationsLoadedKeyRef = useRef<string | null>(null);
  const scrollSelectionRangesRef = useRef<Array<{
    blockId: string;
    offset: number;
    length: number;
  }>>([]);
  const [noteEditor, setNoteEditor] = useState<{
    id?: string;
    ranges: Array<{ blockId: string; offset: number; length: number }>;
    selectedText: string;
    source: "paged" | "scroll";
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    const key = `${documentId}:${annotationScope}`;
    let cancelled = false;
    annotationsLoadedKeyRef.current = null;
    void loadReaderAnnotations(db, documentId, annotationScope).then((annotations) => {
      if (cancelled) return;
      setPagerHighlights(annotations.highlights);
      setReaderNotes(annotations.notes);
      annotationsLoadedKeyRef.current = key;
    }).catch((error) => console.error("Failed to load reader annotations:", error));
    return () => { cancelled = true; };
  }, [annotationScope, db, documentId]);

  useEffect(() => {
    const key = `${documentId}:${annotationScope}`;
    if (annotationsLoadedKeyRef.current !== key) return;
    const timer = setTimeout(() => {
      void saveReaderAnnotations(
        db,
        documentId,
        annotationScope,
        pagerHighlights,
        readerNotes,
      ).catch((error) => console.error("Failed to save reader annotations:", error));
    }, 180);
    return () => clearTimeout(timer);
  }, [annotationScope, db, documentId, pagerHighlights, readerNotes]);

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
  const bottomSheetViewportWidthRef = useRef(windowWidth);
  const closeSettingsForTransitionChange = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);
  const activeItemRef = useRef(activeItem);
  const pendingBottomSheetItemRef = useRef<ReaderBottomNavItem | null>(null);
  activeItemRef.current = activeItem;

  useLayoutEffect(() => {
    if (Math.abs(bottomSheetViewportWidthRef.current - windowWidth) < 1) return;
    bottomSheetViewportWidthRef.current = windowWidth;
    pendingBottomSheetItemRef.current = null;
    bottomSheetRef.current?.close();
  }, [windowWidth]);

  const openBottomSheet = useCallback((item: ReaderBottomNavItem) => {
    // The landscape reader hides all chrome. Ignore stale taps while the
    // orientation transition is in progress so a sheet cannot open behind it.
    if (isLandscape) return;

    if (activeItemRef.current === item) {
      bottomSheetRef.current?.open(0);
      return;
    }

    // Commit and measure the requested content before the native opening
    // animation begins. This avoids animating while swapping the old panel.
    pendingBottomSheetItemRef.current = item;
    setActiveItem(item);
  }, [isLandscape]);

  useLayoutEffect(() => {
    if (isLandscape) {
      pendingBottomSheetItemRef.current = null;
      return;
    }

    if (pendingBottomSheetItemRef.current !== activeItem) return;
    pendingBottomSheetItemRef.current = null;
    bottomSheetRef.current?.open(0);
  }, [activeItem, isLandscape]);

  useEffect(() => {
    if (isLandscape) {
      bottomSheetRef.current?.close();
    }
  }, [isLandscape]);
  // WebView reference
  const webViewRef = useRef<WebView>(null);
  const transition = useReaderSettingsStore((state) => state.transition);
  const { isPaged, syncPageTransition } = usePageTransition({
    webViewRef,
    transition,
  });
  const [modeHandoff, setModeHandoff] = useState<{
    isPaged: boolean;
    destination: ReaderDestination | null;
    previousDestinationNonce: number | null;
  }>(() => ({
    isPaged,
    destination: null,
    previousDestinationNonce: null,
  }));

  useLayoutEffect(() => {
    setModeHandoff((current) => {
      if (current.isPaged === isPaged) return current;
      const anchor = modeTextAnchorRef.current;
      return {
        isPaged,
        destination: {
          page: Math.max(1, lastSourcePageRef.current),
          blockId: anchor?.blockId,
          // Horizontal pagination uses this offset to resolve the exact segment.
          searchMatchIndex: anchor?.blockOffset,
          // Use the same anchor for the temporary handoff marker. Previously
          // only the vertical destination received a switch-highlight target.
          switchHighlightOffset: anchor?.blockOffset,
          // Vertical scrolling uses the word index to restore the precise line.
          switchHighlightWordIndex: anchor?.wordIndex,
          nonce: Date.now(),
        },
        previousDestinationNonce: destination?.nonce ?? null,
      };
    });
  }, [destination?.nonce, isPaged]);

  const modeHandoffReady = modeHandoff.isPaged === isPaged;

  // A destination that arrives after the mode switch is explicit navigation
  // (search, contents, or page picker) and must supersede the handoff. An old
  // destination that was already consumed must not pull the new view backward.
  const destinationChangedAfterHandoff = Boolean(
    destination &&
      destination.nonce !== modeHandoff.previousDestinationNonce,
  );
  const activeModeDestination = !modeHandoffReady
    ? null
    : destinationChangedAfterHandoff
      ? destination
      : modeHandoff.destination ?? destination;

  useEffect(() => {
    if (!webViewReady) return;
    const revision = ++annotationDeliveryRevisionRef.current;
    const remaining = blocks.filter((block) => !sentBlockIds.current.has(block.id));
    const destinationBlocks = activeModeDestination
      ? remaining.filter((block) => activeModeDestination.blockId
          ? block.id === activeModeDestination.blockId
          : block.page === activeModeDestination.page)
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
        revision,
        html: "",
        hasMore,
        highlights: pagerHighlights,
        notes: readerNotes,
      }));
      return;
    }
    webViewRef.current?.postMessage(JSON.stringify({
      type: "appendBlocks",
      revision,
      html: blocksToMarkup(appended),
      hasMore,
      highlights: pagerHighlights,
      notes: readerNotes,
    }));
    appended.forEach((block) => sentBlockIds.current.add(block.id));
    appendedBlockCount.current = blocks.length;
    if (remaining.length > appended.length) {
      const timer = setTimeout(() => setAppendPass((value) => value + 1), 45);
      return () => clearTimeout(timer);
    }
  }, [
    appendPass,
    activeModeDestination,
    blocks,
    pageCount,
    pagerHighlights,
    readerNotes,
    sourcePageCount,
    webViewReady,
  ]);

  useEffect(() => {
    if (!webViewReady || isPaged) return;
    webViewRef.current?.injectJavaScript(`
      window.__renderReaderAnnotations?.(
        ${JSON.stringify(pagerHighlights)},
        ${JSON.stringify(readerNotes)}
      );
      true;
    `);
  }, [isPaged, pagerHighlights, readerNotes, webViewReady]);

  useEffect(() => {
    if (!isPaged) return;

    // Horizontal mode unmounts the vertical WebView. Reset its delivery
    // bookkeeping at the same time so a fresh vertical WebView receives every
    // block again instead of mistaking its initial batch for the whole book.
    setWebViewReady(false);
    appendedBlockCount.current = initialBlocks.length;
    sentBlockIds.current = new Set(initialBlocks.map((block) => block.id));
  }, [initialBlocks, isPaged]);

  const highlightSpokenWord = useCallback(
    (charIndex: number, charLength: number) => {
      setSpokenWordHighlight(spokenWordForTtsOffset(blocks, charIndex, charLength));
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "ttsHighlight",
          charIndex,
          charLength,
        })
      );
    },
    [blocks]
  );

  const clearSpokenWordHighlight = useCallback(() => {
    setSpokenWordHighlight(null);
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
        pendingPagerHighlightRef.current = null;
        setHighlightPickerVisible(true);
        return;
      }
      if (event.nativeEvent.key === "removeHighlight") {
        const selectedRanges = scrollSelectionRangesRef.current;
        setPagerHighlights((current) => current.filter((highlight) =>
          !selectedRanges.some((range) =>
            highlight.blockId === range.blockId &&
            highlight.offset < range.offset + range.length &&
            highlight.offset + highlight.length > range.offset
          )
        ));
        webViewRef.current?.injectJavaScript(`
          window.__removeReaderHighlightSelection?.();
          true;
        `);
        return;
      }
      if (event.nativeEvent.key === "addNote") {
        setNoteDraft("");
        setNoteEditor({
          ranges: scrollSelectionRangesRef.current,
          selectedText: event.nativeEvent.selectedText?.trim() ?? "",
          source: "scroll",
        });
        return;
      }
      if (event.nativeEvent.key === "askAI") {
        if (!isPremium) {
          setShowAiPremiumPrompt(true);
          return;
        }
        setSelectedAIText(event.nativeEvent.selectedText?.trim() ?? "");
        openBottomSheet("ai");
      }
    },
    [isPremium, openBottomSheet]
  );

  const openReaderNote = useCallback((noteId: string) => {
    const note = readerNotes.find((item) => item.id === noteId);
    if (!note) return;
    setNoteDraft(note.text);
    setNoteEditor({
      id: note.id,
      ranges: readerNotes
        .filter((item) => item.id === note.id)
        .map(({ blockId, offset, length }) => ({ blockId, offset, length })),
      selectedText: "",
      source: note.blockId ? "paged" : "scroll",
    });
  }, [readerNotes]);

  const saveReaderNote = useCallback(() => {
    if (!noteEditor || !noteDraft.trim()) return;
    const noteId = noteEditor.id ?? `note-${Date.now()}`;
    const savedRanges = noteEditor.ranges.length
      ? noteEditor.ranges
      : [{ blockId: "", offset: 0, length: 0 }];
    setReaderNotes((current) => [
      ...current.filter((item) => item.id !== noteId),
      ...savedRanges.map((range) => ({ ...range, id: noteId, text: noteDraft.trim() })),
    ]);
    if (noteEditor.source === "scroll" && !noteEditor.id) {
      webViewRef.current?.injectJavaScript(`
        window.__applyReaderNote?.(${JSON.stringify(noteId)});
        true;
      `);
    }
    setNoteEditor(null);
    setNoteDraft("");
  }, [noteDraft, noteEditor]);

  const deleteReaderNote = useCallback(() => {
    if (!noteEditor?.id) return;
    const noteId = noteEditor.id;
    setReaderNotes((current) => current.filter((item) => item.id !== noteId));
    webViewRef.current?.injectJavaScript(`
      window.__removeReaderNote?.(${JSON.stringify(noteId)});
      true;
    `);
    setNoteEditor(null);
    setNoteDraft("");
  }, [noteEditor]);

  const applyHighlightColor = useCallback((color: string) => {
    setHighlightPickerVisible(false);
    const pendingPagerHighlights = pendingPagerHighlightRef.current;
    if (pendingPagerHighlights?.length) {
      pendingPagerHighlightRef.current = null;
      setPagerHighlights((current) => [
        ...current.filter((highlight) => !pendingPagerHighlights.some((pending) =>
          highlight.blockId === pending.blockId &&
          highlight.offset === pending.offset &&
          highlight.length === pending.length
        )),
        ...pendingPagerHighlights.map((highlight) => ({ ...highlight, color })),
      ]);
      return;
    }
    const scrollRanges = scrollSelectionRangesRef.current;
    if (scrollRanges.length) {
      setPagerHighlights((current) => [
        ...current.filter((highlight) => !scrollRanges.some((range) =>
          highlight.blockId === range.blockId &&
          highlight.offset === range.offset &&
          highlight.length === range.length
        )),
        ...scrollRanges.map((range) => ({ ...range, color })),
      ]);
    }
    webViewRef.current?.injectJavaScript(`
      window.__applyReaderHighlight?.(${JSON.stringify(color)});
      true;
    `);
  }, []);

  const closeHighlightPicker = useCallback(() => {
    pendingPagerHighlightRef.current = null;
    setHighlightPickerVisible(false);
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
  const verticalMarginPreset = useReaderSettingsStore(
    (state) => state.verticalMarginPreset
  );
  const horizontalMarginPreset = useReaderSettingsStore(
    (state) => state.horizontalMarginPreset
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
  const guideColor = useReaderSettingsStore((state) => state.guideColor);
  const switchHighlightColor = useReaderSettingsStore(
    (state) => state.switchHighlightColor
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
    setCurrentSourcePage(sourcePage);
    if (anchor) {
      modeTextAnchorRef.current = anchor;
      const nextTtsOffset = ttsPositionForBlock(blocks, anchor.blockId, anchor.blockOffset);
      ttsStartOffsetRef.current = nextTtsOffset;
      setTtsStartOffset(nextTtsOffset);
      const block = blocks.find((candidate) => candidate.id === anchor.blockId);
      const word = block
        ? Array.from(block.text.matchAll(/\S+/g))[anchor.wordIndex]?.[0] ?? ""
        : "";
      if (isActive) {
        onSwitchAnchorChange?.(anchor.blockId, word, anchor.wordIndex);
      }
    }
    onPaginationChange?.(current, total);
    onPageChange?.(sourcePage);
  }, [blocks, isActive, onPageChange, onPaginationChange, onSwitchAnchorChange]);

  useEffect(() => {
    if (!webViewReady || isPaged) return;
    syncPageTransition();
    if (!activeModeDestination) return;
    const frame = requestAnimationFrame(() => {
      webViewRef.current?.postMessage(JSON.stringify({
        type: "goToSourcePage",
        ...activeModeDestination,
      }));
    });
    return () => cancelAnimationFrame(frame);
  }, [activeModeDestination, isPaged, syncPageTransition, webViewReady]);


  const sendReaderSettings = useCallback(() => {
    webViewRef.current?.postMessage(
    JSON.stringify({
      type: 'readerSettings',
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      paragraphSpacing: paragraphSpacing,
      verticalMarginPreset,
      horizontalMarginPreset,
      letterSpacing: letterSpacing,
      wordSpacing: wordSpacing,
      bold: bold,
      automaticHyphenation: automaticHyphenation,
      backgroundColor: backgroundColor,
      textColor: textColor,
    })
    );
  }, [fontFamily, fontSize, lineHeight, paragraphSpacing, verticalMarginPreset, horizontalMarginPreset, letterSpacing, wordSpacing, bold, automaticHyphenation, backgroundColor, textColor]);

  useEffect(() => {
    sendReaderSettings();
  }, [sendReaderSettings]);

  useEffect(() => {
    if (!webViewReady) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setTopBarVisibility",
      visible: topBarVisible,
      topBoundary: topBarVisible ? headerOverlayHeight : 0,
    }));
  }, [headerOverlayHeight, topBarVisible, webViewReady]);

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

  useEffect(() => {
    if (!webViewReady) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setReaderGuideColor",
      color: guideColor,
    }));
  }, [guideColor, webViewReady]);

  useEffect(() => {
    if (!webViewReady) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setSwitchHighlightColor",
      color: switchHighlightColor,
    }));
  }, [switchHighlightColor, webViewReady]);

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
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setReaderGuideColor",
      color: guideColor,
    }));
    webViewRef.current?.postMessage(JSON.stringify({
      type: "setSwitchHighlightColor",
      color: switchHighlightColor,
    }));
    // iOS WKWebView can settle on a non-zero document offset after load (the
    // native contentInset then tucks the opening line up under the header).
    // A freshly opened reader must always start at the absolute top. Wait a
    // couple of frames for WebKit's post-load layout to settle, then reset the
    // document unless an explicit destination / recovery navigation took over.
    webViewRef.current?.injectJavaScript(`
      (function() {
        if (window.__readerTransition === 'pager') return;
        if (window.__pendingSourceDestination) return;
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            if (window.__pendingSourceDestination) return;
            if (window.scrollY !== 0) window.scrollTo(0, 0);
          });
        });
      })();
      true;
    `);
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
  }, [guideBackgroundDimming, guideColor, onReady, readerGuideMode, sendReaderSettings, showSwitchHighlight, switchHighlightColor, syncPageTransition]);
  // Toolbar animation
  const [toolbarTranslateY] = useState(() => new Animated.Value(0));

  // Previous scroll position
  const lastScrollY =
    useRef(0);

  // Track toolbar visibility
  const toolbarHidden =
    useRef(false);
  const chromeResizeGuardUntil = useRef(0);
  const wordGuideScrollArmed = useRef(false);

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
            --reader-side-padding: 28px;
            --reader-top-padding: 24px;
            --reader-bottom-padding: 160px;
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
            padding: var(--reader-top-padding) var(--reader-side-padding);
            padding-bottom: var(--reader-bottom-padding);

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
            direction: ltr;
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
          .reader-note {
            text-decoration-line: underline;
            text-decoration-color: #dc2626;
            text-decoration-thickness: 2px;
            text-underline-offset: 3px;
          }
          .reader-note-marker {
            display: inline-flex;
            width: 18px;
            height: 18px;
            align-items: center;
            justify-content: center;
            margin: 0 3px;
            padding: 0;
            border: 0;
            border-radius: 9px;
            background: #dc2626;
            color: #ffffff;
            font-size: 17px;
            line-height: 14px;
            vertical-align: middle;
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
            background-color: color-mix(in srgb, var(--switch-highlight-color, #F59E0B) 62%, transparent);
            pointer-events: none;
            animation: reader-switch-pulse 1.2s ease-out forwards;
          }
          @keyframes reader-switch-pulse {
            0% {
              background-color: color-mix(in srgb, var(--switch-highlight-color, #F59E0B) 56%, transparent);
              box-shadow: 0 0 0 0 color-mix(in srgb, var(--switch-highlight-color, #F59E0B) 30%, transparent);
              opacity: 0.82;
            }
            32% {
              background-color: color-mix(in srgb, var(--switch-highlight-color, #F59E0B) 92%, transparent);
              box-shadow: 0 0 0 4px color-mix(in srgb, var(--switch-highlight-color, #F59E0B) 20%, transparent);
              opacity: 1;
            }
            62% {
              background-color: color-mix(in srgb, var(--switch-highlight-color, #F59E0B) 66%, transparent);
              box-shadow: 0 0 0 1px color-mix(in srgb, var(--switch-highlight-color, #F59E0B) 12%, transparent);
              opacity: 0.9;
            }
            100% {
              background-color: transparent;
              box-shadow: 0 0 0 0 transparent;
              opacity: 0;
            }
          }
          @keyframes reader-switch-fade {
            from { opacity: 0.9; }
            to { opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            #reader-switch-highlight {
              animation: reader-switch-fade 0.8s ease-out forwards;
            }
          }
          #reader-line-guide,
          #reader-word-guide {
            display: none;
            position: fixed;
            z-index: 30;
            pointer-events: none;
            border-radius: 4px;
            background: color-mix(in srgb, var(--guide-color, #F59E0B) 30%, transparent);
            box-shadow:
              0 0 0 9999px color-mix(
                in srgb,
                var(--reader-background, #f8fafc) var(--guide-dimming, 60%),
                transparent
              ),
              inset 0 0 0 1px color-mix(in srgb, var(--guide-color, #F59E0B) 55%, transparent);
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
  window.__processedReaderRevisions = new Set();
  window.__renderReaderAnnotations = function(highlights, notes) {
    document.querySelectorAll('.reader-note-marker').forEach(function(marker) { marker.remove(); });
    Array.from(document.querySelectorAll('.reader-note, .reader-user-highlight')).reverse().forEach(function(annotation) {
      const parent = annotation.parentNode;
      annotation.replaceWith(...Array.from(annotation.childNodes));
      parent?.normalize();
    });

    function wrapRange(annotation, kind) {
      const block = Array.from(document.querySelectorAll('[data-reader-block]')).find(function(candidate) {
        return candidate.dataset.blockId === annotation.blockId;
      });
      if (!block || annotation.length <= 0) return;
      const startOffset = annotation.offset;
      const endOffset = annotation.offset + annotation.length;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let cursor = 0;
      let textNode = walker.nextNode();
      while (textNode) {
        const length = (textNode.textContent || '').length;
        nodes.push({ node: textNode, start: cursor, end: cursor + length });
        cursor += length;
        textNode = walker.nextNode();
      }
      let lastNoteSpan = null;
      nodes.reverse().forEach(function(entry) {
        if (endOffset <= entry.start || startOffset >= entry.end) return;
        const start = Math.max(0, startOffset - entry.start);
        const end = Math.min(entry.end - entry.start, endOffset - entry.start);
        if (end <= start) return;
        const range = document.createRange();
        range.setStart(entry.node, start);
        range.setEnd(entry.node, end);
        const element = document.createElement(kind === 'note' ? 'span' : 'mark');
        element.className = kind === 'note' ? 'reader-note' : 'reader-user-highlight';
        if (kind === 'note') element.dataset.noteId = annotation.id;
        else element.style.backgroundColor = annotation.color || '#fde68a';
        range.surroundContents(element);
        if (kind === 'note') lastNoteSpan = element;
      });
      if (kind === 'note' && lastNoteSpan) {
        const marker = document.createElement('button');
        marker.className = 'reader-note-marker';
        marker.dataset.openNote = annotation.id;
        marker.setAttribute('aria-label', 'Open note');
        marker.textContent = '•';
        lastNoteSpan.after(marker);
      }
    }

    (highlights || []).forEach(function(highlight) { wrapRange(highlight, 'highlight'); });
    (notes || []).forEach(function(note) { wrapRange(note, 'note'); });
  };

  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'appendBlocks') {
        const revision = Number(message.revision);
        if (
          Number.isFinite(revision) &&
          window.__processedReaderRevisions.has(revision)
        ) return;
        if (Number.isFinite(revision)) {
          window.__processedReaderRevisions.add(revision);
        }
        const container = document.getElementById('reader-pages');
        if (!container) return;
        const anchorProbeY = Math.max(
          12,
          Math.min(
            window.innerHeight - 12,
            (Number(window.__readerTopBoundary) || 0) + 12
          )
        );
        const viewportAnchor = document
          .elementFromPoint(Math.max(1, window.innerWidth / 2), anchorProbeY)
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
        window.__renderReaderAnnotations(
          message.highlights || [],
          message.notes || []
        );
        window.__tryPendingSourceDestination?.();
        return;
      }

      if (message.type === 'setSwitchHighlightVisible') {
        window.__showReaderSwitchHighlight = Boolean(message.visible);
        if (!window.__showReaderSwitchHighlight) {
          window.__clearReaderSwitchHighlight?.(true);
        } else {
          window.__reportSwitchAnchor?.();
        }
        return;
      }

      if (message.type === 'setTopBarVisibility') {
        window.__readerTopBarVisible = Boolean(message.visible);
        window.__readerTopBoundary = window.__readerTopBarVisible
          ? Math.max(0, Number(message.topBoundary) || 0)
          : 0;
        if (window.__readerTopBarVisible) {
          requestAnimationFrame(function() {
            window.__reportSwitchAnchor?.(true);
            window.__refreshReaderGuideForTopBar?.();
          });
        } else {
          window.__clearReaderSwitchHighlight?.(true);
          requestAnimationFrame(function() {
            window.__refreshReaderGuideForTopBar?.();
          });
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

      if (message.type === 'setReaderGuideColor') {
        const color = String(message.color || '');
        if (/^#[0-9a-f]{6}$/i.test(color)) {
          document.documentElement.style.setProperty('--guide-color', color);
        }
        return;
      }

      if (message.type === 'setSwitchHighlightColor') {
        const color = String(message.color || '');
        if (/^#[0-9a-f]{6}$/i.test(color)) {
          document.documentElement.style.setProperty(
            '--switch-highlight-color',
            color
          );
        }
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
            let highlightAttempt = 0;
            const drawDestinationHighlight = function() {
              highlightAttempt += 1;
              const didDraw = window.__highlightSwitchWordAtIndex?.(
                resolvedTarget,
                pending.switchHighlightWordIndex,
                pending.switchHighlightWordProgress,
                pending.switchHighlightQuery
              );
              if (!didDraw && highlightAttempt < 12) {
                requestAnimationFrame(drawDestinationHighlight);
              }
            };
            drawDestinationHighlight();
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
          window.__applyReaderTransition(message.transition, Boolean(message.resetPage));
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

        // Vertical scrolling keeps a stable top and bottom inset so content
        // never shifts beneath the reader chrome. The adjustable vertical
        // margin presets are reserved for horizontal, page-based reading.
        const verticalMargin = 24;
        const horizontalMargin = {
          compact: 14,
          comfortable: 28,
          relaxed: 52
        }[message.horizontalMarginPreset] || 28;
        document.documentElement.style.setProperty(
          '--reader-top-padding',
          verticalMargin + 'px'
        );
        document.documentElement.style.setProperty(
          '--reader-bottom-padding',
          (verticalMargin + 136) + 'px'
        );
        document.documentElement.style.setProperty(
          '--reader-side-padding',
          horizontalMargin + 'px'
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
                // Anchor-stability scrolling keeps the reading position still
                // when typography changes mid-book. At the very top of a fresh
                // document, preserving a mid-viewport anchor instead pushes the
                // opening line up under the header, clipping the first words.
                if (window.scrollY > 1) {
                  window.scrollBy(0, nextTop - anchorTop);
                }
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

  window.__applyReaderNote = function(noteId) {
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
      if (range.intersectsNode(node) && !node.parentElement?.closest('.reader-note-marker')) {
        textNodes.push(node);
      }
      node = walker.nextNode();
    }
    let lastMarker = null;
    textNodes.reverse().forEach(function(textNode) {
      const start = textNode === range.startContainer ? range.startOffset : 0;
      const end = textNode === range.endContainer ? range.endOffset : (textNode.textContent || '').length;
      if (start >= end) return;
      const noteRange = document.createRange();
      noteRange.setStart(textNode, start);
      noteRange.setEnd(textNode, end);
      const underline = document.createElement('span');
      underline.className = 'reader-note';
      underline.dataset.noteId = noteId;
      noteRange.surroundContents(underline);
      if (!lastMarker) lastMarker = underline;
    });
    if (lastMarker) {
      const marker = document.createElement('button');
      marker.className = 'reader-note-marker';
      marker.dataset.openNote = noteId;
      marker.setAttribute('aria-label', 'Open note');
      marker.textContent = '•';
      lastMarker.after(marker);
    }
    selection?.removeAllRanges();
    window.__readerSelectionRange = null;
  };

  window.__removeReaderNote = function(noteId) {
    document.querySelectorAll('[data-open-note="' + noteId + '"]').forEach(function(marker) {
      marker.remove();
    });
    document.querySelectorAll('.reader-note[data-note-id="' + noteId + '"]').forEach(function(underline) {
      const parent = underline.parentNode;
      underline.replaceWith(document.createTextNode(underline.textContent || ''));
      parent?.normalize();
    });
  };

  window.__removeReaderHighlightSelection = function() {
    const selection = window.getSelection();
    const liveRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const range = liveRange && !liveRange.collapsed ? liveRange.cloneRange() : window.__readerSelectionRange;
    if (!range || range.collapsed) return;
    const matchingHighlights = [];
    document.querySelectorAll('.reader-user-highlight').forEach(function(mark) {
      if (range.intersectsNode(mark)) matchingHighlights.push(mark);
    });
    matchingHighlights.forEach(function(mark) {
      const parent = mark.parentNode;
      mark.replaceWith(...Array.from(mark.childNodes));
      parent?.normalize();
    });
    selection?.removeAllRanges();
    window.__readerSelectionRange = null;
  };

  document.addEventListener('click', function(event) {
    const marker = event.target.closest?.('[data-open-note]');
    if (!marker) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'openNote',
      noteId: marker.dataset.openNote,
    }));
  });
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
      onToolbarVisibilityChange?.(true);
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
    chromeResizeGuardUntil.current = Date.now() + 400;
    onToolbarVisibilityChange?.(true);
  }, [onToolbarVisibilityChange, toolbarTranslateY]);

  const hideToolbar = useCallback(() => {
    if (toolbarHidden.current) {
      onToolbarVisibilityChange?.(false);
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
    chromeResizeGuardUntil.current = Date.now() + 400;
    onToolbarVisibilityChange?.(false);
  }, [onToolbarVisibilityChange, toolbarTranslateY]);

  useEffect(() => {
    if (!readerGuideMode) return;
    wordGuideScrollArmed.current = false;
    chromeResizeGuardUntil.current = Date.now() + 400;
    if (isPaged) {
      hideToolbar();
    } else {
      showToolbar();
    }
  }, [hideToolbar, isPaged, readerGuideMode, showToolbar]);

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

      if (data.type === "wordGuideWillScroll") {
        wordGuideScrollArmed.current = true;
        return;
      }

      if (data.type === "readerTap") {
        if (readerGuideMode) return;
        if (toolbarHidden.current) showToolbar();
        else hideToolbar();
        return;
      }

      if (data.type === "readerSwipeStart") {
        hideToolbar();
        return;
      }

      if (data.type === "readerPagination") {
        const current = Math.max(1, Number(data.current) || 1);
        const total = Math.max(1, Number(data.total) || 1);
        const sourcePage = Math.max(1, Number(data.sourcePage) || 1);
        lastSourcePageRef.current = sourcePage;
        setCurrentSourcePage(sourcePage);
        onPaginationChange?.(current, total);
        onPageChange?.(sourcePage);
        return;
      }

      if (data.type === "readerPageMap" && data.pageMap && typeof data.pageMap === "object") {
        onPageMapChange?.(data.pageMap as Record<number, number>);
        return;
      }

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

        // Hiding the header changes the WebView viewport height. WebKit emits
        // a synthetic scroll update for that resize; treating it as a real
        // upward gesture immediately re-shows the header and causes flicker.
        if (Date.now() < chromeResizeGuardUntil.current) {
          lastScrollY.current = currentScrollY;
          return;
        }

        if (wordGuideEnabled && !wordGuideScrollArmed.current) {
          lastScrollY.current = currentScrollY;
          return;
        }

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
          wordGuideScrollArmed.current = false;
        }

        /*
         * Scrolling UP
         */
        else if (difference < 0) {
          showToolbar();
          wordGuideScrollArmed.current = false;
        }

        lastScrollY.current =
          currentScrollY;

        return;
      }

      // ------------------------------
      // TEXT SELECTION
      // ------------------------------

      if (data.type === "selection") {
        scrollSelectionRangesRef.current = Array.isArray(data.ranges) ? data.ranges : [];
        setSelectionHasHighlight(Boolean(data.hasHighlight));
        return;
      }

      if (data.type === "readerText") {
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
        if (!isPremium) {
          setShowAiPremiumPrompt(true);
          return;
        }
        setSelectedAIText(typeof data.text === "string" ? data.text.trim() : "");
        openBottomSheet("ai");
        return;
      }

      if (data.type === "openNote" && typeof data.noteId === "string") {
        openReaderNote(data.noteId);
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
        }
        if (typeof data.ttsOffset === "number") {
          const nextTtsOffset = Math.max(0, data.ttsOffset);
          ttsStartOffsetRef.current = nextTtsOffset;
          setTtsStartOffset(nextTtsOffset);
        }
        if (isActive) {
          onSwitchAnchorChange?.(
            data.blockId,
            typeof data.word === "string" ? data.word : "",
            typeof data.wordIndex === "number" ? data.wordIndex : 0,
          );
        }
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

    if (item === "ai" && !isPremium) {
      setShowAiPremiumPrompt(true);
      return;
    }

    /*
     * Update selected toolbar item.
     */
    openBottomSheet(item);

    if (item === "ai") {
      setAiExpanded(false);
    }

    if (item === "tts" && !isPaged) {
      webViewRef.current?.postMessage(JSON.stringify({ type: "requestReaderText" }));
    }

    /*
     * Make sure toolbar is visible
     * when user interacts with it.
     */
    showToolbar();

  };

  // --------------------------------
  // BOTTOM SHEET CONTENT
  // --------------------------------

  const renderBottomSheetContent = () => {

    switch (activeItem) {

      case "font":
        return <MemoizedFontSettings />;

      case "background":
        return (
          <MemoizedBackgroundSettings
            onSelectedTypeChange={setBackgroundSettingsTab}
          />
        );

      case "tts":
        return (
          <TTS
            text={ttsText}
            startOffset={ttsStartOffset}
            getStartOffset={() => ttsStartOffsetRef.current}
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
        return (
          <MemoizedSettings
            onTransitionChange={closeSettingsForTransitionChange}
          />
        );

      default:
        return null;
    }

  };

  const usesFixedSettingsSheet =
    activeItem === "background" && backgroundSettingsTab !== "presets";

  const bottomSheetSnapPoints = useMemo(
    () => activeItem === "tts"
      ? undefined
      : activeItem === "ai"
      ? ["40%", "90%"]
      : activeItem === "font"
      ? ["40%", "88%"]
      : usesFixedSettingsSheet
        ? ["40%"]
        : ["40%", "82%"],
    [activeItem, usesFixedSettingsSheet],
  );

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
          visible={noteEditor !== null}
          onRequestClose={() => setNoteEditor(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
            style={styles.noteModalContainer}
          >
            <Pressable
              accessibilityLabel="Close note editor"
              onPress={() => setNoteEditor(null)}
              style={styles.noteModalBackdrop}
            />
            <View style={[styles.noteCard, isDark && styles.noteCardDark]}>
              <Text style={[styles.noteEyebrow, isDark && styles.noteMutedDark]}>NOTE</Text>
              <Text style={[styles.noteTitle, isDark && styles.noteTextDark]}>
                {noteEditor?.id ? "Edit note" : "Add a note"}
              </Text>
              {noteEditor?.selectedText ? (
                <Text numberOfLines={3} style={[styles.noteQuote, isDark && styles.noteQuoteDark]}>
                  “{noteEditor.selectedText}”
                </Text>
              ) : null}
              <TextInput
                autoFocus
                multiline
                onChangeText={setNoteDraft}
                placeholder="Write your note…"
                placeholderTextColor={isDark ? "#7F897A" : "#9A9D95"}
                style={[styles.noteInput, isDark && styles.noteInputDark]}
                textAlignVertical="top"
                value={noteDraft}
              />
              <View style={styles.noteActions}>
                <Pressable onPress={() => setNoteEditor(null)} style={styles.noteCancelButton}>
                  <Text style={[styles.noteCancelText, isDark && styles.noteMutedDark]}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={!noteDraft.trim()}
                  onPress={saveReaderNote}
                  style={[styles.noteSaveButton, !noteDraft.trim() && styles.noteSaveButtonDisabled]}
                >
                  <Text style={styles.noteSaveText}>Save note</Text>
                </Pressable>
              </View>
              {noteEditor?.id ? (
                <View style={styles.noteDestructiveActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={deleteReaderNote}
                    style={styles.noteDestructiveButton}
                  >
                    <Text style={styles.noteDestructiveText}>Delete note</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          animationType="fade"
          transparent
          visible={highlightPickerVisible}
          onRequestClose={closeHighlightPicker}
        >
          <Pressable
            accessibilityLabel="Close highlight color picker"
            onPress={closeHighlightPicker}
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

        <Animated.View style={{ flex: 1, opacity: readerResizeOpacity }}>
        <SafeAreaView
          edges={isLandscape ? ["left", "right"] : []}
          style={{
            flex: 1,
            backgroundColor,
            // Keep the paged reading frame stable whether controls are shown
            // or hidden; changing its origin during a page turn is visibly
            // jarring and can make text appear to blink.
            paddingTop: isPaged && !isLandscape ? headerOverlayHeight : 0,
          }}
        >
          <View className="flex-1">
          {isPaged && modeHandoffReady && (
            <View style={StyleSheet.absoluteFill}>
              <HorizontalReaderPager
                blocks={blocks}
                userHighlights={pagerHighlights}
                onSelectionHighlightRequest={(highlights) => {
                  pendingPagerHighlightRef.current = highlights;
                  setHighlightPickerVisible(true);
                }}
                onSelectionRemoveHighlight={(ranges) => {
                  setPagerHighlights((current) => current.filter((highlight) =>
                    !ranges.some((range) =>
                      highlight.blockId === range.blockId &&
                      highlight.offset < range.offset + range.length &&
                      highlight.offset + highlight.length > range.offset
                    )
                  ));
                }}
                onSelectionAddNote={(ranges, selectedText) => {
                  setNoteDraft("");
                  setNoteEditor({ ranges, selectedText, source: "paged" });
                }}
                onOpenNote={openReaderNote}
                onSelectionAskAI={(text) => {
                  if (!isPremium) {
                    setShowAiPremiumPrompt(true);
                    return;
                  }
                  setSelectedAIText(text.trim());
                  openBottomSheet("ai");
                }}
                readingDirection={readerDirection}
                userNotes={readerNotes}
                spokenWordHighlight={spokenWordHighlight}
                guideMode={readerGuideMode}
                guideBackgroundDimming={guideBackgroundDimming}
                guideColor={guideColor}
                switchHighlightColor={switchHighlightColor}
                onGuideClose={closeReaderGuide}
                destination={activeModeDestination}
                stationarySwitchHighlight={stationarySwitchHighlight}
                fontFamily={fontFamily.split(",")[0].replaceAll("'", "").trim()}
                latoBoldBase64={latoBoldBase64}
                sourceSansBase64={sourceSansBase64}
                fontSize={fontSize}
                lineHeight={lineHeight}
                paragraphSpacing={paragraphSpacing}
                letterSpacing={letterSpacing}
                wordSpacing={wordSpacing}
                bold={bold}
                automaticHyphenation={automaticHyphenation}
                verticalMarginPreset={verticalMarginPreset}
                horizontalMarginPreset={horizontalMarginPreset}
                backgroundColor={backgroundColor}
                textColor={textColor}
                onPageChange={handlePagerPageChange}
                onPageMapChange={onPageMapChange}
                onReaderTap={() => {
                  if (readerGuideMode) return;
                  if (toolbarHidden.current) showToolbar();
                  else hideToolbar();
                }}
                onReaderReveal={() => {
                  if (!readerGuideMode) showToolbar();
                }}
                onReady={onReady}
                onSwipeStart={hideToolbar}
              />
            </View>
          )}
          {!isPaged && modeHandoffReady && (
          <View
            pointerEvents="auto"
            style={StyleSheet.absoluteFill}
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

          contentInset={
            !isPaged && !isLandscape
              ? { top: headerOverlayHeight, left: 0, bottom: 0, right: 0 }
              : undefined
          }

          contentInsetAdjustmentBehavior="never"

          /*
           * Native bounce behavior.
           */
          bounces={!isPaged && !useTranslatedTextDirection}

          /*
           * Smooth iOS scrolling.
           */
          decelerationRate="normal"

          /*
           * Android overscroll.
           */
          overScrollMode={isPaged || useTranslatedTextDirection ? "never" : "always"}

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

          menuItems={selectionHasHighlight ? readerMenuItems : readerMenuItemsWithoutRemove}

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
              if ('scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
              }
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
              function clearReaderSwitchHighlight(preserveExplicit) {
                const marker = document.getElementById('reader-switch-highlight');
                if (preserveExplicit && marker?.dataset.explicit === 'true') return;
                marker?.remove();
              }
              window.__clearReaderSwitchHighlight = clearReaderSwitchHighlight;

              function drawReaderSwitchHighlight(range, explicit) {
                clearReaderSwitchHighlight(false);
                if (!range) return false;
                const rect = Array.from(range.getClientRects()).find(function(item) {
                  return item.width > 0 && item.height > 0;
                });
                if (!rect) return false;
                const marker = document.createElement('div');
                marker.id = 'reader-switch-highlight';
                marker.dataset.explicit = explicit ? 'true' : 'false';
                marker.style.left = (rect.left + window.scrollX) + 'px';
                marker.style.top = (rect.top + window.scrollY) + 'px';
                marker.style.width = rect.width + 'px';
                marker.style.height = rect.height + 'px';
                marker.addEventListener('animationend', function() {
                  if (marker.isConnected) marker.remove();
                  window.__showReaderSwitchHighlight = false;
                }, { once: true });
                document.body.appendChild(marker);
                return true;
              }

              window.__highlightSwitchWordAtIndex = function(
                block,
                wordIndex,
                wordProgress,
                translatedQuery
              ) {
                if (!block) return false;
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
                if (!words.length) return false;

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
                if (!selected) return false;

                const range = document.createRange();
                range.setStart(selected.node, selected.match.index);
                range.setEnd(
                  selected.node,
                  selected.match.index + selected.match[0].length
                );
                const didDraw = drawReaderSwitchHighlight(range, true);
                if (window.__readerTransition === 'scroll') {
                  const rect = range.getBoundingClientRect();
                  const desiredTop = readerVisibleTopBoundary() + 8;
                  window.scrollBy({
                    top: rect.top - desiredTop,
                    left: 0,
                    behavior: 'auto'
                  });
                }
                return didDraw;
              };

              function readerVisibleTopBoundary() {
                if (!window.__readerTopBarVisible) return 0;
                // At the document start, the native WebView contentInset has
                // already placed the first line below the header. Applying the
                // header boundary again would skip the opening text. Once the
                // document has scrolled, content can pass behind the overlay
                // and the real header boundary is required.
                return window.scrollY <= 1
                  ? 0
                  : Math.max(0, Number(window.__readerTopBoundary) || 0);
              }

              function reportPreciseSwitchAnchor(force) {
                if (!window.__readerTopBarVisible && window.__readerTransition === 'scroll') return false;
                const isRtl = document.documentElement.dir === 'rtl';
                const topBoundary = readerVisibleTopBoundary();
                const blocksInView = Array.from(
                  document.querySelectorAll('[data-reader-block]')
                ).filter(function(block) {
                  const rect = block.getBoundingClientRect();
                  return rect.bottom > topBoundary && rect.top < window.innerHeight &&
                    rect.right > 0 && rect.left < window.innerWidth;
                }).sort(function(first, second) {
                  const firstRect = first.getBoundingClientRect();
                  const secondRect = second.getBoundingClientRect();
                  const vertical = Math.max(topBoundary, firstRect.top) -
                    Math.max(topBoundary, secondRect.top);
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
                        return item.width > 0 && item.height > 0 &&
                          item.bottom > topBoundary &&
                          item.top < window.innerHeight && item.right > 0 &&
                          item.left < window.innerWidth;
                      });
                      if (!rect) return;
                      // Preserve the original GitHub selection rule, but make
                      // the bottom of the visible header act as viewport y=0.
                      const visibleTop = Math.max(0, rect.top - topBoundary);
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
                const topBoundary = readerVisibleTopBoundary();
                for (let y = topBoundary + 12; y < window.innerHeight && !block; y += 36) {
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
                  Math.max(topBoundary, blockRect.top) + 8
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
                const topLimit = readerVisibleTopBoundary() + 12;
                const bottomLimit = window.innerHeight - 72;
                const blocks = new Set();
                const sampleXs = [
                  16,
                  window.innerWidth * 0.25,
                  window.innerWidth * 0.5,
                  window.innerWidth * 0.75,
                  window.innerWidth - 16
                ];
                for (let y = topLimit; y < bottomLimit; y += 20) {
                  sampleXs.forEach(function(x) {
                    const block = document.elementFromPoint(x, y)
                      ?.closest?.('[data-reader-block]');
                    if (block) blocks.add(block);
                  });
                }
                const candidates = [];
                Array.from(blocks).forEach(function(block) {
                  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                  let node = walker.nextNode();
                  while (node) {
                    if (isGuideTextNode(node)) {
                      wordMatches(node).forEach(function(match) {
                        const rect = wordRange(node, match).getBoundingClientRect();
                        if (
                          rect.width > 0 &&
                          rect.height > 0 &&
                          rect.top >= topLimit &&
                          rect.bottom <= bottomLimit
                        ) {
                          candidates.push({ node: node, match: match, rect: rect });
                        }
                      });
                    }
                    node = walker.nextNode();
                  }
                });
                candidates.sort(function(first, second) {
                  const vertical = first.rect.top - second.rect.top;
                  if (Math.abs(vertical) > 2) return vertical;
                  return document.documentElement.dir === 'rtl'
                    ? second.rect.right - first.rect.right
                    : first.rect.left - second.rect.left;
                });
                const first = candidates[0];
                if (first) {
                  drawWordGuide(first.node, first.match);
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
                const topLimit = readerVisibleTopBoundary() + 12;
                const bottomLimit = window.innerHeight - 76;
                if (targetRect.top >= topLimit && targetRect.bottom <= bottomLimit) {
                  if (targetRect.right > 0 && targetRect.left < window.innerWidth) {
                    drawWordGuide(target.node, target.match);
                    return;
                  }
                }
                if (window.__readerTransition !== 'scroll') {
                  const targetPage = Math.floor(
                    (targetRect.left + (window.__readerCurrentPage || 0) * window.innerWidth) /
                    window.innerWidth
                  );
                  window.__goToReaderPage?.(targetPage);
                  requestAnimationFrame(function() {
                    drawWordGuide(target.node, target.match);
                  });
                  return;
                }
                const currentRange = document.createRange();
                currentRange.setStart(currentWordNode, currentWordStart);
                currentRange.setEnd(currentWordNode, currentWordEnd);
                const currentRect = currentRange.getBoundingClientRect();
                const scrollDistance = direction < 0
                  ? Math.min(0, currentRect.bottom - bottomLimit)
                  : Math.max(0, currentRect.top - 16);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'wordGuideWillScroll'
                }));
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
                      rect.right < 0 ||
                      rect.left > window.innerWidth ||
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
                // A ragged RTL paragraph has a stable right edge, not a
                // stable left edge. Keep the guide anchored to the reading
                // edge so it continues to identify the same line after a
                // small layout or toolbar change.
                currentGuideLeft = document.documentElement.dir === 'rtl'
                  ? line.right
                  : line.left;
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
                    Math.abs((document.documentElement.dir === 'rtl'
                      ? line.right
                      : line.left) - currentGuideLeft);
                  const closestDistance =
                    Math.abs(closest.documentTop - currentGuideDocumentTop) * 1000 +
                    Math.abs((document.documentElement.dir === 'rtl'
                      ? closest.right
                      : closest.left) - currentGuideLeft);
                  return lineDistance < closestDistance
                      ? line
                      : closest;
                }, null);
              }

              function initializeLineGuide() {
                const topLimit = readerVisibleTopBoundary() + 12;
                const firstLine = collectGuideItems().find(function(line) {
                  return line.top >= topLimit && line.bottom <= window.innerHeight - 72;
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
                const topLimit = readerVisibleTopBoundary() + 12;
                const bottomLimit = window.innerHeight - 76;

                if (
                  nextLine &&
                  nextLine.top >= topLimit &&
                  nextLine.bottom <= bottomLimit
                ) {
                  drawLineGuide(nextLine);
                  return;
                }

                if (window.__readerTransition !== 'scroll') {
                  window.__navigateReaderPage?.(direction < 0 ? -1 : 1);
                  requestAnimationFrame(initializeLineGuide);
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

              window.__refreshReaderGuideForTopBar = function() {
                redrawLineGuideDuringScroll();
              };

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
                const sourcePage = reportSourcePage();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'readerPagination',
                  current: currentPage + 1,
                  total: pageCount,
                  sourcePage: sourcePage
                }));
                const pageMap = {};
                document.querySelectorAll('[data-source-page-section]').forEach(function(section) {
                  const source = Number(section.dataset.sourcePageSection);
                  const documentLeft = section.getBoundingClientRect().left +
                    currentPage * window.innerWidth;
                  if (source >= 1) {
                    pageMap[source] = Math.max(
                      1,
                      Math.min(pageCount, Math.floor(documentLeft / window.innerWidth) + 1)
                    );
                  }
                });
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'readerPageMap',
                  pageMap: pageMap
                }));
              }

              function finishPageChange(targetPage) {
                currentPage = targetPage;
                window.__readerCurrentPage = currentPage;
                pagedContent.style.transform = pageTransform(
                  currentPage,
                  0
                );
                const sourcePage = reportSourcePage();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'readerPagination',
                  current: currentPage + 1,
                  total: pageCount,
                  sourcePage: sourcePage
                }));
                requestAnimationFrame(function() {
                  window.__reportSwitchAnchor?.(true);
                });
              }

              function sourcePageAtViewport() {
                const sections = Array.from(
                  document.querySelectorAll('[data-source-page-section]')
                );
                if (!sections.length) return lastReportedSourcePage || 1;

                if (window.__readerTransition !== 'scroll') {
                  const edgeX = document.documentElement.dir === 'rtl'
                    ? window.innerWidth - 24
                    : 24;
                  const hit = document.elementFromPoint(edgeX, 36) ||
                    document.elementFromPoint(window.innerWidth / 2, 36);
                  const visibleSection = hit?.closest?.('[data-source-page-section]');
                  if (visibleSection) {
                    return Number(visibleSection.dataset.sourcePageSection) ||
                      lastReportedSourcePage || 1;
                  }
                }

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

              function goToReaderPage(targetPage, requestedDuration) {
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
                const duration = Math.max(
                  95,
                  Math.min(165, Number(requestedDuration) || 145)
                );
                if (nextPage === currentPage) {
                  pagedContent.style.transition =
                    'transform ' + duration +
                    'ms cubic-bezier(0.2, 0.72, 0.28, 1)';
                  pagedContent.style.transform = pageTransform(currentPage, 0);
                  return;
                }

                pageAnimationRunning = true;
                pagedContent.style.transition =
                  'transform ' + duration +
                  'ms cubic-bezier(0.2, 0.72, 0.28, 1)';
                finishPageChange(nextPage);
                setTimeout(function() {
                  pageAnimationRunning = false;
                  const sourcePage = reportSourcePage();
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'readerPagination',
                    current: currentPage + 1,
                    total: pageCount,
                    sourcePage: sourcePage
                  }));
                  window.__reportSwitchAnchor?.(true);
                }, duration + 12);
              }

              function applyReaderTransition(mode, resetPage) {
                window.__readerTransition = mode === 'pager' ? 'pager' : 'scroll';

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
                      if (currentWordNode && currentWordStart >= 0) {
                        redrawWordGuide();
                      } else {
                        initializeWordGuide();
                      }
                    } else {
                      if (currentGuideDocumentTop !== null) {
                        redrawLineGuideDuringScroll();
                      } else {
                        initializeLineGuide();
                      }
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

              let pagerTouchStart = null;
              window.addEventListener('touchstart', function(event) {
                if (window.__readerTransition === 'scroll' || pageAnimationRunning) return;
                const touch = event.touches[0];
                pagerTouchStart = touch ? {
                  x: touch.clientX,
                  y: touch.clientY,
                  time: Date.now(),
                  swipeAnnounced: false
                } : null;
              }, { passive: true });
              window.addEventListener('touchmove', function(event) {
                if (window.__readerTransition === 'scroll' || !pagerTouchStart) return;
                const touch = event.touches[0];
                if (!touch) return;
                const dx = touch.clientX - pagerTouchStart.x;
                const dy = touch.clientY - pagerTouchStart.y;
                if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.08) {
                  const selection = window.getSelection();
                  if (selection && !selection.isCollapsed) return;
                  if (document.documentElement.dir !== 'rtl') {
                    let preview = Math.max(
                      -window.innerWidth * 0.34,
                      Math.min(window.innerWidth * 0.34, dx)
                    );
                    if (
                      (currentPage === 0 && preview > 0) ||
                      (currentPage === pageCount - 1 && preview < 0)
                    ) {
                      preview *= 0.18;
                    }
                    pagedContent.style.transition = 'none';
                    pagedContent.style.transform =
                      'translate3d(' +
                      (-currentPage * window.innerWidth + preview) +
                      'px, 0, 0)';
                  }
                  if (!pagerTouchStart.swipeAnnounced) {
                    pagerTouchStart.swipeAnnounced = true;
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'readerSwipeStart'
                    }));
                  }
                }
              }, { passive: true });
              window.addEventListener('touchend', function(event) {
                if (window.__readerTransition === 'scroll' || !pagerTouchStart) return;
                const touch = event.changedTouches[0];
                const start = pagerTouchStart;
                pagerTouchStart = null;
                if (!touch) return;
                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;
                const elapsed = Date.now() - start.time;
                const velocity = Math.abs(dx) / Math.max(1, elapsed);
                const horizontalIntent = Math.abs(dx) > Math.abs(dy) * 1.08;
                const commitsPage = Math.abs(dx) > 28 ||
                  (Math.abs(dx) > 16 && velocity > 0.32);
                if (horizontalIntent && commitsPage && elapsed < 700) {
                  const selection = window.getSelection();
                  if (selection && !selection.isCollapsed) return;
                  const isRtl = document.documentElement.dir === 'rtl';
                  const direction = dx < 0
                    ? (isRtl ? -1 : 1)
                    : (isRtl ? 1 : -1);
                  if (!start.swipeAnnounced) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'readerSwipeStart'
                    }));
                  }
                  const duration = Math.round(155 - Math.min(60, velocity * 70));
                  goToReaderPage(currentPage + direction, duration);
                  return;
                }
                if (start.swipeAnnounced) {
                  goToReaderPage(currentPage, 120);
                  return;
                }
                if (Math.hypot(dx, dy) < 12 && elapsed < 350) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'readerTap'
                  }));
                }
              }, { passive: true });

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

                          const selectionRange = window.__readerSelectionRange;
                          const ranges = [];
                          if (selectionRange) {
                            document.querySelectorAll('[data-reader-block]').forEach(function(block) {
                              try {
                                if (!selectionRange.intersectsNode(block)) return;
                                const startRange = document.createRange();
                                startRange.selectNodeContents(block);
                                if (block.contains(selectionRange.startContainer)) {
                                  startRange.setEnd(selectionRange.startContainer, selectionRange.startOffset);
                                } else {
                                  startRange.collapse(true);
                                }
                                const endRange = document.createRange();
                                endRange.selectNodeContents(block);
                                if (block.contains(selectionRange.endContainer)) {
                                  endRange.setEnd(selectionRange.endContainer, selectionRange.endOffset);
                                }
                                let start = startRange.toString().length;
                                let end = endRange.toString().length;
                                const sourceText = block.textContent || '';
                                while (start < end && /\\s/.test(sourceText[start] || '')) start += 1;
                                while (end > start && /\\s/.test(sourceText[end - 1] || '')) end -= 1;
                                if (end > start) ranges.push({
                                  blockId: block.dataset.blockId,
                                  offset: start,
                                  length: end - start
                                });
                              } catch (error) {}
                            });
                          }
                          const hasHighlight = Boolean(selectionRange) && Array.from(
                            document.querySelectorAll('.reader-user-highlight')
                          ).some(function(mark) {
                            try { return selectionRange.intersectsNode(mark); }
                            catch (error) { return false; }
                          });

                          window.ReactNativeWebView.postMessage(
                            JSON.stringify({
                              type: 'selection',
                              text: text,
                              hasHighlight: hasHighlight,
                              ranges: ranges
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
          )}
          </View>
        </SafeAreaView>
        </Animated.View>

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
      isAiLocked={!isPremium}
      onSelectItem={handleToolbarPress}
    />
  </Animated.View>
)}

        {readerGuideMode && !isPaged && (
          <View
            pointerEvents="box-none"
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              accessibilityLabel="Move reading guide. Tap upper half for up, lower half for down"
              accessibilityRole="button"
              onPress={(event) => {
                moveLineGuide(event.nativeEvent.pageY < windowHeight / 2 ? -1 : 1);
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
          enableDynamicSizing={activeItem === "tts"}
          maxDynamicContentSize={windowHeight * 0.9}
          handleComponent={
            activeItem === "ai"
              ? ReaderAiBottomSheetHandle
              : HiddenBottomSheetHandle
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

        <PremiumFeatureModal
          description="Ask questions, summarize difficult sections, and understand your document with the Bic Reader AI Assistant."
          featureName="AI Assistant is a Premium feature"
          onClose={() => setShowAiPremiumPrompt(false)}
          onUpgrade={() => {
            setShowAiPremiumPrompt(false);
            router.push('/onboarding/premium');
          }}
          visible={showAiPremiumPrompt}
        />

      </View>

    </BottomSheet>
  );
};

export default ReaderView;

const styles = StyleSheet.create({
  noteModalContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  noteModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 14, 0.48)",
  },
  noteCard: {
    width: "100%",
    maxWidth: 390,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E5DC",
    borderRadius: 24,
    backgroundColor: "#FFFEFA",
    shadowColor: "#11180C",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 12,
  },
  noteCardDark: { borderColor: "#343A31", backgroundColor: "#1A1E18" },
  noteEyebrow: { color: "#B42318", fontFamily: "Lato_700Bold", fontSize: 10, letterSpacing: 1.2 },
  noteTitle: { marginTop: 5, color: "#20251D", fontFamily: "Lato_700Bold", fontSize: 22 },
  noteTextDark: { color: "#F4F5F1" },
  noteMutedDark: { color: "#A6ADA1" },
  noteQuote: { marginTop: 12, color: "#687061", fontFamily: "SourceSans3_400Regular", fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  noteQuoteDark: { color: "#B8BEB3" },
  noteInput: { minHeight: 125, marginTop: 15, padding: 14, borderWidth: 1, borderColor: "#D9DED2", borderRadius: 15, color: "#20251D", backgroundColor: "#F8F8F3", fontFamily: "SourceSans3_400Regular", fontSize: 16, lineHeight: 22 },
  noteInputDark: { borderColor: "#3B4237", color: "#F4F5F1", backgroundColor: "#121510" },
  noteActions: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  noteCancelButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  noteCancelText: { color: "#66705E", fontFamily: "Lato_700Bold", fontSize: 14 },
  noteSaveButton: { minHeight: 46, justifyContent: "center", paddingHorizontal: 20, borderRadius: 14, backgroundColor: "#639922" },
  noteSaveButtonDisabled: { opacity: 0.45 },
  noteSaveText: { color: "#FFFFFF", fontFamily: "Lato_700Bold", fontSize: 14 },
  noteDestructiveActions: {
    marginTop: 15,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(180, 35, 24, 0.2)",
  },
  noteDestructiveButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  noteDestructiveText: { color: "#B42318", fontFamily: "Lato_700Bold", fontSize: 14 },
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
