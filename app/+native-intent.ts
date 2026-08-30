import { registerIncomingPdfUrl } from "@/services/incomingPdfService";

/**
 * A document URL is not an application route. Send PDF launches through the
 * normal entry route while OpenWith reads and imports the original linking URL.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (registerIncomingPdfUrl(path, { initial })) {
      return "/OpenPdf";
    }

    return path;
  } catch {
    return "/";
  }
}
