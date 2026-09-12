import { pageStartAnchor, resolveAnchor } from "@/architecture/anchor/AnchorResolution";
import BackButton from "@/components/Backbutton";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import OriginalPDF, { type PdfOutlineItem } from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
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
import type {
  CanonicalAnchor,
  ReaderLayout as AnchorReaderLayout,
} from "@/architecture/anchor/AnchorTypes";
import {
  loadReaderPosition,
  saveReaderPosition,
} from "@/database/readerPositionRepository";
import { useReaderAnchor } from "@/hooks/useReaderAnchor";
import { reportTocNavigation } from "@/services/readerPerformance";

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

const FIRST_READER_PAGE_BATCH = 1;
const WARM_READER_PAGE_COUNT = 5;
const BACKGROUND_READER_PAGE_BATCH = 8;
const CHAPTER_EXTRACTION_PAGES_ABOVE = 3;
const CHAPTER_EXTRACTION_PAGE_COUNT = 7;
const EXTRACTION_CACHE_PAGE_INTERVAL = 32;

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
  const desiredAnchor = useAnchorStore((state) => state.desiredAnchor);
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
  const originalContentReadyRef = React.useRef(false);
  const horizontalPreparing = readerTransition === "pager" && readerBlocks.length === 0;
  const readerSkeletonOpacity = useSharedValue(1);
  const [readerCurrentPage, setReaderCurrentPage] = useState(1);
  const [readerDisplayCurrentPage, setReaderDisplayCurrentPage] = useState(1);
  const [readerDisplayPageCount, setReaderDisplayPageCount] = useState(0);

  const [readerChapterPageMap, setReaderChapterPageMap] = useState<
    Record<number, number>
  >({});
  const [originalCurrentPage, setOriginalCurrentPage] = useState(1);
  const originalCurrentPageRef = React.useRef(1);
  const pendingOriginalPageRef = React.useRef<number | null>(null);
  const originalUserInteractedRef = React.useRef(false);
  // A TOC request is expected to settle on the requested page. Retaining only
  // the start time lets diagnostics measure that handoff without identifying
  // the document or chapter.
  const tocNavigation = React.useRef<{
    startedAt: number;
    targetPage: number;
  } | null>(null);
  // Original PDFKit can report a source page but not a precise visible word.
  // Preserve the exact source anchor used to enter Original so returning to a
  // text renderer does not fall back to an older, debounced canonical anchor.
  const originalHandoffAnchorRef = React.useRef<CanonicalAnchor | null>(null);
  const [originalPageCount, setOriginalPageCount] = useState(0);
  const [originalDestination, setOriginalDestination] = useState<{
    page: number;
    nonce: number;
  } | null>(null);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [readerDestination, setReaderDestination] = useState<{
    page: number;
    documentStart?: boolean;
    readerPage?: number;
    blockId?: string;
    searchQuery?: string;
    searchMatchIndex?: number;
    suppressSwitchHighlight?: boolean;
    switchHighlightOffset?: number;
    switchHighlightWordIndex?: number;
    switchHighlightWordProgress?: number;
    highlightDocumentStart?: boolean;
    pageTop?: boolean;
    nonce: number;
  } | null>(null);
  const [readerSwitchHighlight, setReaderSwitchHighlight] = useState<{
    blockId: string;
    offset: number;
    nonce: number;
  } | null>(null);
  const readerExtractionStarted = React.useRef(false);
  const requestedExtractionPages = React.useRef<number[]>([]);
  const activeTabRef = React.useRef<ReaderMode>("reader");
  const latestReaderBlocks = React.useRef(readerBlocks);
  const latestPdf = React.useRef(pdf);
  const latestReaderPageSizes = React.useRef(readerPageSizes);
  const latestReaderPageCount = React.useRef(readerPageCount);
  const positionRestoreApplied = React.useRef(false);
  const initialOpenIsNew = React.useRef(true);
  const recoveryAnchorRef = React.useRef<CanonicalAnchor | null>(null);
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
    reportReaderAnchor: handleReaderSwitchAnchorChange,
  } = useReaderAnchor({
    documentId: pdfId,
    isActive: activeTab === "reader" && positionHydratedFor === pdfId,
    blocks: readerBlocks,
    isRotationInProgress,
  });
  const canonicalOriginalHighlight = useMemo(
    () =>
      originalHighlightTarget(
        anchorTransition.status === "running" && anchorTransition.target?.mode === "original"
          ? desiredAnchor ?? canonicalAnchor : canonicalAnchor,
        readerBlocks, readerPageSizes),
    [canonicalAnchor, desiredAnchor, anchorTransition.status, anchorTransition.target?.mode, readerBlocks, readerPageSizes],
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
      // Width changes own the rotation mask; native orientation events only update chrome.
      // Restore portrait chrome in the same React batch as orientation. A
      // separate follow-up effect produced a visible hidden-then-shown frame.
      headerVisibility.stopAnimation();
      headerVisibility.setValue(landscape ? 0 : 1);
      if (!landscape) setReaderChromeHidden(false);
    },
    [headerVisibility],
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

  activeTabRef.current = activeTab;
  latestReaderBlocks.current = readerBlocks;
  latestPdf.current = pdf;
  latestReaderPageSizes.current = readerPageSizes;
  latestReaderPageCount.current = readerPageCount;

  useEffect(() => {
    if (!pdfId) return;
    setPositionHydratedFor(null);
    setInitialRestoreCompleteFor(null);
    positionRestoreApplied.current = false;
    initialOpenIsNew.current = true;
    transitionController.cancel("document changed");
    setReaderDestination(null);
    setReaderSwitchHighlight(null);
    setOriginalDestination(null);
    originalHandoffAnchorRef.current = null;
    pendingLayoutAnchor.current = null;
    readerContentReadyRef.current = false;
    setActiveTab("reader");
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
        initialOpenIsNew.current = !anchor;
        anchorController.initialize(
          anchor ?? {
            documentId: pdfId,
            sourcePage: 1,
          },
        );
      })
      .catch(() => {
        if (cancelled) return;
        anchorController.initialize({
          documentId: pdfId,
          sourcePage: 1,
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
          // The document shell can render before background bookkeeping.
          setPdf(storedPdf);
          setLoadError(null);
          setIsLoading(false);
        }

        void markPdfOpened(db, pdfId).catch(() => undefined);
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

          const preparingHorizontal = useReaderSettingsStore.getState().transition === "pager";
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
              (preparingHorizontal ? 256 : EXTRACTION_CACHE_PAGE_INTERVAL) ||
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
    const desired = useAnchorStore.getState().desiredAnchor;
    if (desired?.documentId === pdfId) return desired;
    const current = anchorController.current();
    if (
      activeTabRef.current === "original" &&
      originalHandoffAnchorRef.current?.documentId === pdfId
    ) {
      return originalHandoffAnchorRef.current;
    }
    const live =
      activeTabRef.current === "reader" ? actualReaderAnchor.current : null;
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
  }, [actualReaderAnchor, pdfId]);
  captureCanonicalAnchorRef.current = captureCanonicalAnchor;

  // Cover in the same render that replaces the renderer, before its default
  // page can paint. The transition then owns the cover until verification ends.
  const layoutChanging = readerTransition !== previousReaderTransition.current;
  const transitionMaskVisible = layoutChanging || (
    anchorTransition.status === "running" && Boolean(anchorTransition.target) && (
      anchorTransition.from?.mode !== anchorTransition.target?.mode ||
      anchorTransition.from?.layout !== anchorTransition.target?.layout
    )
  );

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
        suppressSwitchHighlight?: boolean;
        pageTop?: boolean;
      },
      capturedAnchorOverride?: CanonicalAnchor | null,
    ) => {
      const sourceLayout = fromLayout ?? useAnchorStore.getState().activeLayout;
      const from = { mode: activeTabRef.current, layout: sourceLayout };
      const target = { mode: targetMode, layout: targetLayout };
      const candidate = capturedAnchorOverride ?? captureCanonicalAnchor();
      const resolved = candidate && latestReaderPageSizes.current[candidate.sourcePage] && resolveAnchor(candidate, candidate.documentId,
        latestReaderPageCount.current, latestReaderBlocks.current);
      const capturedAnchor = candidate ? { ...candidate, ...(resolved || {}) } : null;

      const readerPorts = {
        isReady: (anchor: CanonicalAnchor) =>
          readerContentReadyRef.current &&
          (!anchor.sourceBlockId ||
            latestReaderBlocks.current.some(
              (block) => block.id === anchor.sourceBlockId,
            )),
        restore: (anchor: CanonicalAnchor, transitionId: number) => {
          if (!transitionController.isCurrent(transitionId)) return;
          actualReaderAnchor.current = null;
          const firstSourceBlock = latestReaderBlocks.current.find((block) =>
            block.text.trim(),
          );
          const { suppressSwitchHighlight, ...destinationOverride } =
            readerDestinationOverride ?? {};
          const destination = verticalDestination(anchor, transitionId);
          setReaderDestination({
            ...destination,
            suppressSwitchHighlight,
            ...(suppressSwitchHighlight && destinationOverride.pageTop
              ? {
                  switchHighlightOffset: undefined,
                  switchHighlightWordIndex: undefined,
                  switchHighlightWordProgress: undefined,
                  switchHighlightQuery: undefined,
                }
              : null),
            documentStart:
              targetLayout === "vertical" &&
              anchor.sourcePage === firstSourceBlock?.page &&
              anchor.sourceBlockId === firstSourceBlock?.id &&
              (anchor.wordIndex ?? 0) === 0 &&
              (anchor.blockProgress ?? 0) === 0,
            highlightDocumentStart:
              !suppressSwitchHighlight && from.mode === "original",
            ...destinationOverride,
            nonce: transitionId,
          });
          setReaderSwitchHighlight(null);
          setActiveTab("reader");
        },
        actual: () => actualReaderAnchor.current,
        isTransitionCurrent: (id: number) => transitionController.isCurrent(id),
      };
      const verificationAnchor = (anchor: CanonicalAnchor): CanonicalAnchor => ({
        ...anchor,
        ...resolveAnchor(anchor, anchor.documentId, latestReaderPageCount.current, latestReaderBlocks.current),
      });
      const adapter =
        targetMode === "original"
          ? createOriginalAnchorAdapter({
              isReady: () => originalContentReadyRef.current,
              restore: (destination, transitionId) => {
                if (!transitionController.isCurrent(transitionId)) return;
                originalUserInteractedRef.current = false;
                pendingOriginalPageRef.current = destination.page;
                setOriginalCurrentPage(destination.page);
                setOriginalDestination(destination);
                setReaderChromeHidden(false);
                setActiveTab("original");
              },
              currentPage: () => originalCurrentPageRef.current,
              isTransitionCurrent: (id: number) => transitionController.isCurrent(id),
            })
          : targetLayout === "horizontal"
            ? createHorizontalAnchorAdapter(readerPorts, {
                verifyTimeoutMs: 2_500,
                verificationAnchor,
              })
            : createVerticalAnchorAdapter(readerPorts, {
                verifyTimeoutMs: 2_500,
                verificationAnchor,
              });

      const succeeded = await transitionController.run({
        from,
        target,
        capture: () => capturedAnchor ?? captureCanonicalAnchor(),
        prepare: async (anchor, transitionId) => {
          if (targetMode === "original") {
            originalHandoffAnchorRef.current = anchor;
            return waitForCurrentTransition(
              transitionId,
              () => originalContentReadyRef.current,
            );
          }
          const pageAvailable = () => Boolean(latestReaderPageSizes.current[anchor.sourcePage]);
          if (!pageAvailable()) requestedExtractionPages.current.unshift(anchor.sourcePage);
          const ready = await waitForCurrentTransition(transitionId,
            () => readerContentReadyRef.current && pageAvailable());
          if (!ready) return false;
          const normalized = resolveAnchor(anchor, anchor.documentId,
            latestReaderPageCount.current, latestReaderBlocks.current);
          if (!normalized) return false;
          Object.assign(anchor, normalized);
          return true;
        },
        adapter,
      });
      if (succeeded && targetLayout === "vertical") {
        const completed = useAnchorStore.getState().transition;
        if (
          completed.status === "complete" &&
          completed.target?.mode === "reader"
        ) {
          setReaderDestination((current) =>
            current?.nonce === completed.id ? null : current,
          );
        }
      }
      if (!succeeded) {
        const transition = useAnchorStore.getState().transition;
        if (
          transition.status === "failed" &&
          transition.target?.mode === targetMode
        ) {
          if (targetMode === "original") pendingOriginalPageRef.current = null;
          else setReaderDestination(null);
        }
      }
      return succeeded;
    },
    [actualReaderAnchor, captureCanonicalAnchor, readerTransition],
  );
  useEffect(() => {
    if (!pdfId || positionRestoreApplied.current || readerBlocks.length === 0)
      return;
    if (positionHydratedFor !== pdfId) return;
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
      { suppressSwitchHighlight: true },
      initialOpenIsNew.current
        ? { ...canonicalAnchor, ...pageStartAnchor(pdfId, readerBlocks[0].page, readerBlocks) }
        : canonicalAnchor,
    ).finally(() => setInitialRestoreCompleteFor(pdfId));
  }, [
    canonicalAnchor,
    pdfId,
    readerBlocks,
    positionHydratedFor,
    captureCanonicalAnchor,
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
    const previousOrientation = previousPresentationKey.current.split(":").at(-1);
    previousPresentationKey.current = nextKey;
    // The pager owns typography reflow and captures its visible first word.
    // A second canonical restore here races that local layout transaction.
    if (readerTransition === "pager" && previousOrientation === nextKey.split(":").at(-1)) return;
    if (!positionRestoreApplied.current) return;
    void runAnchorTransition(activeTabRef.current, undefined, undefined, { suppressSwitchHighlight: true });
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

  const displayedTab =
    anchorTransition.status === "running" && anchorTransition.target
      ? anchorTransition.target.mode
      : activeTab;
  const visibleTab = activeTab;

  const handleFindWordInOtherTab = useCallback(
    (target: FindWordTarget, selected: FindWordAnchor) => {
      if (!pdfId || target === activeTabRef.current) return;
      const sourceBlock = latestReaderBlocks.current.find(
        (block) => block.id === selected.sourceBlockId,
      );
      const sourceWords = sourceBlock
        ? Array.from(sourceBlock.text.matchAll(/\S+/g))
        : [];
      const sourceWordIndex = sourceWords.length
        ? Math.max(
            0,
            Math.min(
              sourceWords.length - 1,
              Math.round(selected.blockProgress * (sourceWords.length - 1)),
            ),
          )
        : 0;
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
  }, []);
  useEffect(() => {
    const guideOwnsReader =
      readerGuideEnabled &&
      readerTransition === "pager" &&
      activeTab === "reader";
    setReaderChromeHidden(guideOwnsReader);
  }, [activeTab, hideTopBarOnScroll, readerGuideEnabled, readerTransition]);

  const handleReaderToolbarVisibilityChange = useCallback(
    (visible: boolean) => {
      if (
        readerGuideEnabled &&
        readerTransition === "pager" &&
        activeTab === "reader"
      ) {
        setReaderChromeHidden(true);
        return;
      }
      if (
        activeTab === "reader" &&
        (hideTopBarOnScroll ||
          readerTransition === "pager" ||
          readerGuideEnabled)
      ) {
        setReaderChromeHidden(!visible);
      }
    },
    [activeTab, hideTopBarOnScroll, readerGuideEnabled, readerTransition],
  );

  const handlePageChanged = useCallback(
    (page: number, totalPages: number) => {
      const previousPage = originalCurrentPageRef.current;
      const pendingPage = pendingOriginalPageRef.current;
      if (pendingPage !== null && page !== pendingPage) return;
      // PDFKit may call the neighboring page "current" while the handoff word
      // is visible near a page boundary. Keep the acknowledged handoff until
      // the user scrolls, or a new explicit destination replaces it.
      if (pendingPage === null && !originalUserInteractedRef.current &&
          originalHandoffAnchorRef.current &&
          page !== originalHandoffAnchorRef.current.sourcePage) return;
      const completedProgrammaticNavigation = page === pendingPage;
      if (completedProgrammaticNavigation)
        pendingOriginalPageRef.current = null;
      if (completedProgrammaticNavigation && tocNavigation.current) {
        const navigation = tocNavigation.current;
        reportTocNavigation(
          page === navigation.targetPage ? "settled" : "missed",
          Date.now() - navigation.startedAt,
        );
        tocNavigation.current = null;
      }
      originalCurrentPageRef.current = page;
      setOriginalCurrentPage(page);
      setOriginalPageCount(totalPages);
      // Keep the exact handoff word after a programmatic transition. For a real
      // user page change, Original only exposes the page, so use that page's
      // first source block as the new deterministic return anchor.
      if (
        !completedProgrammaticNavigation &&
        page !== previousPage &&
        originalUserInteractedRef.current &&
        activeTabRef.current === "original" &&
        pdfId
      ) {
        const firstBlock = latestReaderBlocks.current.find(
          (block) => block.page === page && block.text.trim(),
        );
        if (firstBlock) {
          originalHandoffAnchorRef.current = {
            documentId: pdfId,
            sourcePage: page,
            sourceBlockId: firstBlock.id,
            wordIndex: 0,
            characterOffset: 0,
            blockProgress: 0,
            revision: anchorController.current()?.revision ?? 0,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    },
    [pdfId],
  );

  const readerChapters = useMemo<ReaderChapter[]>(() => {
    const pageMap = activeTab === "reader" && readerTransition === "pager" ? readerChapterPageMap : null;
    const convert = (
      items: PdfOutlineItem[],
      path = "outline",
    ): ReaderChapter[] =>
      items.map((item, index) => {
        const chapterId = `${path}-${index}-${item.page}`;
        return {
          id: chapterId,
          title: item.title,
          page: pageMap?.[item.page] ?? item.page,
          sourcePage: item.page,
          children: convert(item.children ?? [], `${path}-${index}`),
        };
      });
    return convert(pdfOutline);
  }, [activeTab, pdfOutline, readerChapterPageMap, readerTransition]);

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

  const handleOutlineChanged = useCallback((outline: PdfOutlineItem[]) => {
    setPdfOutline(outline);
  }, []);

  const handleReaderPagination = useCallback(
    (current: number, total: number) => {
      // Generated pagination belongs exclusively to the horizontal pager. The
      // pager can finish an async repagination while it is being unmounted;
      // accepting that late callback after returning to scroll mode makes its
      // generated total replace the PDF's source-page total.
      if (readerTransition !== "pager") return;
      setReaderDisplayCurrentPage(current);
      setReaderDisplayPageCount(total);

    },
    [readerTransition],
  );

  useEffect(() => {
    if (readerTransition === "pager") return;

    // Scroll mode is indexed by original PDF pages, never the generated pages
    // used by the horizontal reader. Reset all horizontal-only presentation
    // state immediately, rather than waiting for the vertical WebView to send
    // its first status message.
    const sourcePageTotal = readerPageCount || pdf?.totalPages || 0;
    setReaderDisplayPageCount(sourcePageTotal);
    setReaderDisplayCurrentPage((current) =>
      Math.max(1, Math.min(current, sourcePageTotal || 1)),
    );
    setReaderChapterPageMap({});
  }, [pdf?.totalPages, readerPageCount, readerTransition]);
  const handleReaderExplicitPageResolved = useCallback(
    (
      sourcePage: number,
      anchor: { blockId: string; blockOffset: number; wordIndex: number },
    ) => {
      if (!pdfId) return;
      if (tocNavigation.current) {
        const navigation = tocNavigation.current;
        reportTocNavigation(
          sourcePage === navigation.targetPage ? "settled" : "missed",
          Date.now() - navigation.startedAt,
        );
        tocNavigation.current = null;
      }
      const block = latestReaderBlocks.current.find(
        (candidate) => candidate.id === anchor.blockId,
      );
      const wordCount = block
        ? Array.from(block.text.matchAll(/\S+/g)).length
        : 0;
      anchorController.publish(
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
  const visiblePage = activeTab === "original"
    ? originalCurrentPage
    : readerTransition === "pager"
      ? readerDisplayCurrentPage
      : readerCurrentPage;
  const visiblePageCount = activeTab === "original"
    ? originalPageCount || pdf?.totalPages || readerPageCount
    : readerTransition === "pager"
      ? readerDisplayPageCount
      : readerPageCount || pdf?.totalPages || 0;
  const navigationCurrentPage =
    activeTab === "original"
      ? originalCurrentPage
      : readerTransition === "pager"
        ? readerDisplayCurrentPage
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
            (block) => block.page === page && block.text.trim(),
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
      tocNavigation.current = { startedAt: Date.now(), targetPage: page };
      reportTocNavigation("requested");
      const block = blockId
        ? latestReaderBlocks.current.find((item) => item.id === blockId && item.page === page)
        : undefined;
      anchorController.navigate(
        block ? { ...pageStartAnchor(pdfId, page, latestReaderBlocks.current), sourceBlockId: block.id } :
          pageStartAnchor(pdfId, page, latestReaderBlocks.current),
        "toc",
      );
      requestedExtractionPages.current.unshift(page);
      void runAnchorTransition(
        activeTabRef.current,
        undefined,
        undefined,
        { suppressSwitchHighlight: true, pageTop: true },
      );
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
        setReaderDestination(destination);
        setReaderSwitchHighlight(null);
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
        hidden={visibleTab === "reader" && (isLandscape || readerChromeHidden)}
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

            <View className="absolute right-4 top-1/2 -translate-y-1/2 flex-row">
              <ReaderSearchButton
                blocks={readerBlocks}
                grouped
                onSelectResult={(page, blockId, query, matchIndex) =>
                  goToReaderPage(page, blockId, query, matchIndex)
                }
              />
              <ThreeLinesButton
                chapters={readerChapters}
                currentPage={navigationCurrentPage}
                grouped
                totalPages={activeTab === "reader" && readerTransition === "pager"
                  ? readerDisplayPageCount : visiblePageCount}
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
                value={displayedTab}
                onValueChange={handleTabChange}
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
            visibleTab === "original" ||
            (visibleTab === "reader" && readerBlocks.length === 0)
              ? "auto"
              : "none"
          }
          style={{
            position: "absolute",
            top: isLandscape ? 0 : headerHeight,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: visibleTab === "original" ? 2 : 0,
          }}
        >
          <OriginalPDF
            key={pdf.id}
            pdfUri={pdf.uri}
            fileSize={pdf.size}
            initialPage={
              canonicalAnchor && canonicalAnchor.documentId === pdfId
                ? canonicalAnchor.sourcePage
                : pdf.currentPage || 1
            }
            destination={originalDestination}
            onReady={() => {
              originalContentReadyRef.current = true;
            }}
            onUserInteraction={() => { originalUserInteractedRef.current = true; }}
            onPageChanged={handlePageChanged}
            onOutlineChanged={handleOutlineChanged}
            highlightTarget={
              activeTab === "original" ? canonicalOriginalHighlight : null
            }
          />
        </Animated.View>

        <Animated.View
          pointerEvents={
            visibleTab === "reader" && readerContentReady ? "auto" : "none"
          }
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: visibleTab === "reader" ? 2 : 0,
            opacity:
              visibleTab === "reader" &&
              readerBlocks.length > 0 &&
              initialRestoreCompleteFor !== pdfId && !horizontalPreparing
                ? 0
                : 1,
          }}
        >
          {readerBlocks.length > 0 ? (
            <View style={{ flex: 1 }}>
              <ReaderView
                key={pdf.id}
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
                extractedPageSizes={readerPageSizes}
                extractionError={readerError}
                onRequestPage={(page) => {
                  if (!requestedExtractionPages.current.includes(page)) {
                    requestedExtractionPages.current.push(page);
                  }
                }}
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
                  activeTab === "reader" &&
                  Boolean(readerDestination) &&
                  !readerDestination?.suppressSwitchHighlight &&
                  (!readerDestination?.documentStart ||
                    readerDestination.highlightDocumentStart)
                }
                onUnavailable={() => {
                  recoveryAnchorRef.current = captureCanonicalAnchor();
                  transitionController.cancel("vertical WebView terminated");
                  readerContentReadyRef.current = false;
                  setReaderContentReady(false);
                  actualReaderAnchor.current = null;
                }}
                onReady={(reason) => {
                  readerContentReadyRef.current = true;
                  setReaderContentReady(true);
                  if (reason === "recovery" && useAnchorStore.getState().transition.status !== "running") {
                    const anchor = recoveryAnchorRef.current ?? anchorController.current();
                    recoveryAnchorRef.current = null;
                    void runAnchorTransition("reader", undefined, undefined, undefined, anchor);
                  }
                }}
                onToolbarVisibilityChange={handleReaderToolbarVisibilityChange}
                onFindWordInOtherTab={handleFindWordInOtherTab}
                onVerticalRotationSettled={(ok) => {
                  finishRotationMask();
                  if (ok === false && useAnchorStore.getState().transition.status !== "running") {
                    void runAnchorTransition("reader", "vertical", undefined, undefined, anchorController.current());
                  }
                }}
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
          {!readerError && !horizontalPreparing && (
            <Reanimated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, readerSkeletonStyle]}
            >
              <BookPageSkeleton />
            </Reanimated.View>
          )}
        </Animated.View>

        {visibleTab === "reader" &&
          readerBlocks.length > 0 &&
          initialRestoreCompleteFor !== pdfId && !horizontalPreparing && (
            <View
              pointerEvents="none"
              className="absolute inset-0 z-[3] items-center justify-center bg-[#F7F5EC] dark:bg-[#10120F]"
            >
              <ActivityIndicator size="large" color="#8fb996" />
            </View>
          )}
      </View>

      {transitionMaskVisible && !rotationMaskVisible && !horizontalPreparing && (
        <View
          style={{
            position: "absolute",
            top: isLandscape ? 0 : headerHeight,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: isDark ? "#151814" : "#F7F5EC",
          }}
          className="z-[1000]"
        />
      )}

      {rotationMaskVisible && (
        <View
          style={{
            position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
            zIndex: 1000, elevation: 1000,
            backgroundColor: isDark ? "#151814" : "#F7F5EC",
          }}
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
