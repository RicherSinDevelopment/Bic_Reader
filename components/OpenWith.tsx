import type { PickedPdf } from "@/hooks/useDocumentPicker";
import {
  clearIncomingPdfUrl,
  claimIncomingPdfUrl,
  getIncomingPdf,
  markIncomingPdfHandled,
  releaseIncomingPdfUrl,
  subscribeToIncomingPdf,
  wasIncomingPdfHandled,
} from "@/services/incomingPdfService";
import { useRouter } from "expo-router";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  addSafeBreadcrumb,
  captureHandledError,
} from "@/services/errorReporting";

type OpenWithProps = {
  onPdfReceived: (pdf: PickedPdf) => Promise<string | null>;
};

function getPdfName(url: string) {
  try {
    const pathWithoutQuery = url.split(/[?#]/, 1)[0];
    const encodedName = pathWithoutQuery.split("/").pop();

    if (!encodedName) {
      return "Imported PDF.pdf";
    }

    const decodedName = decodeURIComponent(encodedName);
    return decodedName.toLowerCase().endsWith(".pdf")
      ? decodedName
      : `${decodedName}.pdf`;
  } catch {
    return "Imported PDF.pdf";
  }
}

/**
 * Imports PDFs used to launch or resume the native app. The native PDF
 * associations are declared in app.json; this component handles the URL that
 * iOS or Android delivers after the user chooses Bic Reader.
 */
export default function OpenWith({ onPdfReceived }: OpenWithProps) {
  const router = useRouter();
  const incomingPdf = useSyncExternalStore(
    subscribeToIncomingPdf,
    getIncomingPdf,
    () => null,
  );
  const importInProgress = useRef<string | null>(null);

  useEffect(() => {
    const incomingUrl = incomingPdf?.url;
    if (
      !incomingUrl ||
      importInProgress.current === incomingUrl ||
      !claimIncomingPdfUrl(incomingUrl)
    ) {
      return;
    }

    importInProgress.current = incomingUrl;

    const openPdf = async () => {
      addSafeBreadcrumb("bic.pdf.import", "open-with-started");
      // Metro reloads can replay the URL that originally launched the native
      // app. Ignore that replay, while allowing non-initial Open With events.
      if (incomingPdf.initial && (await wasIncomingPdfHandled(incomingUrl))) {
        clearIncomingPdfUrl(incomingUrl);
        releaseIncomingPdfUrl(incomingUrl);
        importInProgress.current = null;
        router.replace("/HomePage");
        return;
      }

      const pdfId = await onPdfReceived({
        name: getPdfName(incomingUrl),
        uri: incomingUrl,
        mimeType: "application/pdf",
      });

      await markIncomingPdfHandled(incomingUrl);
      clearIncomingPdfUrl(incomingUrl);
      releaseIncomingPdfUrl(incomingUrl);
      importInProgress.current = null;

      if (pdfId) {
        addSafeBreadcrumb("bic.pdf.import", "open-with-completed", {
          imported: true,
        });
        router.replace({
          pathname: "/Reader/[pdfId]",
          params: { pdfId },
        });
      } else {
        addSafeBreadcrumb("bic.pdf.import", "open-with-completed", {
          imported: false,
        });
        router.replace("/HomePage");
      }
    };

    void openPdf().catch((error: unknown) => {
        captureHandledError(error, "pdf.import.open-with");
        console.error("Failed to import a PDF opened with Bic Reader:", error);
        clearIncomingPdfUrl(incomingUrl);
        releaseIncomingPdfUrl(incomingUrl);
        importInProgress.current = null;
        router.replace("/HomePage");
      });
  }, [incomingPdf, onPdfReceived, router]);

  return null;
}
