import * as FileSystem from "expo-file-system/legacy";
import PdfThumbnail from "react-native-pdf-thumbnail";

const THUMBNAIL_DIRECTORY_NAME = "pdf-thumbnails";
const thumbnailMemoryCache = new Map<string, string>();
const pendingThumbnails = new Map<string, Promise<string>>();

function getThumbnailDirectoryUri() {
  if (!FileSystem.documentDirectory) {
    throw new Error("The app documents directory is unavailable.");
  }

  return `${FileSystem.documentDirectory}${THUMBNAIL_DIRECTORY_NAME}/`;
}

function hashUri(uri: string) {
  let hash = 0;

  for (let index = 0; index < uri.length; index += 1) {
    hash = (hash * 31 + uri.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function getThumbnailUri(pdfUri: string) {
  return `${getThumbnailDirectoryUri()}${hashUri(pdfUri)}.jpg`;
}

export function getCachedPdfThumbnail(pdfUri: string) {
  return thumbnailMemoryCache.get(pdfUri) ?? null;
}

async function createOrLoadPdfThumbnail(pdfUri: string) {
  const permanentThumbnailUri = getThumbnailUri(pdfUri);
  const existingThumbnail = await FileSystem.getInfoAsync(permanentThumbnailUri);

  if (existingThumbnail.exists) {
    thumbnailMemoryCache.set(pdfUri, permanentThumbnailUri);
    return permanentThumbnailUri;
  }

  const directoryUri = getThumbnailDirectoryUri();
  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });

  const generatedThumbnail = await PdfThumbnail.generate(pdfUri, 0);
  await FileSystem.copyAsync({
    from: generatedThumbnail.uri,
    to: permanentThumbnailUri,
  });

  thumbnailMemoryCache.set(pdfUri, permanentThumbnailUri);
  return permanentThumbnailUri;
}

export async function getOrCreatePdfThumbnail(pdfUri: string) {
  const cachedThumbnail = getCachedPdfThumbnail(pdfUri);

  if (cachedThumbnail) {
    return cachedThumbnail;
  }

  const pendingThumbnail = pendingThumbnails.get(pdfUri);

  if (pendingThumbnail) {
    return pendingThumbnail;
  }

  const thumbnailPromise = createOrLoadPdfThumbnail(pdfUri).finally(() => {
    pendingThumbnails.delete(pdfUri);
  });

  pendingThumbnails.set(pdfUri, thumbnailPromise);
  return thumbnailPromise;
}

export async function deletePdfThumbnail(pdfUri: string) {
  thumbnailMemoryCache.delete(pdfUri);
  pendingThumbnails.delete(pdfUri);

  await FileSystem.deleteAsync(getThumbnailUri(pdfUri), {
    idempotent: true,
  });
}
