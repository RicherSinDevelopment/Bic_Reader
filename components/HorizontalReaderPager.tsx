import {
  hyphenateText,
  type ExtractedPdfBlock,
} from "@/modules/bic-pdf-reader";
import {
  captureHorizontalFlipAnchor,
  horizontalPageForFlipAnchor,
  HORIZONTAL_FLIP_SETTLE_MS,
} from "@/architecture/HorizontalSwipFlip";
import {
  findTargetForMenuKey,
  type FindWordTarget,
} from "@/architecture/FindWordInOtherTab";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type Destination = {
  page: number;
  readerPage?: number;
  switchHighlightOffset?: number;
  switchHighlightWordIndex?: number;
  switchHighlightWordProgress?: number;
  switchHighlightQuery?: string;
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
  runningTitle: string;
};

export type PageAnchor = {
  blockId: string;
  blockOffset: number;
  wordIndex: number;
};

type GuideLine = {
  left: number;
  top: number;
  width: number;
  height: number;
  text?: string;
};

type TextRange = { blockId: string; offset: number; length: number };
export type ReaderNote = TextRange & { id: string; text: string };
type MarginPreset = "compact" | "comfortable" | "relaxed";

type Props = {
  blocks: ExtractedPdfBlock[];
  isActive?: boolean;
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
  findWordItems?: Array<{ key: string; label: string }>;
  onFindWord?: (
    target: FindWordTarget,
    range: TextRange,
    selectedText: string,
  ) => void;
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
  guideColor?: string;
  switchHighlightColor?: string;
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
  verticalMarginPreset: MarginPreset;
  horizontalMarginPreset: MarginPreset;
  backgroundColor: string;
  textColor: string;
  onPageChange?: (
    page: number,
    totalPages: number,
    sourcePage: number,
    anchor?: PageAnchor,
  ) => void;
  onPageMapChange?: (pageMap: Record<number, number>) => void;
  onExplicitPageResolved?: (sourcePage: number, anchor: PageAnchor) => void;
  onReaderTap?: () => void;
  onReaderReveal?: () => void;
  onReady?: () => void;
  onSwipeStart?: () => void;
  onViewportSettled?: () => void;
};

