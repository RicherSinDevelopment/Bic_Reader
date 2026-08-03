import ReaderToolbar, {
  ReaderBottomNavItem,
} from "@/components/Readertoolbar";

import AI from "@/components/readernavbar/AI";
import BackgroundSettings from "@/components/readernavbar/BackgroundSettings";
import FontSettings from "@/components/readernavbar/FontSettings";
import Settings from "@/components/readernavbar/Settings";
import TTS from "@/components/readernavbar/TTS";
import { usePageTransition } from "@/hooks/pagetransition";
import {
  BottomSheet,
  BottomSheetBackdrop,
  BottomSheetContent,
  BottomSheetDragIndicator,
  BottomSheetPortal,
  type BottomSheetRef,
} from "@/components/ui/bottomsheet";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  View,
} from "react-native";

import { useReaderSettingsStore } from '@/stores/readerSettingsStore';
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { ExtractedPdfBlock } from "@/modules/bic-pdf-reader";

type ReaderViewProps = {
  isLandscape: boolean;
  blocks: ExtractedPdfBlock[];
  pageCount: number;
  destination?: { page: number; blockId?: string; nonce: number } | null;
  onPageChange?: (page: number) => void;
  onSwitchAnchorChange?: (blockId: string, word: string, wordIndex: number) => void;
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

const ReaderView = ({ isLandscape, blocks, pageCount, destination, onPageChange, onSwitchAnchorChange }: ReaderViewProps) => {
  const [activeItem, setActiveItem] =
    useState<ReaderBottomNavItem>("font");
  const [readerText, setReaderText] = useState("");
  const [initialBlocks] = useState(() => blocks);
  const readerMarkup = useMemo(() => blocksToMarkup(initialBlocks), [initialBlocks]);
  const appendedBlockCount = useRef(initialBlocks.length);
  const sentBlockIds = useRef(new Set(initialBlocks.map((block) => block.id)));
  const [webViewReady, setWebViewReady] = useState(false);
  const [highlightPickerVisible, setHighlightPickerVisible] = useState(false);
  const [selectedAIText, setSelectedAIText] = useState("");

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
    const appended = blocks.filter((block) => !sentBlockIds.current.has(block.id));
    if (!appended.length) return;
    webViewRef.current?.postMessage(JSON.stringify({
      type: "appendBlocks",
      html: blocksToMarkup(appended),
    }));
    appended.forEach((block) => sentBlockIds.current.add(block.id));
    appendedBlockCount.current = blocks.length;
  }, [blocks, webViewReady]);

  useEffect(() => {
    if (!webViewReady || !destination) return;
    webViewRef.current?.postMessage(JSON.stringify({ type: "goToSourcePage", ...destination }));
  }, [destination, webViewReady]);
  const transition = useReaderSettingsStore((state) => state.transition);
  const { isPaged, syncPageTransition } = usePageTransition({
    webViewRef,
    transition,
  });

  const navigateReaderPage = useCallback((direction: 1 | -1) => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: "pageNavigate",
        direction,
      })
    );
  }, []);

  /* eslint-disable react-hooks/refs -- PanResponder callbacks read WebView refs only after gestures. */
  const pagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          isPaged &&
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          const isSwipe =
            Math.abs(gesture.dx) >= 45 ||
            Math.abs(gesture.vx) >= 0.5;

          if (isSwipe) {
            navigateReaderPage(gesture.dx < 0 ? 1 : -1);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [isPaged, navigateReaderPage]
  );
  /* eslint-enable react-hooks/refs */

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
  const letterSpacing = useReaderSettingsStore(
  (state) => state.letterSpacing
);

const wordSpacing = useReaderSettingsStore(
  (state) => state.wordSpacing
);

const bold = useReaderSettingsStore(
  (state) => state.bold
);

const backgroundColor = useReaderSettingsStore(
  (state) => state.backgroundColor
);

