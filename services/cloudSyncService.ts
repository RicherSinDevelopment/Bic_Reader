import { supabase, supabasePublishableKey, supabaseUrl } from "@/lib/supabase";
import { useAppearanceStore } from "@/stores/appearanceStore";
import { useReaderSettingsStore } from "@/stores/readerSettingsStore";
import * as FileSystem from "expo-file-system/legacy";
import type { Session } from "@supabase/supabase-js";
import type { SQLiteDatabase } from "expo-sqlite";
import { withSerializedWrite } from "@/database/serializedWriteTransaction";
import { isCloudRecordNewer } from "@/services/cloudConflictPolicy";
import { claimGuestLibrary } from "@/services/guestLibraryMigration";

const PDF_BUCKET = "premium-pdfs";

type LocalPdfRow = {
  id: string;
  display_name: string;
  normalized_name: string;
  original_name: string;
  file_uri: string;
  file_size: number | null;
  mime_type: string | null;
  added_at: string;
  last_opened_at: string;
  current_page: number;
  total_pages: number | null;
  completion_percentage: number;
  cloud_owner_id: string | null;
};

type CloudPdfRow = Omit<LocalPdfRow, "file_uri" | "cloud_owner_id"> & {
  user_id: string;
  storage_path: string;
  updated_at: string;
};

type AnnotationRow = {
  id: string;
  annotation_id: string;
  pdf_id: string;
  scope: string;
  kind: "highlight" | "note";
  block_id: string;
  start_offset: number;
  text_length: number;
  color: string | null;
  note_text: string | null;
  created_at: string;
};

type ReaderPositionRow = {
  pdf_id: string;
  source_page: number;
  source_block_id: string | null;
  word_index: number | null;
  character_offset: number | null;
  block_progress: number | null;
  revision: number;
  updated_at: string;
};

function pdfDirectory() {
  if (!FileSystem.documentDirectory)
    throw new Error("Document storage is unavailable.");
  return `${FileSystem.documentDirectory}pdfs/`;
}

function localPdfUri(id: string) {
  return `${pdfDirectory()}${id}.pdf`;
}

function settingsSnapshot() {
  const state = useReaderSettingsStore.getState();
  return {
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    lineHeight: state.lineHeight,
    paragraphSpacing: state.paragraphSpacing,
    spacingPreset: state.spacingPreset,
    verticalMarginPreset: state.verticalMarginPreset,
    horizontalMarginPreset: state.horizontalMarginPreset,
    letterSpacing: state.letterSpacing,
    wordSpacing: state.wordSpacing,
    bold: state.bold,
    automaticHyphenation: state.automaticHyphenation,
    disableRotation: state.disableRotation,
    hideTopBarOnScroll: state.hideTopBarOnScroll,
    lineGuideEnabled: state.lineGuideEnabled,
    wordGuideEnabled: state.wordGuideEnabled,
    guideBackgroundDimming: state.guideBackgroundDimming,
    guideColor: state.guideColor,
    switchHighlightColor: state.switchHighlightColor,
    transition: state.transition,
    backgroundColor: state.backgroundColor,
    textColor: state.textColor,
    colorsCustomized: state.colorsCustomized,
  };
}

