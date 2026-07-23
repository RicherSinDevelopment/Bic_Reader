
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
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";

const ReaderView = () => {
  const [activeItem, setActiveItem] =
    useState<ReaderBottomNavItem>("font");

  // Bottom Sheet reference
  const bottomSheetRef =
    useRef<BottomSheetRef>(null);

  // Toolbar animation
  const toolbarTranslateY =
    useRef(new Animated.Value(0)).current;

  // Previous scroll position
  const lastScrollY = useRef(0);

  // Track toolbar visibility
  const toolbarHidden =
    useRef(false);

  // -----------------------------
  // SCROLL / TOOLBAR ANIMATION
  // -----------------------------

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const currentScrollY =
      event.nativeEvent.contentOffset.y;

    const difference =
      currentScrollY -
      lastScrollY.current;

    // Ignore tiny movements
    if (Math.abs(difference) < 5) {
      return;
    }

    // Scrolling DOWN
    if (
      difference > 0 &&
      currentScrollY > 20
    ) {
      if (!toolbarHidden.current) {
        toolbarHidden.current = true;

        Animated.timing(
          toolbarTranslateY,
          {
            toValue: 120,
            duration: 250,
            useNativeDriver: true,
          }
        ).start();
      }
    }

    // Scrolling UP
    else if (difference < 0) {
      if (toolbarHidden.current) {
        toolbarHidden.current = false;

        Animated.timing(
          toolbarTranslateY,
          {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }
        ).start();
      }
    }

    lastScrollY.current =
      currentScrollY;
  };

  // -----------------------------
  // TOOLBAR BUTTON
  // -----------------------------

  const handleToolbarPress = (
    item: ReaderBottomNavItem
  ) => {
    // First change the active icon
    setActiveItem(item);

    // Then open the Bottom Sheet
    // If it is already open, this simply
    // keeps it open and changes the content.
    bottomSheetRef.current?.open(0);
  };

  // -----------------------------
  // BOTTOM SHEET CONTENT
  // -----------------------------

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
        {/* BOOK CONTENT */}
        {/* ========================= */}

        <ScrollView
          className="flex-1 rounded-xl bg-slate-50"
          showsVerticalScrollIndicator={true}
          bounces={true}
          overScrollMode="always"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 140,
          }}
        >
          <Text
            selectable={true}
            style={{
              fontFamily: "Arial",
              fontSize: 18,
              lineHeight: 31,
              color: "#1e293b",
            }}
          >
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Sed do eiusmod tempor incididunt ut labore et dolore magna
            aliqua. Ut enim ad minim veniam, quis nostrud exercitation
            ullamco laboris nisi ut aliquip ex ea commodo consequat.

            {"\n\n"}

            Duis aute irure dolor in reprehenderit in voluptate velit
            esse cillum dolore eu fugiat nulla pariatur.

            {"\n\n"}

            Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.

            {"\n\n"}

            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Integer nec odio. Praesent libero. Sed cursus ante dapibus
            diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.

            {"\n\n"}

            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Sed do eiusmod tempor incididunt ut labore et dolore magna
            aliqua.

            {"\n\n"}

            Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.

            {"\n\n"}

            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Integer nec odio. Praesent libero. Sed cursus ante dapibus
            diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.
          </Text>
        </ScrollView>

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
            activeItem={activeItem}
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
            "75%",
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

