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

import React, { useRef, useState } from "react";
import {
  Animated,
  View,
} from "react-native";

import { WebView } from "react-native-webview";

const ReaderView = () => {
  const [activeItem, setActiveItem] =
    useState<ReaderBottomNavItem>("font");

  // Bottom Sheet reference
  const bottomSheetRef =
    useRef<BottomSheetRef>(null);

  // WebView reference
  const webViewRef =
    useRef<WebView>(null);

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
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Sed do eiusmod tempor incididunt ut labore et dolore magna
          aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </p>

        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit
          esse cillum dolore eu fugiat nulla pariatur.
        </p>

        <p>
          Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </p>

        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Integer nec odio. Praesent libero. Sed cursus ante dapibus
          diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.
        </p>

        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Sed do eiusmod tempor incididunt ut labore et dolore magna
          aliqua.
        </p>

        <p>
          Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </p>

        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Integer nec odio. Praesent libero. Sed cursus ante dapibus
          diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.
        </p>

        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Sed do eiusmod tempor incididunt ut labore et dolore magna
          aliqua.
        </p>

        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit
          esse cillum dolore eu fugiat nulla pariatur.
        </p>

        <p>
          Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </p>

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
        return <TTS />;

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

        <WebView
          ref={webViewRef}

          source={{
            html: htmlContent,
          }}

          style={{
            flex: 1,
            backgroundColor: "#f8fafc",
          }}

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

        {/* ========================= */}
        {/* ANIMATED READER TOOLBAR */}
        {/* ========================= */}

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
            activeItem={
              activeItem
            }
            onSelectItem={
              handleToolbarPress
            }
          />

        </Animated.View>

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