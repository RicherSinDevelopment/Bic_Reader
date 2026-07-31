import * as FileSystem from "expo-file-system/legacy";

const IOS_DOCUMENTS_MARKER = "/Documents/";

function getDocumentsDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error("The app documents directory is unavailable.");
  }

  return FileSystem.documentDirectory;
}

export function resolveStoredFileUri(storedUri: string) {
  const documentsDirectory = getDocumentsDirectory();

  if (!storedUri.startsWith("file://")) {
    return `${documentsDirectory}${storedUri.replace(/^\/+/, "")}`;
  }

  const documentsIndex = storedUri.indexOf(IOS_DOCUMENTS_MARKER);

  if (documentsIndex >= 0) {
    const relativePath = storedUri.slice(
      documentsIndex + IOS_DOCUMENTS_MARKER.length,
    );

    return `${documentsDirectory}${relativePath}`;
  }

  return storedUri;
}