const textColor =
  useReaderSettingsStore(
    (state) => state.textColor
  );


  const sendReaderSettings = useCallback(() => {
    webViewRef.current?.postMessage(
    JSON.stringify({
      type: 'readerSettings',
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      letterSpacing: letterSpacing,
      wordSpacing: wordSpacing,
      bold: bold,
      backgroundColor: backgroundColor,
      textColor: textColor,
    })
    );
  }, [fontFamily, fontSize, lineHeight, letterSpacing, wordSpacing, bold, backgroundColor, textColor]);

  useEffect(() => {
    sendReaderSettings();
  }, [sendReaderSettings]);
  const handleReaderLoadEnd = useCallback(() => {
    setWebViewReady(true);
    sendReaderSettings();
    syncPageTransition();
  }, [sendReaderSettings, syncPageTransition]);
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

    <html>

      <head>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />

        <style>

          * {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
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
            padding: 20px;
            padding-bottom: 160px;

            color: #1e293b;

            font-family: Arial, sans-serif;

            font-size: 18px;

            line-height: 1.72;

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

          html.reader-paged,
          html.reader-paged body {
            width: 100%;
            height: 100%;
            min-height: 100%;
            overflow: hidden;
            overscroll-behavior: none;
          }

          body.reader-paged {
            padding: 20px;
            padding-bottom: 20px;
          }

          #reader-pages {
            min-height: 100%;
          }

          #reader-pages.reader-paged {
            height: 100%;
            min-height: 0;
            column-width: calc(100vw - 40px);
            column-gap: 40px;
            column-fill: auto;
            transform-style: preserve-3d;
            backface-visibility: hidden;
            will-change: transform, opacity;
          }
          p {
            margin-top: 0;
            margin-bottom: 24px;
          }
          h1 {
            font-size: 1.7em;
            font-weight: inherit;
            line-height: 1.2;
            margin: 0 0 1em;
          }
          h2 {
            font-size: 1.3em;
            font-weight: inherit;
            line-height: 1.3;
            margin: 1.3em 0 0.65em;
          }
          li {
            margin: 0 0 0.65em 1.2em;
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
            margin: 34px -20px 30px;
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
          .tts-word-active {
            background-color: #fde047;
            border-radius: 4px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            padding: 1px 2px;
            margin: 0 -2px;
          }
          .switch-word-highlight {
            background: rgba(250, 204, 21, 0.62);
            border-radius: 3px;
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

        <main id="reader-pages">
          ${readerMarkup}
        </main>


        <script>
  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'appendBlocks') {
        const container = document.getElementById('reader-pages');
        if (!container || !message.html) return;
        const template = document.createElement('template');
        template.innerHTML = message.html;
        Array.from(template.content.children).forEach(function(section) {
          const page = Number(section.dataset.sourcePageSection);
          const next = Array.from(container.children).find(function(candidate) {
            return Number(candidate.dataset.sourcePageSection) > page;
          });
          container.insertBefore(section, next || null);
        });
        if (
          window.__readerTransition !== 'scroll' &&
          window.__refreshReaderPages
        ) {
          requestAnimationFrame(window.__refreshReaderPages);
        }
        window.__tryPendingSourceDestination?.();
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
        if (!target) return;
        window.__pendingSourceDestination = null;
        if (window.__readerTransition === 'scroll') {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else if (window.__goToElementPage) {
          window.__goToElementPage(target);
        }
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
         const targetBlock = readerBlocks.find(function(block) {
           const start = Number(block.dataset.ttsStart);
           const end = Number(block.dataset.ttsEnd);
           return message.charIndex >= start && message.charIndex < end;
         });

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
        const activeWord = words.find(function(word) {
          const start = Number(word.dataset.ttsStart);
          const end = Number(word.dataset.ttsEnd);

          return message.charIndex >= start && message.charIndex < end;
        });

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
              window.scrollTo({
                top:
                  window.scrollY +
                  bounds.top -
                  window.innerHeight * 0.3,
                behavior: 'smooth'
              });
            }
          }
        }
        return;
      }

      if (message.type === 'ttsClearHighlight') {
        document
          .querySelector('.tts-word-active')
          ?.classList.remove('tts-word-active');
        return;
      }
      if (message.type === 'readerSettings') {

        document.body.style.fontFamily =
          message.fontFamily;

        document.body.style.fontSize =
          message.fontSize + 'px';

        document.body.style.lineHeight =
          message.lineHeight;

        document.body.style.letterSpacing =
          message.letterSpacing + 'px';

        document.body.style.wordSpacing =
          message.wordSpacing + 'px';

        document.body.style.fontWeight =
          message.bold ? 'bold' : 'normal';

        document.body.style.backgroundColor =
          message.backgroundColor;

        document.documentElement.style.backgroundColor =
          message.backgroundColor;
        
        document.body.style.color =
          message.textColor;

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'settingsApplied'
        }));

        if (window.__refreshReaderPages) {
          setTimeout(window.__refreshReaderPages, 0);
        }
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
  `, [readerMarkup]);

  const webViewSource = useMemo(() => ({ html: htmlContent }), [htmlContent]);

  // --------------------------------
  // SHOW / HIDE TOOLBAR
  // --------------------------------

  const showToolbar = () => {
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
  };

  const hideToolbar = () => {
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
  };

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
          onPageChange?.(data.sourcePage);
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
        onPageChange?.(data.page);
        return;
      }

      if (data.type === "askAI") {
        setSelectedAIText(typeof data.text === "string" ? data.text.trim() : "");
        setActiveItem("ai");
        bottomSheetRef.current?.open(0);
        return;
      }

      if (data.type === "switchAnchor" && typeof data.blockId === "string") {
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
        return <BackgroundSettings />;

      case "tts":
        return (
          <TTS
            text={readerText}
            onHighlightWord={highlightSpokenWord}
            onClearHighlight={clearSpokenWordHighlight}
          />
        );

      case "ai":
        return <AI selectedText={selectedAIText} />;

      case "settings":
        return <Settings />;

      default:
        return null;
    }

  };

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
          <View className="flex-1" {...pagePanResponder.panHandlers}>
          <WebView
            ref={webViewRef}

          source={webViewSource}

          style={{
            flex: 1,
            backgroundColor,
          }}

          onLoadEnd={handleReaderLoadEnd}

          onContentProcessDidTerminate={() => {
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
              function reportSwitchAnchor() {
                const previous = document.querySelector('.switch-word-highlight');
                if (previous) {
                  const parent = previous.parentNode;
                  previous.replaceWith(document.createTextNode(previous.textContent || ''));
                  parent?.normalize();
                }

                let block = null;
                for (let y = 12; y < window.innerHeight && !block; y += 36) {
                  const hit = document.elementFromPoint(24, y) ||
                    document.elementFromPoint(window.innerWidth / 2, y);
                  block = hit?.closest?.('[data-reader-block]') || null;
                }
                if (!block) return;
                const blockRect = block.getBoundingClientRect();
                const probeX = Math.max(8, Math.min(
                  window.innerWidth - 8,
                  Math.max(0, blockRect.left) + 8
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
                    highlightedWordIndex = (prefix.toString().match(/\\S+/g) || []).length;
                    const range = document.createRange();
                    range.setStart(textNode, match.index);
                    range.setEnd(textNode, match.index + match[0].length);
                    const marker = document.createElement('span');
                    marker.className = 'switch-word-highlight';
                    range.surroundContents(marker);
                    highlightedWord = match[0];
                  }
                }

                const blockId = block.dataset.blockId;
                const anchorKey = blockId + ':' + highlightedWordIndex;
                if (blockId && anchorKey !== lastSwitchAnchorKey) {
                  lastSwitchAnchorKey = anchorKey;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'switchAnchor',
                    blockId: blockId,
                    word: highlightedWord,
                    wordIndex: highlightedWordIndex
                  }));
                }
              }
              window.__reportSwitchAnchor = reportSwitchAnchor;
              requestAnimationFrame(reportSwitchAnchor);

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
                const probeX = window.innerWidth / 2;
                const probeY = window.innerHeight * 0.28;
                let section = document.elementFromPoint(probeX, probeY)
                  ?.closest?.('[data-source-page-section]');
                if (!section) {
                  for (let y = probeY; y >= 8 && !section; y -= 36) {
                    section = document.elementFromPoint(probeX, y)
                      ?.closest?.('[data-source-page-section]');
                  }
                }
                return Number(section?.dataset.sourcePageSection) ||
                  lastReportedSourcePage || 1;
              }

              let lastReportedSourcePage = 0;
              function reportSourcePage() {
                const page = sourcePageAtViewport();
                if (page === lastReportedSourcePage) return page;
                lastReportedSourcePage = page;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'sourcePage',
                  page: page
                }));
                return page;
              }

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

                const direction = nextPage > currentPage ? 1 : -1;
                pageAnimationRunning = true;

                if (window.__readerTransition === 'fade') {
                  pagedContent.style.transition = 'opacity 130ms ease';
                  pagedContent.style.opacity = '0';

                  setTimeout(function() {
                    finishPageChange(nextPage);
                    pagedContent.style.transition = 'opacity 170ms ease';
                    pagedContent.style.opacity = '1';

                    setTimeout(function() {
                      pageAnimationRunning = false;
                    }, 180);
                  }, 135);

                  return;
                }

                pagedContent.style.transformOrigin =
                  direction > 0 ? 'left center' : 'right center';
                pagedContent.style.transition =
                  'transform 150ms ease-in, opacity 150ms ease-in';
                pagedContent.style.transform = pageTransform(
                  currentPage,
                  direction > 0 ? -18 : 18
                );
                pagedContent.style.opacity = '0.4';

                setTimeout(function() {
                  currentPage = nextPage;
                  window.__readerCurrentPage = currentPage;
                  pagedContent.style.transition = 'none';
                  pagedContent.style.transform = pageTransform(
                    currentPage,
                    direction > 0 ? 18 : -18
                  );

                  requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                      pagedContent.style.transition =
                        'transform 190ms ease-out, opacity 190ms ease-out';
                      pagedContent.style.transform = pageTransform(
                        currentPage,
                        0
                      );
                      pagedContent.style.opacity = '1';

                      setTimeout(function() {
                        pageAnimationRunning = false;
                      }, 200);
                    });
                  });
                }, 155);
              }

              function applyReaderTransition(mode, resetPage) {
                window.__readerTransition =
                  mode === 'fade' || mode === 'pageFlip'
                    ? mode
                    : 'scroll';

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
                setTimeout(refreshReaderPages, 50);
              });
              // --------------------------------
              // SCROLL HANDLING
              // --------------------------------

              let scrollTimer = null;

              window.addEventListener(
                'scroll',
                function() {

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
        </SafeAreaView>

        {/* ========================= */}
        {/* ANIMATED READER TOOLBAR */}
        {/* ========================= */}

        {!isLandscape && (
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
        {/* ========================= */}
        {/* BOTTOM SHEET */}
        {/* ========================= */}

        <BottomSheetPortal
          snapPoints={[
            "40%",
            "65%",
          ]}
          backdropComponent={
            BottomSheetBackdrop
          }
        >

          <BottomSheetDragIndicator />

          <BottomSheetContent>

            {renderBottomSheetContent()}

          </BottomSheetContent>

        </BottomSheetPortal>

      </View>

    </BottomSheet>
  );
};

export default ReaderView;
