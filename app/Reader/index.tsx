import OriginalPDF from "@/components/OriginalPDF";
import ReaderView from "@/components/ReaderView";
import { Box } from "@/components/ui/box";
import {
  Tabs,
  TabsContent,
  TabsContentWrapper,
  TabsIndicator,
  TabsList,
  TabsTrigger,
  TabsTriggerText
} from "@/components/ui/tabs";
import React from "react";

export default function ReaderScreen() {
  return (
     <Box className="flex-1 pt-12 px-4">

      <Tabs
        defaultValue="reader"
        variant="filled"
        className="flex-1"
      >

        <TabsList>

          <TabsTrigger value="reader">
            <TabsTriggerText>
              Reader
            </TabsTriggerText>
          </TabsTrigger>

          <TabsTrigger value="original">
            <TabsTriggerText>
              Original
            </TabsTriggerText>
          </TabsTrigger>

          {/* Animated filled background */}
          <TabsIndicator />

        </TabsList>

        <TabsContentWrapper className="flex-1">

          <TabsContent value="reader" className="flex-1">
            <ReaderView />
          </TabsContent>

          <TabsContent value="original" className="flex-1">
            <OriginalPDF />
          </TabsContent>

        </TabsContentWrapper>

      </Tabs>

    </Box>
  );
}