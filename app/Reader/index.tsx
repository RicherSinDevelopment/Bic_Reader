import BackButton from "@/components/Backbutton";
import OriginalPDF from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
import ThreeLinesButton from "@/components/threelinesbutton";
import { Box } from "@/components/ui/box";
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsTrigger,
  TabsTriggerText,
} from "@/components/ui/tabs";
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from "react";
import { View } from "react-native";
import PagerView from "react-native-pager-view";
export default function ReaderScreen() {
  const pagerRef = useRef<PagerView>(null);
  
  const [activeTab, setActiveTab] = useState("reader");

  // Reader = page 0
  // Original = page 1
  const handleTabChange = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(value);

    if (value === "reader") {
      pagerRef.current?.setPage(0);
    }

    if (value === "original") {
      pagerRef.current?.setPage(1);
    }
  };

  const handlePageChange = (position: number) => {
    if (position === 0) {
      setActiveTab("reader");
    }

    if (position === 1) {
      setActiveTab("original");
    }
  };

  return (
    <Box className="flex-1 pt-12">
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        variant="filled"
        className="w-full"
      >
    
        {/* Center the tab buttons */}
        <Box className="relative w-full items-center">

          <Box className="absolute left-2 top-1/2 -translate-y-1/2">
          <BackButton />
          </Box>
          <Box className="absolute right-2 top-1/2 -translate-y-1/2">
          <ThreeLinesButton></ThreeLinesButton>
          </Box>
          <TabsList className="p-2 rounded-xl">

            <TabsTrigger value="reader" className="px-6 py-3">
              <TabsTriggerText >
                Reader
              </TabsTriggerText>
            </TabsTrigger>

            <TabsTrigger value="original" className="px-6 py-3">
              <TabsTriggerText>
                Original
              </TabsTriggerText>
            </TabsTrigger>

            <TabsIndicator />

          </TabsList>

        </Box>

      </Tabs>


      {/* Sliding pages */}
      <View className="flex-1 mt-4">

        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          scrollEnabled={false} // this is the part the desables the swiping gesture so in the feature i can turn this off or based on user input
          overScrollMode="never"
          onPageSelected={(event) => {
            handlePageChange(
              event.nativeEvent.position
            );
          }}
        >

          {/* Page 0 - Reader */}
          <View
            key="reader"
            className="flex-1"
          >
            <ReaderView />
          </View>


          {/* Page 1 - Original */}
          <View
            key="original"
            className="flex-1"
          >
            <OriginalPDF />
          </View>

        </PagerView>

      </View>

    </Box>
  );
}