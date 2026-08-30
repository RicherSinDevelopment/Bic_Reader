import * as FileSystem from "expo-file-system/legacy";

type PendingPdf = {
  initial: boolean;
  url: string;
};

type HandledPdfReceipt = {
  urls: string[];
};

const RECEIPT_FILE_NAME = "last-open-with-pdf.json";
const MAX_RECEIPT_URLS = 20;

let pendingPdf: PendingPdf | null = null;
const listeners = new Set<() => void>();
const claimedPdfUrls = new Set<string>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function normalizeIncomingPdfUrl(url: string) {
  // iOS converts an Inbox URL to the app scheme before giving it to Router.
  // Restore the file URL expected by expo-file-system.
  const iosInboxMatch = url.match(/^bicreader:\/\/(?:\/)?(private\/.*)$/i);

  if (iosInboxMatch) {
    return `file:///${iosInboxMatch[1]}`;
  }

  return url;
}

export function isIncomingPdfUrl(url: string) {
  try {
    return /\.pdf(?:$|[?#])/i.test(decodeURIComponent(url));
  } catch {
    return /\.pdf(?:$|[?#])/i.test(url);
  }
}

export function registerIncomingPdfUrl(
  url: string,
  options: { initial?: boolean } = {},
) {
  if (!isIncomingPdfUrl(url)) return false;

  const normalizedUrl = normalizeIncomingPdfUrl(url);
  if (
    pendingPdf?.url !== normalizedUrl ||
    pendingPdf.initial !== (options.initial ?? false)
  ) {
    pendingPdf = {
      initial: options.initial ?? false,
      url: normalizedUrl,
    };
    emitChange();
  }

  return true;
}

export function clearIncomingPdfUrl(url: string) {
  if (pendingPdf?.url !== url) return;
  pendingPdf = null;
  emitChange();
}

export function claimIncomingPdfUrl(url: string) {
  if (claimedPdfUrls.has(url)) return false;
  claimedPdfUrls.add(url);
  return true;
}

export function releaseIncomingPdfUrl(url: string) {
  claimedPdfUrls.delete(url);
}

export function getIncomingPdf() {
  return pendingPdf;
}

export function subscribeToIncomingPdf(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getReceiptUri() {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${RECEIPT_FILE_NAME}`
    : null;
}

export async function wasIncomingPdfHandled(url: string) {
  const receiptUri = getReceiptUri();
  if (!receiptUri) return false;

  try {
    const receipt = JSON.parse(
      await FileSystem.readAsStringAsync(receiptUri),
    ) as Partial<HandledPdfReceipt>;
    return receipt.urls?.includes(url) ?? false;
  } catch {
    return false;
  }
}

export async function markIncomingPdfHandled(url: string) {
  const receiptUri = getReceiptUri();
  if (!receiptUri) return;

  let urls: string[] = [];
  try {
    const receipt = JSON.parse(
      await FileSystem.readAsStringAsync(receiptUri),
    ) as Partial<HandledPdfReceipt>;
    urls = receipt.urls ?? [];
  } catch {
    // The receipt is created on the first successful external open.
  }

  const nextUrls = [url, ...urls.filter((item) => item !== url)].slice(
    0,
    MAX_RECEIPT_URLS,
  );

  await FileSystem.writeAsStringAsync(
    receiptUri,
    JSON.stringify({ urls: nextUrls } satisfies HandledPdfReceipt),
  );
}
