
import PdfCoverCard from "@/components/pdfcardcomponent/createpdfcardexpocom";
import { Asset } from "expo-asset";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  View,
  useWindowDimensions,
} from "react-native";

export default function PdfLibrary() {
  // ========================================
  // CUSTOMIZE YOUR PDF GRID HERE
  // ========================================

  // Number of columns
  // 1 = list
  // 2 = two-column grid
  // 3 = three-column grid
  const numColumns = 1;

  // Space between PDF cards
  const gap = 16;

  // Space between the screen edges and the cards
  const horizontalPadding = 20;

  // Number of duplicate cards for testing
  const numberOfCards = 6;

  // ========================================

  const { width: screenWidth } = useWindowDimensions();

  const [pdfUri, setPdfUri] = useState<string | null>(null);

  // Load your PDF
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const asset = await Asset.fromModule(
          require("@/components/pdfcardcomponent/1984.pdf")
        ).downloadAsync();

        setPdfUri(asset.localUri ?? asset.uri);
      } catch (error) {
        console.error("Failed to load PDF:", error);
      }
    };

    loadPdf();
  }, []);

  // ========================================
  // CALCULATE CARD WIDTH
  // ========================================

  const availableWidth =
    screenWidth -
    horizontalPadding * 2 -
    gap * (numColumns - 1);

  const cardWidth = availableWidth / numColumns;

  // ========================================
  // CREATE TEST PDF DATA
  // ========================================

  // These IDs are only for FlatList.
  // They are NOT your actual PDF IDs.
  const pdfCards = Array.from(
    { length: numberOfCards },
    (_, index) => ({
      id: `test-pdf-${index}`,
    })
  );

  // ========================================
  // LOADING STATE
  // ========================================

  if (!pdfUri) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F5EC]">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <View className="flex-1 bg-[#F7F5EC]">
      <FlatList
        data={pdfCards}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}

        // This forces FlatList to properly rebuild
        // when switching between 1, 2, or 3 columns.
        key={`columns-${numColumns}`}

        // Overall spacing around the grid
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: 20,
          paddingBottom: 40,
        }}

        // Controls spacing between columns and rows
        columnWrapperStyle={
          numColumns > 1
            ? {
                gap: gap,
                marginBottom: gap,
              }
            : undefined
        }

        // Render each PDF
        renderItem={() => (
          <View
            style={{
              width: cardWidth,
            }}
          >
            <PdfCoverCard
              pdfPath={pdfUri}
              width={cardWidth}
              dateOpened={new Date()}
              completionPercentage={20}
            />
          </View>
        )}
      />
    </View>
  );
}
