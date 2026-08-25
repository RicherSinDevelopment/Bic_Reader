import { hyphenateText, type ExtractedPdfBlock } from "@/modules/bic-pdf-reader";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

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

type TextRange = { blockId: string; offset: number; length: number };
export type ReaderNote = TextRange & { id: string; text: string };

type Props = {
  blocks: ExtractedPdfBlock[];
  userHighlights?: Array<{
    blockId: string;
    offset: number;
    length: number;
    color: string;
  }>;
  onSelectionHighlightRequest?: (highlights: TextRange[]) => void;
  onSelectionRemoveHighlight?: (highlights: TextRange[]) => void;
  onSelectionAskAI?: (text: string) => void;
  onSelectionAddNote?: (ranges: TextRange[], selectedText: string) => void;
  onOpenNote?: (noteId: string) => void;
  userNotes?: ReaderNote[];
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
  latoBoldBase64?: string;
  sourceSansBase64?: string;
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
  onReaderReveal?: () => void;
  onReady?: () => void;
  onSwipeStart?: () => void;
};

const horizontalReaderMenuItems = [
  { key: "highlight", label: "Highlight" },
  { key: "addNote", label: "Add Note" },
  { key: "removeHighlight", label: "Remove Highlight" },
  { key: "askAI", label: "Ask AI" },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function HorizontalSelectablePage({
  page,
  userHighlights,
  spokenWordHighlight,
  searchHighlight,
  switchHighlight,
  displayText,
  readingDirection,
  fontFamily,
  latoBoldBase64,
  sourceSansBase64,
  fontSize,
  lineHeight,
  letterSpacing,
  wordSpacing,
  bold,
  automaticHyphenation,
  backgroundColor,
  textColor,
  bottomPadding,
  onHighlight,
  onRemoveHighlight,
  onAddNote,
  onOpenNote,
  onAskAI,
  userNotes,
  onReaderReveal,
  onReady,
}: {
  page: Segment[];
  userHighlights: Props["userHighlights"];
  spokenWordHighlight: Props["spokenWordHighlight"];
  searchHighlight?: TextRange;
  switchHighlight?: TextRange;
  displayText: (text: string) => string;
  readingDirection: "ltr" | "rtl";
  fontFamily: string;
  latoBoldBase64?: string;
  sourceSansBase64?: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  bold: boolean;
  automaticHyphenation: boolean;
  backgroundColor: string;
  textColor: string;
  bottomPadding: number;
  onHighlight?: (ranges: TextRange[]) => void;
  onRemoveHighlight?: (ranges: TextRange[]) => void;
  onAddNote?: (ranges: TextRange[], selectedText: string) => void;
  onOpenNote?: (noteId: string) => void;
  onAskAI?: (text: string) => void;
  userNotes: ReaderNote[];
  onReaderReveal?: () => void;
  onReady?: () => void;
}) {
  const webViewRef = useRef<WebView>(null);
  const selectionRangesRef = useRef<TextRange[]>([]);

  const markup = useMemo(() => page.map((segment) => {
    const highlights = (userHighlights ?? []).filter((highlight) =>
      highlight.blockId === segment.blockId &&
      highlight.offset < segment.startOffset + segment.text.length &&
      highlight.offset + highlight.length > segment.startOffset
    ).map((highlight) => ({
      start: Math.max(0, highlight.offset - segment.startOffset),
      end: Math.min(segment.text.length, highlight.offset + highlight.length - segment.startOffset),
      color: highlight.color,
      noteId: undefined as string | undefined,
    }));
    (userNotes ?? []).filter((note) =>
      note.blockId === segment.blockId &&
      note.offset < segment.startOffset + segment.text.length &&
      note.offset + note.length > segment.startOffset
    ).forEach((note) => highlights.push({
      start: Math.max(0, note.offset - segment.startOffset),
      end: Math.min(segment.text.length, note.offset + note.length - segment.startOffset),
      color: "transparent",
      noteId: note.id,
    }));
    [searchHighlight, switchHighlight].forEach((highlight, index) => {
      if (!highlight || highlight.blockId !== segment.blockId) return;
      const start = highlight.offset - segment.startOffset;
      if (start < 0 || start >= segment.text.length) return;
      highlights.push({
        start,
        end: Math.min(segment.text.length, start + highlight.length),
        color: index === 0 ? "#facc15" : "rgba(250, 204, 21, 0.68)",
        noteId: undefined,
      });
    });
    highlights.sort((left, right) => left.start - right.start);
    let cursor = 0;
    const contents = highlights.map((highlight) => {
      if (highlight.end <= cursor) return "";
      const start = Math.max(cursor, highlight.start);
      const before = escapeHtml(displayText(segment.text.slice(cursor, start)));
      const selected = escapeHtml(displayText(segment.text.slice(start, highlight.end)));
      cursor = highlight.end;
      if (highlight.noteId) {
        return `${before}<span class="reader-note" data-note-id="${escapeHtml(highlight.noteId)}">${selected}</span><button class="reader-note-marker" data-open-note="${escapeHtml(highlight.noteId)}" aria-label="Open note">•</button>`;
      }
      return `${before}<mark class="reader-user-highlight" style="background-color:${escapeHtml(highlight.color)}">${selected}</mark>`;
    }).join("") + escapeHtml(displayText(segment.text.slice(cursor)));
    const scale = segment.kind === "title" ? 1.55 : segment.kind === "heading" ? 1.25 : 1;
    const indent = segment.paragraphStart && !segment.sectionOpening ? "&#8195;&#8194;" : "";
    return `<div class="segment ${segment.sectionOpening ? "section-opening" : ""}" data-block-id="${escapeHtml(segment.blockId)}" data-start="${segment.startOffset}" data-prefix="${indent ? 2 : 0}" style="font-size:${fontSize * scale}px;line-height:${fontSize * scale * lineHeight}px;margin-top:${segment.spacingBefore}px;margin-bottom:${segment.spacingAfter}px">${indent}${contents}</div>`;
  }).join(""), [displayText, fontSize, lineHeight, page, searchHighlight, switchHighlight, userHighlights, userNotes]);

  const webFontFamily = fontFamily === "Lato_700Bold"
    ? "LatoReaderBold"
    : fontFamily === "SourceSans3_400Regular" ? "SourceSansReader" : fontFamily;
  const html = useMemo(() => `<!doctype html><html dir="${readingDirection}"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
    @font-face{font-family:'LatoReaderBold';src:url('data:font/ttf;base64,${latoBoldBase64 ?? ""}') format('truetype');font-weight:700;font-display:block}@font-face{font-family:'SourceSansReader';src:url('data:font/ttf;base64,${sourceSansBase64 ?? ""}') format('truetype');font-weight:400;font-display:block}
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${backgroundColor}}body{padding:20px 0 ${bottomPadding}px;color:${textColor};font-family:${JSON.stringify(webFontFamily)},sans-serif;font-weight:${bold ? 700 : 400};letter-spacing:${letterSpacing}px;word-spacing:${wordSpacing}px;-webkit-user-select:text;user-select:text;-webkit-touch-callout:default;-webkit-font-smoothing:antialiased;${automaticHyphenation ? "-webkit-hyphens:manual;hyphens:manual" : "-webkit-hyphens:none;hyphens:none"}}.segment{white-space:pre-wrap;overflow-wrap:break-word;text-align:${readingDirection === "rtl" ? "right" : "left"};direction:${readingDirection};unicode-bidi:plaintext}.reader-user-highlight,.tts-word-active{border-radius:3px;color:inherit;padding:0;box-decoration-break:clone;-webkit-box-decoration-break:clone}.reader-note{text-decoration-line:underline;text-decoration-color:#dc2626;text-decoration-thickness:2px;text-underline-offset:3px}.reader-note-marker{display:inline-flex;width:18px;height:18px;margin:0 3px;padding:0;align-items:center;justify-content:center;border:0;border-radius:9px;background:#dc2626;color:#fff;font-size:17px;line-height:14px;vertical-align:middle}::selection{background:#93c5fd;color:#1e293b}</style></head><body>${markup}<script>
    window.__selectionRanges=[];
    function cleanLength(value){return String(value||'').replace(/\\u00ad/g,'').length}
    function rawIndexForClean(value,target){let clean=0;for(let index=0;index<value.length;index++){if(value[index]!=='\\u00ad'){if(clean===target)return index;clean++}}return value.length}
    window.__setTtsHighlight=function(blockId,offset,length){
      document.querySelectorAll('.tts-word-active').forEach(function(mark){const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent||''));parent&&parent.normalize()});
      if(!blockId||!length)return;const segment=Array.from(document.querySelectorAll('[data-block-id]')).find(function(item){const start=Number(item.dataset.start||0);return item.dataset.blockId===blockId&&offset>=start&&offset<start+cleanLength(item.textContent)-Number(item.dataset.prefix||0)});if(!segment)return;
      const localStart=offset-Number(segment.dataset.start||0)+Number(segment.dataset.prefix||0);const localEnd=localStart+length;let cleanCursor=0;const walker=document.createTreeWalker(segment,NodeFilter.SHOW_TEXT);const nodes=[];let node=walker.nextNode();while(node){const nodeLength=cleanLength(node.textContent||'');nodes.push({node:node,start:cleanCursor,end:cleanCursor+nodeLength});cleanCursor+=nodeLength;node=walker.nextNode()}
      nodes.reverse().forEach(function(entry){const textNode=entry.node;const value=textNode.textContent||'';if(localEnd<=entry.start||localStart>=entry.end)return;const start=rawIndexForClean(value,Math.max(0,localStart-entry.start));const end=rawIndexForClean(value,Math.min(entry.end-entry.start,localEnd-entry.start));if(end<=start)return;const range=document.createRange();range.setStart(textNode,start);range.setEnd(textNode,end);const mark=document.createElement('mark');mark.className='tts-word-active';mark.style.backgroundColor='#fde047';range.surroundContents(mark)});
    }
    function captureSelection(){
      const selection=window.getSelection();
      if(!selection||!selection.rangeCount||selection.isCollapsed){window.__selectionRanges=[];window.ReactNativeWebView.postMessage(JSON.stringify({type:'selection',text:'',ranges:[]}));return}
      const range=selection.getRangeAt(0);const ranges=[];
      document.querySelectorAll('[data-block-id]').forEach(function(segment){
        try{if(!range.intersectsNode(segment))return;const contents=document.createRange();contents.selectNodeContents(segment);
          const startRange=document.createRange();startRange.selectNodeContents(segment);
          if(segment.contains(range.startContainer))startRange.setEnd(range.startContainer,range.startOffset);else if(range.compareBoundaryPoints(Range.START_TO_START,contents)<=0)startRange.collapse(true);else return;
          const endRange=document.createRange();endRange.selectNodeContents(segment);
          if(segment.contains(range.endContainer))endRange.setEnd(range.endContainer,range.endOffset);else if(range.compareBoundaryPoints(Range.END_TO_END,contents)>=0){}else return;
          const prefix=Number(segment.dataset.prefix||0);let start=Math.max(0,cleanLength(startRange.toString())-prefix);let end=Math.max(0,cleanLength(endRange.toString())-prefix);const sourceText=String(segment.textContent||'').replace(/\\u00ad/g,'').slice(prefix);while(start<end&&/\\s/.test(sourceText[start]||''))start++;while(end>start&&/\\s/.test(sourceText[end-1]||''))end--;
          if(end>start)ranges.push({blockId:segment.dataset.blockId,offset:Number(segment.dataset.start||0)+start,length:end-start});
        }catch(error){}
      });window.__selectionRanges=ranges;
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'selection',text:selection.toString(),ranges:ranges}));
    }
    let timer;document.addEventListener('selectionchange',function(){clearTimeout(timer);timer=setTimeout(captureSelection,80)});
    document.addEventListener('click',function(event){const marker=event.target.closest('[data-open-note]');if(marker)window.ReactNativeWebView.postMessage(JSON.stringify({type:'openNote',noteId:marker.dataset.openNote}))});
  </script></body></html>`, [automaticHyphenation, backgroundColor, bold, bottomPadding, latoBoldBase64, letterSpacing, markup, readingDirection, sourceSansBase64, textColor, webFontFamily, wordSpacing]);

  const source = useMemo(() => ({ html }), [html]);
  const ttsInjection = useMemo(
    () => `window.__setTtsHighlight?.(${JSON.stringify(spokenWordHighlight?.blockId ?? "")},${spokenWordHighlight?.offset ?? 0},${spokenWordHighlight?.length ?? 0});true;`,
    [spokenWordHighlight],
  );
  useEffect(() => {
    webViewRef.current?.injectJavaScript(ttsInjection);
  }, [ttsInjection]);
  return <WebView
    ref={webViewRef}
    source={source}
    style={[StyleSheet.absoluteFill, { backgroundColor }]}
    containerStyle={{ backgroundColor }}
    scrollEnabled={false}
    bounces={false}
    overScrollMode="never"
    showsHorizontalScrollIndicator={false}
    showsVerticalScrollIndicator={false}
    menuItems={horizontalReaderMenuItems}
    onLoadEnd={() => {
      webViewRef.current?.injectJavaScript(ttsInjection);
      onReady?.();
    }}
    onContentProcessDidTerminate={() => webViewRef.current?.reload()}
    onMessage={(event) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.type === "selection") {
          const hadSelection = selectionRangesRef.current.length > 0;
          selectionRangesRef.current = Array.isArray(message.ranges) ? message.ranges : [];
          if (hadSelection && !selectionRangesRef.current.length) onReaderReveal?.();
        } else if (message.type === "openNote" && typeof message.noteId === "string") {
          onOpenNote?.(message.noteId);
        }
      } catch {}
    }}
    onCustomMenuSelection={(event) => {
      if (event.nativeEvent.key === "highlight") {
        if (selectionRangesRef.current.length) onHighlight?.(selectionRangesRef.current);
      } else if (event.nativeEvent.key === "removeHighlight") {
        if (selectionRangesRef.current.length) onRemoveHighlight?.(selectionRangesRef.current);
      } else if (event.nativeEvent.key === "addNote") {
        if (selectionRangesRef.current.length) {
          onAddNote?.(selectionRangesRef.current, event.nativeEvent.selectedText?.trim() ?? "");
        }
      } else if (event.nativeEvent.key === "askAI") {
        onAskAI?.(event.nativeEvent.selectedText?.trim() ?? "");
      }
    }}
  />;
}

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
  onSelectionHighlightRequest,
  onSelectionRemoveHighlight,
  onSelectionAskAI,
  onSelectionAddNote,
  onOpenNote,
  userNotes = [],
  readingDirection = "ltr",
  spokenWordHighlight,
  guideMode = null,
  guideBackgroundDimming = 60,
  onGuideClose,
  destination,
  stationarySwitchHighlight,
  fontFamily,
  latoBoldBase64,
  sourceSansBase64,
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
  onReaderReveal,
  onReady,
  onSwipeStart,
}: Props) {
  const isRtl = readingDirection === "rtl";
  const pagerRef = useRef<FlatList<Segment[]>>(null);
  const currentPageRef = useRef(0);
  const readyReportedRef = useRef(false);
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
  const reportReady = useCallback(() => {
    if (readyReportedRef.current) return;
    readyReportedRef.current = true;
    onReady?.();
  }, [onReady]);
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
    const openingWord = "";
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
  const selectableSearchHighlight = destination &&
    destination.nonce !== dismissedSearchNonce &&
    destination.blockId && destination.searchQuery && destination.searchMatchIndex !== undefined
    ? {
        blockId: destination.blockId,
        offset: destination.searchMatchIndex,
        length: destination.searchQuery.length,
      }
    : undefined;
  const selectableSwitchHighlight = useMemo(() => {
    if (!activeSwitchHighlight || activeSwitchHighlight.nonce === dismissedSwitchNonce) return undefined;
    const block = blocks.find((candidate) => candidate.id === activeSwitchHighlight.blockId);
    if (!block) return undefined;
    const match = Array.from(block.text.matchAll(/\S+/g)).find((candidate) =>
      (candidate.index ?? 0) + candidate[0].length > activeSwitchHighlight.offset
    );
    return match ? {
      blockId: activeSwitchHighlight.blockId,
      offset: match.index ?? activeSwitchHighlight.offset,
      length: match[0].length,
    } : undefined;
  }, [activeSwitchHighlight, blocks, dismissedSwitchNonce]);
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
    const openingWord = "";
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
      const displayedText = textForDisplay(segment.text);
      const displayIndexForSourceOffset = (sourceOffset: number) => {
        let sourceCursor = 0;
        let displayCursor = 0;
        while (displayCursor < displayedText.length && sourceCursor < sourceOffset) {
          if (displayedText[displayCursor] !== "\u00ad") sourceCursor += 1;
          displayCursor += 1;
        }
        return displayCursor;
      };
      const highlights = userHighlights
        .filter((highlight) =>
          highlight.blockId === segment.blockId &&
          highlight.offset < segment.startOffset + segment.text.length &&
          highlight.offset + highlight.length > segment.startOffset
        )
        .map((highlight) => ({
          start: Math.max(0, highlight.offset - segment.startOffset),
          end: Math.min(
            segment.text.length,
            highlight.offset + highlight.length - segment.startOffset,
          ),
          color: highlight.color,
        }))
        .sort((left, right) => left.start - right.start);
      if (!highlights.length) return displayedText;

      const rendered: React.ReactNode[] = [];
      let sourceCursor = 0;
      highlights.forEach((highlight, highlightIndex) => {
        if (highlight.end <= sourceCursor) return;
        const start = Math.max(sourceCursor, highlight.start);
        const displayStart = displayIndexForSourceOffset(start);
        const displayEnd = displayIndexForSourceOffset(highlight.end);
        const previousDisplayEnd = displayIndexForSourceOffset(sourceCursor);
        if (displayStart > previousDisplayEnd) {
          rendered.push(displayedText.slice(previousDisplayEnd, displayStart));
        }
        rendered.push(
          <Text
            key={`${segment.blockId}:${segment.startOffset}:${highlightIndex}:${start}`}
            style={{ backgroundColor: highlight.color }}
          >
            {displayedText.slice(displayStart, displayEnd)}
          </Text>,
        );
        sourceCursor = highlight.end;
      });
      const finalDisplayOffset = displayIndexForSourceOffset(sourceCursor);
      if (finalDisplayOffset < displayedText.length) {
        rendered.push(displayedText.slice(finalDisplayOffset));
      }
      return rendered;
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
      onTouchStartCapture={(event) => {
        touchStart.current = {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
          time: Date.now(),
        };
      }}
      onTouchEndCapture={(event) => {
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
        windowSize={3}
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
            <View pointerEvents="none" style={{ opacity: 0 }}>
              {page.map((segment, segmentIndex) => renderSegment(segment, segmentIndex, pageIndex))}
            </View>
            <View style={{ position: "absolute", left: horizontalPadding, right: horizontalPadding, top: 0, bottom: 0 }}>
              <HorizontalSelectablePage
                page={page}
                userHighlights={userHighlights}
                userNotes={userNotes}
                spokenWordHighlight={spokenWordHighlight}
                searchHighlight={selectableSearchHighlight}
                switchHighlight={selectableSwitchHighlight}
                displayText={textForDisplay}
                readingDirection={readingDirection}
                fontFamily={fontFamily}
                latoBoldBase64={latoBoldBase64}
                sourceSansBase64={sourceSansBase64}
                fontSize={fontSize}
                lineHeight={lineHeight}
                letterSpacing={letterSpacing}
                wordSpacing={wordSpacing}
                bold={bold}
                automaticHyphenation={automaticHyphenation}
                backgroundColor={backgroundColor}
                textColor={textColor}
                bottomPadding={12 + insets.bottom}
                onHighlight={onSelectionHighlightRequest}
                onRemoveHighlight={onSelectionRemoveHighlight}
                onAddNote={onSelectionAddNote}
                onOpenNote={onOpenNote}
                onAskAI={onSelectionAskAI}
                onReaderReveal={onReaderReveal}
                onReady={reportReady}
              />
            </View>
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
