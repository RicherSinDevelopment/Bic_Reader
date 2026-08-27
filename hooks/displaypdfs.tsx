import PdfCoverCard from "@/components/pdfcardcomponent/createpdfcard";
import type { PdfDocument } from "@/database/types";
import { useRouter } from "expo-router";
import { memo, useCallback } from "react";
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

interface PdfLibraryRowProps {
  item: PdfLibraryItem;
  cardWidth: number;
  isListView: boolean;
  onDeletePdf: (id: string) => void;
  onRenamePdf: (id: string, name: string) => void;
}

const PdfLibraryRow = memo(function PdfLibraryRow({
  item,
  cardWidth,
  isListView,
  onDeletePdf,
  onRenamePdf,
}: PdfLibraryRowProps) {
  const router = useRouter();
  const openPdf = useCallback(() => {
    router.push({ pathname: "/Reader/[pdfId]", params: { pdfId: item.id } });
  }, [item.id, router]);
  const deletePdf = useCallback(() => onDeletePdf(item.id), [item.id, onDeletePdf]);
  const renamePdf = useCallback((name: string) => onRenamePdf(item.id, name), [item.id, onRenamePdf]);

  return (
    <View style={{ width: cardWidth, marginBottom: isListView ? 14 : 0 }}>
      <PdfCoverCard
        pdfPath={item.uri}
        fileName={item.name}
        width={cardWidth}
        list={isListView}
        dateOpened={item.dateOpened}
        completionPercentage={item.completionPercentage}
        onDelete={deletePdf}
        onRename={renamePdf}
        onOpen={openPdf}
      />
    </View>
  );
});

// ========================================
// PDF LIBRARY
// ========================================

export default function PdfLibrary({
  numColumns,
  pdfs,
  onDeletePdf,
  onRenamePdf,
}: PdfLibraryProps) {
  // ========================================
  // CUSTOMIZE SPACING
  // ========================================

  // Space between PDF cards
  const gap = 14;

  // Space between screen edges and cards
  const horizontalPadding = 22;

  const { width: screenWidth } = useWindowDimensions();
  const isListView = numColumns === 3;
  const effectiveColumns = isListView ? 1 : numColumns;

  // ========================================
  // CALCULATE CARD WIDTH
  // ========================================

  const availableWidth =
    screenWidth -
    horizontalPadding * 2 -
    gap * (effectiveColumns - 1);

  const cardWidth = availableWidth / effectiveColumns;

  // ========================================
  // RENDER
  // ========================================

  return (
    <View className="flex-1 bg-[#F7F5EC] dark:bg-[#10120F]">
      <FlatList
        data={pdfs}
        keyExtractor={(item) => item.id}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        updateCellsBatchingPeriod={50}

        // Number of columns comes from HomePage
        numColumns={effectiveColumns}

        // Forces FlatList to rebuild when switching
        // between 1, 2, and 3 columns
        key={isListView ? "layout-list" : `columns-${numColumns}`}

        // Overall spacing around the grid
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: 8,
          paddingBottom: 112,
          flexGrow: 1,
        }}

        // Spacing between columns and rows
        columnWrapperStyle={
          effectiveColumns > 1
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
          <PdfLibraryRow
            item={item}
            cardWidth={cardWidth}
            isListView={isListView}
            onDeletePdf={onDeletePdf}
            onRenamePdf={onRenamePdf}
          />
        )}
      />
    </View>
  );
}
