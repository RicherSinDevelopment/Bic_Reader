import AddButton from "@/components/HomePageui/AddFilebutton";
import SearchButton from "@/components/HomePageui/SearchButton";
import SettingsButton from "@/components/HomePageui/settingsbutton";
import SortButton from "@/components/HomePageui/SortBybutton";
import PdfLayoutTabs from "@/components/HomePageui/ViewStyletab";
import PdfLibrary from "@/hooks/displaypdfs";
import React, { useState } from "react";
import { Text, View } from "react-native";

const HomePage = () => {
  const [numColumns, setNumColumns] = useState<1 | 2 | 3>(1);

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

    <View className="flex-row w-full items-center justify-between mt-6 gap-40">

      {/* Sort Button */}
      <View className="flex-1 items-start">
        < SortButton />
      </View>

      {/* Column Layout Tabs */}
      <View className="flex-1 items-end">
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
  />


  {/* ========================= */}
  {/* ADD PDF BUTTON */}
  {/* ========================= */}

  <View className="absolute bottom-8 left-6 right-6"> 
    <AddButton /> 
  </View>

</View>


  );
};

export default HomePage;