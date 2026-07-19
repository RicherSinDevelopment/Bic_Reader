import * as DocumentPicker from "expo-document-picker";

export function useDocumentPicker() {

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return null;
      }

      const pdf = result.assets[0];

      return {
        name: pdf.name,
        uri: pdf.uri,
        size: pdf.size,
        mimeType: pdf.mimeType,
      };

    } catch (error) {
      console.error("Error picking PDF:", error);
      return null;
    }
  };

  return {
    pickPdf,
  };
}