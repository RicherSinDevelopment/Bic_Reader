import { withSupabase } from "npm:@supabase/server@^1";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.4-nano";
const MAX_CONTEXT_CHARACTERS = 120_000;
const MAX_QUESTION_CHARACTERS = 2_000;

type AskPdfBody = {
  question?: unknown;
  context?: unknown;
  contextLabel?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    output_text?: unknown;
    output?: { content?: { type?: unknown; text?: unknown }[] }[];
  };

  if (typeof response.output_text === "string") return response.output_text.trim();

  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text as string)
    .join("\n")
    .trim();
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request) => {
    if (request.method !== "POST") {
      return jsonError("Method not allowed.", 405);
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      console.error("OPENAI_API_KEY is not configured.");
      return jsonError("AI is not configured yet.", 503);
    }

    let body: AskPdfBody;
    try {
      body = await request.json();
    } catch {
      return jsonError("The request body must be valid JSON.", 400);
    }

    const question = typeof body.question === "string" ? body.question.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim() : "";
    const contextLabel = typeof body.contextLabel === "string"
      ? body.contextLabel.trim().slice(0, 100)
      : "Selected PDF pages";

    if (!question) return jsonError("Enter a question first.", 400);
    if (question.length > MAX_QUESTION_CHARACTERS) {
      return jsonError(`Questions are limited to ${MAX_QUESTION_CHARACTERS} characters.`, 400);
    }
    if (!context) return jsonError("No readable PDF text was found for this context.", 400);
    if (context.length > MAX_CONTEXT_CHARACTERS) {
      return jsonError("That context is too large. Choose a smaller page range.", 413);
    }

    // Subscription enforcement belongs here once App Store purchases are connected.
    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: "low" },
        max_output_tokens: 1_200,
        instructions: [
          "You are the in-app reading assistant for Bic Reader.",
          "Answer using only the supplied PDF context.",
          "If the context does not contain the answer, say so clearly.",
          "Be concise, accurate, and easy to understand.",
          "When useful, refer to source pages as Page N.",
          "Do not claim to have read pages that are not included in the context.",
        ].join(" "),
        input: `Context selection: ${contextLabel}\n\nPDF context:\n${context}\n\nUser question:\n${question}`,
      }),
    });

    const payload = await openAiResponse.json().catch(() => null);
    if (!openAiResponse.ok) {
      console.error("OpenAI request failed", openAiResponse.status, payload);
      return jsonError("The AI service could not answer right now. Please try again.", 502);
    }

    const answer = extractOutputText(payload);
    if (!answer) return jsonError("The AI returned an empty response. Please try again.", 502);

    return Response.json({ answer, model: MODEL });
  }),
};
