import { hyphenateText, type ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Destination = {
  page: number;
  readerPage?: number;
  switchHighlightOffset?: number;
  blockId?: string;
  searchQuery?: string;
  searchMatchIndex?: number;
  nonce: number;
} | null;

type Segment = {
  blockId: string;
  sourcePage: number;
  text: string;
  startOffset: number;
  kind: ExtractedPdfBlock["kind"];
  spacingBefore: number;
  spacingAfter: number;
  paragraphStart: boolean;
  sectionOpening: boolean;
};

type PageAnchor = {
  blockId: string;
  blockOffset: number;
  wordIndex: number;
};

type GuideLine = { left: number; top: number; width: number; height: number; text?: string };

type Props = {
  blocks: ExtractedPdfBlock[];
  userHighlights?: Array<{
    blockId: string;
    offset: number;
    length: number;
    color: string;
  }>;
  onWordHighlightRequest?: (highlight: {
    blockId: string;
    offset: number;
    length: number;
  }) => void;
  readingDirection?: "ltr" | "rtl";
  spokenWordHighlight?: {
    blockId: string;
    offset: number;
    length: number;
  } | null;
  guideMode?: "line" | "word" | null;
  guideBackgroundDimming?: number;
  onGuideClose?: () => void;
  destination?: Destination;
  stationarySwitchHighlight?: {
    blockId: string;
    offset: number;
    nonce: number;
  } | null;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  letterSpacing: number;
  wordSpacing: number;
  bold: boolean;
  automaticHyphenation: boolean;
  backgroundColor: string;
  textColor: string;
  onPageChange?: (
    page: number,
    totalPages: number,
    sourcePage: number,
    anchor?: PageAnchor,
  ) => void;
  onPageMapChange?: (pageMap: Record<number, number>) => void;
  onReaderTap?: () => void;
  onSwipeStart?: () => void;
};

function buildPages(
  blocks: ExtractedPdfBlock[],
  charactersPerLine: number,
  pageHeight: number,
  baseLineHeight: number,
  baseFontSize: number,
  paragraphSpacing: number,
) {
  const pages: Segment[][] = [[]];
  let usedHeight = 0;

  blocks.forEach((block, blockIndex) => {
    let sourceOffset = 0;
    const previousKind = blocks[blockIndex - 1]?.kind;
    const sectionOpening = block.kind === "paragraph" && (
      blockIndex === 0 || previousKind === "title" || previousKind === "heading"
    );
    const textScale = block.kind === "title" ? 1.65 : block.kind === "heading" ? 1.3 : 1;
    const scaledLineHeight = baseLineHeight * textScale;
    const scaledCharactersPerLine = Math.max(8, Math.floor(charactersPerLine / textScale));

    while (sourceOffset < block.text.length) {
      let spacingBefore = sourceOffset === 0 && usedHeight > 0
        ? block.kind === "title"
          ? baseFontSize * 1.15
          : block.kind === "heading"
            ? baseFontSize * 0.95
            : 0
        : 0;
      let remainingHeight = pageHeight - usedHeight - spacingBefore;
      let availableLines = Math.floor(remainingHeight / scaledLineHeight);
      if (availableLines < 1 && usedHeight > 0) {
        pages.push([]);
        usedHeight = 0;
        spacingBefore = 0;
        remainingHeight = pageHeight;
        availableLines = Math.max(1, Math.floor(remainingHeight / scaledLineHeight));
      }

      const available = Math.max(1, availableLines * scaledCharactersPerLine);
      let end = Math.min(block.text.length, sourceOffset + available);
      if (end < block.text.length) {
        const breakAt = block.text.lastIndexOf(" ", end);
        if (breakAt > sourceOffset) end = breakAt + 1;
      }
      if (end <= sourceOffset) end = Math.min(block.text.length, sourceOffset + available);

      const text = block.text.slice(sourceOffset, end).trimEnd();
      if (text) {
        const spacingAfter = end >= block.text.length
          ? block.kind === "title"
            ? baseFontSize * 0.7
            : block.kind === "heading"
              ? baseFontSize * 0.55
              : baseFontSize * paragraphSpacing
          : 0;
        pages[pages.length - 1].push({
          blockId: block.id,
          sourcePage: block.page,
          text,
          startOffset: sourceOffset,
          kind: block.kind,
          spacingBefore,
          spacingAfter,
          paragraphStart: block.kind === "paragraph" && sourceOffset === 0,
          sectionOpening: sectionOpening && sourceOffset === 0,
        });
        const wrappedLines = Math.max(
          1,
          Math.ceil(text.length / scaledCharactersPerLine)
        );
        usedHeight += wrappedLines * scaledLineHeight + spacingBefore + spacingAfter;
      }
      sourceOffset = end;
    }
  });

  return pages.filter((page) => page.length > 0);
}

function pageAnchor(
  page: Segment[] | undefined,
  blocks: ExtractedPdfBlock[],
): PageAnchor | undefined {
  const segment = page?.[0];
  if (!segment) return undefined;
  const block = blocks.find((item) => item.id === segment.blockId);
  const prefix = block?.text.slice(0, segment.startOffset) ?? "";
  return {
    blockId: segment.blockId,
    blockOffset: segment.startOffset,
    wordIndex: prefix.match(/\S+/g)?.length ?? 0,
  };
}

export default function HorizontalReaderPager({
  blocks,
  userHighlights = [],
  onWordHighlightRequest,
  readingDirection = "ltr",
  spokenWordHighlight,
  guideMode = null,
  guideBackgroundDimming = 60,
  onGuideClose,
  destination,
  stationarySwitchHighlight,
  fontFamily,
  fontSize,
  lineHeight,
  paragraphSpacing,
  letterSpacing,
  wordSpacing,
  bold,
  automaticHyphenation,
  backgroundColor,
  textColor,
  onPageChange,
  onPageMapChange,
  onReaderTap,
  onSwipeStart,
}: Props) {
  const isRtl = readingDirection === "rtl";
  const pagerRef = useRef<FlatList<Segment[]>>(null);
  const currentPageRef = useRef(0);
  const navigatedDestinationKeyRef = useRef<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [dismissedSearchNonce, setDismissedSearchNonce] = useState<number | null>(null);
  const [dismissedSwitchNonce, setDismissedSwitchNonce] = useState<number | null>(null);
  const [lineGuideIndex, setLineGuideIndex] = useState(0);
  const [wordGuideIndex, setWordGuideIndex] = useState(0);
  const [wordGuideFragmentIndex, setWordGuideFragmentIndex] = useState(0);
  const [guideLinesByPage, setGuideLinesByPage] = useState<Record<number, GuideLine[]>>({});
  const [wordMeasurement, setWordMeasurement] = useState<{
    key: string;
    prefixWidth?: number;
    totalWidth?: number;
  } | null>(null);
  const [displayedGuideRect, setDisplayedGuideRect] = useState<GuideLine | undefined>();
  const segmentMeasurements = useRef(new Map<string, {
    pageIndex: number;
    blockId?: string;
    segmentStart?: number;
    segmentLength?: number;
    indentLength?: number;
    left?: number;
    top?: number;
    lines?: GuideLine[];
  }>());
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const hyphenationCache = useRef(new Map<string, string>());
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight = containerHeight || windowHeight;
  // Painting the new type settings is urgent; rebuilding every page in a long
  // book is not. Deferred layout metrics keep the controls responsive while
  // React repaginates in the background.
  const deferredFontSize = useDeferredValue(fontSize);
  const deferredLineHeight = useDeferredValue(lineHeight);
  const deferredParagraphSpacing = useDeferredValue(paragraphSpacing);
  const deferredLetterSpacing = useDeferredValue(letterSpacing);
  const deferredWordSpacing = useDeferredValue(wordSpacing);
  const horizontalPadding = Math.max(24, (width - 680) / 2);
  const charactersPerLine = Math.max(
    12,
    Math.floor(
      (width - horizontalPadding * 2) /
      Math.max(
        7,
        deferredFontSize * 0.52 +
          deferredLetterSpacing +
          deferredWordSpacing * 0.16,
      ),
    )
  );
  const pageContentHeight = Math.max(
    120,
    (usableHeight - 32 - insets.bottom) * 0.94
  );
  const baseLineHeight = Math.max(
    16,
    deferredFontSize * deferredLineHeight,
  );
  const pages = useMemo(
    () => buildPages(
      blocks,
      charactersPerLine,
      pageContentHeight,
      baseLineHeight,
      deferredFontSize,
      deferredParagraphSpacing,
    ),
    [
      baseLineHeight,
      blocks,
      charactersPerLine,
      deferredFontSize,
      deferredParagraphSpacing,
      pageContentHeight,
    ]
  );
  const sourcePageMap = useMemo(() => {
    const direct: Record<number, number> = {};
    let maximumSourcePage = 0;
    pages.forEach((page, readerPageIndex) => {
      page.forEach((segment) => {
        maximumSourcePage = Math.max(maximumSourcePage, segment.sourcePage);
        direct[segment.sourcePage] ??= readerPageIndex + 1;
      });
    });

    const complete: Record<number, number> = {};
    let nextReaderPage = pages.length || 1;
    for (let sourcePage = maximumSourcePage; sourcePage >= 1; sourcePage -= 1) {
      if (direct[sourcePage] !== undefined) nextReaderPage = direct[sourcePage];
      complete[sourcePage] = nextReaderPage;
    }
    return complete;
  }, [pages]);
  const guideWords = useMemo(() => pages.flatMap((page, pageIndex) =>
    page.flatMap((segments) => Array.from(segments.text.matchAll(/\S+/g)).map((match) => ({
      pageIndex,
      blockId: segments.blockId,
      offset: segments.startOffset + (match.index ?? 0),
      length: match[0].length,
    }))),
  ), [pages]);

  useEffect(() => {
    if (!guideMode) return;
    setLineGuideIndex(0);
    if (guideMode === "word") {
      const firstVisibleWord = guideWords.findIndex(
        (word) => word.pageIndex >= currentPageRef.current,
      );
      setWordGuideIndex(Math.max(0, firstVisibleWord));
      setWordGuideFragmentIndex(0);
    }
  }, [guideMode, guideWords]);

  useEffect(() => {
    onPageMapChange?.(sourcePageMap);
  }, [onPageMapChange, sourcePageMap]);
  const destinationPage = useMemo(() => {
    if (!destination) return 0;
    if (destination.readerPage !== undefined) {
      return Math.max(0, Math.min(pages.length - 1, destination.readerPage - 1));
    }
    const exactIndex = pages.findIndex((page) => page.some((segment) =>
      segment.blockId === destination.blockId &&
      (destination.searchMatchIndex === undefined || (
        destination.searchMatchIndex >= segment.startOffset &&
        destination.searchMatchIndex < segment.startOffset + segment.text.length
      ))
    ));
    if (exactIndex >= 0) return exactIndex;
    return Math.max(0, pages.findIndex((page) =>
      page.some((segment) => segment.sourcePage >= destination.page)
    ));
  }, [destination, pages]);
  useEffect(() => {
    if (!destination || !pages.length) return;
    currentPageRef.current = destinationPage;
    const sourcePage = pages[destinationPage]?.[0]?.sourcePage ?? destination.page;
    onPageChange?.(
      destinationPage + 1,
      pages.length,
      sourcePage,
      pageAnchor(pages[destinationPage], blocks),
    );
  }, [blocks, destination, destinationPage, onPageChange, pages]);

  useEffect(() => {
    if (!destination || !pages.length) return;
    // Pagination is rebuilt after the pager receives its measured height and
    // whenever typography changes. The same destination nonce can therefore
    // resolve to a different horizontal page; include the resolved layout in
    // the key so the exact word is repositioned after pagination settles.
    const navigationKey = [
      destination.nonce,
      destinationPage,
      pages.length,
      Math.round(width),
      Math.round(pageContentHeight),
    ].join(':');
    if (navigatedDestinationKeyRef.current === navigationKey) return;
    const timer = setTimeout(() => {
      pagerRef.current?.scrollToIndex({
        animated: false,
        index: destinationPage,
      });
      currentPageRef.current = destinationPage;
      navigatedDestinationKeyRef.current = navigationKey;
    }, 0);
    return () => clearTimeout(timer);
  }, [destination, destinationPage, pageContentHeight, pages.length, width]);

  useEffect(() => {
    if (pages.length) {
      const current = Math.min(currentPageRef.current, pages.length - 1);
      currentPageRef.current = current;
      onPageChange?.(
        current + 1,
        pages.length,
        pages[current]?.[0]?.sourcePage ?? 1,
        pageAnchor(pages[current], blocks),
      );
    }
  }, [blocks, onPageChange, pages]);

  useEffect(() => {
    if (!spokenWordHighlight || !pages.length) return;
    const pageIndex = pages.findIndex((page) => page.some((segment) =>
      segment.blockId === spokenWordHighlight.blockId &&
      spokenWordHighlight.offset >= segment.startOffset &&
      spokenWordHighlight.offset < segment.startOffset + segment.text.length
    ));
    if (pageIndex < 0 || pageIndex === currentPageRef.current) return;
    pagerRef.current?.scrollToIndex({ animated: true, index: pageIndex });
    currentPageRef.current = pageIndex;
    const sourcePage = pages[pageIndex]?.[0]?.sourcePage ?? 1;
    onPageChange?.(
      pageIndex + 1,
      pages.length,
      sourcePage,
      pageAnchor(pages[pageIndex], blocks),
    );
  }, [blocks, onPageChange, pages, spokenWordHighlight]);

  const textForDisplay = useCallback((text: string) => {
    if (!automaticHyphenation || Platform.OS !== "ios") return text;
    const cached = hyphenationCache.current.get(text);
    if (cached !== undefined) return cached;
    const hyphenated = hyphenateText(text);
    if (hyphenationCache.current.size >= 4000) hyphenationCache.current.clear();
    hyphenationCache.current.set(text, hyphenated);
    return hyphenated;
  }, [automaticHyphenation]);

  const activeGuideWord = guideMode === "word"
    ? guideWords[wordGuideIndex]
    : undefined;
  const activeGuideLines = guideLinesByPage[currentPageRef.current] ?? [];
  const activeGuideLine = activeGuideLines[Math.min(lineGuideIndex, Math.max(0, activeGuideLines.length - 1))];

  const recordSegmentMeasurement = useCallback((
    key: string,
    pageIndex: number,
    segmentInfo: {
      blockId: string;
      start: number;
      length: number;
      indentLength: number;
    },
    layout?: { left: number; top: number },
    lines?: GuideLine[],
  ) => {
    const current = segmentMeasurements.current.get(key) ?? { pageIndex };
    const next = {
      ...current,
      pageIndex,
      blockId: segmentInfo.blockId,
      segmentStart: segmentInfo.start,
      segmentLength: segmentInfo.length,
      indentLength: segmentInfo.indentLength,
      ...(layout ? layout : {}),
      ...(lines ? { lines } : {}),
    };
    segmentMeasurements.current.set(key, next);
    if (next.left === undefined || next.top === undefined || !next.lines) return;
    const pageLines = Array.from(segmentMeasurements.current.values())
      .filter((measurement) =>
        measurement.pageIndex === pageIndex &&
        measurement.left !== undefined &&
        measurement.top !== undefined &&
        measurement.lines
      )
      .flatMap((measurement) => measurement.lines!.map((line) => ({
        left: measurement.left! + line.left,
        top: measurement.top! + line.top,
        width: line.width,
        height: line.height,
        text: line.text,
      })))
      .sort((left, right) => left.top - right.top || left.left - right.left);
    setGuideLinesByPage((currentPages) => {
      const previous = currentPages[pageIndex] ?? [];
      const unchanged = previous.length === pageLines.length && previous.every((line, index) => {
        const candidate = pageLines[index];
        return Math.abs(line.left - candidate.left) < 0.5 &&
          Math.abs(line.top - candidate.top) < 0.5 &&
          Math.abs(line.width - candidate.width) < 0.5 &&
          Math.abs(line.height - candidate.height) < 0.5;
      });
      return unchanged ? currentPages : { ...currentPages, [pageIndex]: pageLines };
    });
  }, []);

  const activeWordMeasurementTarget = useMemo(() => {
    if (!activeGuideWord) return undefined;
    const measurement = Array.from(segmentMeasurements.current.values()).find((item) =>
      item.pageIndex === activeGuideWord.pageIndex &&
      item.blockId === activeGuideWord.blockId &&
      item.segmentStart !== undefined &&
      item.segmentLength !== undefined &&
      activeGuideWord.offset >= item.segmentStart &&
      activeGuideWord.offset < item.segmentStart + item.segmentLength &&
      item.left !== undefined &&
      item.top !== undefined &&
      item.lines
    );
    if (!measurement?.lines || measurement.left === undefined || measurement.top === undefined) {
      return undefined;
    }
    const pageSegment = pages[activeGuideWord.pageIndex]?.find((segment) =>
      segment.blockId === activeGuideWord.blockId &&
      activeGuideWord.offset >= segment.startOffset &&
      activeGuideWord.offset < segment.startOffset + segment.text.length
    );
    if (!pageSegment) return undefined;
    const sourceLocalOffset = activeGuideWord.offset - measurement.segmentStart!;
    const openingWord = pageSegment.sectionOpening
      ? pageSegment.text.match(/^\S+/)?.[0] ?? ""
      : "";
    const displayedOpeningWord = openingWord ? textForDisplay(openingWord) : "";
    const displayedSegment = openingWord
      ? displayedOpeningWord + textForDisplay(pageSegment.text.slice(openingWord.length))
      : textForDisplay(pageSegment.text);
    let sourceCharacters = 0;
    let displayLocalOffset = 0;
    while (displayLocalOffset < displayedSegment.length && sourceCharacters < sourceLocalOffset) {
      if (displayedSegment[displayLocalOffset] !== "\u00ad") sourceCharacters += 1;
      displayLocalOffset += 1;
    }
    let displayWordEnd = displayLocalOffset;
    const sourceWordEnd = sourceLocalOffset + activeGuideWord.length;
    while (displayWordEnd < displayedSegment.length && sourceCharacters < sourceWordEnd) {
      if (displayedSegment[displayWordEnd] !== "\u00ad") sourceCharacters += 1;
      displayWordEnd += 1;
    }
    const displayWordLength = displayWordEnd - displayLocalOffset;
    const localOffset = displayLocalOffset + (measurement.indentLength ?? 0);
    const displayedText = "\u2003\u2002".slice(0, measurement.indentLength ?? 0) + displayedSegment;
    let searchFrom = 0;
    const fragments: Array<{
      prefix: string;
      prefixAndWord: string;
      line: GuideLine;
    }> = [];
    for (const line of measurement.lines) {
      const lineText = line.text ?? "";
      const lineLength = Math.max(1, lineText.length);
      const matchedStart = lineText ? displayedText.indexOf(lineText, searchFrom) : -1;
      const lineStart = matchedStart >= 0 ? matchedStart : searchFrom;
      const lineEnd = lineStart + lineLength;
      const wordStart = localOffset;
      const wordEnd = localOffset + displayWordLength;
      const fragmentStart = Math.max(wordStart, lineStart);
      const fragmentEnd = Math.min(wordEnd, lineEnd);
      if (fragmentStart < fragmentEnd) {
        const offsetInLine = fragmentStart - lineStart;
        const fragmentLength = fragmentEnd - fragmentStart;
        const prefix = lineText.slice(0, offsetInLine);
        fragments.push({
          prefix,
          prefixAndWord: prefix + lineText.slice(offsetInLine, offsetInLine + fragmentLength),
          line: {
            left: measurement.left + line.left,
            top: measurement.top + line.top,
            width: line.width,
            height: line.height,
          },
        });
      }
      searchFrom = lineEnd;
      while (searchFrom < displayedText.length && /\s/.test(displayedText[searchFrom])) {
        searchFrom += 1;
      }
    }
    if (!fragments.length) return undefined;
    const selectedFragmentIndex = wordGuideFragmentIndex < 0
      ? fragments.length - 1
      : Math.min(wordGuideFragmentIndex, fragments.length - 1);
    const fragment = fragments[selectedFragmentIndex];
    const headingScale = pageSegment.kind === "title"
      ? 1.55
      : pageSegment.kind === "heading" ? 1.25 : 1;
    return {
      key: `${activeGuideWord.pageIndex}:${activeGuideWord.blockId}:${activeGuideWord.offset}:${selectedFragmentIndex}`,
      ...fragment,
      fragmentCount: fragments.length,
      selectedFragmentIndex,
      typography: {
        fontFamily,
        fontSize: fontSize * headingScale,
        lineHeight: fontSize * headingScale * lineHeight,
        letterSpacing,
        fontWeight: bold ? "700" as const : "400" as const,
        writingDirection: readingDirection,
      },
      openingWord: displayedOpeningWord,
      activeWordUsesOpeningStyle: Boolean(openingWord && sourceLocalOffset === 0),
      openingWordStyle: {
        fontSize: fontSize * headingScale * 1.24,
        fontWeight: "700" as const,
        letterSpacing: letterSpacing + 0.15,
      },
    };
  }, [
    activeGuideWord,
    bold,
    fontFamily,
    fontSize,
    guideLinesByPage,
    letterSpacing,
    lineHeight,
    pages,
    readingDirection,
    textForDisplay,
    wordGuideFragmentIndex,
  ]);
  const activeGuideWordRect = useMemo<GuideLine | undefined>(() => {
    const target = activeWordMeasurementTarget;
    if (!target || wordMeasurement?.key !== target.key ||
      wordMeasurement.prefixWidth === undefined ||
      wordMeasurement.totalWidth === undefined) {
      return undefined;
    }
    const wordWidth = Math.max(4, wordMeasurement.totalWidth - wordMeasurement.prefixWidth);
    return {
      left: isRtl
        ? target.line.left + target.line.width - wordMeasurement.totalWidth
        : target.line.left + wordMeasurement.prefixWidth,
      top: target.line.top,
      width: wordWidth,
      height: target.line.height,
    };
  }, [activeWordMeasurementTarget, isRtl, wordMeasurement]);
  useEffect(() => {
    if (!activeWordMeasurementTarget) {
      setWordMeasurement(null);
      return;
    }
    setWordMeasurement((current) => current?.key === activeWordMeasurementTarget.key
      ? current
      : {
          key: activeWordMeasurementTarget.key,
          ...(activeWordMeasurementTarget.prefix ? {} : { prefixWidth: 0 }),
        });
  }, [activeWordMeasurementTarget]);
  const activeGuideRect = guideMode === "word"
    ? activeGuideWordRect
    : activeGuideLine;
  useEffect(() => {
    if (!guideMode) {
      setDisplayedGuideRect(undefined);
    } else if (activeGuideRect) {
      setDisplayedGuideRect(activeGuideRect);
    }
  }, [activeGuideRect, guideMode]);
  const visibleGuideRect = activeGuideRect ?? displayedGuideRect;

  const renderMeasuredGuideText = useCallback((value: string) => {
    const target = activeWordMeasurementTarget;
    if (target?.activeWordUsesOpeningStyle) {
      return <Text style={target.openingWordStyle}>{value}</Text>;
    }
    if (!target?.openingWord || !value.startsWith(target.openingWord)) return value;
    return (
      <>
        <Text style={target.openingWordStyle}>{target.openingWord}</Text>
        {value.slice(target.openingWord.length)}
      </>
    );
  }, [activeWordMeasurementTarget]);

  const moveToPage = useCallback((pageIndex: number) => {
    const target = Math.max(0, Math.min(pages.length - 1, pageIndex));
    if (target === currentPageRef.current) return;
    pagerRef.current?.scrollToIndex({ animated: true, index: target });
    currentPageRef.current = target;
    const sourcePage = pages[target]?.[0]?.sourcePage ?? 1;
    onPageChange?.(
      target + 1,
      pages.length,
      sourcePage,
      pageAnchor(pages[target], blocks),
    );
  }, [blocks, onPageChange, pages]);

  const moveGuide = useCallback((direction: -1 | 1) => {
    if (guideMode === "word") {
      const selectedFragment = activeWordMeasurementTarget?.selectedFragmentIndex ?? 0;
      const fragmentCount = activeWordMeasurementTarget?.fragmentCount ?? 1;
      if (direction > 0 && selectedFragment < fragmentCount - 1) {
        setWordGuideFragmentIndex(selectedFragment + 1);
        return;
      }
      if (direction < 0 && selectedFragment > 0) {
        setWordGuideFragmentIndex(selectedFragment - 1);
        return;
      }
      const next = Math.max(0, Math.min(guideWords.length - 1, wordGuideIndex + direction));
      if (next === wordGuideIndex) return;
      setWordGuideIndex(next);
      setWordGuideFragmentIndex(direction < 0 ? -1 : 0);
      const nextPage = guideWords[next]?.pageIndex;
      if (nextPage !== undefined) moveToPage(nextPage);
      return;
    }
    const currentLines = guideLinesByPage[currentPageRef.current] ?? [];
    const maximumLine = Math.max(0, currentLines.length - 1);
    const next = lineGuideIndex + direction;
    if (next > maximumLine) {
      setLineGuideIndex(0);
      moveToPage(currentPageRef.current + 1);
      return;
    }
    if (next < 0) {
      const previousPage = Math.max(0, currentPageRef.current - 1);
      setLineGuideIndex(Math.max(0, (guideLinesByPage[previousPage]?.length ?? 1) - 1));
      moveToPage(previousPage);
      return;
    }
    setLineGuideIndex(next);
  }, [activeWordMeasurementTarget, guideLinesByPage, guideMode, guideWords, lineGuideIndex, moveToPage, wordGuideIndex]);

  const navigationSwitchHighlight = destination?.blockId &&
    destination.switchHighlightOffset !== undefined
    ? {
        blockId: destination.blockId,
        offset: destination.switchHighlightOffset,
        nonce: destination.nonce,
      }
    : null;
  const activeSwitchHighlight = stationarySwitchHighlight &&
    (!navigationSwitchHighlight ||
      stationarySwitchHighlight.nonce >= navigationSwitchHighlight.nonce)
    ? stationarySwitchHighlight
    : navigationSwitchHighlight;

  const renderSegment = (segment: Segment, index: number, pageIndex: number) => {
    const isSearchTarget = destination?.nonce !== dismissedSearchNonce &&
      destination?.blockId === segment.blockId &&
      destination.searchQuery &&
      destination.searchMatchIndex !== undefined &&
      destination.searchMatchIndex >= segment.startOffset &&
      destination.searchMatchIndex < segment.startOffset + segment.text.length;
    const localMatch = isSearchTarget
      ? destination.searchMatchIndex! - segment.startOffset
      : -1;
    const queryLength = isSearchTarget ? destination.searchQuery!.length : 0;
    const isSwitchTarget = activeSwitchHighlight?.nonce !== dismissedSwitchNonce &&
      activeSwitchHighlight?.blockId === segment.blockId &&
      activeSwitchHighlight.offset >= segment.startOffset &&
      activeSwitchHighlight.offset < segment.startOffset + segment.text.length;
    const switchLocalOffset = isSwitchTarget
      ? activeSwitchHighlight!.offset - segment.startOffset
      : -1;
    const switchMatch = isSwitchTarget
      ? Array.from(segment.text.matchAll(/\S+/g)).find((match) =>
          (match.index ?? 0) + match[0].length > switchLocalOffset
        )
      : undefined;
    const switchStart = switchMatch?.index ?? -1;
    const switchLength = switchMatch?.[0].length ?? 0;
    const isSpokenTarget = spokenWordHighlight?.blockId === segment.blockId &&
      spokenWordHighlight.offset >= segment.startOffset &&
      spokenWordHighlight.offset < segment.startOffset + segment.text.length;
    const spokenStart = isSpokenTarget
      ? spokenWordHighlight!.offset - segment.startOffset
      : -1;
    const spokenLength = isSpokenTarget ? spokenWordHighlight!.length : 0;
    const headingScale = segment.kind === "title" ? 1.55 : segment.kind === "heading" ? 1.25 : 1;
    const openingWord = segment.sectionOpening
      ? segment.text.match(/^\S+/)?.[0] ?? ""
      : "";
    const paragraphIndent = segment.paragraphStart && !segment.sectionOpening
      ? "\u2003\u2002"
      : "";
    const typographyStyle = {
      color: textColor,
      writingDirection: readingDirection,
      textAlign: isRtl ? "right" as const : "left" as const,
      fontFamily,
      fontSize: fontSize * headingScale,
      lineHeight: fontSize * headingScale * lineHeight,
      letterSpacing,
      fontWeight: bold ? "700" as const : "400" as const,
    };
    const openingWordStyle = {
      fontSize: fontSize * headingScale * 1.24,
      fontWeight: "700" as const,
      letterSpacing: letterSpacing + 0.15,
    };
    const highlightStyle = {
      ...typographyStyle,
      backgroundColor: "rgba(250, 204, 21, 0.82)",
    };
    const renderHighlightableText = () => {
      const matches = Array.from(segment.text.matchAll(/\S+/g));
      let cursor = 0;
      return matches.flatMap((match, wordIndex) => {
        const start = match.index ?? cursor;
        const absoluteOffset = segment.startOffset + start;
        const savedHighlight = userHighlights.find((highlight) =>
          highlight.blockId === segment.blockId &&
          highlight.offset === absoluteOffset &&
          highlight.length === match[0].length
        );
        const leading = segment.text.slice(cursor, start);
        cursor = start + match[0].length;
        const word = (
          <Text
            key={`${absoluteOffset}:${match[0]}`}
            onLongPress={() => onWordHighlightRequest?.({
              blockId: segment.blockId,
              offset: absoluteOffset,
              length: match[0].length,
            })}
            style={[
              wordIndex === 0 && openingWord ? openingWordStyle : undefined,
              savedHighlight ? {
                backgroundColor: savedHighlight.color,
                borderRadius: 3,
              } : undefined,
            ]}
          >
            {textForDisplay(match[0])}
          </Text>
        );
        return [leading, word];
      }).concat(segment.text.slice(cursor));
    };

    return (
      <Text
        android_hyphenationFrequency={automaticHyphenation ? "full" : "none"}
        key={`${segment.blockId}-${segment.startOffset}-${index}`}
        onLayout={(event) => recordSegmentMeasurement(
          `${pageIndex}:${segment.blockId}:${segment.startOffset}`,
          pageIndex,
          { blockId: segment.blockId, start: segment.startOffset, length: segment.text.length, indentLength: paragraphIndent.length },
          {
            left: event.nativeEvent.layout.x,
            top: event.nativeEvent.layout.y,
          },
        )}
        onTextLayout={(event) => recordSegmentMeasurement(
          `${pageIndex}:${segment.blockId}:${segment.startOffset}`,
          pageIndex,
          { blockId: segment.blockId, start: segment.startOffset, length: segment.text.length, indentLength: paragraphIndent.length },
          undefined,
          event.nativeEvent.lines.map((line) => ({
            left: line.x,
            top: line.y,
            width: line.width,
            height: line.height,
            text: line.text,
          })),
        )}
        style={{
          ...typographyStyle,
          marginBottom: segment.spacingAfter,
          marginTop: segment.spacingBefore,
        }}
      >
        {paragraphIndent}
        {spokenStart >= 0 && openingWord ? (
          <>
            <Text style={openingWordStyle}>
              {spokenStart < openingWord.length ? (
                <Text style={[highlightStyle, openingWordStyle]}>
                  {textForDisplay(openingWord)}
                </Text>
              ) : textForDisplay(openingWord)}
            </Text>
            {spokenStart >= openingWord.length ? (
              <>
                {textForDisplay(segment.text.slice(openingWord.length, spokenStart))}
                <Text style={highlightStyle}>
                  {textForDisplay(segment.text.slice(spokenStart, spokenStart + spokenLength))}
                </Text>
                {textForDisplay(segment.text.slice(spokenStart + spokenLength))}
              </>
            ) : textForDisplay(segment.text.slice(openingWord.length))}
          </>
        ) : spokenStart >= 0 ? (
          <>
            {textForDisplay(segment.text.slice(0, spokenStart))}
            <Text style={highlightStyle}>
              {textForDisplay(segment.text.slice(spokenStart, spokenStart + spokenLength))}
            </Text>
            {textForDisplay(segment.text.slice(spokenStart + spokenLength))}
          </>
        ) : localMatch >= 0 ? (
          <>
            {textForDisplay(segment.text.slice(0, localMatch))}
            <Text style={{ backgroundColor: "#facc15" }}>
              {textForDisplay(segment.text.slice(localMatch, localMatch + queryLength))}
            </Text>
            {textForDisplay(segment.text.slice(localMatch + queryLength))}
          </>
        ) : switchStart >= 0 ? (
          <>
            {textForDisplay(segment.text.slice(0, switchStart))}
            <Text style={{ backgroundColor: "rgba(250, 204, 21, 0.68)" }}>
              {textForDisplay(segment.text.slice(switchStart, switchStart + switchLength))}
            </Text>
            {textForDisplay(segment.text.slice(switchStart + switchLength))}
          </>
        ) : renderHighlightableText()}
      </Text>
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor }}
      onLayout={(event) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        // Showing or hiding the iOS status bar changes the reported viewport
        // by a small amount. Repaginating for that chrome-only change moves
        // text even though the reader has not changed position. Preserve the
        // established page geometry; still accept larger changes such as an
        // orientation change or split-screen resize.
        const isMeaningfulResize =
          containerHeight === 0 || Math.abs(nextHeight - containerHeight) > 80;
        if (nextHeight > 0 && isMeaningfulResize) {
          setContainerHeight(nextHeight);
        }
      }}
      onTouchStart={(event) => {
        touchStart.current = {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
          time: Date.now(),
        };
      }}
      onTouchEnd={(event) => {
        const dx = event.nativeEvent.pageX - touchStart.current.x;
        const dy = event.nativeEvent.pageY - touchStart.current.y;
        if (Math.hypot(dx, dy) < 10 && Date.now() - touchStart.current.time < 350) {
          onReaderTap?.();
        }
      }}
    >
      <FlatList
        ref={pagerRef}
        style={{ flex: 1, backgroundColor }}
        data={pages}
        horizontal
        inverted={isRtl}
        pagingEnabled
        initialScrollIndex={pages.length ? destinationPage : undefined}
        bounces={false}
        overScrollMode="never"
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, pageIndex) => `reader-page-${pageIndex}`}
        getItemLayout={(_, pageIndex) => ({
          index: pageIndex,
          length: width,
          offset: width * pageIndex,
        })}
        onScrollBeginDrag={() => {
          onSwipeStart?.();
          if (activeSwitchHighlight) {
            setDismissedSwitchNonce(activeSwitchHighlight.nonce);
          }
        }}
        scrollEventThrottle={16}
        onScroll={(event) => {
          if (!pages.length || width <= 0) return;
          const position = Math.max(
            0,
            Math.min(
              pages.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / width),
            ),
          );
          if (position === currentPageRef.current) return;
          currentPageRef.current = position;
          const sourcePage = pages[position]?.[0]?.sourcePage ?? 1;
          onPageChange?.(
            position + 1,
            pages.length,
            sourcePage,
            pageAnchor(pages[position], blocks),
          );
        }}
        onMomentumScrollEnd={(event) => {
          const position = Math.max(
            0,
            Math.min(
              pages.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / width),
            ),
          );
          currentPageRef.current = position;
          if (destination?.searchQuery && position !== destinationPage) {
            setDismissedSearchNonce(destination.nonce);
          }
          const sourcePage = pages[position]?.[0]?.sourcePage ?? 1;
          onPageChange?.(
            position + 1,
            pages.length,
            sourcePage,
            pageAnchor(pages[position], blocks),
          );
        }}
        onScrollToIndexFailed={({ index }) => {
          pagerRef.current?.scrollToOffset({
            animated: false,
            offset: index * width,
          });
        }}
        renderItem={({ item: page, index: pageIndex }) => (
          <View
            style={{
              backgroundColor,
              height: "100%",
              paddingHorizontal: horizontalPadding,
              paddingTop: 20,
              paddingBottom: 12 + insets.bottom,
              width,
            }}
          >
            {page.map((segment, segmentIndex) => renderSegment(segment, segmentIndex, pageIndex))}
          </View>
        )}
      />
      {guideMode === "word" && activeWordMeasurementTarget && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: -10000, top: -10000, alignItems: "flex-start" }}
        >
          {activeWordMeasurementTarget.prefix ? (
            <Text
              numberOfLines={1}
              style={[activeWordMeasurementTarget.typography, { alignSelf: "flex-start" }]}
              onTextLayout={(event) => {
                const measured = event.nativeEvent.lines[0]?.width ?? 0;
                setWordMeasurement((current) => current?.key === activeWordMeasurementTarget.key && current.prefixWidth === measured
                  ? current
                  : { ...(current?.key === activeWordMeasurementTarget.key ? current : { key: activeWordMeasurementTarget.key }), prefixWidth: measured });
              }}
            >
              {renderMeasuredGuideText(activeWordMeasurementTarget.prefix)}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={[activeWordMeasurementTarget.typography, { alignSelf: "flex-start" }]}
            onTextLayout={(event) => {
              const measured = event.nativeEvent.lines[0]?.width ?? 0;
              setWordMeasurement((current) => current?.key === activeWordMeasurementTarget.key && current.totalWidth === measured
                ? current
                : { ...(current?.key === activeWordMeasurementTarget.key ? current : { key: activeWordMeasurementTarget.key }), totalWidth: measured });
            }}
          >
            {renderMeasuredGuideText(activeWordMeasurementTarget.prefixAndWord)}
          </Text>
        </View>
      )}
      {guideMode && visibleGuideRect && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={{ height: visibleGuideRect.top, backgroundColor, opacity: guideBackgroundDimming / 100 }} />
          <View style={{ height: visibleGuideRect.height, flexDirection: "row" }}>
            <View style={{ width: visibleGuideRect.left, backgroundColor, opacity: guideBackgroundDimming / 100 }} />
            <View style={{ width: visibleGuideRect.width, backgroundColor: "rgba(245, 158, 11, 0.28)", borderColor: "rgba(217, 119, 6, 0.55)", borderWidth: 1, borderRadius: 4 }} />
            <View style={{ flex: 1, backgroundColor, opacity: guideBackgroundDimming / 100 }} />
          </View>
          <View style={{ flex: 1, backgroundColor, opacity: guideBackgroundDimming / 100 }} />
        </View>
      )}
      {guideMode && (
        <>
          <Pressable
            accessibilityLabel="Move reading guide. Tap upper half for back, lower half for forward"
            accessibilityRole="button"
            onPress={(event) => moveGuide(event.nativeEvent.pageY < usableHeight / 2 ? -1 : 1)}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityLabel="Close reading guide"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onGuideClose}
            style={{
              position: "absolute",
              bottom: 24 + insets.bottom,
              alignSelf: "center",
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(15, 23, 42, 0.92)",
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 8,
            }}
          >
            <Text style={{ color: "white", fontSize: 32, fontWeight: "300", lineHeight: 34 }}>×</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
