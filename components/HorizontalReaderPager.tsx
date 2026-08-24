import { hyphenateText, type ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Text, useWindowDimensions, View } from "react-native";
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

type Props = {
  blocks: ExtractedPdfBlock[];
  readingDirection?: "ltr" | "rtl";
  spokenWordHighlight?: {
    blockId: string;
    offset: number;
    length: number;
  } | null;
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
  readingDirection = "ltr",
  spokenWordHighlight,
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

  const renderSegment = (segment: Segment, index: number) => {
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

    return (
      <Text
        android_hyphenationFrequency={automaticHyphenation ? "full" : "none"}
        key={`${segment.blockId}-${segment.startOffset}-${index}`}
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
        ) : openingWord ? (
          <>
            <Text
              style={openingWordStyle}
            >
              {textForDisplay(openingWord)}
            </Text>
            {textForDisplay(segment.text.slice(openingWord.length))}
          </>
        ) : textForDisplay(segment.text)}
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
        renderItem={({ item: page }) => (
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
            {page.map(renderSegment)}
          </View>
        )}
      />
    </View>
  );
}
