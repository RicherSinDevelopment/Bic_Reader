import PdfCoverCard from "@/components/pdfcardcomponent/createpdfcardexpocom";
import { Asset } from "expo-asset";
import { useEffect, useState } from "react";
import { View } from "react-native";

export default function HomeScreen() {
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  useEffect(() => {
    Asset.fromModule(require("@/components/pdfcardcomponent/1984.pdf"))
      .downloadAsync()
      .then((asset) => setPdfUri(asset.localUri ?? asset.uri));
  }, []);

  if (!pdfUri) return null; // or a loading spinner

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F7F5EC" }}>
      <PdfCoverCard
        pdfPath={pdfUri}
        dateOpened={new Date()}
        completionPercentage={20}
      />
    </View>
  );
}