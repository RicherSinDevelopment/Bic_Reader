import * as DocumentPicker from "expo-document-picker";
import {
  addSafeBreadcrumb,
  captureHandledError,
} from "@/services/errorReporting";

export type PickedPdf = {
  name: string;
  uri: string;
  size?: number;
  mimeType?: string;
};

export function useDocumentPicker() {

  const pickPdf = async (): Promise<PickedPdf | null> => {
    addSafeBreadcrumb("bic.pdf.import", "picker-opened");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        addSafeBreadcrumb("bic.pdf.import", "picker-cancelled");
        return null;
      }

      const pdf = result.assets[0];
      const size = pdf.size ?? 0;
      addSafeBreadcrumb("bic.pdf.import", "picker-selected", {
        sizeBucket: size < 5_000_000
          ? "under-5mb"
          : size < 25_000_000
            ? "5-25mb"
            : "over-25mb",
      });

      return {
        name: pdf.name,
        uri: pdf.uri,
        size: pdf.size,
        mimeType: pdf.mimeType,
      };

    } catch (error) {
      captureHandledError(error, "pdf.import.picker");
      console.error("Error picking PDF:", error);
      return null;
    }
  };

  return {
    pickPdf,
  };
}
