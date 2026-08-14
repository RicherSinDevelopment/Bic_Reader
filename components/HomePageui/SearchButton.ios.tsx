import PdfCoverCard from "@/components/pdfcardcomponent/createpdfcard";
import {
  BottomSheet,
  BottomSheetBackdrop,
  BottomSheetContent,
  BottomSheetDragIndicator,
  BottomSheetFlatList,
  BottomSheetPortal,
  BottomSheetTextInput,
  type BottomSheetRef,
} from "@/components/ui/bottomsheet";
import { Icon, SearchIcon } from "@/components/ui/icon";
import type { PdfLibraryItem } from "@/hooks/displaypdfs";
import { Button, Host } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  labelStyle,
  shadow,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SearchButtonProps = {
  pdfs: PdfLibraryItem[];
};

export default function SearchButton({ pdfs }: SearchButtonProps) {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();

  const matchingPdfs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) return pdfs;

    return pdfs.filter((pdf) =>
      pdf.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [pdfs, query]);

  const openSearch = () => {
    void Haptics.selectionAsync();
    bottomSheetRef.current?.open(0);
  };

  return (
    <BottomSheet ref={bottomSheetRef}>
      <Host style={{ width: 40, height: 40 }}>
        <Button
          label="Search PDFs"
          systemImage="magnifyingglass"
          onPress={openSearch}
          modifiers={[
            buttonStyle("glass"),
            controlSize("regular"),
            labelStyle("iconOnly"),
            shadow({ color: "#173A212E", radius: 9, x: 0, y: 5 }),
            shadow({ color: "#FFFFFF70", radius: 1, x: -1, y: -1 }),
          ]}
        />
      </Host>

      <BottomSheetPortal
        snapPoints={["90%"]}
        backdropComponent={BottomSheetBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        topInset={insets.top}
        backgroundStyle={{ backgroundColor: "#F7F5EC" }}
      >
        <BottomSheetDragIndicator />
        <BottomSheetContent className="flex-1 bg-[#F7F5EC] px-3 pb-0 pt-3">
          <View className="relative h-16 w-full justify-center rounded-2xl bg-white shadow-sm">
            <View pointerEvents="none" className="absolute left-5 z-10">
              <Icon as={SearchIcon} size="md" className="text-black/40" />
            </View>
            <BottomSheetTextInput
              accessibilityLabel="Search PDF names"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="Search your PDFs"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              className="h-full w-full pl-14 pr-5 text-lg text-black"
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
                <Text className="font-lato-bold text-base text-black/50">
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
