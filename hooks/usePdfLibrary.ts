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
import { useCloudSync } from "@/providers/CloudSyncProvider";
import { useCallback, useEffect, useState } from "react";

export function usePdfLibrary() {
  const db = useSQLiteContext();
  const { revision: cloudRevision, syncNow } = useCloudSync();
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

  useEffect(() => {
    if (cloudRevision > 0) void refreshPdfs();
  }, [cloudRevision, refreshPdfs]);

  const importPdf = useCallback(
    async (pickedPdf: PickedPdf) => {
      const result = await importPickedPdf(db, pickedPdf);

      if (result.status === "imported") {
        await refreshPdfs();
        void syncNow();
      }

      return result;
    },
    [db, refreshPdfs, syncNow],
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
        void syncNow();
      }
    },
    [db, pdfs, refreshPdfs, syncNow],
  );

  const renamePdf = useCallback(
    async (id: string, name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return;
      }

      await renamePdfRecord(db, id, trimmedName);
      await refreshPdfs();
      void syncNow();
    },
    [db, refreshPdfs, syncNow],
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