const baseHorizontalReaderMenuItems = [
  { key: "highlight", label: "Highlight" },
  { key: "addNote", label: "Add Note" },
  { key: "removeHighlight", label: "Remove Highlight" },
  { key: "askAI", label: "Ask AI" },
];
const baseHorizontalReaderMenuItemsWithoutRemove =
  baseHorizontalReaderMenuItems.filter(
    (item) => item.key !== "removeHighlight",
  );

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
  switchHighlightColor,
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
  findWordItems,
  onFindWord,
  userNotes,
  onReaderReveal,
  onReady,
  onSwitchHighlightReady,
  topContentInset,
  onGuideLines,
  guideWord,
  onGuideWordRects,
  guideActive,
  readerPageNumber,
  pageTopMargin,
  pageBottomMargin,
}: {
  page: Segment[];
  userHighlights: Props["userHighlights"];
  spokenWordHighlight: Props["spokenWordHighlight"];
  searchHighlight?: TextRange;
  switchHighlight?: TextRange & { nonce: number };
  switchHighlightColor: string;
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
  findWordItems: Array<{ key: string; label: string }>;
  onFindWord?: (
    target: FindWordTarget,
    range: TextRange,
    selectedText: string,
  ) => void;
  userNotes: ReaderNote[];
  onReaderReveal?: () => void;
  onReady?: () => void;
  onSwitchHighlightReady?: () => void;
  topContentInset: number;
  onGuideLines?: (lines: GuideLine[]) => void;
  guideWord?: TextRange;
  onGuideWordRects?: (rects: GuideLine[], target?: TextRange) => void;
  guideActive: boolean;
  readerPageNumber: number;
  pageTopMargin: number;
  pageBottomMargin: number;
}) {
  const webViewRef = useRef<WebView>(null);
  const runningHeader =
    page.find((segment) => segment.runningTitle)?.runningTitle ?? "";
  const pageNumber = String(readerPageNumber);
  const selectionRangesRef = useRef<TextRange[]>([]);
  const [selectionHasHighlight, setSelectionHasHighlight] = useState(false);
  const horizontalReaderMenuItems = [
    ...baseHorizontalReaderMenuItems,
    ...findWordItems,
  ];
  const horizontalReaderMenuItemsWithoutRemove = [
    ...baseHorizontalReaderMenuItemsWithoutRemove,
    ...findWordItems,
  ];

  const markup = useMemo(
    () =>
      page
        .map((segment) => {
          const highlights = (userHighlights ?? [])
            .filter(
              (highlight) =>
                highlight.blockId === segment.blockId &&
                highlight.offset < segment.startOffset + segment.text.length &&
                highlight.offset + highlight.length > segment.startOffset,
            )
            .map((highlight) => ({
              start: Math.max(0, highlight.offset - segment.startOffset),
              end: Math.min(
                segment.text.length,
                highlight.offset + highlight.length - segment.startOffset,
              ),
              color: highlight.color,
              className: "reader-user-highlight",
              noteId: undefined as string | undefined,
            }));
          (userNotes ?? [])
            .filter(
              (note) =>
                note.blockId === segment.blockId &&
                note.offset < segment.startOffset + segment.text.length &&
                note.offset + note.length > segment.startOffset,
            )
            .forEach((note) =>
              highlights.push({
                start: Math.max(0, note.offset - segment.startOffset),
                end: Math.min(
                  segment.text.length,
                  note.offset + note.length - segment.startOffset,
                ),
                color: "transparent",
                className: "reader-note",
                noteId: note.id,
              }),
            );
          if (searchHighlight?.blockId === segment.blockId) {
            const start = searchHighlight.offset - segment.startOffset;
            if (start >= 0 && start < segment.text.length) {
              highlights.push({
                start,
                end: Math.min(
                  segment.text.length,
                  start + searchHighlight.length,
                ),
                color: "#facc15",
                className: "reader-search-highlight",
                noteId: undefined,
              });
            }
          }
          highlights.sort((left, right) => left.start - right.start);
          let cursor = 0;
          const contents =
            highlights
              .map((highlight) => {
                if (highlight.end <= cursor) return "";
                const start = Math.max(cursor, highlight.start);
                const before = escapeHtml(
                  displayText(segment.text.slice(cursor, start)),
                );
                const selected = escapeHtml(
                  displayText(segment.text.slice(start, highlight.end)),
                );
                cursor = highlight.end;
                if (highlight.noteId) {
                  return `${before}<span class="reader-note" data-note-id="${escapeHtml(highlight.noteId)}">${selected}</span><button class="reader-note-marker" data-open-note="${escapeHtml(highlight.noteId)}" aria-label="Open note">•</button>`;
                }
                return `${before}<mark class="${highlight.className}" style="background-color:${escapeHtml(highlight.color)}">${selected}</mark>`;
              })
              .join("") + escapeHtml(displayText(segment.text.slice(cursor)));
          const scale =
            segment.kind === "title"
              ? 1.55
              : segment.kind === "heading"
                ? 1.25
                : 1;
          const paragraphClass = segment.paragraphStart
            ? " paragraph-start"
            : "";
          return `<div class="segment${paragraphClass} ${segment.sectionOpening ? "section-opening" : ""}" data-block-id="${escapeHtml(segment.blockId)}" data-start="${segment.startOffset}" data-prefix="0" style="font-size:${fontSize * scale}px;line-height:${fontSize * scale * lineHeight}px;margin-top:${segment.spacingBefore}px;margin-bottom:${segment.spacingAfter}px">${contents}</div>`;
        })
        .join(""),
    [
      displayText,
      fontSize,
      lineHeight,
      page,
      searchHighlight,
      userHighlights,
      userNotes,
    ],
  );

  const webFontFamily =
    fontFamily === "Lato_700Bold"
      ? "LatoReaderBold"
      : fontFamily === "SourceSans3_400Regular"
        ? "SourceSansReader"
        : fontFamily;
  const fontFaceCss =
    webFontFamily === "LatoReaderBold" && latoBoldBase64
      ? `@font-face{font-family:'LatoReaderBold';src:url('data:font/ttf;base64,${latoBoldBase64}') format('truetype');font-weight:700;font-display:block}`
      : webFontFamily === "SourceSansReader" && sourceSansBase64
        ? `@font-face{font-family:'SourceSansReader';src:url('data:font/ttf;base64,${sourceSansBase64}') format('truetype');font-weight:400;font-display:block}`
        : "";
  const html = useMemo(
    () => `<!doctype html><html dir="${readingDirection}"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
    ${fontFaceCss}
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${backgroundColor}}body{padding:${topContentInset}px 0 ${bottomPadding}px;color:${textColor};font-family:${webFontFamily},sans-serif;font-weight:${bold ? 700 : 400};letter-spacing:${letterSpacing}px;word-spacing:${wordSpacing}px;-webkit-user-select:text;user-select:text;-webkit-touch-callout:default;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;${automaticHyphenation ? "-webkit-hyphens:manual;hyphens:manual" : "-webkit-hyphens:none;hyphens:none"}}.page-running-header,.page-number{position:fixed;z-index:2;left:0;right:0;color:${textColor};opacity:.48;text-align:center;pointer-events:none}.page-running-header{top:${pageTopMargin}px;padding:0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:${Math.max(11, fontSize * 0.58)}px;font-weight:600;letter-spacing:.025em}.page-number{bottom:${pageBottomMargin}px;font-size:${Math.max(11, fontSize * 0.62)}px;font-variant-numeric:tabular-nums}.segment{white-space:pre-wrap;overflow-wrap:break-word;text-align:${readingDirection === "rtl" ? "right" : "left"};direction:${readingDirection};unicode-bidi:plaintext}.segment.paragraph-start{text-indent:1.35em}.reader-user-highlight,.reader-search-highlight,.reader-switch-highlight,.tts-word-active{border-radius:3px;color:inherit;padding:0;box-decoration-break:clone;-webkit-box-decoration-break:clone}.reader-switch-highlight{animation:readerSwitchPulse 1.2s ease-out .4s forwards}@keyframes readerSwitchPulse{0%{background-color:color-mix(in srgb,${switchHighlightColor} 56%,transparent);box-shadow:0 0 0 0 color-mix(in srgb,${switchHighlightColor} 30%,transparent)}32%{background-color:color-mix(in srgb,${switchHighlightColor} 92%,transparent);box-shadow:0 0 0 4px color-mix(in srgb,${switchHighlightColor} 20%,transparent)}62%{background-color:color-mix(in srgb,${switchHighlightColor} 66%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,${switchHighlightColor} 12%,transparent)}100%{background-color:transparent;box-shadow:0 0 0 0 transparent}}@keyframes readerSwitchFade{from{background-color:color-mix(in srgb,${switchHighlightColor} 66%,transparent)}to{background-color:transparent}}@media(prefers-reduced-motion:reduce){.reader-switch-highlight{animation:readerSwitchFade .8s ease-out .4s forwards}}.reader-note{text-decoration-line:underline;text-decoration-color:#dc2626;text-decoration-thickness:2px;text-underline-offset:3px}.reader-note-marker{display:inline-flex;width:18px;height:18px;margin:0 3px;padding:0;align-items:center;justify-content:center;border:0;border-radius:9px;background:#dc2626;color:#fff;font-size:17px;line-height:14px;vertical-align:middle}::selection{background:#93c5fd;color:#1e293b}</style></head><body><div class="page-running-header">${escapeHtml(runningHeader)}</div>${markup}<div class="page-number">${pageNumber}</div><script>
    window.__selectionRanges=[];
    function cleanLength(value){return String(value||'').replace(/\\u00ad/g,'').length}
    function rawIndexForClean(value,target){let clean=0;for(let index=0;index<value.length;index++){if(value[index]!=='\\u00ad'){if(clean===target)return index;clean++}}return value.length}
    window.__setTtsHighlight=function(blockId,offset,length){
      document.querySelectorAll('.tts-word-active').forEach(function(mark){const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent||''));parent&&parent.normalize()});
      if(!blockId||!length)return;const segment=Array.from(document.querySelectorAll('[data-block-id]')).find(function(item){const start=Number(item.dataset.start||0);return item.dataset.blockId===blockId&&offset>=start&&offset<start+cleanLength(item.textContent)-Number(item.dataset.prefix||0)});if(!segment)return;
      const localStart=offset-Number(segment.dataset.start||0)+Number(segment.dataset.prefix||0);const localEnd=localStart+length;let cleanCursor=0;const walker=document.createTreeWalker(segment,NodeFilter.SHOW_TEXT);const nodes=[];let node=walker.nextNode();while(node){const nodeLength=cleanLength(node.textContent||'');nodes.push({node:node,start:cleanCursor,end:cleanCursor+nodeLength});cleanCursor+=nodeLength;node=walker.nextNode()}
      nodes.reverse().forEach(function(entry){const textNode=entry.node;const value=textNode.textContent||'';if(localEnd<=entry.start||localStart>=entry.end)return;const start=rawIndexForClean(value,Math.max(0,localStart-entry.start));const end=rawIndexForClean(value,Math.min(entry.end-entry.start,localEnd-entry.start));if(end<=start)return;const range=document.createRange();range.setStart(textNode,start);range.setEnd(textNode,end);const mark=document.createElement('mark');mark.className='tts-word-active';mark.style.backgroundColor='#fde047';range.surroundContents(mark)});
    }
    window.__setSwitchHighlight=function(target){
      document.querySelectorAll('.reader-switch-highlight').forEach(function(mark){const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent||''));parent&&parent.normalize()});
      if(!target||!target.blockId||!target.length)return;
      const segment=Array.from(document.querySelectorAll('[data-block-id]')).find(function(item){const start=Number(item.dataset.start||0);return item.dataset.blockId===target.blockId&&target.offset>=start&&target.offset<start+cleanLength(item.textContent)-Number(item.dataset.prefix||0)});
      if(!segment)return;
      const localStart=target.offset-Number(segment.dataset.start||0)+Number(segment.dataset.prefix||0);const localEnd=localStart+target.length;let cleanCursor=0;const walker=document.createTreeWalker(segment,NodeFilter.SHOW_TEXT);const nodes=[];let node=walker.nextNode();while(node){const nodeLength=cleanLength(node.textContent||'');nodes.push({node:node,start:cleanCursor,end:cleanCursor+nodeLength});cleanCursor+=nodeLength;node=walker.nextNode()}
      let painted=false;nodes.reverse().forEach(function(entry){const textNode=entry.node;const value=textNode.textContent||'';if(localEnd<=entry.start||localStart>=entry.end)return;const start=rawIndexForClean(value,Math.max(0,localStart-entry.start));const end=rawIndexForClean(value,Math.min(entry.end-entry.start,localEnd-entry.start));if(end<=start)return;const range=document.createRange();range.setStart(textNode,start);range.setEnd(textNode,end);const mark=document.createElement('mark');mark.className='reader-switch-highlight';range.surroundContents(mark);painted=true});
      if(painted)requestAnimationFrame(function(){requestAnimationFrame(function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'switchHighlightReady',nonce:target.nonce}))})});
    }
    function captureSelection(){
      const selection=window.getSelection();
      if(!selection||!selection.rangeCount||selection.isCollapsed){window.__selectionRanges=[];window.ReactNativeWebView.postMessage(JSON.stringify({type:'selection',text:'',ranges:[],hasHighlight:false}));return}
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
      const hasHighlight=Array.from(document.querySelectorAll('.reader-user-highlight')).some(function(mark){try{return range.intersectsNode(mark)}catch(error){return false}});
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'selection',text:selection.toString(),ranges:ranges,hasHighlight:hasHighlight}));
    }
    let timer;document.addEventListener('selectionchange',function(){clearTimeout(timer);timer=setTimeout(captureSelection,80)});
    document.addEventListener('click',function(event){const marker=event.target.closest('[data-open-note]');if(marker)window.ReactNativeWebView.postMessage(JSON.stringify({type:'openNote',noteId:marker.dataset.openNote}))});
  </script></body></html>`,
    [
      automaticHyphenation,
      backgroundColor,
      bold,
      bottomPadding,
      fontFaceCss,
      fontSize,
      letterSpacing,
      markup,
      pageBottomMargin,
      pageNumber,
      pageTopMargin,
      readingDirection,
      runningHeader,
      switchHighlightColor,
      textColor,
      topContentInset,
      webFontFamily,
      wordSpacing,
    ],
  );

  const source = useMemo(() => ({ html }), [html]);
  const ttsInjection = useMemo(
    () =>
      `window.__setTtsHighlight?.(${JSON.stringify(spokenWordHighlight?.blockId ?? "")},${spokenWordHighlight?.offset ?? 0},${spokenWordHighlight?.length ?? 0});true;`,
    [spokenWordHighlight],
  );
  useEffect(() => {
    webViewRef.current?.injectJavaScript(ttsInjection);
  }, [ttsInjection]);
  const switchHighlightInjection = useMemo(
    () =>
      `window.__setSwitchHighlight?.(${JSON.stringify(switchHighlight ?? null)});true;`,
    [switchHighlight],
  );
  useEffect(() => {
    webViewRef.current?.injectJavaScript(switchHighlightInjection);
  }, [switchHighlightInjection]);
  const guideWordInjection = useMemo(
    () =>
      `window.__reportGuideWord?.(${JSON.stringify(guideWord ?? null)});true;`,
    [guideWord],
  );
  useEffect(() => {
    webViewRef.current?.injectJavaScript(guideWordInjection);
  }, [guideWordInjection]);
  useEffect(() => {
    if (!guideActive) return;
    webViewRef.current?.injectJavaScript(
      "window.__reportGuideGeometry?.();true;",
    );
  }, [guideActive]);
  return (
    <WebView
      ref={webViewRef}
      source={source}
      style={[StyleSheet.absoluteFill, { backgroundColor }]}
      containerStyle={{ backgroundColor }}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      menuItems={
        selectionHasHighlight
          ? horizontalReaderMenuItems
          : horizontalReaderMenuItemsWithoutRemove
      }
      onLoadEnd={() => {
        webViewRef.current?.injectJavaScript(ttsInjection);
        webViewRef.current?.injectJavaScript(switchHighlightInjection);
        webViewRef.current?.injectJavaScript(`
        window.__reportGuideGeometry = function() {
          setTimeout(function() {
          const rects = [];
          document.querySelectorAll('.segment').forEach(function(segment) {
            const range = document.createRange();
            range.selectNodeContents(segment);
            Array.from(range.getClientRects()).forEach(function(rect) {
              if (rect.width > 0 && rect.height > 0) {
                rects.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
              }
            });
          });
          const uniqueRects = rects.filter(function(rect, index) {
            return !rects.slice(0, index).some(function(previous) {
              return Math.abs(previous.left - rect.left) < 0.5 && Math.abs(previous.top - rect.top) < 0.5 && Math.abs(previous.width - rect.width) < 0.5;
            });
          }).sort(function(a, b) {
            const vertical = a.top - b.top;
            if (Math.abs(vertical) > 1) return vertical;
            return document.documentElement.dir === 'rtl'
              ? (b.left + b.width) - (a.left + a.width)
              : a.left - b.left;
          });
          const lines = [];
          uniqueRects.forEach(function(rect) {
            const line = lines.find(function(candidate) {
              return Math.abs(candidate.top - rect.top) < 1.5;
            });
            if (!line) {
              lines.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
              return;
            }
            const right = Math.max(line.left + line.width, rect.left + rect.width);
            line.left = Math.min(line.left, rect.left);
            line.width = right - line.left;
            line.height = Math.max(line.height, rect.height);
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'guideLines', lines: lines }));
          window.__reportGuideWord = function(target) {
            if (!target || !target.blockId || !target.length) return;
            const segment = Array.from(document.querySelectorAll('[data-block-id]')).find(function(item) {
              const start = Number(item.dataset.start || 0);
              const prefix = Number(item.dataset.prefix || 0);
              return item.dataset.blockId === target.blockId && target.offset >= start && target.offset < start + cleanLength(item.textContent) - prefix;
            });
            if (!segment) return;
            const prefix = Number(segment.dataset.prefix || 0);
            const localStart = target.offset - Number(segment.dataset.start || 0) + prefix;
            const localEnd = localStart + target.length;
            const nodes = [];
            let cursor = 0;
            const walker = document.createTreeWalker(segment, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
              const length = cleanLength(node.textContent || '');
              nodes.push({ node: node, start: cursor, end: cursor + length });
              cursor += length;
              node = walker.nextNode();
            }
            const pointFor = function(offset, isEnd) {
              const entry = nodes.find(function(item) { return offset >= item.start && (offset < item.end || (isEnd && offset === item.end)); }) || nodes[nodes.length - 1];
              if (!entry) return null;
              return { node: entry.node, offset: rawIndexForClean(entry.node.textContent || '', Math.max(0, Math.min(entry.end - entry.start, offset - entry.start))) };
            };
            const startPoint = pointFor(localStart, false);
            const endPoint = pointFor(localEnd, true);
            if (!startPoint || !endPoint) return;
            const range = document.createRange();
            range.setStart(startPoint.node, startPoint.offset);
            range.setEnd(endPoint.node, endPoint.offset);
            const wordRects = Array.from(range.getClientRects()).filter(function(rect) { return rect.width > 0 && rect.height > 0; }).map(function(rect) {
              return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            }).sort(function(first, second) {
              const vertical = first.top - second.top;
              if (Math.abs(vertical) > 1) return vertical;
              return document.documentElement.dir === 'rtl'
                ? (second.left + second.width) - (first.left + first.width)
                : first.left - second.left;
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'guideWordRects', target: target, rects: wordRects }));
          };
          window.__reportGuideWord(${JSON.stringify(guideWord ?? null)});
          }, 80);
        };
        if (${guideActive ? "true" : "false"}) window.__reportGuideGeometry();
        true;
      `);
        onReady?.();
      }}
      onContentProcessDidTerminate={() => webViewRef.current?.reload()}
      onMessage={(event) => {
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === "selection") {
            const hadSelection = selectionRangesRef.current.length > 0;
            selectionRangesRef.current = Array.isArray(message.ranges)
              ? message.ranges
              : [];
            setSelectionHasHighlight(Boolean(message.hasHighlight));
            if (hadSelection && !selectionRangesRef.current.length)
              onReaderReveal?.();
          } else if (
            message.type === "openNote" &&
            typeof message.noteId === "string"
          ) {
            onOpenNote?.(message.noteId);
          } else if (
            message.type === "switchHighlightReady" &&
            message.nonce === switchHighlight?.nonce
          ) {
            onSwitchHighlightReady?.();
          } else if (
            message.type === "guideLines" &&
            Array.isArray(message.lines)
          ) {
            onGuideLines?.(
              message.lines.filter(
                (line: unknown): line is GuideLine =>
                  typeof line === "object" &&
                  line !== null &&
                  typeof (line as GuideLine).left === "number" &&
                  typeof (line as GuideLine).top === "number" &&
                  typeof (line as GuideLine).width === "number" &&
                  typeof (line as GuideLine).height === "number",
              ),
            );
          } else if (
            message.type === "guideWordRects" &&
            Array.isArray(message.rects)
          ) {
            onGuideWordRects?.(
              message.rects.filter(
                (rect: unknown): rect is GuideLine =>
                  typeof rect === "object" &&
                  rect !== null &&
                  typeof (rect as GuideLine).left === "number" &&
                  typeof (rect as GuideLine).top === "number" &&
                  typeof (rect as GuideLine).width === "number" &&
                  typeof (rect as GuideLine).height === "number",
              ),
              message.target &&
                typeof message.target.blockId === "string" &&
                typeof message.target.offset === "number" &&
                typeof message.target.length === "number"
                ? message.target
                : undefined,
            );
          }
        } catch {}
      }}
      onCustomMenuSelection={(event) => {
        const findTarget = findTargetForMenuKey(event.nativeEvent.key);
        if (findTarget) {
          const range = selectionRangesRef.current[0];
          if (range)
            onFindWord?.(
              findTarget,
              range,
              event.nativeEvent.selectedText?.trim() ?? "",
            );
          return;
        }
        if (event.nativeEvent.key === "highlight") {
          if (selectionRangesRef.current.length)
            onHighlight?.(selectionRangesRef.current);
        } else if (event.nativeEvent.key === "removeHighlight") {
          if (selectionRangesRef.current.length)
            onRemoveHighlight?.(selectionRangesRef.current);
        } else if (event.nativeEvent.key === "addNote") {
          if (selectionRangesRef.current.length) {
            onAddNote?.(
              selectionRangesRef.current,
              event.nativeEvent.selectedText?.trim() ?? "",
            );
          }
        } else if (event.nativeEvent.key === "askAI") {
          onAskAI?.(event.nativeEvent.selectedText?.trim() ?? "");
        }
      }}
    />
  );
}

