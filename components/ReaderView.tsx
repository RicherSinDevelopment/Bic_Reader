import ReaderToolbar, {
  ReaderBottomNavItem,
} from "@/components/Readertoolbar";

import AI from "@/components/readernavbar/AI";
import BackgroundSettings from "@/components/readernavbar/BackgroundSettings";
import FontSettings from "@/components/readernavbar/FontSettings";
import Settings from "@/components/readernavbar/Settings";
import TTS from "@/components/readernavbar/TTS";
import {
  BottomSheet,
  BottomSheetBackdrop,
  BottomSheetContent,
  BottomSheetDragIndicator,
  BottomSheetPortal,
  type BottomSheetRef,
} from "@/components/ui/bottomsheet";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
  // Toolbar animation
  const toolbarTranslateY =
    useRef(new Animated.Value(0)).current;

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

          p {
            margin-top: 0;
            margin-bottom: 24px;
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
          The Roman Empire was one of the greatest and most influential civilizations in human history, shaping the political, cultural, legal, military, and architectural foundations of the Western world for centuries. Emerging from the Roman Republic after the rise of Augustus Caesar in 27 BC, the empire expanded to encompass vast territories across Europe, North Africa, and the Middle East, stretching from the Atlantic Ocean to the Euphrates River at its greatest extent. This immense empire united hundreds of different peoples, languages, and cultures under a single government, creating an unprecedented period of stability known as the *Pax Romana*, or "Roman Peace," which lasted for approximately two hundred years. During this era, commerce flourished as an extensive network of paved roads, bridges, ports, and aqueducts connected distant provinces, allowing goods, ideas, and people to travel more efficiently than ever before. Roman engineers demonstrated extraordinary skill by constructing monumental structures such as the Colosseum, the Pantheon, and countless amphitheaters, baths, and aqueducts, many of which still stand today as enduring symbols of Roman ingenuity. The empire's military was among the most disciplined and effective fighting forces in history, with highly trained legions that employed advanced tactics, standardized equipment, and exceptional organization to conquer and defend an enormous territory. Beyond military success, Rome profoundly influenced civilization through its legal system, developing principles of justice, citizenship, contracts, and governance that continue to shape modern legal codes around the world. Latin, the language of Rome, became the foundation for the Romance languagesâ€”including Italian, French, Spanish, Portuguese, and Romanianâ€”and contributed countless words to English and many other languages. Roman culture also embraced literature, philosophy, art, and education, producing renowned figures such as Virgil, Cicero, Ovid, and Seneca, whose writings remain widely studied today. Although the empire experienced remarkable prosperity, it also faced significant challenges, including political corruption, economic instability, civil wars, invasions by Germanic tribes, and the increasing difficulty of governing such an expansive realm. In AD 395, the empire was permanently divided into the Western and Eastern Roman Empires, with the Western Empire ultimately collapsing in AD 476 after the deposition of the last emperor, Romulus Augustulus. The Eastern Roman Empire, later known as the Byzantine Empire, continued to preserve Roman traditions and institutions for nearly another thousand years until the fall of Constantinople in 1453. Despite its eventual decline, the legacy of the Roman Empire has endured through its contributions to law, government, military organization, architecture, engineering, language, religion, and culture, making it one of the most transformative civilizations in world history. Its influence can still be seen in modern democratic institutions, legal systems, city planning, engineering practices, and countless aspects of contemporary society, demonstrating that the achievements of ancient Rome continue to shape the world more than two millennia after its rise.

        </p>

        <script>
  function handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

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
        return <TTS text={readerText} />;

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
          <WebView
            ref={webViewRef}

          source={{
            html: htmlContent,
          }}

          style={{
            flex: 1,
            backgroundColor,
          }}

          onLoadEnd={sendReaderSettings}

          /*
           * Native scrolling.
           */
          scrollEnabled={true}

          /*
           * Native bounce behavior.
           */
          bounces={true}

          /*
           * Smooth iOS scrolling.
           */
          decelerationRate="normal"

          /*
           * Android overscroll.
           */
          overScrollMode="always"

          showsVerticalScrollIndicator={true}

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

              const readerText = Array.from(
                document.querySelectorAll('p')
              )
                .map(function(paragraph) {
                  return paragraph.textContent || '';
                })
                .join('\\n\\n')
                .trim();

              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  type: 'readerText',
                  text: readerText
                })
              );

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
