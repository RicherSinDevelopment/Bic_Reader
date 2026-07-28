import AddButton from "@/components/HomePageui/AddFilebutton";
import SearchButton from "@/components/HomePageui/SearchButton";
import SettingsButton from "@/components/HomePageui/settingsbutton";
import SortButton, {
  type PdfSortOption,
} from "@/components/HomePageui/SortBybutton";
import PdfLayoutTabs from "@/components/HomePageui/ViewStyletab";
import PdfLibrary, { type PdfLibraryItem } from "@/hooks/displaypdfs";
import type { PickedPdf } from "@/hooks/useDocumentPicker";
import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";

const HomePage = () => {
  const [numColumns, setNumColumns] = useState<1 | 2 | 3>(1);
  const [pdfs, setPdfs] = useState<PdfLibraryItem[]>([]);
  const [sortOption, setSortOption] = useState<PdfSortOption>("newest");

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

  const handlePdfPicked = (pdf: PickedPdf) => {
    const addedAt = new Date().toISOString();

    setPdfs((currentPdfs) => [
      {
        ...pdf,
        id: `${Date.now()}-${pdf.name}`,
        dateOpened: addedAt,
        completionPercentage: 0,
      },
      ...currentPdfs,
    ]);
  };

  const handleDeletePdf = (id: string) => {
    setPdfs((currentPdfs) => currentPdfs.filter((pdf) => pdf.id !== id));
  };

  const handleRenamePdf = (id: string, name: string) => {
    setPdfs((currentPdfs) =>
      currentPdfs.map((pdf) => (pdf.id === id ? { ...pdf, name } : pdf))
    );
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
      <Text className="text-3xl font-lato-bold text-black">
        Bic Reader
      </Text>

      {/* Search + Settings */}
      <View className="flex-row items-center gap-3">
        <SearchButton />
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

</View>


  );
};

export default HomePage;
