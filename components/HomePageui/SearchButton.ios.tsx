import PdfCoverCard from "@/components/pdfcardcomponent/createpdfcard";
import {
  BottomSheet,
  BottomSheetBackdrop,
  BottomSheetContent,
  BottomSheetFlatList,
  BottomSheetPortal,
  BottomSheetTextInput,
  type BottomSheetRef,
} from "@/components/ui/bottomsheet";
import { BottomSheetHandle as NativeBottomSheetHandle } from "@gorhom/bottom-sheet";
import { Icon, SearchIcon } from "@/components/ui/icon";
import type { PdfLibraryItem } from "@/hooks/displaypdfs";
import { Button, Host } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  shadow,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SearchButtonProps = {
  pdfs: PdfLibraryItem[];
};

export default function SearchButton({ pdfs }: SearchButtonProps) {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const matchingPdfs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) return pdfs;

    return pdfs.filter((pdf) =>
      pdf.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [pdfs, query]);

  const openSearch = () => {
    void Haptics.selectionAsync();
    bottomSheetRef.current?.open(1);
  };

  return (
    <BottomSheet ref={bottomSheetRef}>
      <Host style={{ width: 40, height: 40 }}>
        <Button
          systemImage="magnifyingglass"
          controlSize="regular"
          onPress={openSearch}
          modifiers={[
            buttonStyle("glass"),
            accessibilityLabel("Search PDFs"),
            shadow({ color: "#173A212E", radius: 9, x: 0, y: 5 }),
            shadow({ color: "#FFFFFF70", radius: 1, x: -1, y: -1 }),
          ]}
        />
      </Host>

      <BottomSheetPortal
        snapPoints={["45%", "90%"]}
        backdropComponent={BottomSheetBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        topInset={insets.top}
        handleComponent={(props) => (
          <NativeBottomSheetHandle
            {...props}
            accessibilityLabel="Resize search panel"
            indicatorStyle={{
              width: 48,
              height: 5,
              borderRadius: 3,
              backgroundColor: isDark ? "#9AA394" : "#686C65",
            }}
            style={{
              height: 34,
              paddingTop: 12,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: isDark ? "#10120F" : "#F7F5EC",
            }}
          />
        )}
        style={{
          overflow: "hidden",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        backgroundStyle={{
          backgroundColor: isDark ? "#10120F" : "#F7F5EC",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
      >
        <BottomSheetContent className="flex-1 bg-[#F7F5EC] px-3 pb-0 pt-3 dark:bg-[#10120F]">
          <View className="relative h-16 w-full justify-center rounded-2xl bg-white shadow-sm dark:bg-[#1A1E18]">
            <View pointerEvents="none" className="absolute left-5 z-10">
              <Icon as={SearchIcon} size="md" className="text-black/40 dark:text-white/50" />
            </View>
            <BottomSheetTextInput
              accessibilityLabel="Search PDF names"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="Search your PDFs"
              placeholderTextColor={isDark ? "#9EA69A" : "#9ca3af"}
              value={query}
              onChangeText={setQuery}
              className="h-full w-full pl-14 pr-5 text-lg text-black dark:text-[#F4F5F1]"
            />
          </View>

          <BottomSheetFlatList
            data={matchingPdfs}
            keyExtractor={(item: PdfLibraryItem) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{
              paddingBottom: 32,
              paddingTop: 16,
              flexGrow: 1,
            }}
            ItemSeparatorComponent={() => <View className="h-3" />}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center pb-24">
                <Text className="font-lato-bold text-base text-black/50 dark:text-white/50">
                  {pdfs.length === 0 ? "No PDFs yet" : "No matching PDFs"}
                </Text>
              </View>
            }
            renderItem={({ item }: { item: PdfLibraryItem }) => (
              <PdfCoverCard
                compact
                pdfPath={item.uri}
                fileName={item.name}
                dateOpened={item.dateOpened}
                completionPercentage={item.completionPercentage}
                onOpen={() => {
                  bottomSheetRef.current?.close();
                  router.push({
                    pathname: "/Reader/[pdfId]",
                    params: { pdfId: item.id },
                  });
                }}
              />
            )}
          />
        </BottomSheetContent>
      </BottomSheetPortal>
    </BottomSheet>
  );
}
