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
  PanResponder,
  View,
} from "react-native";

import { useReaderSettingsStore } from '@/stores/readerSettingsStore';
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type ReaderViewProps = {
  isLandscape: boolean;
};

const ReaderView = ({ isLandscape }: ReaderViewProps) => {
  const [activeItem, setActiveItem] =
    useState<ReaderBottomNavItem>("font");
  const [readerText, setReaderText] = useState("");

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

  const htmlContent = `
    <!DOCTYPE html>

    <html>

      <head>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes"
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
          .tts-word-active {
            background-color: #fde047;
            border-radius: 4px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            padding: 1px 2px;
            margin: 0 -2px;
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

        <p>
          The Roman Empire was one of the greatest and most influential civilizations in human history, shaping the political, cultural, legal, military, and architectural foundations of the Western world for centuries. Emerging from the Roman Republic after the rise of Augustus Caesar in 27 BC, the empire expanded to encompass vast territories across Europe, North Africa, and the Middle East, stretching from the Atlantic Ocean to the Euphrates River at its greatest extent. This immense empire united hundreds of different peoples, languages, and cultures under a single government, creating an unprecedented period of stability known as the *Pax Romana*, or "Roman Peace," which lasted for approximately two hundred years. During this era, commerce flourished as an extensive network of paved roads, bridges, ports, and aqueducts connected distant provinces, allowing goods, ideas,
          and people to travel more efficiently than ever before. Roman engineers demonstrated extraordinary skill by constructing monumental structures such as the Colosseum, the Pantheon, and countless amphitheaters, baths, and aqueducts, many of which still stand today as enduring symbols of Roman ingenuity. The empire's military was among the most disciplined and effective fighting forces in history, with highly trained legions that employed advanced tactics, standardized equipment, and exceptional organization to conquer and defend an enormous territory. Beyond military success, Rome profoundly influenced civilization through its legal system, developing principles of justice, citizenship, contracts, and governance that continue to shape modern legal codes around the world. Latin, the language of Rome, became the foundation for the Romance including Italian, French, Spanish, Portuguese, and contributed countless words to English and many other languages. Roman culture also embraced literature, philosophy, art, and education, producing renowned figures such as Virgil, Cicero, Ovid, and Seneca, whose writings remain widely studied today. Although the empire experienced remarkable prosperity, it also faced significant challenges, including political corruption, economic instability, civil wars, invasions by Germanic tribes, and the increasing difficulty 
          of governing such an expansive realm. In AD 395, the empire was permanently divided into the Western and Eastern Roman Empires, with the Western Empire
          ultimately collapsing in AD 476 after the deposition of the last emperor, Romulus Augustulus. The Eastern Roman Empire, later known as the Byzantine Empire, continued to preserve Roman traditions and institutions for nearly another thousand years until the fall of Constantinople in 1453. Despite its eventual decline, the legacy of the Roman Empire has endured through its contributions to law, government, military organization, architecture, engineering, language, religion, and culture, making it one of the most transformative civilizations in world history. Its influence can still be seen in modern democratic institutions, legal systems, city planning, engineering practices, and countless aspects of contemporary society, demonstrating that the achievements of ancient Rome continue to shape the world more than two millennia after its rise.

        </p>

        <script>
  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'pageNavigate') {
        if (window.__navigateReaderPage) {
          window.__navigateReaderPage(message.direction);
        }
        return;
      }
      if (message.type === 'pageTransition') {
        if (window.__applyReaderTransition) {
          window.__applyReaderTransition(message.transition, true);
        }
        return;
      }
      if (message.type === 'ttsHighlight') {
        const words = Array.from(
          document.querySelectorAll('[data-tts-start]')
        );
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
</script>
      </body>

    </html>
  `;

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
        return <AI />;

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

          source={{
            html: htmlContent,
          }}

          style={{
            flex: 1,
            backgroundColor,
          }}

          onLoadEnd={handleReaderLoadEnd}

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
                document.querySelectorAll('p')
              );
              const paragraphTexts = paragraphs.map(function(paragraph) {
                return (paragraph.textContent || '').trim();
              });
              const readerText = paragraphTexts.join('\\n\\n');

              const readerPages = document.createElement('main');
              readerPages.id = 'reader-pages';

              if (paragraphs.length > 0) {
                paragraphs[0].parentNode.insertBefore(
                  readerPages,
                  paragraphs[0]
                );
                paragraphs.forEach(function(paragraph) {
                  readerPages.appendChild(paragraph);
                });
              }

              let globalOffset = 0;

              paragraphs.forEach(function(paragraph, paragraphIndex) {
                const paragraphText = paragraphTexts[paragraphIndex];
                const fragment = document.createDocumentFragment();
                const wordPattern = /\\S+/g;
                let cursor = 0;
                let match;

                while ((match = wordPattern.exec(paragraphText)) !== null) {
                  if (match.index > cursor) {
                    fragment.appendChild(
                      document.createTextNode(
                        paragraphText.slice(cursor, match.index)
                      )
                    );
                  }

                  const word = document.createElement('span');
                  word.textContent = match[0];
                  word.dataset.ttsStart = String(
                    globalOffset + match.index
                  );
                  word.dataset.ttsEnd = String(
                    globalOffset + match.index + match[0].length
                  );
                  fragment.appendChild(word);
                  cursor = match.index + match[0].length;
                }

                if (cursor < paragraphText.length) {
                  fragment.appendChild(
                    document.createTextNode(paragraphText.slice(cursor))
                  );
                }

                paragraph.replaceChildren(fragment);
                globalOffset += paragraphText.length + 2;
              });

              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  type: 'readerText',
                  text: readerText
                })
              );

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
              }

              function finishPageChange(targetPage) {
                currentPage = targetPage;
                window.__readerCurrentPage = currentPage;
                pagedContent.style.transform = pageTransform(
                  currentPage,
                  0
                );
              }

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

              let ticking = false;

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
                  if (!ticking) {

                    window.requestAnimationFrame(
                      function() {

                        window.ReactNativeWebView.postMessage(
                          JSON.stringify({
                            type: 'scroll',
                            scrollY: window.scrollY
                          })
                        );

                        ticking = false;

                      }
                    );

                    ticking = true;
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