const MemoizedHorizontalSelectablePage = React.memo(
  HorizontalSelectablePage,
  (previous, next) =>
    previous.page === next.page &&
    previous.userHighlights === next.userHighlights &&
    previous.userNotes === next.userNotes &&
    previous.spokenWordHighlight === next.spokenWordHighlight &&
    previous.searchHighlight === next.searchHighlight &&
    previous.switchHighlight === next.switchHighlight &&
    previous.switchHighlightColor === next.switchHighlightColor &&
    previous.displayText === next.displayText &&
    previous.readingDirection === next.readingDirection &&
    previous.fontFamily === next.fontFamily &&
    previous.latoBoldBase64 === next.latoBoldBase64 &&
    previous.sourceSansBase64 === next.sourceSansBase64 &&
    previous.fontSize === next.fontSize &&
    previous.lineHeight === next.lineHeight &&
    previous.letterSpacing === next.letterSpacing &&
    previous.wordSpacing === next.wordSpacing &&
    previous.bold === next.bold &&
    previous.automaticHyphenation === next.automaticHyphenation &&
    previous.backgroundColor === next.backgroundColor &&
    previous.textColor === next.textColor &&
    previous.bottomPadding === next.bottomPadding &&
    previous.topContentInset === next.topContentInset &&
    previous.guideWord === next.guideWord &&
    previous.guideActive === next.guideActive &&
    previous.readerPageNumber === next.readerPageNumber &&
    previous.pageTopMargin === next.pageTopMargin &&
    previous.pageBottomMargin === next.pageBottomMargin,
);

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
  const isRunningTitle = (block: ExtractedPdfBlock) => {
    const text = block.text.trim();
    if (
      (block.kind !== "title" && block.kind !== "heading") ||
      !text ||
      text.length > 100 ||
      (text.match(/\S+/g)?.length ?? 0) > 12
    )
      return false;
    const firstLetter = text.match(/\p{L}/u)?.[0];
    const hasLetterCase =
      firstLetter &&
      firstLetter.toLocaleUpperCase() !== firstLetter.toLocaleLowerCase();
    return Boolean(
      firstLetter &&
      (!hasLetterCase || firstLetter === firstLetter.toLocaleUpperCase()),
    );
  };
  let runningTitle = blocks.find(isRunningTitle)?.text.trim() ?? "";
  let paginatedSourcePage: number | undefined;

  blocks.forEach((block, blockIndex) => {
    // Horizontal mode is a discrete book, not one continuous text stream.
    // Never place the end of one PDF source page and the beginning of the next
    // on the same generated page. A source page may expand into several book
    // pages as typography grows, but its first generated page always starts
    // with content from that source page. This makes cross-layout restoration
    // unambiguous and prevents page N from visibly landing on page N - 1.
    if (
      paginatedSourcePage !== undefined &&
      block.page !== paginatedSourcePage &&
      pages[pages.length - 1].length > 0
    ) {
      pages.push([]);
      usedHeight = 0;
    }
    paginatedSourcePage = block.page;

    if (isRunningTitle(block)) {
      runningTitle = block.text.trim();
    }
    let sourceOffset = 0;
    const previousKind = blocks[blockIndex - 1]?.kind;
    const sectionOpening =
      block.kind === "paragraph" &&
      (blockIndex === 0 ||
        previousKind === "title" ||
        previousKind === "heading");
    // Keep the pagination estimate identical to the rendered heading sizes;
    // overestimating these left avoidable blank space near page bottoms.
    const textScale =
      block.kind === "title" ? 1.55 : block.kind === "heading" ? 1.25 : 1;
    const scaledLineHeight = baseLineHeight * textScale;
    const scaledCharactersPerLine = Math.max(
      8,
      Math.floor(charactersPerLine / textScale),
    );

    while (sourceOffset < block.text.length) {
      let spacingBefore =
        sourceOffset === 0 && usedHeight > 0
          ? block.kind === "title"
            ? baseFontSize * 1.15
            : block.kind === "heading"
              ? baseFontSize * 0.95
              : 0
          : 0;
      let remainingHeight = pageHeight - usedHeight - spacingBefore;
      let availableLines = Math.floor(remainingHeight / scaledLineHeight);
      const estimatedRemainingLines = Math.ceil(
        (block.text.length - sourceOffset) / scaledCharactersPerLine,
      );
      // Avoid leaving a single opening line of a paragraph or heading at the
      // bottom of a page when the content continues onto the next page.
      if (
        usedHeight > 0 &&
        (availableLines < 1 ||
          (availableLines === 1 && estimatedRemainingLines > 1))
      ) {
        pages.push([]);
        usedHeight = 0;
        spacingBefore = 0;
        remainingHeight = pageHeight;
        availableLines = Math.max(
          1,
          Math.floor(remainingHeight / scaledLineHeight),
        );
      }

      const available = Math.max(1, availableLines * scaledCharactersPerLine);
      let end = Math.min(block.text.length, sourceOffset + available);
      if (end < block.text.length) {
        const breakAt = block.text.lastIndexOf(" ", end);
        if (breakAt > sourceOffset) end = breakAt + 1;
      }
      if (end <= sourceOffset)
        end = Math.min(block.text.length, sourceOffset + available);

      const text = block.text.slice(sourceOffset, end).trimEnd();
      if (text) {
        const spacingAfter =
          end >= block.text.length
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
          runningTitle,
        });
        const wrappedLines = Math.max(
          1,
          Math.ceil(text.length / scaledCharactersPerLine),
        );
        usedHeight +=
          wrappedLines * scaledLineHeight + spacingBefore + spacingAfter;
      }
      sourceOffset = end;
    }
  });

  return pages.filter((page) => page.length > 0);
}