async function uploadPdf(
  session: Session,
  row: LocalPdfRow,
  storagePath: string,
) {
  const info = await FileSystem.getInfoAsync(row.file_uri);
  if (!info.exists) return;
  const endpoint = `${supabaseUrl}/storage/v1/object/${PDF_BUCKET}/${storagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const result = await FileSystem.uploadAsync(endpoint, row.file_uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublishableKey!,
      "Content-Type": row.mime_type ?? "application/pdf",
      "x-upsert": "true",
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`PDF upload failed (${result.status}).`);
  }
}

async function downloadPdf(storagePath: string, id: string) {
  const { data, error } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrl(storagePath, 300);
  if (error) throw error;
  await FileSystem.makeDirectoryAsync(pdfDirectory(), { intermediates: true });
  const destination = localPdfUri(id);
  await FileSystem.downloadAsync(data.signedUrl, destination);
  return destination;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function syncPremiumLibrary(
  db: SQLiteDatabase,
  session: Session,
  restoreFirst: boolean,
) {
  const userId = session.user.id;
  await claimGuestLibrary(db, userId);
  const localBefore = await db.getAllAsync<LocalPdfRow>(
    "SELECT * FROM pdf_documents WHERE cloud_owner_id = ?",
    userId,
  );
  const { data: cloudDocuments, error: cloudError } = await supabase
    .from("cloud_pdf_documents")
    .select("*");
  throwIfError(cloudError);
  const cloudRows = (cloudDocuments ?? []) as CloudPdfRow[];

  if (restoreFirst) {
    const localById = new Map(localBefore.map((row) => [row.id, row]));
    for (const cloud of cloudRows) {
      const local = localById.get(cloud.id);
      if (!local) {
        const uri = await downloadPdf(cloud.storage_path, cloud.id);
        await withSerializedWrite(db, (database) =>
          database.runAsync(
            `INSERT OR IGNORE INTO pdf_documents
           (id, display_name, normalized_name, original_name, file_uri, file_size,
            mime_type, added_at, last_opened_at, current_page, total_pages,
            completion_percentage, cloud_owner_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            cloud.id,
            cloud.display_name,
            cloud.normalized_name,
            cloud.original_name,
            uri,
            cloud.file_size,
            cloud.mime_type,
            cloud.added_at,
            cloud.last_opened_at,
            cloud.current_page,
            cloud.total_pages,
            cloud.completion_percentage,
            userId,
          ),
        );
      } else if (
        Date.parse(cloud.last_opened_at) > Date.parse(local.last_opened_at)
      ) {
        await withSerializedWrite(db, (database) =>
          database.runAsync(
            `UPDATE pdf_documents SET display_name = ?, last_opened_at = ?,
           current_page = ?, total_pages = ?, completion_percentage = ? WHERE id = ?`,
            cloud.display_name,
            cloud.last_opened_at,
            cloud.current_page,
            cloud.total_pages,
            cloud.completion_percentage,
            cloud.id,
          ),
        );
      }
    }

    const { data: annotations, error: annotationError } = await supabase
      .from("cloud_reader_annotations")
      .select(
        "id, annotation_id, pdf_id, scope, kind, block_id, start_offset, text_length, color, note_text, created_at",
      );
    throwIfError(annotationError);
    const restoredIds = new Set(
      (
        await db.getAllAsync<{ id: string }>(
          "SELECT id FROM pdf_documents WHERE cloud_owner_id = ?",
          userId,
        )
      ).map((row) => row.id),
    );
    for (const row of (annotations ?? []) as AnnotationRow[]) {
      if (!restoredIds.has(row.pdf_id)) continue;
      await withSerializedWrite(db, (database) =>
        database.runAsync(
          `INSERT OR REPLACE INTO reader_annotations
         (id, annotation_id, pdf_id, scope, kind, block_id, start_offset,
          text_length, color, note_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.annotation_id,
          row.pdf_id,
          row.scope,
          row.kind,
          row.block_id,
          row.start_offset,
          row.text_length,
          row.color,
          row.note_text,
          row.created_at,
        ),
      );
    }

    const { data: cloudSettings, error: settingsError } = await supabase
      .from("cloud_user_settings")
      .select("reader_settings, appearance_preference")
      .maybeSingle();
    throwIfError(settingsError);
    if (cloudSettings?.reader_settings) {
      useReaderSettingsStore.setState(cloudSettings.reader_settings);
    }
    if (cloudSettings?.appearance_preference) {
      useAppearanceStore
        .getState()
        .setPreference(cloudSettings.appearance_preference);
    }
  }

  const localDocuments = await db.getAllAsync<LocalPdfRow>(
    "SELECT * FROM pdf_documents WHERE cloud_owner_id = ?",
    userId,
  );

  // Reconcile positions on every sync, not just first login. This prevents a
  // stale second device from overwriting a newer cloud position.
  const localDocumentIds = new Set(localDocuments.map((row) => row.id));
  const { data: cloudPositions, error: positionError } = await supabase
    .from("cloud_reader_positions")
    .select(
      "pdf_id, source_page, source_block_id, word_index, character_offset, block_progress, revision, updated_at",
    );
  throwIfError(positionError);
  for (const position of (cloudPositions ?? []) as ReaderPositionRow[]) {
    if (!localDocumentIds.has(position.pdf_id)) continue;
    const local = await db.getFirstAsync<{ updated_at: string }>(
      "SELECT updated_at FROM reader_positions WHERE pdf_id = ? LIMIT 1",
      position.pdf_id,
    );
    if (!isCloudRecordNewer(local?.updated_at, position.updated_at)) {
      continue;
    }
    await withSerializedWrite(db, (database) => database.runAsync(
      `INSERT INTO reader_positions (
        pdf_id, source_page, source_block_id, word_index, character_offset,
        block_progress, revision, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pdf_id) DO UPDATE SET
        source_page = excluded.source_page,
        source_block_id = excluded.source_block_id,
        word_index = excluded.word_index,
        character_offset = excluded.character_offset,
        block_progress = excluded.block_progress,
        revision = excluded.revision,
        updated_at = excluded.updated_at`,
      position.pdf_id,
      position.source_page,
      position.source_block_id,
      position.word_index,
      position.character_offset,
      position.block_progress,
      position.revision,
      position.updated_at,
    ));
  }
  if (!restoreFirst) {
    const localIds = new Set(localDocuments.map((row) => row.id));
    const removedCloudRows = cloudRows.filter((row) => !localIds.has(row.id));
    if (removedCloudRows.length) {
      const { error: storageDeleteError } = await supabase.storage
        .from(PDF_BUCKET)
        .remove(removedCloudRows.map((row) => row.storage_path));
      throwIfError(storageDeleteError);
      const { error: metadataDeleteError } = await supabase
        .from("cloud_pdf_documents")
        .delete()
        .eq("user_id", userId)
        .in(
          "id",
          removedCloudRows.map((row) => row.id),
        );
      throwIfError(metadataDeleteError);
    }
  }
  const existingCloudIds = new Set(cloudRows.map((row) => row.id));
  for (const row of localDocuments) {
    const storagePath = `${userId}/${row.id}.pdf`;
    if (!existingCloudIds.has(row.id))
      await uploadPdf(session, row, storagePath);
    const { error } = await supabase.from("cloud_pdf_documents").upsert(
      {
        user_id: userId,
        id: row.id,
        display_name: row.display_name,
        normalized_name: row.normalized_name,
        original_name: row.original_name,
        storage_path: storagePath,
        file_size: row.file_size,
        mime_type: row.mime_type,
        added_at: row.added_at,
        last_opened_at: row.last_opened_at,
        current_page: row.current_page,
        total_pages: row.total_pages,
        completion_percentage: row.completion_percentage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,id" },
    );
    throwIfError(error);
  }

  const localAnnotations = await db.getAllAsync<AnnotationRow>(
    `SELECT annotation.id, annotation.annotation_id, annotation.pdf_id,
            annotation.scope, annotation.kind, annotation.block_id,
            annotation.start_offset, annotation.text_length, annotation.color,
            annotation.note_text, annotation.created_at
     FROM reader_annotations AS annotation
     INNER JOIN pdf_documents AS document ON document.id = annotation.pdf_id
     WHERE document.cloud_owner_id = ?`,
    userId,
  );
  const { error: deleteAnnotationsError } = await supabase
    .from("cloud_reader_annotations")
    .delete()
    .eq("user_id", userId);
  throwIfError(deleteAnnotationsError);
  if (localAnnotations.length) {
    const { error } = await supabase
      .from("cloud_reader_annotations")
      .insert(localAnnotations.map((row) => ({ ...row, user_id: userId })));
    throwIfError(error);
  }


  const localPositions = await db.getAllAsync<ReaderPositionRow>(
    `SELECT position.pdf_id, position.source_page, position.source_block_id,
            position.word_index, position.character_offset,
            position.block_progress, position.revision, position.updated_at
     FROM reader_positions AS position
     INNER JOIN pdf_documents AS document ON document.id = position.pdf_id
     WHERE document.cloud_owner_id = ?`,
    userId,
  );
  if (localPositions.length) {
    const { error } = await supabase.from("cloud_reader_positions").upsert(
      localPositions.map((position) => ({ ...position, user_id: userId })),
      { onConflict: "user_id,pdf_id" },
    );
    throwIfError(error);
  }

  const { error: settingsUpsertError } = await supabase
    .from("cloud_user_settings")
    .upsert({
      user_id: userId,
      reader_settings: settingsSnapshot(),
      appearance_preference: useAppearanceStore.getState().preference,
      updated_at: new Date().toISOString(),
    });
  throwIfError(settingsUpsertError);
}

export async function deletePremiumCloudPdf(userId: string, pdfId: string) {
  const storagePath = `${userId}/${pdfId}.pdf`;
  const { error: storageError } = await supabase.storage
    .from(PDF_BUCKET)
    .remove([storagePath]);
  if (storageError) throw storageError;
  const { error } = await supabase
    .from("cloud_pdf_documents")
    .delete()
    .eq("user_id", userId)
    .eq("id", pdfId);
  throwIfError(error);
}
