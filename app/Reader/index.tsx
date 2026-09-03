import BackButton from "@/components/Backbutton";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import OriginalPDF, { type PdfOutlineItem } from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
import {
  translationLanguages,
  type TranslationLanguage,
} from "@/components/readernavbar/TTS";
import ReaderSearchButton from "@/components/ReaderSearchButton";
import ReaderModeTabs, {
  type ReaderMode,
} from "@/components/readerui/ReaderModeTabs";
import ThreeLinesButton, {
  type ReaderChapter,
} from "@/components/threelinesbutton";
import { Box } from "@/components/ui/box";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  getPdfById,
  markPdfOpened,
  peekCachedPdfById,
  updatePdfProgress,
} from "@/database/pdfRepository";
import {
  getCachedPdfExtraction,
  getCachedPdfExtractionPreview,
  savePdfExtraction,
} from "@/database/pdfExtractionRepository";
import {
  getCachedPdfTranslations,
  getPdfTranslationPreference,
  savePdfTranslationPreference,
  savePdfTranslations,
} from "@/database/pdfTranslationRepository";
import type { PdfDocument } from "@/database/types";
import { useScreenRotation } from "@/hooks/screenRotation";
import type { PdfPageSize } from "@/hooks/switchhighlight";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  extractPdfDocumentRange,
  isPdfEngineLinked,
  type ExtractedPdfBlock,
  type ExtractedPdfDocument,
} from "@/modules/bic-pdf-reader";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  isBookTranslationCancellation,
  translationSourceHash,
  translatePdfBlocks,
} from "@/services/translationService";
import { normalizeReaderBlocks } from "@/services/readerTypography";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import { anchorController } from "@/architecture/anchor/AnchorController";
import type {
  FindWordAnchor,
  FindWordTarget,
} from "@/architecture/FindWordInOtherTab";
import { useAnchorStore } from "@/architecture/anchor/AnchorStore";
import {
  createVerticalAnchorAdapter,
  verticalDestination,
} from "@/architecture/anchor/VerticalAnchorAdapter";
import {
  createHorizontalAnchorAdapter,
  generatedPageDestination,
} from "@/architecture/anchor/HorizontalAnchorAdapter";
import {
  createOriginalAnchorAdapter,
  originalHighlightTarget,
} from "@/architecture/anchor/OriginalAnchorAdapter";
import { transitionController } from "@/architecture/anchor/TransitionController";
import { proportionalWordIndex } from "@/architecture/anchor/TranslationAnchorMapper";
import type {
  CanonicalAnchor,
  ReaderLayout as AnchorReaderLayout,
} from "@/architecture/anchor/AnchorTypes";
import {
  loadReaderPosition,
  saveReaderPosition,
} from "@/database/readerPositionRepository";
import {
  translatedDestinationForAnchor,
  useTabSwitchTranslate,
} from "@/hooks/TabSwitchTranslate";

function isVisibleReaderBlock(block: ExtractedPdfBlock) {
  if (block.hiddenInReader) return false;
  const normalized = block.text.toLowerCase();
  const isPrepressMarker =
    normalized.includes(".qxp") ||
    normalized.startsWith("aronson rdg_") ||
    (normalized.includes("_ch") && normalized.includes(" page "));
  return !isPrepressMarker;
}

function firstMissingPageIndex(
  document: ExtractedPdfDocument | null | undefined,
) {
  if (!document) return 0;
  const loaded = new Set(document.pages.map((page) => page.page));
  for (let page = 1; page <= document.pageCount; page += 1) {
    if (!loaded.has(page)) return page - 1;
  }
  return document.pageCount;
}

function outlineTranslationBlocks(
  items: PdfOutlineItem[],
  path = "outline",
): ExtractedPdfBlock[] {
  return items.flatMap((item, index) => {
    const chapterId = `${path}-${index}-${item.page}`;
    const block: ExtractedPdfBlock = {
      id: `toc-${chapterId}`,
      kind: "heading",
      text: item.title,
      page: item.page,
      sourceBounds: { left: 0, top: 0, right: 0, bottom: 0 },
      wordBounds: [],
      readingOrder: index,
      confidence: 1,
      hiddenInReader: true,
    };
    return [
      block,
      ...outlineTranslationBlocks(item.children ?? [], `${path}-${index}`),
    ];
  });
}

const FIRST_READER_PAGE_BATCH = 1;
const WARM_READER_PAGE_COUNT = 5;
const BACKGROUND_READER_PAGE_BATCH = 8;
const TRANSLATION_WORK_CHUNK = 64;
const TRANSLATION_PRIORITY_CHUNK = 32;
const TRANSLATION_PRIORITY_RADIUS = 12;
const CHAPTER_EXTRACTION_PAGES_ABOVE = 3;
const CHAPTER_EXTRACTION_PAGE_COUNT = 7;
const TRANSLATION_PREFETCH_DISTANCE = 7;
const EXTRACTION_CACHE_PAGE_INTERVAL = 32;
// Translation is windowed around the current reading position (plus the
// opening pages) so a long book is translated as the user reads instead of in
// one continuous background sweep that saturates the JS thread.
const TRANSLATION_WINDOW_BEHIND = 5;
const TRANSLATION_WINDOW_AHEAD = 40;

function currentCachedTranslation(
  cache: Map<string, ExtractedPdfBlock>,
  languageCode: string,
  source: ExtractedPdfBlock,
) {
  const translated = cache.get(`${languageCode}:${source.id}`);
  return translated?.sourceContentHash === translationSourceHash(source.text) &&
    (source.text.trim().length === 0 || translated.text.trim().length > 0)
    ? translated
    : undefined;
}

async function waitForCurrentTransition(
  transitionId: number,
  predicate: () => boolean,
  timeoutMs = 60_000,
  abort?: () => boolean,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!transitionController.isCurrent(transitionId)) return false;
    if (abort?.()) return false;
    if (predicate()) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

const readerSnapshotCache = new WeakMap<
  ExtractedPdfDocument,
  {
    blocks: ExtractedPdfBlock[];
    pageSizes: Record<number, PdfPageSize>;
  }
>();

function readerSnapshot(document: ExtractedPdfDocument) {
  const cached = readerSnapshotCache.get(document);
  if (cached) return cached;
  const pageSizes: Record<number, PdfPageSize> = Object.fromEntries(
    document.pages.map((page) => [
      page.page,
      { width: page.width, height: page.height },
    ]),
  );
  const snapshot = {
    blocks: normalizeReaderBlocks(
      document.pages.flatMap((page) =>
        page.blocks.filter(isVisibleReaderBlock),
      ),
    ),
    pageSizes,
  };
  readerSnapshotCache.set(document, snapshot);
  return snapshot;
}

function BookPageSkeleton() {
  const lineWidths = [
    "w-full",
    "w-[94%]",
    "w-[98%]",
    "w-[88%]",
    "w-full",
    "w-[92%]",
    "w-[96%]",
    "w-[84%]",
    "w-full",
    "w-[90%]",
    "w-[97%]",
    "w-[72%]",
  ];

  return (
    <View className="flex-1 bg-white px-6 py-8 dark:bg-[#151814]">
      <Skeleton
        speed={2}
        startColor="bg-[#E7E3D8]"
        className="mb-8 h-7 w-[58%] rounded-md"
      />
      <View className="gap-4">
        {lineWidths.map((width, index) => (
          <Skeleton
            key={`${width}-${index}`}
            speed={2}
            startColor="bg-[#E7E3D8]"
            className={`h-3.5 rounded-full ${width}`}
          />
        ))}
      </View>
      <View className="mt-10 gap-4">
        {lineWidths.slice(0, 7).map((width, index) => (
          <Skeleton
            key={`second-${width}-${index}`}
            speed={2}
            startColor="bg-[#E7E3D8]"
            className={`h-3.5 rounded-full ${width}`}
          />
        ))}
      </View>
    </View>
  );
}

