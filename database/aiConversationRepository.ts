import type { SQLiteDatabase } from "expo-sqlite";
import { withSerializedWrite } from "./serializedWriteTransaction";

export type AIChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "loading" | "error";
};

export type AIMessageFeedback = "helpful" | "not-helpful";

export type AIConversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: AIChatMessage[];
  feedback: Record<string, AIMessageFeedback>;
};

type ConversationRow = {
  messages_json: string;
  feedback_json: string;
  conversations_json: string;
  updated_at: string;
};

export async function loadAIConversation(
  db: SQLiteDatabase,
  pdfId: string,
) {
  const row = await db.getFirstAsync<ConversationRow>(
    `SELECT messages_json, feedback_json, conversations_json, updated_at
     FROM pdf_ai_conversations
     WHERE pdf_id = ?`,
    pdfId,
  );

  if (!row) {
    return {
      conversations: [] as AIConversation[],
    };
  }

  try {
    const storedConversations = JSON.parse(
      row.conversations_json,
    ) as AIConversation[];
    const legacyMessages = JSON.parse(row.messages_json) as AIChatMessage[];
    const legacyFeedback = JSON.parse(row.feedback_json) as Record<
      string,
      AIMessageFeedback
    >;
    const conversations = storedConversations.length > 0
      ? storedConversations
      : legacyMessages.length > 0
        ? [{
            id: `legacy-${pdfId}`,
            createdAt: row.updated_at,
            updatedAt: row.updated_at,
            messages: legacyMessages,
            feedback: legacyFeedback,
          }]
        : [];
    return {
      conversations: conversations.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.status === "loading"
            ? {
                ...message,
                status: "error" as const,
                text: "This response was interrupted. Please try again.",
              }
            : message,
        ),
      })),
    };
  } catch {
    return {
      conversations: [] as AIConversation[],
    };
  }
}

export function saveAIConversation(
  db: SQLiteDatabase,
  pdfId: string,
  conversations: AIConversation[],
) {
  return withSerializedWrite(db, (database) =>
    database.runAsync(
      `INSERT INTO pdf_ai_conversations
       (pdf_id, messages_json, feedback_json, conversations_json, updated_at)
       VALUES (?, '[]', '{}', ?, ?)
       ON CONFLICT(pdf_id) DO UPDATE SET
         conversations_json = excluded.conversations_json,
         updated_at = excluded.updated_at`,
      pdfId,
      JSON.stringify(conversations),
      new Date().toISOString(),
    ),
  );
}
