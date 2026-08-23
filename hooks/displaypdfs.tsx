import PdfCoverCard from "@/components/pdfcardcomponent/createpdfcard";
import type { PdfDocument } from "@/database/types";
import { useRouter } from "expo-router";
import {
  FlatList,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

// ========================================
// PROPS
// ========================================

export type PdfLibraryItem = PdfDocument;

interface PdfLibraryProps {
  numColumns: 1 | 2 | 3;
  pdfs: PdfLibraryItem[];
  onDeletePdf: (id: string) => void;
  onRenamePdf: (id: string, name: string) => void;
}

// ========================================
// PDF LIBRARY
// ========================================

export default function PdfLibrary({
  numColumns,
  pdfs,
  onDeletePdf,
  onRenamePdf,
}: PdfLibraryProps) {
  const router = useRouter();

  // ========================================
  // CUSTOMIZE SPACING
  // ========================================

  // Space between PDF cards
  const gap = 16;

  // Space between screen edges and cards
  const horizontalPadding = 20;

  const { width: screenWidth } = useWindowDimensions();

  // ========================================
  // CALCULATE CARD WIDTH
  // ========================================

  const availableWidth =
    screenWidth -
    horizontalPadding * 2 -
    gap * (numColumns - 1);

  const cardWidth = availableWidth / numColumns;

  // ========================================
  // RENDER
  // ========================================

  return (
    <View className="flex-1 bg-[#F7F5EC] dark:bg-[#10120F]">
      <FlatList
        data={pdfs}
        keyExtractor={(item) => item.id}

        // Number of columns comes from HomePage
        numColumns={numColumns}

        // Forces FlatList to rebuild when switching
        // between 1, 2, and 3 columns
        key={`columns-${numColumns}`}

        // Overall spacing around the grid
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: 20,
          paddingBottom: 100,
          flexGrow: 1,
        }}

        // Spacing between columns and rows
        columnWrapperStyle={
          numColumns > 1
            ? {
                gap: gap,
                marginBottom: gap,
              }
            : undefined
        }

        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pb-20">
            <Text className="font-lato-bold text-base text-black/50 dark:text-white/50">
              No PDFs yet
            </Text>
          </View>
        }

        // Render each PDF
        renderItem={({ item }) => (
          <View
            style={{
              width: cardWidth,
              marginBottom: numColumns === 1 ? gap : 0,
            }}
          >
            <PdfCoverCard
              pdfPath={item.uri}
              fileName={item.name}
              width={cardWidth}
              dateOpened={item.dateOpened}
              completionPercentage={item.completionPercentage}
              onDelete={() => onDeletePdf(item.id)}
              onRename={(name) => onRenamePdf(item.id, name)}
              onOpen={() =>
                router.push({
                  pathname: "/Reader/[pdfId]",
                  params: { pdfId: item.id },
                })
              }
            />
          </View>
        )}
      />
    </View>
  );
}
