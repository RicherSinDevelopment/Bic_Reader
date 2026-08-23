import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Text, useWindowDimensions, View } from "react-native";
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
};

type PageAnchor = {
  blockId: string;
  blockOffset: number;
  wordIndex: number;
};

type Props = {
  blocks: ExtractedPdfBlock[];
  destination?: Destination;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  bold: boolean;
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
) {
  const pages: Segment[][] = [[]];
  let usedHeight = 0;

  blocks.forEach((block) => {
    let sourceOffset = 0;
    const textScale = block.kind === "title" ? 1.65 : block.kind === "heading" ? 1.3 : 1;
    const spacing = block.kind === "title" || block.kind === "heading" ? 16 : 12;
    const scaledLineHeight = baseLineHeight * textScale;
    const scaledCharactersPerLine = Math.max(8, Math.floor(charactersPerLine / textScale));

    while (sourceOffset < block.text.length) {
      let remainingHeight = pageHeight - usedHeight - spacing;
      let availableLines = Math.floor(remainingHeight / scaledLineHeight);
      if (availableLines < 1 && usedHeight > 0) {
        pages.push([]);
        usedHeight = 0;
        remainingHeight = pageHeight - spacing;
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
        pages[pages.length - 1].push({
          blockId: block.id,
          sourcePage: block.page,
          text,
          startOffset: sourceOffset,
          kind: block.kind,
        });
        const wrappedLines = Math.max(
          1,
          Math.ceil(text.length / scaledCharactersPerLine)
        );
        usedHeight += wrappedLines * scaledLineHeight + spacing;
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
  destination,
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
  wordSpacing,
  bold,
  backgroundColor,
  textColor,
  onPageChange,
  onPageMapChange,
  onReaderTap,
  onSwipeStart,
}: Props) {
  const pagerRef = useRef<FlatList<Segment[]>>(null);
  const currentPageRef = useRef(0);
  const navigatedDestinationNonceRef = useRef<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [dismissedSearchNonce, setDismissedSearchNonce] = useState<number | null>(null);
  const [dismissedSwitchNonce, setDismissedSwitchNonce] = useState<number | null>(null);
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight = containerHeight || windowHeight;
  // Painting the new type settings is urgent; rebuilding every page in a long
  // book is not. Deferred layout metrics keep the controls responsive while
  // React repaginates in the background.
  const deferredFontSize = useDeferredValue(fontSize);
  const deferredLineHeight = useDeferredValue(lineHeight);
  const deferredLetterSpacing = useDeferredValue(letterSpacing);
  const deferredWordSpacing = useDeferredValue(wordSpacing);
  const charactersPerLine = Math.max(
    12,
    Math.floor(
      (width - 40) /
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
    ),
    [baseLineHeight, blocks, charactersPerLine, pageContentHeight]
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
        destination.searchMatchIndex <= segment.startOffset + segment.text.length
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
    if (
      !destination ||
      navigatedDestinationNonceRef.current === destination.nonce
    ) return;
    const timer = setTimeout(() => {
      pagerRef.current?.scrollToIndex({
        animated: false,
        index: destinationPage,
      });
      navigatedDestinationNonceRef.current = destination.nonce;
    }, 0);
    return () => clearTimeout(timer);
  }, [destination, destinationPage]);

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
    const isSwitchTarget = destination?.nonce !== dismissedSwitchNonce &&
      destination?.blockId === segment.blockId &&
      destination.switchHighlightOffset !== undefined &&
      destination.switchHighlightOffset >= segment.startOffset &&
      destination.switchHighlightOffset < segment.startOffset + segment.text.length;
    const switchLocalOffset = isSwitchTarget
      ? destination.switchHighlightOffset! - segment.startOffset
      : -1;
    const switchMatch = isSwitchTarget
      ? Array.from(segment.text.matchAll(/\S+/g)).find((match) =>
          (match.index ?? 0) + match[0].length > switchLocalOffset
        )
      : undefined;
    const switchStart = switchMatch?.index ?? -1;
    const switchLength = switchMatch?.[0].length ?? 0;
    const headingScale = segment.kind === "title" ? 1.55 : segment.kind === "heading" ? 1.25 : 1;

    return (
      <Text
        key={`${segment.blockId}-${segment.startOffset}-${index}`}
        style={{
          color: textColor,
          fontFamily,
          fontSize: fontSize * headingScale,
          lineHeight: fontSize * headingScale * lineHeight,
          letterSpacing,
          fontWeight: bold ? "700" : "400",
          marginBottom: segment.kind === "heading" || segment.kind === "title" ? 16 : 12,
        }}
      >
        {localMatch >= 0 ? (
          <>
            {segment.text.slice(0, localMatch)}
            <Text style={{ backgroundColor: "#facc15" }}>
              {segment.text.slice(localMatch, localMatch + queryLength)}
            </Text>
            {segment.text.slice(localMatch + queryLength)}
          </>
        ) : switchStart >= 0 ? (
          <>
            {segment.text.slice(0, switchStart)}
            <Text style={{ backgroundColor: "rgba(250, 204, 21, 0.68)" }}>
              {segment.text.slice(switchStart, switchStart + switchLength)}
            </Text>
            {segment.text.slice(switchStart + switchLength)}
          </>
        ) : segment.text}
      </Text>
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor }}
      onLayout={(event) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== containerHeight) {
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
          if (destination?.switchHighlightOffset !== undefined) {
            setDismissedSwitchNonce(destination.nonce);
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
              paddingHorizontal: 20,
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