// ReaderView stays mounted while its horizontal child is swapped out. Keep a
// small pagination cache keyed by that stable blocks array so returning to the
// pager does not synchronously lay out the whole book again.
const paginationCache = new WeakMap<
  ExtractedPdfBlock[],
  Map<string, Segment[][]>
>();

function cachedBuildPages(
  blocks: ExtractedPdfBlock[],
  charactersPerLine: number,
  pageHeight: number,
  baseLineHeight: number,
  baseFontSize: number,
  paragraphSpacing: number,
) {
  const key = [
    "source-bounded-pages-v3",
    blocks.length,
    blocks[blocks.length - 1]?.id ?? "empty",
    blocks[blocks.length - 1]?.text.length ?? 0,
    charactersPerLine,
    Math.round(pageHeight * 10),
    Math.round(baseLineHeight * 100),
    Math.round(baseFontSize * 100),
    Math.round(paragraphSpacing * 100),
  ].join(":");
  let entries = paginationCache.get(blocks);
  if (!entries) {
    entries = new Map();
    paginationCache.set(blocks, entries);
  }
  const cached = entries.get(key);
  if (cached) return cached;

  const pages = buildPages(
    blocks,
    charactersPerLine,
    pageHeight,
    baseLineHeight,
    baseFontSize,
    paragraphSpacing,
  );
  if (entries.size >= 8) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey !== undefined) entries.delete(oldestKey);
  }
  entries.set(key, pages);
  return pages;
}

function pageAnchor(
  page: Segment[] | undefined,
  blocks: ExtractedPdfBlock[],
): PageAnchor | undefined {
  return captureHorizontalFlipAnchor(page, blocks);
}

function pageIndexForAnchor(pages: Segment[][], anchor?: PageAnchor) {
  return horizontalPageForFlipAnchor(pages, anchor);
}