function ReaderScreenContent() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const translatedActionWidth = Math.min(
    36,
    Math.max(28, (windowWidth / 2 - 108) / 3),
  );
  const translatedActionInset = (translatedActionWidth - 20) / 2;
  const { pdfId } = useLocalSearchParams<{ pdfId?: string }>();
  const db = useSQLiteContext();
  const initiallyCachedPdf = pdfId ? peekCachedPdfById(pdfId) : null;
  const readerTransition = useReaderSettingsStore((state) => state.transition);
  const readerPresentationKey = useReaderSettingsStore((state) =>
    [
      state.fontFamily,
      state.fontSize,
      state.lineHeight,
      state.paragraphSpacing,
      state.verticalMarginPreset,
      state.horizontalMarginPreset,
      state.letterSpacing,
      state.wordSpacing,
      state.bold ? 1 : 0,
      state.automaticHyphenation ? 1 : 0,
    ].join(":"),
  );
  const canonicalAnchor = useAnchorStore((state) => state.canonicalAnchor);
  const anchorTransition = useAnchorStore((state) => state.transition);
  const hideTopBarOnScroll = useReaderSettingsStore(
    (state) => state.hideTopBarOnScroll,
  );
  const lineGuideEnabled = useReaderSettingsStore(
    (state) => state.lineGuideEnabled,
  );
  const wordGuideEnabled = useReaderSettingsStore(
    (state) => state.wordGuideEnabled,
  );
  const readerGuideEnabled = lineGuideEnabled || wordGuideEnabled;
  const [readerChromeHidden, setReaderChromeHidden] = useState(false);
  const isDark = useColorScheme() === "dark";
  const [pdf, setPdf] = useState<PdfDocument | null>(initiallyCachedPdf);
  const [isLoading, setIsLoading] = useState(!initiallyCachedPdf);
  const [positionHydratedFor, setPositionHydratedFor] = useState<string | null>(
    null,
  );
  const [initialRestoreCompleteFor, setInitialRestoreCompleteFor] = useState<
    string | null
  >(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [headerVisibility] = useState(() => new Animated.Value(1));
  const [activeTab, setActiveTab] = useState<ReaderMode>("reader");
  const [translationLanguage, setTranslationLanguage] =
    useState<TranslationLanguage>();
  const [translatedBlocks, setTranslatedBlocks] = useState<ExtractedPdfBlock[]>(
    [],
  );
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationPriorityVersion, setTranslationPriorityVersion] =
    useState(0);
  const [translationCacheReadyFor, setTranslationCacheReadyFor] = useState<
    string | null
  >(null);
  const [translatedReaderActivated, setTranslatedReaderActivated] =
    useState(false);
  const [translatedChapterRequest, setTranslatedChapterRequest] = useState<{
    sourcePage: number;
    targetBlockId?: string;
    targetWordProgress?: number;
    nonce: number;
  } | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [rotationMaskVisible, setRotationMaskVisible] = useState(false);
  const rotationMaskFallback = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const rotationMaskStartedAt = React.useRef(0);
  const rotationInProgress = React.useRef(false);
  const layoutHandoffInProgress = React.useRef(false);
  const previousRotationWidth = React.useRef(windowWidth);
  const captureCanonicalAnchorRef = React.useRef<() => CanonicalAnchor | null>(
    () => null,
  );
  const isRotationInProgress = useCallback(
    () => rotationInProgress.current || layoutHandoffInProgress.current,
    [],
  );
  // Derive landscape from the live window dimensions instead of a separately
  // debounced orientation event. The native layout rotates at the same moment
  // windowWidth/windowHeight change, so the chrome (header, status bar, content
  // offsets) now updates in the exact same render as the rotation instead of a
  // visible frame later.
  const isLandscape = windowWidth > windowHeight;
  const [readerBlocks, setReaderBlocks] = useState<ExtractedPdfBlock[]>([]);
  const [readerPageSizes, setReaderPageSizes] = useState<
    Record<number, PdfPageSize>
  >({});
  const [readerLoading, setReaderLoading] = useState(true);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerPageCount, setReaderPageCount] = useState(0);
  const [readerContentReady, setReaderContentReady] = useState(false);
  const readerContentReadyRef = React.useRef(false);
  const translatedContentReadyRef = React.useRef(false);
  const originalContentReadyRef = React.useRef(false);
  const readerSkeletonOpacity = useSharedValue(1);
  const [readerCurrentPage, setReaderCurrentPage] = useState(1);
  const [readerDisplayCurrentPage, setReaderDisplayCurrentPage] = useState(1);
  const [readerDisplayPageCount, setReaderDisplayPageCount] = useState(0);
  const [translatedDisplayCurrentPage, setTranslatedDisplayCurrentPage] =
    useState(1);
  const [translatedDisplayPageCount, setTranslatedDisplayPageCount] =
    useState(0);
  const [readerChapterPageMap, setReaderChapterPageMap] = useState<
    Record<number, number>
  >({});
  const [translatedChapterPageMap, setTranslatedChapterPageMap] = useState<
    Record<number, number>
  >({});
  const [originalCurrentPage, setOriginalCurrentPage] = useState(1);
  const originalCurrentPageRef = React.useRef(1);
  const pendingOriginalPageRef = React.useRef<number | null>(null);
  const [originalPageCount, setOriginalPageCount] = useState(0);
  const [originalZoomResetNonce, setOriginalZoomResetNonce] = useState(0);
  const [originalDestination, setOriginalDestination] = useState<{
    page: number;
    nonce: number;
  } | null>(null);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [readerDestination, setReaderDestination] = useState<{
    page: number;
    readerPage?: number;
    blockId?: string;
    searchQuery?: string;
    searchMatchIndex?: number;
    switchHighlightOffset?: number;
    switchHighlightWordIndex?: number;
    switchHighlightWordProgress?: number;
    nonce: number;
  } | null>(null);
  const [readerSwitchHighlight, setReaderSwitchHighlight] = useState<{
    blockId: string;
    offset: number;
    nonce: number;
  } | null>(null);
  const [translatedDestination, setTranslatedDestination] = useState<{
    page: number;
    readerPage?: number;
    blockId?: string;
    searchMatchIndex?: number;
    switchHighlightOffset?: number;
    switchHighlightWordIndex?: number;
    switchHighlightWordProgress?: number;
    switchHighlightQuery?: string;
    nonce: number;
  } | null>(null);
  const [translatedSwitchHighlight, setTranslatedSwitchHighlight] = useState<{
    blockId: string;
    offset: number;
    nonce: number;
  } | null>(null);
  const readerExtractionStarted = React.useRef(false);
  const requestedExtractionPages = React.useRef<number[]>([]);
  const requestedTranslationPage = React.useRef<number | null>(null);
  const requestedTranslationBlockId = React.useRef<string | null>(null);
  const translatedBlockCache = React.useRef(
    new Map<string, ExtractedPdfBlock>(),
  );
  const translationQueue = React.useRef<Promise<void>>(Promise.resolve());
  const translationPersistenceQueue = React.useRef<Promise<void>>(
    Promise.resolve(),
  );
  const translationPublishTimer = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const scheduledTranslationLanguage = React.useRef<string | null>(null);
  const activeTranslationLanguage = React.useRef<string | null>(null);
  const activeTabRef = React.useRef<ReaderMode>("reader");
  const translatedSourcePageRef = React.useRef(1);
  const translationSourceLanguage = React.useRef<string | undefined>(undefined);
  const latestReaderBlocks = React.useRef(readerBlocks);
  const latestTranslatedBlocks = React.useRef(translatedBlocks);
  const latestPdf = React.useRef(pdf);
  const latestTranslationError = React.useRef(translationError);
  const latestPdfOutline = React.useRef(pdfOutline);
  const latestReaderPageSizes = React.useRef(readerPageSizes);
  const latestReaderPageCount = React.useRef(readerPageCount);
  const positionRestoreApplied = React.useRef(false);
  const previousReaderTransition = React.useRef(readerTransition);
  const pendingLayoutAnchor = React.useRef<CanonicalAnchor | null>(null);
  const previousPresentationKey = React.useRef(
    readerTransition === "pager"
      ? `${readerPresentationKey}:${isLandscape ? "landscape" : "portrait"}`
      : `${readerPresentationKey}:vertical`,
  );
  const positionPersistenceTimer = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const {
    actualReaderAnchor,
    actualTranslatedAnchor,
    reportReaderAnchor: handleReaderSwitchAnchorChange,
    reportTranslatedAnchor: handleTranslatedSwitchAnchorChange,
  } = useTabSwitchTranslate({
    documentId: pdfId,
    languageCode: translationLanguage?.code,
    activeMode: activeTab,
    readerBlocks,
    translatedBlocks,
    isRotationInProgress,
  });
  const canonicalOriginalHighlight = useMemo(
    () =>
      originalHighlightTarget(canonicalAnchor, readerBlocks, readerPageSizes),
    [canonicalAnchor, readerBlocks, readerPageSizes],
  );

  const beginRotationMask = useCallback(() => {
    if (activeTabRef.current === "original") return;
    if (rotationMaskFallback.current)
      clearTimeout(rotationMaskFallback.current);
    rotationInProgress.current = true;
    rotationMaskStartedAt.current = Date.now();
    setRotationMaskVisible(true);
    rotationMaskFallback.current = setTimeout(() => {
      rotationInProgress.current = false;
      setRotationMaskVisible(false);
      rotationMaskFallback.current = null;
    }, 800);
  }, []);

  const finishRotationMask = useCallback(() => {
    rotationInProgress.current = false;
    if (rotationMaskFallback.current) {
      clearTimeout(rotationMaskFallback.current);
      rotationMaskFallback.current = null;
    }
    const reveal = () => setRotationMaskVisible(false);
    const remaining = Math.max(
      0,
      300 - (Date.now() - rotationMaskStartedAt.current),
    );
    if (remaining > 0) {
      rotationMaskFallback.current = setTimeout(() => {
        rotationMaskFallback.current = null;
        reveal();
      }, remaining);
    } else {
      reveal();
    }
  }, []);

  const handleOrientationChange = useCallback(
    (landscape: boolean) => {
      // Vertical scrolling has its own rotation handoff. Pin the exact
      // canonical block/word before native dimensions change so DOM insertion,
      // pruning, and WebKit reflow cannot turn a source-page location into a
      // stale pixel offset. Horizontal mode owns a separate pager state.
      if (readerTransition !== "pager" && activeTabRef.current !== "original") {
        const anchor = captureCanonicalAnchorRef.current();
        if (anchor) {
          const nonce = Date.now();
          if (activeTabRef.current === "translated" && translationLanguage) {
            setTranslatedDestination(
              translatedDestinationForAnchor(
                anchor,
                translationLanguage.code,
                latestTranslatedBlocks.current,
                nonce,
              ),
            );
          } else {
            setReaderDestination(verticalDestination(anchor, nonce));
          }
        }
      }
      beginRotationMask();
      // Restore portrait chrome in the same React batch as orientation. A
      // separate follow-up effect produced a visible hidden-then-shown frame.
      headerVisibility.stopAnimation();
      headerVisibility.setValue(landscape ? 0 : 1);
      if (!landscape) setReaderChromeHidden(false);
    },
    [
      beginRotationMask,
      headerVisibility,
      readerTransition,
      translationLanguage,
    ],
  );
  useScreenRotation(handleOrientationChange);

  useLayoutEffect(() => {
    if (Math.abs(previousRotationWidth.current - windowWidth) < 1) return;
    previousRotationWidth.current = windowWidth;
    beginRotationMask();
  }, [beginRotationMask, windowWidth]);

  useEffect(
    () => () => {
      if (rotationMaskFallback.current)
        clearTimeout(rotationMaskFallback.current);
    },
    [],
  );

  activeTranslationLanguage.current = translationLanguage?.code ?? null;
  activeTabRef.current = activeTab;
  latestReaderBlocks.current = readerBlocks;
  latestTranslatedBlocks.current = translatedBlocks;
  latestPdf.current = pdf;
  latestTranslationError.current = translationError;
  latestPdfOutline.current = pdfOutline;
  latestReaderPageSizes.current = readerPageSizes;
  latestReaderPageCount.current = readerPageCount;

  useEffect(() => {
    if (!pdfId) return;
    setPositionHydratedFor(null);
    setInitialRestoreCompleteFor(null);
    positionRestoreApplied.current = false;
    useAnchorStore.getState().resetForDocument(pdfId);
    useAnchorStore.getState().setActiveMode("reader");
    useAnchorStore
      .getState()
      .setActiveLayout(
        useReaderSettingsStore.getState().transition === "pager"
          ? "horizontal"
          : "vertical",
      );
    let cancelled = false;
    void loadReaderPosition(db, pdfId)
      .then((anchor) => {
        if (cancelled) return;
        anchorController.initialize(
          anchor ?? {
            documentId: pdfId,
            sourcePage: Math.max(1, peekCachedPdfById(pdfId)?.currentPage || 1),
          },
        );
      })
      .catch(() => {
        if (cancelled) return;
        anchorController.initialize({
          documentId: pdfId,
          sourcePage: Math.max(1, peekCachedPdfById(pdfId)?.currentPage || 1),
        });
      })
      .finally(() => {
        if (!cancelled) setPositionHydratedFor(pdfId);
      });
    anchorController.setPersistenceScheduler((anchor) => {
      if (anchor.documentId !== pdfId) return;
      if (positionPersistenceTimer.current)
        clearTimeout(positionPersistenceTimer.current);
      positionPersistenceTimer.current = setTimeout(() => {
        positionPersistenceTimer.current = null;
        void saveReaderPosition(db, anchor);
        void updatePdfProgress(
          db,
          anchor.documentId,
          anchor.sourcePage,
          latestReaderPageCount.current ||
            latestPdf.current?.totalPages ||
            anchor.sourcePage,
        );
      }, 750);
    });
    return () => {
      cancelled = true;
      const pending = positionPersistenceTimer.current;
      if (pending) clearTimeout(pending);
      positionPersistenceTimer.current = null;
      const anchor = anchorController.current();
      if (anchor?.documentId === pdfId) void saveReaderPosition(db, anchor);
      anchorController.setPersistenceScheduler(undefined);
    };
  }, [db, pdfId]);

  useEffect(() => {
    if (!pdfId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      const anchor = anchorController.current();
      if (anchor?.documentId === pdfId) void saveReaderPosition(db, anchor);
    });
    return () => subscription.remove();
  }, [db, pdfId]);

  useEffect(() => {
    translationSourceLanguage.current = undefined;
    translatedContentReadyRef.current = false;
    originalContentReadyRef.current = false;
    translatedBlockCache.current.clear();
    setTranslationCacheReadyFor(null);
  }, [pdfId]);

  useEffect(() => {
    translatedContentReadyRef.current = false;
  }, [translationLanguage?.code]);

  useEffect(() => {
    if (!pdfId || !translationLanguage) {
      setTranslationCacheReadyFor(null);
      return;
    }
    const languageCode = translationLanguage.code;
    const cacheKey = `${pdfId}:${languageCode}`;
    let cancelled = false;
    setTranslationCacheReadyFor(null);
    void getCachedPdfTranslations(db, pdfId, languageCode)
      .then((blocks) => {
        if (cancelled) return;
        blocks.forEach((block) => {
          const sourceId = block.id.replace(`translated-${languageCode}-`, "");
          translatedBlockCache.current.set(
            `${languageCode}:${sourceId}`,
            block,
          );
        });
        setTranslationCacheReadyFor(cacheKey);
      })
      .catch(() => {
        if (!cancelled) setTranslationCacheReadyFor(cacheKey);
      });
    return () => {
      cancelled = true;
    };
  }, [db, pdfId, translationLanguage]);

  useEffect(() => {
    if (!translationLanguage) {
      setTranslatedBlocks([]);
      setTranslatedChapterRequest(null);
      setTranslationError(null);
      return;
    }

    const languageCode = translationLanguage.code;
    if (!pdfId || translationCacheReadyFor !== `${pdfId}:${languageCode}`) {
      return;
    }
    const publishTranslatedBlocks = () => {
      const latestBlocks = latestReaderBlocks.current;
      const blocksByPage = new Map<number, ExtractedPdfBlock[]>();
      latestBlocks
        .filter((block) => block.text.trim().length > 0)
        .forEach((block) => {
          const pageBlocks = blocksByPage.get(block.page);
          if (pageBlocks) pageBlocks.push(block);
          else blocksByPage.set(block.page, [block]);
        });
      const completedBlocks: ExtractedPdfBlock[] = [];
      const orderedPages = [...blocksByPage.keys()].sort((a, b) => a - b);
      for (const page of orderedPages) {
        const pageBlocks = blocksByPage.get(page) ?? [];
        const translatedPage = pageBlocks.flatMap((block) => {
          const translated = currentCachedTranslation(
            translatedBlockCache.current,
            languageCode,
            block,
          );
          return translated ? [translated] : [];
        });
        if (translatedPage.length === pageBlocks.length) {
          completedBlocks.push(...translatedPage);
        } else if (page === orderedPages[0] && completedBlocks.length === 0) {
          // Apple reports a translation batch progressively. Publish the
          // contiguous opening prefix immediately instead of keeping the
          // entire translated tab blank until every block on page one ends.
          for (const block of pageBlocks) {
            const translated = currentCachedTranslation(
              translatedBlockCache.current,
              languageCode,
              block,
            );
            if (!translated) break;
            completedBlocks.push(translated);
          }
        }
      }
      setTranslatedBlocks((current) => {
        if (
          current.length === completedBlocks.length &&
          current.at(-1)?.id === completedBlocks.at(-1)?.id
        ) {
          return current;
        }
        return completedBlocks;
      });
    };
    const scheduleTranslatedPublish = () => {
      if (translationPublishTimer.current) return;
      translationPublishTimer.current = setTimeout(() => {
        translationPublishTimer.current = null;
        if (activeTranslationLanguage.current === languageCode) {
          publishTranslatedBlocks();
        }
      }, 60);
    };
    publishTranslatedBlocks();
    setTranslationError(null);

    // Do not create Apple's native TranslationSession in the background.
    // This prevents the model-download sheet from appearing before the user
    // explicitly opens Translated mode.
    if (!translatedReaderActivated) return;

    // A running worker reads the latest refs on every pass, so extraction and
    // outline updates do not enqueue stale copies of the whole document.
    if (scheduledTranslationLanguage.current === languageCode) return;
    scheduledTranslationLanguage.current = languageCode;

    translationQueue.current = translationQueue.current
      .catch(() => undefined)
      .then(async () => {
        while (activeTranslationLanguage.current === languageCode) {
          // Translate only while the Translated tab is actually on screen. A
          // background sweep over a long book saturates the JS thread and
          // makes the rest of the app sluggish.
          if (activeTabRef.current !== "translated") {
            await new Promise((resolve) => setTimeout(resolve, 250));
            continue;
          }
          const latestContentBlocks = latestReaderBlocks.current;
          const firstContentPage = latestContentBlocks[0]?.page;
          const warmContentBlocks =
            firstContentPage === undefined
              ? []
              : latestContentBlocks.filter(
                  (block) => block.page <= firstContentPage + 1,
                );
          const warmContentIds = new Set(
            warmContentBlocks.map((block) => block.id),
          );
          const allSourceBlocks = [
            ...warmContentBlocks,
            ...outlineTranslationBlocks(latestPdfOutline.current),
            ...latestContentBlocks.filter(
              (block) => !warmContentIds.has(block.id),
            ),
          ];
          let missingBlocks = allSourceBlocks.filter(
            (block) =>
              block.text.trim().length > 0 &&
              !currentCachedTranslation(
                translatedBlockCache.current,
                languageCode,
                block,
              ),
          );

          const hasTranslatedContent = latestContentBlocks.some((block) =>
            Boolean(
              currentCachedTranslation(
                translatedBlockCache.current,
                languageCode,
                block,
              ),
            ),
          );
          if (
            !hasTranslatedContent &&
            firstContentPage !== undefined &&
            requestedTranslationPage.current === null
          ) {
            missingBlocks = missingBlocks.filter(
              (block) =>
                !block.id.startsWith("toc-") && block.page === firstContentPage,
            );
          }

          const priorityPage = requestedTranslationPage.current;
          if (priorityPage !== null) {
            const contentBlocks = missingBlocks.filter(
              (block) => !block.id.startsWith("toc-"),
            );
            const allNearbyBlocks = contentBlocks
              .filter(
                (block) =>
                  Math.abs(block.page - priorityPage) <=
                  TRANSLATION_PRIORITY_RADIUS,
              )
              .sort((a, b) => {
                const priorityBlockId = requestedTranslationBlockId.current;
                if (a.id === priorityBlockId) return -1;
                if (b.id === priorityBlockId) return 1;
                const distanceDifference =
                  Math.abs(a.page - priorityPage) -
                  Math.abs(b.page - priorityPage);
                return distanceDifference || a.page - b.page;
              });
            const nearbyBlocks = allNearbyBlocks.slice(
              0,
              TRANSLATION_PRIORITY_CHUNK,
            );
            const selectedIds = new Set(nearbyBlocks.map((block) => block.id));
            const sequentialBlocks = [
              ...contentBlocks.filter((block) => !selectedIds.has(block.id)),
              ...missingBlocks.filter((block) => block.id.startsWith("toc-")),
            ];
            missingBlocks = [...nearbyBlocks, ...sequentialBlocks];
          }
          // Bound the sweep to a window around the reader's position (plus the
          // opening pages) so the Translated tab becomes usable quickly and the
          // worker never chases the whole document in one go.
          const translationAnchorPage =
            requestedTranslationPage.current ??
            translatedSourcePageRef.current ??
            1;
          missingBlocks = missingBlocks.filter(
            (block) =>
              block.page <= 2 ||
              (block.page >=
                Math.max(
                  1,
                  translationAnchorPage - TRANSLATION_WINDOW_BEHIND,
                ) &&
                block.page <= translationAnchorPage + TRANSLATION_WINDOW_AHEAD),
          );
          missingBlocks = missingBlocks.slice(0, TRANSLATION_WORK_CHUNK);

          if (missingBlocks.length === 0) {
            // The current window is fully translated. Wait briefly so the
            // reader can advance (or extraction can add pages) before checking
            // again — without spinning the JS thread.
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }
          await translatePdfBlocks(
            missingBlocks,
            languageCode,
            (batch) => {
              batch.forEach((block) => {
                const sourceId = block.id.replace(
                  `translated-${languageCode}-`,
                  "",
                );
                translatedBlockCache.current.set(
                  `${languageCode}:${sourceId}`,
                  block,
                );
              });
              translationPersistenceQueue.current =
                translationPersistenceQueue.current
                  .catch(() => undefined)
                  .then(() =>
                    savePdfTranslations(db, pdfId, languageCode, batch),
                  )
                  .catch(() => undefined);

              if (activeTranslationLanguage.current === languageCode) {
                scheduleTranslatedPublish();
              }
            },
            translationSourceLanguage.current,
            (detectedLanguage) => {
              translationSourceLanguage.current = detectedLanguage;
            },
          );
          // Yield to the JS event loop between chunks so React can flush the
          // published updates and keep the UI responsive while translating.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        if (activeTranslationLanguage.current === languageCode) {
          if (translationPublishTimer.current) {
            clearTimeout(translationPublishTimer.current);
            translationPublishTimer.current = null;
          }
          publishTranslatedBlocks();
        }
      })
      .catch((error) => {
        if (activeTranslationLanguage.current !== languageCode) return;
        if (isBookTranslationCancellation(error)) {
          return;
        }
        setTranslationError(
          error instanceof Error
            ? error.message
            : "Unable to translate this document.",
        );
        setTranslatedChapterRequest(null);
      })
      .finally(() => {
        if (scheduledTranslationLanguage.current === languageCode) {
          scheduledTranslationLanguage.current = null;
        }
      });
  }, [
    pdfOutline,
    db,
    pdfId,
    readerBlocks,
    translationCacheReadyFor,
    translationLanguage,
    translationPriorityVersion,
    translatedReaderActivated,
  ]);

  useEffect(
    () => () => {
      if (translationPublishTimer.current) {
        clearTimeout(translationPublishTimer.current);
      }
    },
    [],
  );

  const handleTranslatedPageChange = useCallback((page: number) => {
    if (activeTabRef.current !== "translated") return;
    setReaderCurrentPage(page);
    translatedSourcePageRef.current = page;
    // Page reports drive chrome/prefetch only. They are approximate while the
    // DOM is growing and must never replace the precise visible-word anchor.
    requestedTranslationPage.current = page;
    requestedTranslationBlockId.current = null;
    const pageCount = latestReaderPageCount.current;
    const extractionCandidates = [
      Math.max(1, page - TRANSLATION_PREFETCH_DISTANCE),
      Math.min(pageCount, page + TRANSLATION_PREFETCH_DISTANCE),
    ];
    extractionCandidates.forEach((candidate) => {
      if (
        candidate > 0 &&
        !latestReaderPageSizes.current[candidate] &&
        !requestedExtractionPages.current.includes(candidate)
      ) {
        requestedExtractionPages.current.push(candidate);
      }
    });
    if (
      activeTranslationLanguage.current &&
      scheduledTranslationLanguage.current === null
    ) {
      setTranslationPriorityVersion((version) => version + 1);
    }
  }, []);

  const handleReaderPageChange = useCallback((page: number) => {
    if (activeTabRef.current !== "reader") return;
    setReaderCurrentPage(page);
    // The subsequent switchAnchor message contains the authoritative word.
    // Publishing this approximate page first caused tab switches to capture a
    // downgraded/stale location and generated hundreds of needless revisions.
  }, []);

  useEffect(() => {
    readerSkeletonOpacity.value = withTiming(readerContentReady ? 0 : 1, {
      duration: readerContentReady ? 140 : 0,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [readerContentReady, readerSkeletonOpacity]);

  const readerSkeletonStyle = useAnimatedStyle(() => ({
    opacity: readerSkeletonOpacity.value,
  }));

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!pdfId) {
          throw new Error("No PDF was selected.");
        }

        const storedPdf = await getPdfById(db, pdfId);
        if (!storedPdf) {
          throw new Error("This PDF is no longer in your library.");
        }

        if (!cancelled) {
          // The document shell can render now. Neither bookkeeping nor an
          // optional translation preference should gate the first frame.
          setPdf(storedPdf);
          setLoadError(null);
          setIsLoading(false);
        }

        void markPdfOpened(db, pdfId).catch(() => undefined);
        void getPdfTranslationPreference(db, pdfId)
          .then((savedLanguageCode) => {
            if (cancelled || !savedLanguageCode) return;
            setTranslationLanguage(
              translationLanguages.find(
                ({ code }) => code === savedLanguageCode,
              ),
            );
          })
          .catch(() => undefined);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load PDF.",
          );
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, pdfId]);

  useEffect(() => {
    if (!pdf || !pdfId || readerExtractionStarted.current) {
      return;
    }
    readerExtractionStarted.current = true;
    let cancelled = false;
    setReaderLoading(true);
    setReaderError(null);

    void (async () => {
      try {
        let document: ExtractedPdfDocument | null = null;

        const publish = (value: ExtractedPdfDocument) => {
          if (!cancelled) {
            const snapshot = readerSnapshot(value);
            setReaderBlocks(snapshot.blocks);
            setReaderPageCount(value.pageCount);
            setReaderPageSizes(snapshot.pageSizes);
            // Decorative/blank opening pages should not leave Reader Mode
            // looking empty while later batches continue toward real text.
            setReaderLoading(
              snapshot.blocks.length === 0 &&
                value.pages.length < value.pageCount,
            );
            return snapshot.blocks.length > 0;
          }
          return false;
        };

        const preview = await getCachedPdfExtractionPreview(db, pdfId);
        if (preview?.pages.length) {
          const previewHasContent = publish(preview);
          if (previewHasContent) {
            // Let the first cached page paint before parsing and normalizing
            // a potentially very large full-book JSON cache.
            for (
              let frame = 0;
              frame < 32 && !cancelled && !readerContentReadyRef.current;
              frame += 1
            ) {
              await new Promise<void>((resolve) => setTimeout(resolve, 16));
            }
          }
          document = (await getCachedPdfExtraction(db, pdfId)) ?? preview;
          if (document !== preview) publish(document);
        }

        let nextPage = firstMissingPageIndex(document);
        let pageCount = document?.pageCount ?? Number.MAX_SAFE_INTEGER;
        let lastSavedPageCount = document?.pages.length ?? 0;

        while (!cancelled && nextPage < pageCount) {
          let requestedPage: number | null = null;
          while (
            requestedPage === null &&
            requestedExtractionPages.current.length > 0
          ) {
            const candidate = requestedExtractionPages.current.shift()!;
            if (!document?.pages.some((page) => page.page === candidate)) {
              requestedPage = candidate;
            }
          }
          const requestIsMissing = requestedPage !== null;
          const firstPage =
            requestedPage !== null
              ? Math.max(0, requestedPage - 1 - CHAPTER_EXTRACTION_PAGES_ABOVE)
              : nextPage;

          const extractedPageCount = document?.pages.length ?? 0;
          const batchSize = requestIsMissing
            ? CHAPTER_EXTRACTION_PAGE_COUNT
            : extractedPageCount === 0 && firstPage === 0
              ? FIRST_READER_PAGE_BATCH
              : firstPage < WARM_READER_PAGE_COUNT
                ? WARM_READER_PAGE_COUNT - firstPage
                : BACKGROUND_READER_PAGE_BATCH;
          const chunk = await extractPdfDocumentRange(
            pdf.uri,
            firstPage,
            batchSize,
          );
          const pagesByNumber = new Map(
            document?.pages.map((page) => [page.page, page]) ?? [],
          );
          chunk.pages.forEach((page) => pagesByNumber.set(page.page, page));
          document = {
            pageCount: chunk.pageCount,
            pages: Array.from(pagesByNumber.values()).sort(
              (a, b) => a.page - b.page,
            ),
          };
          pageCount = document.pageCount;
          nextPage = firstMissingPageIndex(document);
          publish(document);
          const shouldSaveExtraction =
            (lastSavedPageCount === 0 && document.pages.length > 0) ||
            document.pages.length - lastSavedPageCount >=
              EXTRACTION_CACHE_PAGE_INTERVAL ||
            nextPage >= pageCount;
          if (shouldSaveExtraction) {
            await savePdfExtraction(db, pdfId, document);
            lastSavedPageCount = document.pages.length;
          }

          if (chunk.pages.length === 0) break;
          await new Promise<void>((resolve) => setTimeout(resolve, 16));
        }
      } catch (error) {
        if (!cancelled) {
          setReaderError(
            error instanceof Error
              ? error.message
              : "Unable to create Reader Mode.",
          );
        }
      } finally {
        if (!cancelled) setReaderLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, pdf, pdfId]);

  useEffect(() => {
    if (isLandscape) {
      headerVisibility.stopAnimation();
      headerVisibility.setValue(0);
      return;
    }
    const animation = Animated.timing(headerVisibility, {
      toValue: readerChromeHidden ? 0 : 1,
      duration: 140,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [headerVisibility, isLandscape, readerChromeHidden]);

  const captureCanonicalAnchor = useCallback((): CanonicalAnchor | null => {
    const current = anchorController.current();
    const live =
      activeTabRef.current === "reader"
        ? actualReaderAnchor.current
        : activeTabRef.current === "translated"
          ? actualTranslatedAnchor.current
          : null;
    // Explicit navigation (TOC/search/page picker) commits a newer revision
    // immediately before starting its transition. It must outrank the old live
    // viewport. For ordinary tab switches revisions are equal, so the precise
    // live word remains the preferred capture.
    if (
      live &&
      live.documentId === pdfId &&
      live.sourceBlockId &&
      (!current || live.revision >= current.revision)
    )
      return live;
    if (!current || current.documentId !== pdfId) return null;
    if (current.sourceBlockId) return current;
    const nearestBlock = latestReaderBlocks.current.find(
      (block) => block.page === current.sourcePage && block.text.trim(),
    );
    return nearestBlock
      ? {
          ...current,
          sourcePage: nearestBlock.page,
          sourceBlockId: nearestBlock.id,
          wordIndex: 0,
          characterOffset: 0,
          blockProgress: 0,
        }
      : current;
  }, [actualReaderAnchor, actualTranslatedAnchor, pdfId]);
  captureCanonicalAnchorRef.current = captureCanonicalAnchor;

  // The settings store changes before the horizontal pager mounts. Capture the
  // old renderer's live word during this render, before the new pager can emit
  // its initial page (page zero) and replace the vertical viewport anchor.
  if (
    readerTransition !== previousReaderTransition.current &&
    pendingLayoutAnchor.current === null
  ) {
    layoutHandoffInProgress.current = true;
    pendingLayoutAnchor.current = captureCanonicalAnchor();
  }

  const runAnchorTransition = useCallback(
    async (
      targetMode: ReaderMode,
      targetLayout: AnchorReaderLayout = readerTransition === "pager"
        ? "horizontal"
        : "vertical",
      fromLayout?: AnchorReaderLayout,
      readerDestinationOverride?: {
        searchQuery?: string;
        searchMatchIndex?: number;
        switchHighlightWordIndex?: number;
      },
      capturedAnchorOverride?: CanonicalAnchor | null,
    ) => {
      if (rotationInProgress.current && targetMode === activeTabRef.current) {
        return true;
      }
      const sourceLayout = fromLayout ?? useAnchorStore.getState().activeLayout;
      const from = { mode: activeTabRef.current, layout: sourceLayout };
      const target = { mode: targetMode, layout: targetLayout };
      const readerPorts = {
        isReady: (anchor: CanonicalAnchor) => {
          const blocks =
            targetMode === "translated"
              ? latestTranslatedBlocks.current
              : latestReaderBlocks.current;
          const expectedBlockId =
            targetMode === "translated" && translationLanguage
              ? anchor.sourceBlockId
                ? `translated-${translationLanguage.code}-${anchor.sourceBlockId}`
                : undefined
              : anchor.sourceBlockId;
          return (
            (targetMode === "translated"
              ? translatedContentReadyRef.current
              : readerContentReadyRef.current) &&
            (!expectedBlockId ||
              blocks.some((block) => block.id === expectedBlockId))
          );
        },
        restore: (anchor: CanonicalAnchor, transitionId: number) => {
          if (!transitionController.isCurrent(transitionId)) return;
          const resetOriginalZoomIfLeaving = () => {
            if (activeTabRef.current !== "original") return;
            originalContentReadyRef.current = false;
            setOriginalZoomResetNonce((current) => current + 1);
          };
          if (targetMode === "translated" && translationLanguage) {
            setTranslatedDestination(
              translatedDestinationForAnchor(
                anchor,
                translationLanguage.code,
                latestTranslatedBlocks.current,
                transitionId,
              ),
            );
            setTranslatedSwitchHighlight(null);
            resetOriginalZoomIfLeaving();
            setActiveTab("translated");
            return;
          }
          setReaderDestination({
            ...verticalDestination(anchor, transitionId),
            ...readerDestinationOverride,
            nonce: transitionId,
          });
          setReaderSwitchHighlight(null);
          resetOriginalZoomIfLeaving();
          setActiveTab("reader");
        },
        actual: () =>
          targetMode === "translated"
            ? actualTranslatedAnchor.current
            : actualReaderAnchor.current,
        isTransitionCurrent: (id: number) => transitionController.isCurrent(id),
      };
      const adapter =
        targetMode === "original"
          ? createOriginalAnchorAdapter({
              isReady: () => originalContentReadyRef.current,
              restore: (destination, transitionId) => {
                if (!transitionController.isCurrent(transitionId)) return;
                pendingOriginalPageRef.current = destination.page;
                setOriginalCurrentPage(destination.page);
                setOriginalDestination(destination);
                setReaderChromeHidden(false);
                setActiveTab("original");
              },
              currentPage: () => originalCurrentPageRef.current,
            })
          : targetLayout === "horizontal"
            ? createHorizontalAnchorAdapter(readerPorts, {
                verifyTimeoutMs: targetMode === "translated" ? 4_000 : 2_500,
                verificationAnchor: (anchor) => {
                  const targetBlock =
                    targetMode === "translated" && translationLanguage
                      ? latestTranslatedBlocks.current.find(
                          (block) =>
                            block.id ===
                            `translated-${translationLanguage.code}-${anchor.sourceBlockId}`,
                        )
                      : latestReaderBlocks.current.find(
                          (block) => block.id === anchor.sourceBlockId,
                        );
                  const words = targetBlock
                    ? Array.from(targetBlock.text.matchAll(/\S+/g))
                    : [];
                  const wordIndex = proportionalWordIndex(
                    anchor.blockProgress,
                    words.length,
                  );
                  return {
                    ...anchor,
                    wordIndex,
                    characterOffset: words[wordIndex]?.index,
                    blockProgress:
                      words.length > 1 ? wordIndex / (words.length - 1) : 0,
                  };
                },
              })
            : createVerticalAnchorAdapter(readerPorts, {
                verifyTimeoutMs: targetMode === "translated" ? 4_000 : 2_500,
                verificationAnchor: (anchor) => {
                  const targetBlock =
                    targetMode === "translated" && translationLanguage
                      ? latestTranslatedBlocks.current.find(
                          (block) =>
                            block.id ===
                            `translated-${translationLanguage.code}-${anchor.sourceBlockId}`,
                        )
                      : latestReaderBlocks.current.find(
                          (block) => block.id === anchor.sourceBlockId,
                        );
                  const words = targetBlock
                    ? Array.from(targetBlock.text.matchAll(/\S+/g))
                    : [];
                  const wordIndex = proportionalWordIndex(
                    anchor.blockProgress,
                    words.length,
                  );
                  return {
                    ...anchor,
                    wordIndex,
                    characterOffset: words[wordIndex]?.index,
                    blockProgress:
                      words.length > 1 ? wordIndex / (words.length - 1) : 0,
                  };
                },
              });

      const succeeded = await transitionController.run({
        from,
        target,
        capture: () => capturedAnchorOverride ?? captureCanonicalAnchor(),
        prepare: async (anchor, transitionId) => {
          if (targetMode === "original") {
            return waitForCurrentTransition(
              transitionId,
              () => originalContentReadyRef.current,
            );
          }
          if (targetMode === "reader") {
            const targetAvailable = anchor.sourceBlockId
              ? latestReaderBlocks.current.some(
                  (block) => block.id === anchor.sourceBlockId,
                )
              : Boolean(latestReaderPageSizes.current[anchor.sourcePage]);
            if (readerContentReadyRef.current && targetAvailable) return true;
            if (!targetAvailable)
              requestedExtractionPages.current.unshift(anchor.sourcePage);
            return waitForCurrentTransition(
              transitionId,
              () =>
                readerContentReadyRef.current &&
                (latestReaderBlocks.current.some((block) =>
                  anchor.sourceBlockId
                    ? block.id === anchor.sourceBlockId
                    : block.page === anchor.sourcePage,
                ) ||
                  (!anchor.sourceBlockId &&
                    Boolean(latestReaderPageSizes.current[anchor.sourcePage]))),
            );
          }
          if (!translationLanguage) return false;
          const translatedTargetId = anchor.sourceBlockId
            ? `translated-${translationLanguage.code}-${anchor.sourceBlockId}`
            : undefined;
          latestTranslationError.current = null;
          setTranslationError(null);
          setTranslatedReaderActivated(true);
          setActiveTab("translated");
          requestedTranslationPage.current = anchor.sourcePage;
          requestedTranslationBlockId.current = anchor.sourceBlockId ?? null;
          requestedExtractionPages.current.unshift(anchor.sourcePage);
          setTranslatedChapterRequest({
            sourcePage: anchor.sourcePage,
            targetBlockId: translatedTargetId,
            targetWordProgress: anchor.blockProgress,
            nonce: transitionId,
          });
          // Deliver the destination before waiting for the translation to land so
          // the translated reader immediately centers its append window on the
          // target page. As on-demand translation completes, the blocks append and
          // the renderer scrolls to the destination the moment it exists instead
          // of floating on stale cached pages.
          setTranslatedDestination(
            translatedDestinationForAnchor(
              anchor,
              translationLanguage.code,
              latestTranslatedBlocks.current,
              transitionId,
            ),
          );
          setTranslationPriorityVersion((version) => version + 1);
          const ready = await waitForCurrentTransition(
            transitionId,
            () => {
              const sourcePageBlocks = latestReaderBlocks.current.filter(
                (block) =>
                  block.page === anchor.sourcePage && block.text.trim(),
              );
              if (sourcePageBlocks.length === 0) return false;
              const pageIsComplete = sourcePageBlocks.every((sourceBlock) =>
                latestTranslatedBlocks.current.some(
                  (translatedBlock) =>
                    translatedBlock.id ===
                    `translated-${translationLanguage.code}-${sourceBlock.id}`,
                ),
              );
              return (
                pageIsComplete &&
                (!translatedTargetId ||
                  latestTranslatedBlocks.current.some(
                    (block) => block.id === translatedTargetId,
                  ))
              );
            },
            60_000,
            () => Boolean(latestTranslationError.current),
          );
          if (transitionController.isCurrent(transitionId)) {
            setTranslatedChapterRequest((current) =>
              current?.nonce === transitionId ? null : current,
            );
          }
          return ready;
        },
        adapter,
      });
      if (succeeded && targetLayout === "vertical") {
        // A destination is only a handoff instruction. Leaving it mounted after
        // verification keeps the vertical WebView's programmatic anchor pinned;
        // every translated-block append can then re-scroll to that old word and
        // fight the user's next drag. Clear only this completed transition so a
        // newer navigation cannot be accidentally released.
        const completedTransition = useAnchorStore.getState().transition;
        if (
          completedTransition.status === "complete" &&
          completedTransition.target?.mode === targetMode
        ) {
          const completedId = completedTransition.id;
          if (targetMode === "reader") {
            setReaderDestination((current) =>
              current?.nonce === completedId ? null : current,
            );
          }
          if (targetMode === "translated") {
            setTranslatedDestination((current) =>
              current?.nonce === completedId ? null : current,
            );
          }
        }
      }
      if (!succeeded) {
        const transition = useAnchorStore.getState().transition;
        if (
          transition.status === "failed" &&
          transition.target?.mode === targetMode
        ) {
          if (targetMode === "original") pendingOriginalPageRef.current = null;
          if (targetMode === "reader") {
            // Do not keep re-delivering an unreachable destination: the renderer
            // would keep re-scrolling against the user instead of settling.
            setReaderDestination(null);
          }
          if (targetMode === "translated") {
            setTranslatedDestination(null);
            setTranslatedChapterRequest(null);
            setTranslationError(
              (current) =>
                current ?? "Unable to restore the translated reading position.",
            );
            // Translation content remains usable even if exact verification
            // fails. Never eject the user back to the source tab.
            setActiveTab("translated");
          }
        }
      }
      return succeeded;
    },
    [
      actualReaderAnchor,
      actualTranslatedAnchor,
      captureCanonicalAnchor,
      readerTransition,
      translationLanguage,
    ],
  );

  useEffect(() => {
    if (!pdfId || positionRestoreApplied.current || readerBlocks.length === 0)
      return;
    if (!canonicalAnchor || canonicalAnchor.documentId !== pdfId) return;
    positionRestoreApplied.current = true;
    // Reopening is not a live renderer-to-renderer transition. The freshly
    // mounted reader briefly reports its default page-one viewport before its
    // destination is applied, so recapturing here can replace the hydrated
    // database position with that transient report. Keep the loaded anchor
    // immutable for this one initial restore. Layout rotation and tab changes
    // continue to use their own live capture paths.
    void runAnchorTransition(
      "reader",
      readerTransition === "pager" ? "horizontal" : "vertical",
      undefined,
      undefined,
      canonicalAnchor,
    ).finally(() => setInitialRestoreCompleteFor(pdfId));
  }, [
    canonicalAnchor,
    pdfId,
    readerBlocks.length,
    readerTransition,
    runAnchorTransition,
  ]);

  useLayoutEffect(() => {
    const nextLayout: AnchorReaderLayout =
      readerTransition === "pager" ? "horizontal" : "vertical";
    const previousLayout: AnchorReaderLayout =
      previousReaderTransition.current === "pager" ? "horizontal" : "vertical";
    if (nextLayout === previousLayout) return;
    const capturedAnchor = pendingLayoutAnchor.current;
    pendingLayoutAnchor.current = null;
    previousReaderTransition.current = readerTransition;
    previousPresentationKey.current =
      readerTransition === "pager"
        ? `${readerPresentationKey}:${isLandscape ? "landscape" : "portrait"}`
        : `${readerPresentationKey}:vertical`;
    // Both renderers use the same already-loaded block model. Do not reset the
    // content-ready flag for a layout-only switch; readiness is verified by the
    // destination adapter after the horizontal pager consumes this anchor.
    void runAnchorTransition(
      activeTabRef.current,
      nextLayout,
      previousLayout,
      undefined,
      capturedAnchor,
    ).finally(() => {
      layoutHandoffInProgress.current = false;
    });
  }, [
    isLandscape,
    readerPresentationKey,
    readerTransition,
    runAnchorTransition,
  ]);

  useEffect(() => {
    // Vertical mode preserves its word directly inside the WebView. Starting a
    // second canonical transition here races that restore and publishes words
    // from intermediate reflow frames. The pager still needs a full restore
    // because its generated pages change with orientation.
    const nextKey =
      readerTransition === "pager"
        ? `${readerPresentationKey}:${isLandscape ? "landscape" : "portrait"}`
        : `${readerPresentationKey}:vertical`;
    if (previousPresentationKey.current === nextKey) return;
    previousPresentationKey.current = nextKey;
    if (!positionRestoreApplied.current) return;
    void runAnchorTransition(activeTabRef.current);
  }, [
    isLandscape,
    readerPresentationKey,
    readerTransition,
    runAnchorTransition,
  ]);

  const handleTabChange = useCallback(
    (value: ReaderMode) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (value !== "reader") setReaderChromeHidden(false);
      void runAnchorTransition(value);
    },
    [runAnchorTransition],
  );

  const handleFindWordInOtherTab = useCallback(
    (target: FindWordTarget, selected: FindWordAnchor) => {
      if (!pdfId || target === activeTabRef.current) return;
      const sourceBlock = latestReaderBlocks.current.find(
        (block) => block.id === selected.sourceBlockId,
      );
      const sourceWords = sourceBlock
        ? Array.from(sourceBlock.text.matchAll(/\S+/g))
        : [];
      const sourceWordIndex = proportionalWordIndex(
        selected.blockProgress,
        sourceWords.length,
      );
      anchorController.navigate(
        {
          documentId: pdfId,
          sourcePage: selected.sourcePage,
          sourceBlockId: selected.sourceBlockId,
          wordIndex: sourceWordIndex,
          characterOffset:
            sourceWords[sourceWordIndex]?.index ?? selected.characterOffset,
          blockProgress: selected.blockProgress,
        },
        "explicit-navigation",
      );
      setReaderChromeHidden(false);
      void Haptics.selectionAsync();
      void runAnchorTransition(target);
    },
    [pdfId, runAnchorTransition],
  );

  const handleReaderUserInteraction = useCallback(() => {
    if (useAnchorStore.getState().transition.status === "running") {
      transitionController.cancel("user took control");
    }
    setReaderDestination(null);
    setTranslatedDestination(null);
    setTranslatedChapterRequest(null);
  }, []);
  useEffect(() => {
    const guideOwnsReader =
      readerGuideEnabled &&
      readerTransition === "pager" &&
      (activeTab === "reader" || activeTab === "translated");
    setReaderChromeHidden(guideOwnsReader);
  }, [activeTab, hideTopBarOnScroll, readerGuideEnabled, readerTransition]);

  useEffect(() => {
    if (translationLanguage) {
      setTranslatedReaderActivated(true);
    }
  }, [translationLanguage]);

  const handleReaderToolbarVisibilityChange = useCallback(
    (visible: boolean) => {
      if (
        readerGuideEnabled &&
        readerTransition === "pager" &&
        (activeTab === "reader" || activeTab === "translated")
      ) {
        setReaderChromeHidden(true);
        return;
      }
      if (
        (activeTab === "reader" || activeTab === "translated") &&
        (hideTopBarOnScroll ||
          readerTransition === "pager" ||
          readerGuideEnabled)
      ) {
        setReaderChromeHidden(!visible);
      }
    },
    [activeTab, hideTopBarOnScroll, readerGuideEnabled, readerTransition],
  );

  const handleTranslationLanguageChange = (language?: TranslationLanguage) => {
    setTranslationLanguage(language);
    if (pdfId) {
      void savePdfTranslationPreference(db, pdfId, language?.code);
    }
    if (!language && activeTab === "translated") {
      void runAnchorTransition("original");
    }
  };

  const handlePageChanged = useCallback((page: number, totalPages: number) => {
    const pendingPage = pendingOriginalPageRef.current;
    if (pendingPage !== null && page !== pendingPage) return;
    if (page === pendingPage) pendingOriginalPageRef.current = null;
    originalCurrentPageRef.current = page;
    setOriginalCurrentPage(page);
    setOriginalPageCount(totalPages);
  }, []);

  const readerChapters = useMemo<ReaderChapter[]>(() => {
    const pageMap =
      activeTab === "reader"
        ? readerChapterPageMap
        : activeTab === "translated"
          ? translatedChapterPageMap
          : null;
    const convert = (
      items: PdfOutlineItem[],
      path = "outline",
    ): ReaderChapter[] =>
      items.map((item, index) => {
        const chapterId = `${path}-${index}-${item.page}`;
        const translatedTitleCandidate =
          activeTab === "translated" && translationLanguage
            ? translatedBlockCache.current.get(
                `${translationLanguage.code}:toc-${chapterId}`,
              )
            : undefined;
        const translatedTitle =
          translatedTitleCandidate?.sourceContentHash ===
          translationSourceHash(item.title)
            ? translatedTitleCandidate.text
            : undefined;
        return {
          id: chapterId,
          title: translatedTitle || item.title,
          page: pageMap?.[item.page] ?? item.page,
          sourcePage: item.page,
          children: convert(item.children ?? [], `${path}-${index}`),
        };
      });
    return convert(pdfOutline);
  }, [
    activeTab,
    pdfOutline,
    readerChapterPageMap,
    translatedBlocks,
    translatedChapterPageMap,
    translationLanguage,
  ]);

  const updateReaderChapterPageMap = useCallback(
    (
      setPageMap: React.Dispatch<React.SetStateAction<Record<number, number>>>,
    ) =>
      (next: Record<number, number>) => {
        setPageMap((current) => {
          const currentKeys = Object.keys(current);
          const nextKeys = Object.keys(next);
          if (
            currentKeys.length === nextKeys.length &&
            nextKeys.every((key) => current[Number(key)] === next[Number(key)])
          )
            return current;
          return next;
        });
      },
    [],
  );
  const handleReaderChapterPageMapChange = useMemo(
    () => updateReaderChapterPageMap(setReaderChapterPageMap),
    [updateReaderChapterPageMap],
  );
  const handleTranslatedChapterPageMapChange = useMemo(
    () => updateReaderChapterPageMap(setTranslatedChapterPageMap),
    [updateReaderChapterPageMap],
  );

  const handleOutlineChanged = useCallback((outline: PdfOutlineItem[]) => {
    setPdfOutline(outline);
  }, []);

  const handleReaderPagination = useCallback(
    (current: number, total: number) => {
      setReaderDisplayCurrentPage(current);
      setReaderDisplayPageCount(total);
    },
    [],
  );
  const handleTranslatedPagination = useCallback(
    (current: number, total: number) => {
      setTranslatedDisplayCurrentPage(current);
      setTranslatedDisplayPageCount(total);
    },
    [],
  );
  const handleReaderExplicitPageResolved = useCallback(
    (
      sourcePage: number,
      anchor: { blockId: string; blockOffset: number; wordIndex: number },
    ) => {
      if (!pdfId) return;
      const block = latestReaderBlocks.current.find(
        (candidate) => candidate.id === anchor.blockId,
      );
      const wordCount = block
        ? Array.from(block.text.matchAll(/\S+/g)).length
        : 0;
      anchorController.navigate(
        {
          documentId: pdfId,
          sourcePage,
          sourceBlockId: anchor.blockId,
          wordIndex: anchor.wordIndex,
          characterOffset: anchor.blockOffset,
          blockProgress: wordCount > 1 ? anchor.wordIndex / (wordCount - 1) : 0,
        },
        "explicit-navigation",
      );
    },
    [pdfId],
  );
  const handleTranslatedExplicitPageResolved = useCallback(
    (
      sourcePage: number,
      anchor: { blockId: string; blockOffset: number; wordIndex: number },
    ) => {
      if (!pdfId || !translationLanguage) return;
      const translatedBlock = latestTranslatedBlocks.current.find(
        (candidate) => candidate.id === anchor.blockId,
      );
      const wordCount = translatedBlock
        ? Array.from(translatedBlock.text.matchAll(/\S+/g)).length
        : 0;
      const prefix = `translated-${translationLanguage.code}-`;
      anchorController.navigate(
        {
          documentId: pdfId,
          sourcePage,
          sourceBlockId: anchor.blockId.startsWith(prefix)
            ? anchor.blockId.slice(prefix.length)
            : anchor.blockId,
          blockProgress: wordCount > 1 ? anchor.wordIndex / (wordCount - 1) : 0,
        },
        "explicit-navigation",
      );
    },
    [pdfId, translationLanguage],
  );

  const visiblePage =
    activeTab === "original"
      ? originalCurrentPage
      : readerTransition === "pager"
        ? activeTab === "translated"
          ? translatedDisplayCurrentPage
          : readerDisplayCurrentPage
        : readerCurrentPage;
  const visiblePageCount =
    activeTab === "original"
      ? originalPageCount || pdf?.totalPages || readerPageCount
      : readerTransition === "pager"
        ? activeTab === "translated"
          ? translatedDisplayPageCount
          : readerDisplayPageCount
        : readerPageCount || pdf?.totalPages || 0;
  const navigationCurrentPage =
    activeTab === "original"
      ? originalCurrentPage
      : readerTransition === "pager"
        ? activeTab === "translated"
          ? translatedDisplayCurrentPage
          : readerDisplayCurrentPage
        : readerCurrentPage;
  const displayPdfName = pdf?.name.replace(/\.pdf$/i, "") ?? "";

  const goToReaderPage = useCallback(
    (
      page: number,
      blockId?: string,
      searchQuery?: string,
      searchMatchIndex?: number,
    ) => {
      if (!pdfId) return;
      const targetBlock = blockId
        ? latestReaderBlocks.current.find((block) => block.id === blockId)
        : latestReaderBlocks.current.find(
            (block) => block.page >= page && block.text.trim(),
          );
      const words = targetBlock
        ? Array.from(targetBlock.text.matchAll(/\S+/g))
        : [];
      const characterOffset = targetBlock
        ? Math.max(0, searchMatchIndex ?? 0)
        : undefined;
      const wordIndex =
        characterOffset === undefined
          ? undefined
          : Math.max(
              0,
              words.findIndex(
                (word) => (word.index ?? 0) + word[0].length > characterOffset,
              ),
            );
      anchorController.navigate(
        {
          documentId: pdfId,
          sourcePage: targetBlock?.page ?? page,
          sourceBlockId: targetBlock?.id,
          wordIndex,
          characterOffset,
          blockProgress:
            words.length > 1 && wordIndex !== undefined
              ? wordIndex / (words.length - 1)
              : targetBlock
                ? 0
                : undefined,
        },
        searchQuery ? "search" : "explicit-navigation",
      );
      requestedExtractionPages.current.push(page);
      void runAnchorTransition(
        "reader",
        readerTransition === "pager" ? "horizontal" : "vertical",
        undefined,
        {
          searchQuery,
          searchMatchIndex,
        },
      );
    },
    [pdfId, readerTransition, runAnchorTransition],
  );

  const goToNavigationPage = useCallback(
    (page: number, blockId?: string) => {
      if (!pdfId) return;
      const targetBlock = blockId
        ? latestReaderBlocks.current.find((block) => block.id === blockId)
        : latestReaderBlocks.current.find(
            (block) => block.page >= page && block.text.trim(),
          );
      anchorController.navigate(
        {
          documentId: pdfId,
          sourcePage: targetBlock?.page ?? page,
          sourceBlockId: targetBlock?.id,
          wordIndex: targetBlock ? 0 : undefined,
          characterOffset: targetBlock ? 0 : undefined,
          blockProgress: targetBlock ? 0 : undefined,
        },
        "toc",
      );
      requestedExtractionPages.current.unshift(page);
      void runAnchorTransition(activeTabRef.current);
    },
    [pdfId, runAnchorTransition],
  );

  const goToDisplayedPage = useCallback(
    (page: number) => {
      if (activeTab === "original") {
        goToNavigationPage(page);
        return;
      }
      if (readerTransition === "pager") {
        const destination = generatedPageDestination(
          page,
          anchorController.current()?.sourcePage ?? readerCurrentPage,
        );
        if (activeTab === "translated") {
          setTranslatedDestination(destination);
          setTranslatedSwitchHighlight(null);
        } else {
          setReaderDestination(destination);
          setReaderSwitchHighlight(null);
        }
        return;
      }
      if (activeTab === "translated") {
        goToNavigationPage(page);
        return;
      }

      goToReaderPage(page);
    },
    [
      activeTab,
      goToNavigationPage,
      goToReaderPage,
      readerCurrentPage,
      readerTransition,
    ],
  );

  if (isLoading || (pdfId && positionHydratedFor !== pdfId)) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F5EC] dark:bg-[#10120F]">
        <ActivityIndicator size="large" color="#8fb996" />
      </View>
    );
  }

  if (!pdf || loadError) {
    return (
      <View className="flex-1 bg-[#F7F5EC] px-6 pt-12 dark:bg-[#10120F]">
        <BackButton />
        <View className="flex-1 items-center justify-center pb-20">
          <Text className="text-center font-lato-bold text-lg text-black dark:text-[#F4F5F1]">
            PDF unavailable
          </Text>
          <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
            {loadError ?? "Unable to find this PDF."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Box className="flex-1 bg-[#F7F5EC] dark:bg-[#10120F]">
      <StatusBar
        animated
        hidden={
          (activeTab === "reader" || activeTab === "translated") &&
          (isLandscape || readerChromeHidden)
        }
        style="auto"
      />
      <Animated.View
        pointerEvents={isLandscape ? "none" : "auto"}
        accessibilityElementsHidden={isLandscape}
        importantForAccessibility={isLandscape ? "no-hide-descendants" : "auto"}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          zIndex: 50,
          height: isLandscape ? 0 : headerHeight || undefined,
          overflow: "hidden",
          backgroundColor: isDark ? "#151814" : "#ffffff",
          borderBottomWidth: 0,
          transform: [
            {
              translateY: headerVisibility.interpolate({
                inputRange: [0, 1],
                outputRange: [-Math.max(headerHeight, 120), 0],
              }),
            },
          ],
        }}
      >
        <Animated.View
          className="pt-12"
          style={{ minHeight: 128 }}
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height;

            if (Math.abs(measuredHeight - headerHeight) > 0.5) {
              setHeaderHeight(measuredHeight);
            }
          }}
        >
          <View className="relative h-14 w-full items-center justify-center px-5">
            <View className="absolute left-4 top-1/2 -translate-y-1/2">
              <BackButton />
            </View>

            <View
              className="absolute top-1/2 -translate-y-1/2 flex-row"
              style={{
                right: translationLanguage ? translatedActionInset : 16,
              }}
            >
              <ReaderSearchButton
                blocks={readerBlocks}
                compact={Boolean(translationLanguage)}
                compactWidth={translatedActionWidth}
                grouped
                onSelectResult={(page, blockId, query, matchIndex) =>
                  goToReaderPage(page, blockId, query, matchIndex)
                }
              />
              <ThreeLinesButton
                chapters={readerChapters}
                compact={Boolean(translationLanguage)}
                compactWidth={translatedActionWidth}
                currentPage={navigationCurrentPage}
                grouped
                totalPages={visiblePageCount}
                onGoToPage={goToDisplayedPage}
                onGoToChapter={(chapter) =>
                  goToNavigationPage(
                    chapter.sourcePage ?? chapter.page,
                    chapter.blockId,
                  )
                }
              />
            </View>

            <View>
              <ReaderModeTabs
                value={activeTab}
                onValueChange={handleTabChange}
                showTranslated={Boolean(translationLanguage)}
              />
            </View>
          </View>
          {visiblePageCount > 0 && (
            <View className="absolute bottom-[6px] left-0 right-0 flex-row items-center px-5">
              <Text
                className="mr-4 flex-1 font-lato-bold text-xs text-[#83877e]"
                numberOfLines={1}
              >
                {displayPdfName}
              </Text>
              <Text className="min-w-14 text-right font-lato-bold text-xs text-[#6d716a]">
                {visiblePage}/{visiblePageCount}
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      <View className="flex-1 overflow-hidden">
        <Animated.View
          pointerEvents={
            activeTab === "original" ||
            (activeTab === "reader" && readerBlocks.length === 0)
              ? "auto"
              : "none"
          }
          style={{
            position: "absolute",
            top: isLandscape ? 0 : headerHeight,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: activeTab === "original" ? 2 : 0,
          }}
        >
          <OriginalPDF
            pdfUri={pdf.uri}
            fileSize={pdf.size}
            initialPage={
              canonicalAnchor && canonicalAnchor.documentId === pdfId
                ? canonicalAnchor.sourcePage
                : pdf.currentPage || 1
            }
            destination={originalDestination}
            resetZoomNonce={originalZoomResetNonce}
            onReady={() => {
              originalContentReadyRef.current = true;
            }}
            onPageChanged={handlePageChanged}
            onOutlineChanged={handleOutlineChanged}
            highlightTarget={
              activeTab === "original" ? canonicalOriginalHighlight : null
            }
          />
        </Animated.View>

        <Animated.View
          pointerEvents={activeTab === "translated" ? "auto" : "none"}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: activeTab === "translated" ? 2 : 0,
          }}
        >
          {translatedReaderActivated && translatedBlocks.length > 0 ? (
            <ReaderView
              documentId={pdf.id}
              annotationScope={`translated:${translationLanguage?.code ?? "unknown"}`}
              key={`translated-${translationLanguage?.code ?? "unknown"}`}
              isActive={activeTab === "translated"}
              isLandscape={isLandscape}
              headerOverlayHeight={isLandscape ? 0 : headerHeight}
              topBarVisible={
                !(readerGuideEnabled && readerTransition === "pager") &&
                (isLandscape || !readerChromeHidden)
              }
              blocks={translatedBlocks}
              pageCount={readerPageCount}
              sourcePageCount={readerPageCount}
              destination={translatedDestination}
              stationarySwitchHighlight={translatedSwitchHighlight}
              onPageChange={handleTranslatedPageChange}
              onPaginationChange={handleTranslatedPagination}
              onPageMapChange={handleTranslatedChapterPageMapChange}
              onExplicitPageResolved={handleTranslatedExplicitPageResolved}
              onSwitchAnchorChange={handleTranslatedSwitchAnchorChange}
              onUserInteraction={handleReaderUserInteraction}
              onReady={(reason) => {
                const recovered = translatedContentReadyRef.current;
                translatedContentReadyRef.current = true;
                if (
                  recovered &&
                  reason === "recovery" &&
                  useAnchorStore.getState().transition.status !== "running"
                ) {
                  void runAnchorTransition("translated");
                }
              }}
              onToolbarVisibilityChange={handleReaderToolbarVisibilityChange}
              showSwitchHighlight={activeTab === "translated"}
              translationLanguage={translationLanguage}
              onTranslationLanguageChange={handleTranslationLanguageChange}
              useTranslatedTextDirection
              readerMode="translated"
              onFindWordInOtherTab={handleFindWordInOtherTab}
              onVerticalRotationSettled={finishRotationMask}
            />
          ) : translationError ? (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]">
              <Text className="text-center font-lato-bold text-lg text-black dark:text-[#F4F5F1]">
                Translation unavailable
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                {translationError}
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]">
              <ActivityIndicator size="large" color="#8fb996" />
              <Text className="mt-4 text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">
                Translating this reading location to{" "}
                {translationLanguage?.label}…
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                iOS may ask to download the required language models.
              </Text>
            </View>
          )}
          {translatedChapterRequest && (
            <View className="absolute inset-0 z-50 items-center justify-center bg-[#F7F5EC]/95 px-8 dark:bg-[#10120F]/95">
              <ActivityIndicator size="large" color="#4f936b" />
              <Text className="mt-4 text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">
                {readerPageSizes[translatedChapterRequest.sourcePage]
                  ? "Translating this chapter…"
                  : "Preparing this chapter…"}
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                Preparing page {translatedChapterRequest.sourcePage} and the
                pages around it.
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View
          pointerEvents={
            activeTab === "reader" && readerContentReady ? "auto" : "none"
          }
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: activeTab === "reader" ? 2 : 0,
            opacity:
              activeTab === "reader" &&
              readerBlocks.length > 0 &&
              initialRestoreCompleteFor !== pdfId
                ? 0
                : 1,
          }}
        >
          {readerBlocks.length > 0 ? (
            <View style={{ flex: 1 }}>
              <ReaderView
                documentId={pdf.id}
                annotationScope="reader"
                isActive={activeTab === "reader"}
                isLandscape={isLandscape}
                headerOverlayHeight={isLandscape ? 0 : headerHeight}
                topBarVisible={
                  !(readerGuideEnabled && readerTransition === "pager") &&
                  (isLandscape || !readerChromeHidden)
                }
                blocks={readerBlocks}
                pageCount={readerPageCount}
                destination={readerDestination}
                stationarySwitchHighlight={readerSwitchHighlight}
                onPageChange={handleReaderPageChange}
                onPaginationChange={handleReaderPagination}
                onPageMapChange={handleReaderChapterPageMapChange}
                onExplicitPageResolved={handleReaderExplicitPageResolved}
                onSwitchAnchorChange={handleReaderSwitchAnchorChange}
                onUserInteraction={handleReaderUserInteraction}
                showSwitchHighlight={
                  activeTab === "reader" && Boolean(readerSwitchHighlight)
                }
                onReady={(reason) => {
                  const recovered = readerContentReadyRef.current;
                  readerContentReadyRef.current = true;
                  setReaderContentReady(true);
                  if (
                    recovered &&
                    reason === "recovery" &&
                    useAnchorStore.getState().transition.status !== "running"
                  ) {
                    void runAnchorTransition("reader");
                  }
                }}
                onToolbarVisibilityChange={handleReaderToolbarVisibilityChange}
                translationLanguage={translationLanguage}
                onTranslationLanguageChange={handleTranslationLanguageChange}
                readerMode="reader"
                onFindWordInOtherTab={handleFindWordInOtherTab}
                onVerticalRotationSettled={finishRotationMask}
              />
            </View>
          ) : readerLoading ? (
            <View className="flex-1 bg-transparent">
              <Text className="hidden">
                Preparing a comfortable reading version…
              </Text>
            </View>
          ) : readerError ? (
            <View className="flex-1 items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#10120F]">
              <Text className="text-center font-lato-bold text-base text-black dark:text-[#F4F5F1]">
                Reader Mode is not ready
              </Text>
              <Text className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                {readerError}
              </Text>
              {!isPdfEngineLinked && (
                <Text className="mt-3 text-center text-xs text-black/40 dark:text-white/40">
                  Install the iOS development build containing the Rust
                  extraction engine.
                </Text>
              )}
            </View>
          ) : (
            <View className="flex-1 bg-[#F7F5EC] dark:bg-[#10120F]" />
          )}
          {!readerError && (
            <Reanimated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, readerSkeletonStyle]}
            >
              <BookPageSkeleton />
            </Reanimated.View>
          )}
        </Animated.View>

        {activeTab === "reader" &&
          readerBlocks.length > 0 &&
          initialRestoreCompleteFor !== pdfId && (
            <View
              pointerEvents="none"
              className="absolute inset-0 z-[3] items-center justify-center bg-[#F7F5EC] dark:bg-[#10120F]"
            >
              <ActivityIndicator size="large" color="#8fb996" />
            </View>
          )}
      </View>

      {anchorTransition.status === "running" &&
        anchorTransition.target &&
        anchorTransition.target.mode !== "original" && (
          <View className="absolute inset-0 z-[1000] items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#151814]">
            <ActivityIndicator size="large" color="#6F9B78" />
            <Text className="mt-4 text-center font-lato-bold text-sm text-black/50 dark:text-white/55">
              Keeping your place…
            </Text>
          </View>
        )}

      {rotationMaskVisible && (
        <View
          accessibilityLabel="Keeping your reading place"
          accessibilityLiveRegion="polite"
          className="absolute inset-0 z-[1000] items-center justify-center bg-[#F7F5EC] px-8 dark:bg-[#151814]"
        >
          <ActivityIndicator size="large" color="#6F9B78" />
          <Text className="mt-4 font-lato-bold text-sm text-black/50 dark:text-white/55">
            Keeping your place…
          </Text>
        </View>
      )}
    </Box>
  );
}

export default function ReaderScreen() {
  const router = useRouter();
  return (
    <AppErrorBoundary
      area="reader"
      fallbackTitle="This PDF couldn't be displayed"
      fallbackMessage="Your library is safe. Try reopening the reader or return to your library."
      onExit={() => router.replace("/HomePage")}
    >
      <ReaderScreenContent />
    </AppErrorBoundary>
  );
}
