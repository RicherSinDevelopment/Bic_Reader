import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Destination = {
  page: number;
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

type Props = {
  blocks: ExtractedPdfBlock[];
  destination?: Destination;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  bold: boolean;
  backgroundColor: string;
  textColor: string;
  onPageChange?: (page: number, totalPages: number, sourcePage: number) => void;
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

export default function HorizontalReaderPager({
  blocks,
  destination,
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
  bold,
  backgroundColor,
  textColor,
  onPageChange,
  onReaderTap,
  onSwipeStart,
}: Props) {
  const pagerRef = useRef<PagerView>(null);
  const currentPageRef = useRef(0);
  const navigatedDestinationNonceRef = useRef<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [visiblePage, setVisiblePage] = useState(0);
  const [dismissedSearchNonce, setDismissedSearchNonce] = useState<number | null>(null);
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight = containerHeight || windowHeight;
  const charactersPerLine = Math.max(
    12,
    Math.floor((width - 40) / Math.max(7, fontSize * 0.52 + letterSpacing))
  );
  const pageContentHeight = Math.max(
    120,
    (usableHeight - 32 - insets.bottom) * 0.94
  );
  const baseLineHeight = Math.max(16, fontSize * lineHeight);
  const pages = useMemo(
    () => buildPages(
      blocks,
      charactersPerLine,
      pageContentHeight,
      baseLineHeight,
    ),
    [baseLineHeight, blocks, charactersPerLine, pageContentHeight]
  );
  const destinationPage = useMemo(() => {
    if (!destination) return 0;
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
    setVisiblePage(destinationPage);
    const sourcePage = pages[destinationPage]?.[0]?.sourcePage ?? destination.page;
    onPageChange?.(destinationPage + 1, pages.length, sourcePage);
  }, [destination, destinationPage, onPageChange, pages]);

  useEffect(() => {
    if (
      !destination ||
      navigatedDestinationNonceRef.current === destination.nonce
    ) return;
    const timer = setTimeout(() => {
      pagerRef.current?.setPageWithoutAnimation(destinationPage);
      navigatedDestinationNonceRef.current = destination.nonce;
    }, 0);
    return () => clearTimeout(timer);
  }, [destination, destinationPage]);

  useEffect(() => {
    if (pages.length) {
      const current = Math.min(currentPageRef.current, pages.length - 1);
      currentPageRef.current = current;
      setVisiblePage(current);
      onPageChange?.(
        current + 1,
        pages.length,
        pages[current]?.[0]?.sourcePage ?? 1
      );
    }
  }, [onPageChange, pages]);

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
      <PagerView
        ref={pagerRef}
        style={{ flex: 1, backgroundColor }}
        initialPage={0}
        orientation="horizontal"
        overdrag={false}
        overScrollMode="never"
        offscreenPageLimit={1}
        onPageScrollStateChanged={(event) => {
          const state = event.nativeEvent.pageScrollState;
          if (state === "dragging") {
            onSwipeStart?.();
          }
        }}
        onPageSelected={(event) => {
          const position = event.nativeEvent.position;
          currentPageRef.current = position;
          setVisiblePage(position);
          if (destination?.searchQuery && position !== destinationPage) {
            setDismissedSearchNonce(destination.nonce);
          }
          const sourcePage = pages[position]?.[0]?.sourcePage ?? 1;
          onPageChange?.(position + 1, pages.length, sourcePage);
        }}
      >
        {pages.map((page, pageIndex) => (
          <View
            key={`reader-page-${pageIndex}`}
            collapsable={false}
            style={{
              flex: 1,
              backgroundColor,
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12 + insets.bottom,
            }}
          >
            {Math.abs(pageIndex - visiblePage) <= 2
              ? page.map(renderSegment)
              : null}
          </View>
        ))}
      </PagerView>
    </View>
  );
}
