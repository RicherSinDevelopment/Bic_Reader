import AddButton from "@/components/HomePageui/AddFilebutton";
import SearchButton from "@/components/HomePageui/SearchButton";
import SettingsButton from "@/components/HomePageui/settingsbutton";
import SortButton, {
  type PdfSortOption,
} from "@/components/HomePageui/SortBybutton";
import PdfLayoutTabs from "@/components/HomePageui/ViewStyletab";
import PdfLibrary from "@/hooks/displaypdfs";
import type { PickedPdf } from "@/hooks/useDocumentPicker";
import { usePdfLibrary } from "@/hooks/usePdfLibrary";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";


const HomePage = () => {
  const [numColumns, setNumColumns] = useState<1 | 2 | 3>(1);
  const { pdfs, importPdf, deletePdf, renamePdf } = usePdfLibrary();
  const [sortOption, setSortOption] = useState<PdfSortOption>("newest");
  const [duplicatePdfName, setDuplicatePdfName] = useState<string | null>(null);

  const sortedPdfs = useMemo(() => {
    return [...pdfs].sort((firstPdf, secondPdf) => {
      switch (sortOption) {
        case "oldest":
          return Date.parse(firstPdf.dateOpened) - Date.parse(secondPdf.dateOpened);
        case "closest":
          return secondPdf.completionPercentage - firstPdf.completionPercentage;
        case "furthest":
          return firstPdf.completionPercentage - secondPdf.completionPercentage;
        case "newest":
        default:
          return Date.parse(secondPdf.dateOpened) - Date.parse(firstPdf.dateOpened);
      }
    });
  }, [pdfs, sortOption]);

  const handlePdfPicked = async (pdf: PickedPdf) => {
    const result = await importPdf(pdf);

    if (result.status === "duplicate") {
      setDuplicatePdfName(pdf.name);
    }
  };

  const handleDeletePdf = (id: string) => {
    void deletePdf(id);
  };

  const handleRenamePdf = (id: string, name: string) => {
    void renamePdf(id, name);
  };

  return (
<View className="flex-1 bg-[#F7F5EC]">

  {/* ========================= */}
  {/* HEADER */}
  {/* ========================= */}

  <View className="px-6 pt-12 pb-4">

    {/* Title + Top Actions */}
    <View className="flex-row items-center justify-between">

      {/* App Title */}
      <Text
        className="text-black"
        style={{
          fontFamily: "Lato_700Bold",
          fontSize: 38,
          lineHeight: 44,
          letterSpacing: -0.8,
        }}
      >
        <Text style={{ color: "#22C55E" }}>Bic</Text>
        <Text> Reader</Text>
      </Text>

      {/* Search + Settings */}
      <View className="flex-row items-center gap-4">
        <SearchButton pdfs={sortedPdfs} />
        <SettingsButton />
      </View>

    </View>


    {/* ========================= */}
    {/* SORT + VIEW CONTROLS */}
    {/* ========================= */}

    <View className="mt-6 w-full flex-row items-center justify-between gap-3">

      {/* Sort Button */}
      <View className="min-w-0 flex-1 items-start">
        <SortButton value={sortOption} onValueChange={setSortOption} />
      </View>

      {/* Column Layout Tabs */}
      <View className="shrink-0 items-end">
        <PdfLayoutTabs
          onColumnsChange={setNumColumns}
        />
      </View>
    </View>

  </View>


  {/* ========================= */}
  {/* PDF LIBRARY */}
  {/* ========================= */}

  <PdfLibrary
    numColumns={numColumns}
    pdfs={sortedPdfs}
    onDeletePdf={handleDeletePdf}
    onRenamePdf={handleRenamePdf}
  />


  {/* ========================= */}
  {/* ADD PDF BUTTON */}
  {/* ========================= */}

  <View className="absolute bottom-8 left-6 right-6">
    <AddButton onPdfPicked={handlePdfPicked} />
  </View>

  <Modal
    animationType="fade"
    transparent
    visible={duplicatePdfName !== null}
    onRequestClose={() => setDuplicatePdfName(null)}
  >
    <View className="flex-1 items-center justify-center px-6">
      <Pressable
        accessibilityLabel="Close duplicate PDF message"
        className="absolute inset-0 bg-black/40"
        onPress={() => setDuplicatePdfName(null)}
      />

      <View className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
        <Text className="font-lato-bold text-lg text-black">
          PDF already added
        </Text>
        <Text className="mt-2 text-sm leading-5 text-black/60">
          {duplicatePdfName
            ? `\"${duplicatePdfName}\" matches a PDF already in your library.`
            : "This PDF is already in your library."}
        </Text>

        <View className="mt-5 items-end">
          <Pressable
            accessibilityRole="button"
            onPress={() => setDuplicatePdfName(null)}
            className="h-10 justify-center rounded-md bg-green-400 px-5 active:opacity-80"
          >
            <Text className="font-lato-bold text-black">Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>

</View>


  );
};

export default HomePage;
