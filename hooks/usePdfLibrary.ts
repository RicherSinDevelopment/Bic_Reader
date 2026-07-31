import {
  deletePdfRecord,
  getAllPdfs,
  renamePdf as renamePdfRecord,
} from "@/database/pdfRepository";
import type { PdfDocument } from "@/database/types";
import type { PickedPdf } from "@/hooks/useDocumentPicker";
import {
  deleteStoredPdf,
  importPdf as importPickedPdf,
} from "@/services/pdfImportService";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";

export function usePdfLibrary() {
  const db = useSQLiteContext();
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshPdfs = useCallback(async () => {
    try {
      const storedPdfs = await getAllPdfs(db);
      setError(null);
      setPdfs(storedPdfs);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("Failed to load the PDF library."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      const loadTimer = setTimeout(() => {
        void refreshPdfs();
      }, 0);

      return () => clearTimeout(loadTimer);
    }, [refreshPdfs]),
  );

  const importPdf = useCallback(
    async (pickedPdf: PickedPdf) => {
      const result = await importPickedPdf(db, pickedPdf);

      if (result.status === "imported") {
        await refreshPdfs();
      }

      return result;
    },
    [db, refreshPdfs],
  );

  const deletePdf = useCallback(
    async (id: string) => {
      const pdf = pdfs.find((item) => item.id === id);

      if (!pdf) {
        return;
      }

      await deletePdfRecord(db, id);

      try {
        await deleteStoredPdf(pdf.uri);
      } finally {
        await refreshPdfs();
      }
    },
    [db, pdfs, refreshPdfs],
  );

  const renamePdf = useCallback(
    async (id: string, name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return;
      }

      await renamePdfRecord(db, id, trimmedName);
      await refreshPdfs();
    },
    [db, refreshPdfs],
  );

  return {
    pdfs,
    isLoading,
    error,
    refreshPdfs,
    importPdf,
    deletePdf,
    renamePdf,
  };
}
