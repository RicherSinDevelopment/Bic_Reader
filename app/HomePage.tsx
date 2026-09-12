import AddButton from "@/components/HomePageui/AddFilebutton";
import PremiumFeatureModal from "@/components/PremiumFeatureModal";
import SearchButton from "@/components/HomePageui/SearchButton";
import SettingsButton from "@/components/HomePageui/settingsbutton";
import SortButton, {
  type PdfSortOption,
} from "@/components/HomePageui/SortBybutton";
import PdfLayoutTabs from "@/components/HomePageui/ViewStyletab";
import PdfLibrary from "@/hooks/displaypdfs";
import type { PickedPdf } from "@/hooks/useDocumentPicker";
import { usePdfLibrary } from "@/hooks/usePdfLibrary";
import { FREE_PDF_LIMIT } from "@/lib/premiumFeatures";
import { useRevenueCat } from "@/providers/RevenueCatProvider";
import { useAuth } from "@/providers/AuthProvider";
import { authRoute } from "@/lib/authNavigation";
import { addSafeBreadcrumb } from "@/services/errorReporting";
import { useRouter } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";


const HomePage = () => {
  const [numColumns, setNumColumns] = useState<1 | 2 | 3>(() => {
    const saved = Number(Storage.getItemSync("bic.home.layout"));
    return saved === 2 || saved === 3 ? saved : 1;
  });
  const { pdfs, importPdf, deletePdf, renamePdf } = usePdfLibrary();
  const { isPremium } = useRevenueCat();
  const { session } = useAuth();
  const router = useRouter();
  const [sortOption, setSortOption] = useState<PdfSortOption>("newest");
  const [duplicatePdfName, setDuplicatePdfName] = useState<string | null>(null);
  const [showLibraryLimit, setShowLibraryLimit] = useState(false);
  const freePdfUsage = Math.min(pdfs.length, FREE_PDF_LIMIT);
  const isAtFreeLimit = !isPremium && pdfs.length >= FREE_PDF_LIMIT;

  useEffect(() => {
    Storage.setItemSync("bic.home.layout", String(numColumns));
  }, [numColumns]);

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
    if (isAtFreeLimit) {
      setShowLibraryLimit(true);
      return;
    }
    const result = await importPdf(pdf);

    addSafeBreadcrumb("bic.pdf.import", "completed", {
      result: result.status,
    });

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
<View className="flex-1 bg-[#F5F3EA] dark:bg-[#10120F]">

  {/* ========================= */}
  {/* HEADER */}
  {/* ========================= */}

  <View className="px-6 pb-5 pt-14">

    {/* Title + Top Actions */}
    <View className="flex-row items-center justify-between">

      {/* App Title */}
      <Text
        className="text-black dark:text-[#F4F5F1]"
        style={{
          fontFamily: "Lato_700Bold",
          fontSize: 36,
          lineHeight: 42,
          letterSpacing: -1,
        }}
      >
        <Text style={{ color: "#639922" }}>Bic</Text>
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

    <View className="mt-7 w-full flex-row items-center justify-between gap-3">

      {/* Sort Button */}
      <View className="min-w-0 flex-1 items-start">
        <SortButton value={sortOption} onValueChange={setSortOption} />
      </View>

      {/* Column Layout Tabs */}
      <View className="shrink-0 items-end">
        <PdfLayoutTabs
          initialColumns={numColumns}
          onColumnsChange={setNumColumns}
        />
      </View>
    </View>

    {!isPremium ? (
      <View className="mt-5 rounded-[22px] border border-[#E0E4D8] bg-[#FFFDF8] px-5 py-4 dark:border-[#343A31] dark:bg-[#1A1E18]">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-[#485242] dark:text-[#F4F5F1]"
            style={{ fontFamily: "Lato_700Bold", fontSize: 13 }}
          >
            Free library
          </Text>
          <Text style={{ color: "#639922", fontFamily: "Lato_700Bold", fontSize: 13 }}>
            {freePdfUsage} of {FREE_PDF_LIMIT} PDFs
          </Text>
        </View>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#E6E9DE] dark:bg-[#343A31]">
          <View
            className="h-full rounded-full bg-[#639922]"
            style={{ width: `${(freePdfUsage / FREE_PDF_LIMIT) * 100}%` }}
          />
        </View>
        <Text className="mt-2.5 text-xs text-[#71786B] dark:text-white/50">
          {isAtFreeLimit ? "Upgrade to add more PDFs." : `${FREE_PDF_LIMIT - freePdfUsage} free PDF slots remaining.`}
        </Text>
      </View>
    ) : null}

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

  <View className="absolute bottom-7 left-6 right-6">
    <AddButton
      isLocked={isAtFreeLimit}
      onLockedPress={() => setShowLibraryLimit(true)}
      onPdfPicked={handlePdfPicked}
    />
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

      <View className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-[#1A1E18]">
        <Text className="font-lato-bold text-lg text-black dark:text-[#F4F5F1]">
          PDF already added
        </Text>
        <Text className="mt-2 text-sm leading-5 text-black/60 dark:text-white/60">
          {duplicatePdfName
            ? `\"${duplicatePdfName}\" matches a PDF already in your library.`
            : "This PDF is already in your library."}
        </Text>

        <View className="mt-5 items-end">
          <Pressable
            accessibilityRole="button"
            onPress={() => setDuplicatePdfName(null)}
            className="h-10 justify-center rounded-md bg-[#639922] px-5 active:opacity-80"
          >
            <Text className="font-lato-bold text-white">Close</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>

  <PremiumFeatureModal
    description={`The free plan includes up to ${FREE_PDF_LIMIT} PDFs. Upgrade for an unlimited library while keeping everything already added.`}
    featureName="Your free library is full"
    onClose={() => setShowLibraryLimit(false)}
    onSignIn={!session ? () => {
      setShowLibraryLimit(false);
      router.push(authRoute('/(auth)/sign-in', 'premium'));
    } : undefined}
    onUpgrade={() => {
      setShowLibraryLimit(false);
      router.push({ pathname: '/onboarding/premium', params: { source: 'app' } });
    }}
    visible={showLibraryLimit}
  />

</View>


  );
};

export default HomePage;