export default function HorizontalReaderPager({
  blocks,
  isActive = true,
  userHighlights = [],
  onSelectionHighlightRequest,
  onSelectionRemoveHighlight,
  onSelectionAskAI,
  onSelectionAddNote,
  findWordItems = [],
  onFindWord,
  onOpenNote,
  userNotes = [],
  readingDirection = "ltr",
  spokenWordHighlight,
  guideMode = null,
  guideBackgroundDimming = 60,
  guideColor = "#F59E0B",
  switchHighlightColor = "#F59E0B",
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
  verticalMarginPreset,
  horizontalMarginPreset,
  backgroundColor,
  textColor,
  onPageChange,
  onPageMapChange,
  onExplicitPageResolved,
  onReaderTap,
  onReaderReveal,
  onReady,
  onSwipeStart,
  onViewportSettled,
}: Props) {
  const isRtl = readingDirection === "rtl";
  const pagerRef = useRef<FlatList<Segment[]>>(null);
  const currentPageRef = useRef(0);
  const visiblePageAnchorRef = useRef<PageAnchor | undefined>(undefined);
  const readyReportedRef = useRef(false);
  const navigatedDestinationKeyRef = useRef<string | null>(null);
  const programmaticDestinationPageRef = useRef<number | null>(null);
  const programmaticDestinationAnchorRef = useRef<PageAnchor | undefined>(
    undefined,
  );
  const settledDestinationAnchorRef = useRef<PageAnchor | undefined>(undefined);
  const [paginationAnchor, setPaginationAnchor] = useState<PageAnchor>();
  const viewportFrameRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingViewportRestoreRef = useRef(false);
  const [pagerWarm, setPagerWarm] = useState(false);
  const [viewablePageIndex, setViewablePageIndex] = useState(0);
  const [paintedSwitchNonce, setPaintedSwitchNonce] = useState<number | null>(
    null,
  );
  const onViewablePagesChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ index: number | null; isViewable: boolean }>;
    }) => {
      const visible = viewableItems.find(
        (item) => item.isViewable && item.index != null,
      );
      if (visible?.index != null) setViewablePageIndex(visible.index);
    },
  ).current;
  const pageViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;
  const [dismissedSearchNonce, setDismissedSearchNonce] = useState<
    number | null
  >(null);
  const [dismissedSwitchNonce, setDismissedSwitchNonce] = useState<
    number | null
  >(null);
  const [lineGuideIndex, setLineGuideIndex] = useState(0);
  const [wordGuideIndex, setWordGuideIndex] = useState(0);
  const [wordGuideFragmentIndex, setWordGuideFragmentIndex] = useState(0);
  const [guideLinesByPage, setGuideLinesByPage] = useState<
    Record<number, GuideLine[]>
  >({});
  const [webGuideLinesByPage, setWebGuideLinesByPage] = useState<
    Record<number, GuideLine[]>
  >({});
  const [webGuideWordRects, setWebGuideWordRects] = useState<
    Record<string, GuideLine[]>
  >({});
  const [wordMeasurement, setWordMeasurement] = useState<{
    key: string;
    prefixWidth?: number;
    totalWidth?: number;
  } | null>(null);
  const [displayedGuideRect, setDisplayedGuideRect] = useState<
    GuideLine | undefined
  >();
  const segmentMeasurements = useRef(
    new Map<
      string,
      {
        pageIndex: number;
        blockId?: string;
        segmentStart?: number;
        segmentLength?: number;
        indentLength?: number;
        left?: number;
        top?: number;
        lines?: GuideLine[];
      }
    >(),
  );
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const hyphenationCache = useRef(new Map<string, string>());
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState(() => ({
    width: windowWidth,
    height: windowHeight,
  }));
  const { width, height: usableHeight } = viewport;
  const insets = useSafeAreaInsets();

  useEffect(
    () => () => {
      if (viewportFrameRef.current !== null) {
        clearTimeout(viewportFrameRef.current);
        viewportFrameRef.current = null;
      }
    },
    [],
  );

  const reportReady = useCallback(() => {
    setPagerWarm(true);
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
  const typographyKey = [
    fontFamily,
    fontSize,
    lineHeight,
    paragraphSpacing,
    letterSpacing,
    wordSpacing,
    bold ? 1 : 0,
    automaticHyphenation ? 1 : 0,
  ].join(":");
  const previousTypographyKeyRef = useRef(typographyKey);
  const previousDestinationNonceRef = useRef(destination?.nonce);
  const sideMargin = {
    compact: 18,
    comfortable: 30,
    relaxed: 46,
  }[horizontalMarginPreset];
  const verticalMargin = {
    compact: 22,
    comfortable: 24,
    relaxed: 48,
  }[verticalMarginPreset];
  const headerHeight = verticalMarginPreset === "compact" ? 40 : 44;
  const footerHeight = verticalMarginPreset === "compact" ? 18 : 38;
  const topContentInset = verticalMargin + headerHeight;
  const pageBottomMargin =
    verticalMarginPreset === "compact"
      ? Math.max(10, insets.bottom)
      : verticalMargin + Math.max(6, insets.bottom);
  const bottomContentInset = pageBottomMargin + footerHeight;
  const horizontalPadding = Math.max(sideMargin, (width - 680) / 2);
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
    ),
  );
  const pageContentHeight = Math.max(
    120,
    usableHeight - topContentInset - bottomContentInset,
  );
  const baseLineHeight = Math.max(16, deferredFontSize * deferredLineHeight);
  const pages = useMemo(
    () =>
      cachedBuildPages(
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
    ],
  );

  useLayoutEffect(() => {
    if (previousDestinationNonceRef.current === destination?.nonce) return;
    previousDestinationNonceRef.current = destination?.nonce;
    setPaginationAnchor(undefined);
  }, [destination?.nonce]);

  useLayoutEffect(() => {
    if (previousTypographyKeyRef.current === typographyKey) return;
    previousTypographyKeyRef.current = typographyKey;
    const anchor =
      visiblePageAnchorRef.current ??
      pageAnchor(pages[currentPageRef.current], blocks);
    if (!anchor) return;
    setPaginationAnchor((current) =>
      current?.blockId === anchor.blockId &&
      current.blockOffset === anchor.blockOffset
        ? current
        : anchor,
    );
  }, [blocks, pages, typographyKey]);

  const reportPageChange = useCallback(
    (pageIndex: number, anchorOverride?: PageAnchor) => {
      if (!pages.length) return;
      const safeIndex = Math.max(0, Math.min(pages.length - 1, pageIndex));
      const anchor =
        anchorOverride ??
        (safeIndex === currentPageRef.current
          ? settledDestinationAnchorRef.current
          : undefined) ??
        pageAnchor(pages[safeIndex], blocks);
      visiblePageAnchorRef.current = anchor;
      onPageChange?.(
        safeIndex + 1,
        pages.length,
        pages[safeIndex]?.[0]?.sourcePage ?? 1,
        anchor,
      );
    },
    [blocks, onPageChange, pages],
  );

  useEffect(() => {
    if (programmaticDestinationPageRef.current !== viewablePageIndex) return;
    const confirmedAnchor = programmaticDestinationAnchorRef.current;
    // Becoming viewable does not mean an iOS horizontal pager has finished
    // settling.  In particular, a generated page can begin with the tail of
    // the preceding source page.  Releasing the lock here lets the remaining
    // native scroll events replace the explicit destination with that tail.
    // Keep the discrete destination locked until the reader actually starts
    // a drag; programmatic/layout scroll events must never change its anchor.
    settledDestinationAnchorRef.current = confirmedAnchor;
    reportPageChange(viewablePageIndex, confirmedAnchor);
  }, [reportPageChange, viewablePageIndex]);
  const guideWords = useMemo(() => {
    if (guideMode !== "word") return [];
    return pages.flatMap((page, pageIndex) =>
      page.flatMap((segments) =>
        Array.from(segments.text.matchAll(/\S+/g)).map((match) => ({
          pageIndex,
          blockId: segments.blockId,
          offset: segments.startOffset + (match.index ?? 0),
          length: match[0].length,
        })),
      ),
    );
  }, [guideMode, pages]);

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
    if (!onPageMapChange) return;
    const frame = requestAnimationFrame(() => {
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
      for (
        let sourcePage = maximumSourcePage;
        sourcePage >= 1;
        sourcePage -= 1
      ) {
        if (direct[sourcePage] !== undefined)
          nextReaderPage = direct[sourcePage];
        complete[sourcePage] = nextReaderPage;
      }
      onPageMapChange(complete);
    });
    return () => cancelAnimationFrame(frame);
  }, [onPageMapChange, pages]);
  const destinationPage = useMemo(() => {
    if (destination?.readerPage !== undefined) {
      return Math.max(
        0,
        Math.min(pages.length - 1, destination.readerPage - 1),
      );
    }
    if (destination) {
      const exactIndex = pages.findIndex((page) =>
        page.some(
          (segment) =>
            segment.blockId === destination.blockId &&
            (destination.searchMatchIndex === undefined ||
              (destination.searchMatchIndex >= segment.startOffset &&
                destination.searchMatchIndex <
                  segment.startOffset + segment.text.length)),
        ),
      );
      if (exactIndex >= 0) return exactIndex;
      const sourcePageIndex = pages.findIndex((page) =>
        page.some((segment) => segment.sourcePage >= destination.page),
      );
      if (sourcePageIndex >= 0) return sourcePageIndex;
      // The destination page's content has not been generated/translated yet.
      // Return -1 so the navigation waits for `pages` to grow instead of
      // snapping to an unrelated (usually earlier) page.
      return -1;
    }
    const anchoredPage = pageIndexForAnchor(
      pages,
      paginationAnchor
        ? (visiblePageAnchorRef.current ?? paginationAnchor)
        : undefined,
    );
    if (anchoredPage >= 0) return anchoredPage;
    return 0;
  }, [destination, pages, paginationAnchor]);
  const destinationNavigationKey = destination
    ? String(destination.nonce)
    : null;
  const destinationIsPending = Boolean(
    destinationNavigationKey &&
    navigatedDestinationKeyRef.current !== destinationNavigationKey,
  );
  const preservedViewportPage = useMemo(() => {
    // A destination is a one-time navigation command, not permanent pager
    // state. Once it has been consumed, rotation and repagination must follow
    // the last visible text anchor instead of replaying the old page number.
    if (
      destination &&
      navigatedDestinationKeyRef.current !== String(destination.nonce)
    ) {
      return destinationPage >= 0
        ? destinationPage
        : Math.max(0, Math.min(pages.length - 1, currentPageRef.current));
    }
    const anchoredPage = pageIndexForAnchor(
      pages,
      visiblePageAnchorRef.current,
    );
    return anchoredPage >= 0
      ? anchoredPage
      : Math.max(0, Math.min(pages.length - 1, currentPageRef.current));
  }, [destination, destinationPage, pages]);

  useLayoutEffect(() => {
    if (!pendingViewportRestoreRef.current || !pages.length) return;

    pendingViewportRestoreRef.current = false;
    currentPageRef.current = preservedViewportPage;
    pagerRef.current?.scrollToOffset({
      animated: false,
      offset: preservedViewportPage * width,
    });
    reportPageChange(preservedViewportPage);

    // The keyed pager now has one consistent set of landscape or portrait
    // measurements and the preserved text anchor is restored synchronously.
    // Signal the parent so it can fade its resize mask back in exactly now.
    onViewportSettled?.();
  }, [
    onViewportSettled,
    pages,
    preservedViewportPage,
    reportPageChange,
    width,
  ]);

  useLayoutEffect(() => {
    if (!destination || !pages.length) return;
    if (!destinationIsPending || !destinationNavigationKey) return;
    // Target content not generated/translated yet. Stay put and wait for
    // `pages` to grow; do NOT consume the destination so this effect retries.
    if (destinationPage < 0) return;
    const resolvedAnchor = pageAnchor(pages[destinationPage], blocks);
    const resolvedSourcePage = pages[destinationPage]?.[0]?.sourcePage;
    if (
      destination.readerPage !== undefined &&
      resolvedAnchor &&
      resolvedSourcePage
    ) {
      onExplicitPageResolved?.(resolvedSourcePage, resolvedAnchor);
    }
    const exactOffset =
      destination.searchMatchIndex ?? destination.switchHighlightOffset;
    const exactBlock = destination.blockId
      ? blocks.find((block) => block.id === destination.blockId)
      : undefined;
    const exactAnchor =
      destination.blockId && exactOffset !== undefined
        ? {
            blockId: destination.blockId,
            blockOffset: exactOffset,
            wordIndex:
              exactBlock?.text.slice(0, exactOffset).match(/\S+/g)?.length ?? 0,
          }
        : undefined;
    programmaticDestinationPageRef.current = destinationPage;
    programmaticDestinationAnchorRef.current = exactAnchor ?? resolvedAnchor;
    settledDestinationAnchorRef.current = undefined;
    pagerRef.current?.scrollToIndex({
      animated: false,
      index: destinationPage,
    });
    const settleFrame = requestAnimationFrame(() => {
      pagerRef.current?.scrollToIndex({
        animated: false,
        index: destinationPage,
      });
    });
    currentPageRef.current = destinationPage;
    navigatedDestinationKeyRef.current = destinationNavigationKey;
    reportPageChange(destinationPage, exactAnchor);
    return () => cancelAnimationFrame(settleFrame);
  }, [
    destination,
    destinationIsPending,
    destinationNavigationKey,
    destinationPage,
    pages,
    blocks,
    onExplicitPageResolved,
    reportPageChange,
    width,
  ]);

  useLayoutEffect(() => {
    if (destination) return;
    if (pages.length) {
      const anchor = visiblePageAnchorRef.current ?? paginationAnchor;
      const anchoredPage = pageIndexForAnchor(pages, anchor);
      const current =
        anchoredPage >= 0
          ? anchoredPage
          : Math.min(currentPageRef.current, pages.length - 1);
      currentPageRef.current = current;
      reportPageChange(current);
      if (anchoredPage >= 0) {
        pagerRef.current?.scrollToIndex({ animated: false, index: current });
        const frame = requestAnimationFrame(() => {
          // FlatList can finish applying its new data after the layout effect;
          // repeat once before paint as a fallback without showing a slide.
          pagerRef.current?.scrollToIndex({ animated: false, index: current });
        });
        return () => cancelAnimationFrame(frame);
      }
    }
  }, [destination, pages, paginationAnchor, reportPageChange]);

  useEffect(() => {
    if (!spokenWordHighlight || !pages.length) return;
    const pageIndex = pages.findIndex((page) =>
      page.some(
        (segment) =>
          segment.blockId === spokenWordHighlight.blockId &&
          spokenWordHighlight.offset >= segment.startOffset &&
          spokenWordHighlight.offset <
            segment.startOffset + segment.text.length,
      ),
    );
    if (pageIndex < 0 || pageIndex === currentPageRef.current) return;
    pagerRef.current?.scrollToIndex({ animated: true, index: pageIndex });
    currentPageRef.current = pageIndex;
    reportPageChange(pageIndex);
  }, [pages, reportPageChange, spokenWordHighlight]);

  const textForDisplay = useCallback(
    (text: string) => {
      if (!automaticHyphenation || Platform.OS !== "ios") return text;
      const cached = hyphenationCache.current.get(text);
      if (cached !== undefined) return cached;
      const hyphenated = hyphenateText(text);
      if (hyphenationCache.current.size >= 4000)
        hyphenationCache.current.clear();
      hyphenationCache.current.set(text, hyphenated);
      return hyphenated;
    },
    [automaticHyphenation],
  );

  const activeGuideWord =
    guideMode === "word" ? guideWords[wordGuideIndex] : undefined;
  const activeGuideLines =
    webGuideLinesByPage[currentPageRef.current] ??
    guideLinesByPage[currentPageRef.current] ??
    [];
  const activeGuideLine =
    activeGuideLines[
      Math.min(lineGuideIndex, Math.max(0, activeGuideLines.length - 1))
    ];

  const recordSegmentMeasurement = useCallback(
    (
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
      if (next.left === undefined || next.top === undefined || !next.lines)
        return;
      const pageLines = Array.from(segmentMeasurements.current.values())
        .filter(
          (measurement) =>
            measurement.pageIndex === pageIndex &&
            measurement.left !== undefined &&
            measurement.top !== undefined &&
            measurement.lines,
        )
        .flatMap((measurement) =>
          measurement.lines!.map((line) => ({
            left: measurement.left! + line.left,
            top: measurement.top! + line.top,
            width: line.width,
            height: line.height,
            text: line.text,
          })),
        )
        .sort((left, right) => left.top - right.top || left.left - right.left);
      setGuideLinesByPage((currentPages) => {
        const previous = currentPages[pageIndex] ?? [];
        const unchanged =
          previous.length === pageLines.length &&
          previous.every((line, index) => {
            const candidate = pageLines[index];
            return (
              Math.abs(line.left - candidate.left) < 0.5 &&
              Math.abs(line.top - candidate.top) < 0.5 &&
              Math.abs(line.width - candidate.width) < 0.5 &&
              Math.abs(line.height - candidate.height) < 0.5
            );
          });
        return unchanged
          ? currentPages
          : { ...currentPages, [pageIndex]: pageLines };
      });
    },
    [],
  );

  const activeWordMeasurementTarget = useMemo(() => {
    if (!activeGuideWord) return undefined;
    const measurement = Array.from(segmentMeasurements.current.values()).find(
      (item) =>
        item.pageIndex === activeGuideWord.pageIndex &&
        item.blockId === activeGuideWord.blockId &&
        item.segmentStart !== undefined &&
        item.segmentLength !== undefined &&
        activeGuideWord.offset >= item.segmentStart &&
        activeGuideWord.offset < item.segmentStart + item.segmentLength &&
        item.left !== undefined &&
        item.top !== undefined &&
        item.lines,
    );
    if (
      !measurement?.lines ||
      measurement.left === undefined ||
      measurement.top === undefined
    ) {
      return undefined;
    }
    const pageSegment = pages[activeGuideWord.pageIndex]?.find(
      (segment) =>
        segment.blockId === activeGuideWord.blockId &&
        activeGuideWord.offset >= segment.startOffset &&
        activeGuideWord.offset < segment.startOffset + segment.text.length,
    );
    if (!pageSegment) return undefined;
    const sourceLocalOffset =
      activeGuideWord.offset - measurement.segmentStart!;
    const openingWord: string = "";
    const displayedOpeningWord = openingWord ? textForDisplay(openingWord) : "";
    const displayedSegment = openingWord
      ? displayedOpeningWord +
        textForDisplay(pageSegment.text.slice(openingWord.length))
      : textForDisplay(pageSegment.text);
    let sourceCharacters = 0;
    let displayLocalOffset = 0;
    while (
      displayLocalOffset < displayedSegment.length &&
      sourceCharacters < sourceLocalOffset
    ) {
      if (displayedSegment[displayLocalOffset] !== "\u00ad")
        sourceCharacters += 1;
      displayLocalOffset += 1;
    }
    let displayWordEnd = displayLocalOffset;
    const sourceWordEnd = sourceLocalOffset + activeGuideWord.length;
    while (
      displayWordEnd < displayedSegment.length &&
      sourceCharacters < sourceWordEnd
    ) {
      if (displayedSegment[displayWordEnd] !== "\u00ad") sourceCharacters += 1;
      displayWordEnd += 1;
    }
    const displayWordLength = displayWordEnd - displayLocalOffset;
    const localOffset = displayLocalOffset + (measurement.indentLength ?? 0);
    const displayedText =
      "\u2003\u2002".slice(0, measurement.indentLength ?? 0) + displayedSegment;
    let searchFrom = 0;
    const fragments: Array<{
      prefix: string;
      prefixAndWord: string;
      line: GuideLine;
    }> = [];
    for (const line of measurement.lines) {
      const lineText = line.text ?? "";
      const lineLength = Math.max(1, lineText.length);
      const matchedStart = lineText
        ? displayedText.indexOf(lineText, searchFrom)
        : -1;
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
          prefixAndWord:
            prefix +
            lineText.slice(offsetInLine, offsetInLine + fragmentLength),
          line: {
            left: measurement.left + line.left,
            top: measurement.top + line.top,
            width: line.width,
            height: line.height,
          },
        });
      }
      searchFrom = lineEnd;
      while (
        searchFrom < displayedText.length &&
        /\s/.test(displayedText[searchFrom])
      ) {
        searchFrom += 1;
      }
    }
    if (!fragments.length) return undefined;
    const selectedFragmentIndex =
      wordGuideFragmentIndex < 0
        ? fragments.length - 1
        : Math.min(wordGuideFragmentIndex, fragments.length - 1);
    const fragment = fragments[selectedFragmentIndex];
    const headingScale =
      pageSegment.kind === "title"
        ? 1.55
        : pageSegment.kind === "heading"
          ? 1.25
          : 1;
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
        fontWeight: bold ? ("700" as const) : ("400" as const),
        writingDirection: readingDirection,
      },
      openingWord: displayedOpeningWord,
      activeWordUsesOpeningStyle: Boolean(
        openingWord && sourceLocalOffset === 0,
      ),
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
  const approximatedGuideWordRect = useMemo<GuideLine | undefined>(() => {
    const target = activeWordMeasurementTarget;
    if (
      !target ||
      wordMeasurement?.key !== target.key ||
      wordMeasurement.prefixWidth === undefined ||
      wordMeasurement.totalWidth === undefined
    ) {
      return undefined;
    }
    const wordWidth = Math.max(
      4,
      wordMeasurement.totalWidth - wordMeasurement.prefixWidth,
    );
    return {
      left: isRtl
        ? target.line.left + target.line.width - wordMeasurement.totalWidth
        : target.line.left + wordMeasurement.prefixWidth,
      top: target.line.top,
      width: wordWidth,
      height: target.line.height,
    };
  }, [activeWordMeasurementTarget, isRtl, wordMeasurement]);
  const guideWordKey = activeGuideWord
    ? `${activeGuideWord.pageIndex}:${activeGuideWord.blockId}:${activeGuideWord.offset}:${activeGuideWord.length}`
    : undefined;
  const activeGuideWordRect = useMemo<GuideLine | undefined>(() => {
    const exactRects = guideWordKey
      ? webGuideWordRects[guideWordKey]
      : undefined;
    if (exactRects?.length) {
      const index =
        wordGuideFragmentIndex < 0
          ? exactRects.length - 1
          : Math.min(wordGuideFragmentIndex, exactRects.length - 1);
      return exactRects[index];
    }
    // Once a page has supplied its browser layout, never briefly fall back to
    // the native Text measurement. Its font metrics differ just enough to
    // make the word guide jump sideways before the precise rect arrives.
    if (webGuideLinesByPage[currentPageRef.current]?.length) return undefined;
    return approximatedGuideWordRect;
  }, [
    approximatedGuideWordRect,
    guideWordKey,
    webGuideLinesByPage,
    webGuideWordRects,
    wordGuideFragmentIndex,
  ]);
  useEffect(() => {
    if (!activeWordMeasurementTarget) {
      setWordMeasurement(null);
      return;
    }
    setWordMeasurement((current) =>
      current?.key === activeWordMeasurementTarget.key
        ? current
        : {
            key: activeWordMeasurementTarget.key,
            ...(activeWordMeasurementTarget.prefix ? {} : { prefixWidth: 0 }),
          },
    );
  }, [activeWordMeasurementTarget]);
  const activeGuideRect =
    guideMode === "word" ? activeGuideWordRect : activeGuideLine;
  useEffect(() => {
    if (!guideMode) {
      setDisplayedGuideRect(undefined);
    } else if (activeGuideRect) {
      setDisplayedGuideRect(activeGuideRect);
    }
  }, [activeGuideRect, guideMode]);
  const visibleGuideRect = activeGuideRect ?? displayedGuideRect;

  const renderMeasuredGuideText = useCallback(
    (value: string) => {
      const target = activeWordMeasurementTarget;
      if (target?.activeWordUsesOpeningStyle) {
        return <Text style={target.openingWordStyle}>{value}</Text>;
      }
      if (!target?.openingWord || !value.startsWith(target.openingWord))
        return value;
      return (
        <>
          <Text style={target.openingWordStyle}>{target.openingWord}</Text>
          {value.slice(target.openingWord.length)}
        </>
      );
    },
    [activeWordMeasurementTarget],
  );

  const moveToPage = useCallback(
    (pageIndex: number) => {
      const target = Math.max(0, Math.min(pages.length - 1, pageIndex));
      if (target === currentPageRef.current) return;
      pagerRef.current?.scrollToIndex({ animated: true, index: target });
      currentPageRef.current = target;
      reportPageChange(target);
    },
    [pages.length, reportPageChange],
  );

  const moveGuide = useCallback(
    (direction: -1 | 1) => {
      if (guideMode === "word") {
        const exactFragments = guideWordKey
          ? webGuideWordRects[guideWordKey]
          : undefined;
        const selectedFragment = exactFragments?.length
          ? wordGuideFragmentIndex < 0
            ? exactFragments.length - 1
            : Math.min(wordGuideFragmentIndex, exactFragments.length - 1)
          : (activeWordMeasurementTarget?.selectedFragmentIndex ?? 0);
        const fragmentCount =
          exactFragments?.length ??
          activeWordMeasurementTarget?.fragmentCount ??
          1;
        if (direction > 0 && selectedFragment < fragmentCount - 1) {
          setWordGuideFragmentIndex(selectedFragment + 1);
          return;
        }
        if (direction < 0 && selectedFragment > 0) {
          setWordGuideFragmentIndex(selectedFragment - 1);
          return;
        }
        const next = Math.max(
          0,
          Math.min(guideWords.length - 1, wordGuideIndex + direction),
        );
        if (next === wordGuideIndex) return;
        setWordGuideIndex(next);
        setWordGuideFragmentIndex(direction < 0 ? -1 : 0);
        const nextPage = guideWords[next]?.pageIndex;
        if (nextPage !== undefined) moveToPage(nextPage);
        return;
      }
      const currentLines =
        webGuideLinesByPage[currentPageRef.current] ??
        guideLinesByPage[currentPageRef.current] ??
        [];
      const maximumLine = Math.max(0, currentLines.length - 1);
      const next = lineGuideIndex + direction;
      if (next > maximumLine) {
        setLineGuideIndex(0);
        moveToPage(currentPageRef.current + 1);
        return;
      }
      if (next < 0) {
        const previousPage = Math.max(0, currentPageRef.current - 1);
        setLineGuideIndex(
          Math.max(
            0,
            ((
              webGuideLinesByPage[previousPage] ??
              guideLinesByPage[previousPage]
            )?.length ?? 1) - 1,
          ),
        );
        moveToPage(previousPage);
        return;
      }
      setLineGuideIndex(next);
    },
    [
      activeWordMeasurementTarget,
      guideLinesByPage,
      guideMode,
      guideWordKey,
      guideWords,
      lineGuideIndex,
      moveToPage,
      webGuideLinesByPage,
      webGuideWordRects,
      wordGuideFragmentIndex,
      wordGuideIndex,
    ],
  );

  const destinationSwitchHighlightOffset = useMemo(() => {
    if (!destination?.blockId) return undefined;
    if (destination.switchHighlightOffset !== undefined)
      return destination.switchHighlightOffset;
    const block = blocks.find(
      (candidate) => candidate.id === destination.blockId,
    );
    if (!block) return undefined;
    const query = destination.switchHighlightQuery?.trim();
    if (query) {
      const index = block.text
        .toLocaleLowerCase()
        .indexOf(query.toLocaleLowerCase());
      if (index >= 0) return index;
    }
    const words = Array.from(block.text.matchAll(/\S+/g));
    if (!words.length) return undefined;
    const index =
      destination.switchHighlightWordIndex ??
      (destination.switchHighlightWordProgress !== undefined
        ? Math.round(
            destination.switchHighlightWordProgress * (words.length - 1),
          )
        : undefined);
    return index === undefined
      ? undefined
      : words[Math.max(0, Math.min(words.length - 1, index))]?.index;
  }, [blocks, destination]);
  const navigationSwitchHighlight =
    destination?.blockId && destinationSwitchHighlightOffset !== undefined
      ? {
          blockId: destination.blockId,
          offset: destinationSwitchHighlightOffset,
          nonce: destination.nonce,
        }
      : null;
  const activeSwitchHighlight =
    stationarySwitchHighlight &&
    (!navigationSwitchHighlight ||
      stationarySwitchHighlight.nonce >= navigationSwitchHighlight.nonce)
      ? stationarySwitchHighlight
      : navigationSwitchHighlight;
  const activeSwitchNonce = activeSwitchHighlight?.nonce;
  const activeSwitchPage = useMemo(() => {
    if (!activeSwitchHighlight) return -1;
    return pages.findIndex((page) =>
      page.some(
        (segment) =>
          segment.blockId === activeSwitchHighlight.blockId &&
          activeSwitchHighlight.offset >= segment.startOffset &&
          activeSwitchHighlight.offset <
            segment.startOffset + segment.text.length,
      ),
    );
  }, [activeSwitchHighlight, pages]);
  useEffect(() => {
    if (
      !isActive ||
      activeSwitchNonce === undefined ||
      activeSwitchNonce === dismissedSwitchNonce ||
      activeSwitchNonce !== paintedSwitchNonce ||
      activeSwitchPage < 0 ||
      activeSwitchPage !== viewablePageIndex
    )
      return;

    // The translated pager is intentionally warmed while hidden. Do not spend
    // the highlight's lifetime there: wait until its target page is visible,
    // then allow React Native and the selectable page one frame to paint it.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        setDismissedSwitchNonce(activeSwitchNonce);
      }, 1600);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [
    activeSwitchNonce,
    activeSwitchPage,
    dismissedSwitchNonce,
    isActive,
    paintedSwitchNonce,
    viewablePageIndex,
  ]);
  const selectableSearchHighlight =
    destination &&
    destination.nonce !== dismissedSearchNonce &&
    destination.blockId &&
    destination.searchQuery &&
    destination.searchMatchIndex !== undefined
      ? {
          blockId: destination.blockId,
          offset: destination.searchMatchIndex,
          length: destination.searchQuery.length,
        }
      : undefined;
  const selectableSwitchHighlight = useMemo(() => {
    if (
      !isActive ||
      !activeSwitchHighlight ||
      activeSwitchHighlight.nonce === dismissedSwitchNonce
    )
      return undefined;
    const block = blocks.find(
      (candidate) => candidate.id === activeSwitchHighlight.blockId,
    );
    if (!block) return undefined;
    const match = Array.from(block.text.matchAll(/\S+/g)).find(
      (candidate) =>
        (candidate.index ?? 0) + candidate[0].length >
        activeSwitchHighlight.offset,
    );
    return match
      ? {
          blockId: activeSwitchHighlight.blockId,
          offset: match.index ?? activeSwitchHighlight.offset,
          length: match[0].length,
          nonce: activeSwitchHighlight.nonce,
        }
      : undefined;
  }, [activeSwitchHighlight, blocks, dismissedSwitchNonce, isActive]);
  const renderSegment = (
    segment: Segment,
    index: number,
    pageIndex: number,
  ) => {
    const isSearchTarget =
      destination?.nonce !== dismissedSearchNonce &&
      destination?.blockId === segment.blockId &&
      destination.searchQuery &&
      destination.searchMatchIndex !== undefined &&
      destination.searchMatchIndex >= segment.startOffset &&
      destination.searchMatchIndex < segment.startOffset + segment.text.length;
    const localMatch = isSearchTarget
      ? destination.searchMatchIndex! - segment.startOffset
      : -1;
    const queryLength = isSearchTarget ? destination.searchQuery!.length : 0;
    const isSwitchTarget =
      activeSwitchHighlight?.nonce !== dismissedSwitchNonce &&
      activeSwitchHighlight?.blockId === segment.blockId &&
      activeSwitchHighlight.offset >= segment.startOffset &&
      activeSwitchHighlight.offset < segment.startOffset + segment.text.length;
    const switchLocalOffset = isSwitchTarget
      ? activeSwitchHighlight!.offset - segment.startOffset
      : -1;
    const switchMatch = isSwitchTarget
      ? Array.from(segment.text.matchAll(/\S+/g)).find(
          (match) => (match.index ?? 0) + match[0].length > switchLocalOffset,
        )
      : undefined;
    const switchStart = switchMatch?.index ?? -1;
    const switchLength = switchMatch?.[0].length ?? 0;
    const isSpokenTarget =
      spokenWordHighlight?.blockId === segment.blockId &&
      spokenWordHighlight.offset >= segment.startOffset &&
      spokenWordHighlight.offset < segment.startOffset + segment.text.length;
    const spokenStart = isSpokenTarget
      ? spokenWordHighlight!.offset - segment.startOffset
      : -1;
    const spokenLength = isSpokenTarget ? spokenWordHighlight!.length : 0;
    const headingScale =
      segment.kind === "title" ? 1.55 : segment.kind === "heading" ? 1.25 : 1;
    const openingWord: string = "";
    const paragraphIndent = segment.paragraphStart ? "\u2003" : "";
    const typographyStyle = {
      color: textColor,
      writingDirection: readingDirection,
      textAlign: isRtl ? ("right" as const) : ("left" as const),
      fontFamily,
      fontSize: fontSize * headingScale,
      lineHeight: fontSize * headingScale * lineHeight,
      letterSpacing,
      fontWeight: bold ? ("700" as const) : ("400" as const),
    };
    const openingWordStyle = {
      fontSize: fontSize * headingScale * 1.24,
      fontWeight: "700" as const,
      letterSpacing: letterSpacing + 0.15,
    };
    const highlightStyle = {
      ...typographyStyle,
      backgroundColor: `${switchHighlightColor}D1`,
    };
    const renderHighlightableText = () => {
      const displayedText = textForDisplay(segment.text);
      const displayIndexForSourceOffset = (sourceOffset: number) => {
        let sourceCursor = 0;
        let displayCursor = 0;
        while (
          displayCursor < displayedText.length &&
          sourceCursor < sourceOffset
        ) {
          if (displayedText[displayCursor] !== "\u00ad") sourceCursor += 1;
          displayCursor += 1;
        }
        return displayCursor;
      };
      const highlights = userHighlights
        .filter(
          (highlight) =>
            highlight.blockId === segment.blockId &&
            highlight.offset < segment.startOffset + segment.text.length &&
            highlight.offset + highlight.length > segment.startOffset,
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
        onLayout={(event) =>
          recordSegmentMeasurement(
            `${pageIndex}:${segment.blockId}:${segment.startOffset}`,
            pageIndex,
            {
              blockId: segment.blockId,
              start: segment.startOffset,
              length: segment.text.length,
              indentLength: paragraphIndent.length,
            },
            {
              left: event.nativeEvent.layout.x,
              top: event.nativeEvent.layout.y,
            },
          )
        }
        onTextLayout={(event) =>
          recordSegmentMeasurement(
            `${pageIndex}:${segment.blockId}:${segment.startOffset}`,
            pageIndex,
            {
              blockId: segment.blockId,
              start: segment.startOffset,
              length: segment.text.length,
              indentLength: paragraphIndent.length,
            },
            undefined,
            event.nativeEvent.lines.map((line) => ({
              left: line.x,
              top: line.y,
              width: line.width,
              height: line.height,
              text: line.text,
            })),
          )
        }
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
              ) : (
                textForDisplay(openingWord)
              )}
            </Text>
            {spokenStart >= openingWord.length ? (
              <>
                {textForDisplay(
                  segment.text.slice(openingWord.length, spokenStart),
                )}
                <Text style={highlightStyle}>
                  {textForDisplay(
                    segment.text.slice(spokenStart, spokenStart + spokenLength),
                  )}
                </Text>
                {textForDisplay(segment.text.slice(spokenStart + spokenLength))}
              </>
            ) : (
              textForDisplay(segment.text.slice(openingWord.length))
            )}
          </>
        ) : spokenStart >= 0 ? (
          <>
            {textForDisplay(segment.text.slice(0, spokenStart))}
            <Text style={highlightStyle}>
              {textForDisplay(
                segment.text.slice(spokenStart, spokenStart + spokenLength),
              )}
            </Text>
            {textForDisplay(segment.text.slice(spokenStart + spokenLength))}
          </>
        ) : localMatch >= 0 ? (
          <>
            {textForDisplay(segment.text.slice(0, localMatch))}
            <Text style={{ backgroundColor: "#facc15" }}>
              {textForDisplay(
                segment.text.slice(localMatch, localMatch + queryLength),
              )}
            </Text>
            {textForDisplay(segment.text.slice(localMatch + queryLength))}
          </>
        ) : switchStart >= 0 ? (
          <>
            {textForDisplay(segment.text.slice(0, switchStart))}
            <Text style={{ backgroundColor: `${switchHighlightColor}AD` }}>
              {textForDisplay(
                segment.text.slice(switchStart, switchStart + switchLength),
              )}
            </Text>
            {textForDisplay(segment.text.slice(switchStart + switchLength))}
          </>
        ) : (
          renderHighlightableText()
        )}
      </Text>
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor }}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextWidth <= 0 || nextHeight <= 0) return;
        const widthChanged = Math.abs(nextWidth - viewport.width) > 1;
        const meaningfulHeightChange =
          Math.abs(nextHeight - viewport.height) > 80;
        if (!widthChanged && !meaningfulHeightChange) return;

        // A rotation fires several onLayout passes in quick succession (frame
        // resize, chrome collapse, status bar). Repaginating the book once,
        // after the viewport settles, keeps long documents from being fully
        // re-paginated multiple times on the JS thread while the screen
        // rotates — the sequence that freezes the app on large books.
        if (viewportFrameRef.current !== null) {
          clearTimeout(viewportFrameRef.current);
        }
        pendingViewportRestoreRef.current = true;
        viewportFrameRef.current = setTimeout(() => {
          viewportFrameRef.current = null;
          setViewport({ width: nextWidth, height: nextHeight });
        }, HORIZONTAL_FLIP_SETTLE_MS);
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
        if (
          Math.hypot(dx, dy) < 10 &&
          Date.now() - touchStart.current.time < 350
        ) {
          onReaderTap?.();
        }
      }}
    >
      <FlatList
        key={`horizontal-pager-${Math.round(width)}-${Math.round(usableHeight)}`}
        ref={pagerRef}
        style={{ flex: 1, backgroundColor }}
        data={pages}
        horizontal
        inverted={isRtl}
        pagingEnabled
        initialScrollIndex={pages.length ? preservedViewportPage : undefined}
        bounces={false}
        overScrollMode="never"
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={pagerWarm ? 3 : 1}
        removeClippedSubviews={Platform.OS === "android"}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewablePagesChanged}
        viewabilityConfig={pageViewabilityConfig}
        keyExtractor={(_, pageIndex) => `reader-page-${pageIndex}`}
        getItemLayout={(_, pageIndex) => ({
          index: pageIndex,
          length: width,
          offset: width * pageIndex,
        })}
        onScrollBeginDrag={() => {
          programmaticDestinationPageRef.current = null;
          programmaticDestinationAnchorRef.current = undefined;
          settledDestinationAnchorRef.current = undefined;
          onSwipeStart?.();
          if (activeSwitchHighlight) {
            setDismissedSwitchNonce(activeSwitchHighlight.nonce);
          }
        }}
        scrollEventThrottle={16}
        onScroll={(event) => {
          if (
            pendingViewportRestoreRef.current ||
            Math.abs(windowWidth - width) > 1 ||
            !pages.length ||
            width <= 0
          )
            return;
          const position = Math.max(
            0,
            Math.min(
              pages.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / width),
            ),
          );
          if (programmaticDestinationPageRef.current !== null) return;
          if (position === currentPageRef.current) return;
          currentPageRef.current = position;
          reportPageChange(position);
        }}
        onMomentumScrollEnd={(event) => {
          if (
            pendingViewportRestoreRef.current ||
            Math.abs(windowWidth - width) > 1
          )
            return;
          const position = Math.max(
            0,
            Math.min(
              pages.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / width),
            ),
          );
          if (programmaticDestinationPageRef.current !== null) return;
          currentPageRef.current = position;
          if (destination?.searchQuery && position !== destinationPage) {
            setDismissedSearchNonce(destination.nonce);
          }
          reportPageChange(position);
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
              paddingHorizontal: 6,
              paddingVertical: 5,
              width,
            }}
          >
            <View
              pointerEvents="none"
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "transparent",
                borderRadius: 24,
                marginHorizontal: 6,
                marginVertical: 5,
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                zIndex: 3,
              }}
            />
            {guideMode ? (
              <View pointerEvents="none" style={{ opacity: 0 }}>
                {page.map((segment, segmentIndex) =>
                  renderSegment(segment, segmentIndex, pageIndex),
                )}
              </View>
            ) : null}
            <View
              style={{
                position: "absolute",
                left: horizontalPadding,
                right: horizontalPadding,
                top: 0,
                bottom: 0,
              }}
            >
              <MemoizedHorizontalSelectablePage
                page={page}
                userHighlights={userHighlights}
                userNotes={userNotes}
                spokenWordHighlight={spokenWordHighlight}
                searchHighlight={selectableSearchHighlight}
                switchHighlight={selectableSwitchHighlight}
                switchHighlightColor={switchHighlightColor}
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
                topContentInset={topContentInset}
                backgroundColor={backgroundColor}
                textColor={textColor}
                bottomPadding={bottomContentInset}
                onHighlight={onSelectionHighlightRequest}
                onRemoveHighlight={onSelectionRemoveHighlight}
                onAddNote={onSelectionAddNote}
                onOpenNote={onOpenNote}
                onAskAI={onSelectionAskAI}
                findWordItems={findWordItems ?? []}
                onFindWord={onFindWord}
                onReaderReveal={onReaderReveal}
                onReady={reportReady}
                onSwitchHighlightReady={
                  activeSwitchHighlight && pageIndex === activeSwitchPage
                    ? () => setPaintedSwitchNonce(activeSwitchHighlight.nonce)
                    : undefined
                }
                guideActive={
                  Boolean(guideMode) && pageIndex === currentPageRef.current
                }
                readerPageNumber={pageIndex + 1}
                pageTopMargin={verticalMargin}
                pageBottomMargin={pageBottomMargin}
                guideWord={
                  activeGuideWord?.pageIndex === pageIndex
                    ? activeGuideWord
                    : undefined
                }
                onGuideLines={(lines) => {
                  const pageLines = lines.map((line) => ({
                    ...line,
                    left: line.left + horizontalPadding,
                  }));
                  setWebGuideLinesByPage((current) => {
                    const previous = current[pageIndex] ?? [];
                    const unchanged =
                      previous.length === pageLines.length &&
                      previous.every((line, index) => {
                        const candidate = pageLines[index];
                        return (
                          Math.abs(line.left - candidate.left) < 0.5 &&
                          Math.abs(line.top - candidate.top) < 0.5 &&
                          Math.abs(line.width - candidate.width) < 0.5 &&
                          Math.abs(line.height - candidate.height) < 0.5
                        );
                      });
                    return unchanged
                      ? current
                      : { ...current, [pageIndex]: pageLines };
                  });
                }}
                onGuideWordRects={(rects, target) => {
                  if (!target || activeGuideWord?.pageIndex !== pageIndex)
                    return;
                  const key = `${pageIndex}:${target.blockId}:${target.offset}:${target.length}`;
                  const adjusted = rects.map((rect) => ({
                    ...rect,
                    left: rect.left + horizontalPadding,
                  }));
                  setWebGuideWordRects((current) => {
                    const previous = current[key] ?? [];
                    const unchanged =
                      previous.length === adjusted.length &&
                      previous.every((rect, index) => {
                        const candidate = adjusted[index];
                        return (
                          Math.abs(rect.left - candidate.left) < 0.5 &&
                          Math.abs(rect.top - candidate.top) < 0.5 &&
                          Math.abs(rect.width - candidate.width) < 0.5 &&
                          Math.abs(rect.height - candidate.height) < 0.5
                        );
                      });
                    return unchanged
                      ? current
                      : { ...current, [key]: adjusted };
                  });
                }}
              />
            </View>
          </View>
        )}
      />
      {guideMode === "word" && activeWordMeasurementTarget && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -10000,
            top: -10000,
            alignItems: "flex-start",
          }}
        >
          {activeWordMeasurementTarget.prefix ? (
            <Text
              numberOfLines={1}
              style={[
                activeWordMeasurementTarget.typography,
                { alignSelf: "flex-start" },
              ]}
              onTextLayout={(event) => {
                const measured = event.nativeEvent.lines[0]?.width ?? 0;
                setWordMeasurement((current) =>
                  current?.key === activeWordMeasurementTarget.key &&
                  current.prefixWidth === measured
                    ? current
                    : {
                        ...(current?.key === activeWordMeasurementTarget.key
                          ? current
                          : { key: activeWordMeasurementTarget.key }),
                        prefixWidth: measured,
                      },
                );
              }}
            >
              {renderMeasuredGuideText(activeWordMeasurementTarget.prefix)}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              activeWordMeasurementTarget.typography,
              { alignSelf: "flex-start" },
            ]}
            onTextLayout={(event) => {
              const measured = event.nativeEvent.lines[0]?.width ?? 0;
              setWordMeasurement((current) =>
                current?.key === activeWordMeasurementTarget.key &&
                current.totalWidth === measured
                  ? current
                  : {
                      ...(current?.key === activeWordMeasurementTarget.key
                        ? current
                        : { key: activeWordMeasurementTarget.key }),
                      totalWidth: measured,
                    },
              );
            }}
          >
            {renderMeasuredGuideText(activeWordMeasurementTarget.prefixAndWord)}
          </Text>
        </View>
      )}
      {guideMode && visibleGuideRect && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View
            style={{
              height: visibleGuideRect.top,
              backgroundColor,
              opacity: guideBackgroundDimming / 100,
            }}
          />
          <View
            style={{ height: visibleGuideRect.height, flexDirection: "row" }}
          >
            <View
              style={{
                width: visibleGuideRect.left,
                backgroundColor,
                opacity: guideBackgroundDimming / 100,
              }}
            />
            <View
              style={{
                width: visibleGuideRect.width,
                backgroundColor: `${guideColor}47`,
                borderColor: `${guideColor}8C`,
                borderWidth: 1,
                borderRadius: 4,
              }}
            />
            <View
              style={{
                flex: 1,
                backgroundColor,
                opacity: guideBackgroundDimming / 100,
              }}
            />
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor,
              opacity: guideBackgroundDimming / 100,
            }}
          />
        </View>
      )}
      {guideMode && (
        <>
          <Pressable
            accessibilityLabel="Move reading guide. Tap upper half for back, lower half for forward"
            accessibilityRole="button"
            onPress={(event) =>
              moveGuide(event.nativeEvent.pageY < usableHeight / 2 ? -1 : 1)
            }
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
            <Text
              style={{
                color: "white",
                fontSize: 32,
                fontWeight: "300",
                lineHeight: 34,
              }}
            >
              ×
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
