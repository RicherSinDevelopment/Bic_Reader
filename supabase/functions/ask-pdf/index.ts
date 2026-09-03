// Deno resolves npm: specifiers when Supabase bundles this Edge Function.
// eslint-disable-next-line import/no-unresolved
import { createClient } from "npm:@supabase/supabase-js@2";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.4-nano";
const MAX_CONTEXT_CHARACTERS = 120_000;
const MAX_QUESTION_CHARACTERS = 2_000;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

type AskPdfBody = { question?: unknown; context?: unknown; contextLabel?: unknown };
type Reservation = {
  allowed?: boolean;
  reason?: string;
  request_id?: string;
  monthly_remaining?: number;
  daily_remaining?: number;
};

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code }, { status });
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

async function requestHash(question: string, context: string) {
  const bytes = new TextEncoder().encode(`${question}\u0000${context}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function denial(reason?: string) {
  switch (reason) {
    case "premium_required":
      return jsonError("An active Premium subscription is required.", 403, reason);
    case "request_in_progress":
      return jsonError("Your previous AI request is still running.", 409, reason);
    case "duplicate_request":
      return jsonError("That same request was just submitted.", 409, reason);
    case "minute_limit":
      return jsonError("Too many requests. Wait a minute and try again.", 429, reason);
    case "daily_limit":
      return jsonError("You reached today's AI limit. Try again tomorrow.", 429, reason);
    case "monthly_limit":
      return jsonError("You reached this month's 200-request AI limit.", 429, reason);
    case "invalid_request":
      return jsonError("The AI request was invalid.", 400, reason);
    default:
      return jsonError("Unable to authorize this AI request.", 401, reason);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonError("Method not allowed.", 405);

  const authorization = request.headers.get("authorization");
  if (!authorization) return jsonError("Unauthorized.", 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonError("Unauthorized.", 401);

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    console.error("ask-pdf configuration error: OPENAI_API_KEY missing");
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
  if (question.length > MAX_QUESTION_CHARACTERS)
    return jsonError(`Questions are limited to ${MAX_QUESTION_CHARACTERS} characters.`, 400);
  if (!context) return jsonError("No readable PDF text was found for this context.", 400);
  if (context.length > MAX_CONTEXT_CHARACTERS)
    return jsonError("That context is too large. Choose a smaller page range.", 413);

  const hash = await requestHash(question, context);
  const { data: reservationData, error: reservationError } = await userClient.rpc(
    "reserve_ai_request",
    { p_request_hash: hash, p_input_characters: question.length + context.length },
  );
  if (reservationError) {
    console.error("ask-pdf reservation failed", reservationError.code ?? "unknown");
    return jsonError("The AI usage check is temporarily unavailable.", 503);
  }
  const reservation = reservationData as Reservation;
  if (!reservation.allowed || !reservation.request_id) return denial(reservation.reason);

  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let succeeded = false;
  try {
    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        store: false,
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
      signal: AbortSignal.timeout(90_000),
    });

    const payload = await openAiResponse.json().catch(() => null) as {
      output_text?: unknown;
      output?: { content?: { type?: unknown; text?: unknown }[] }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    } | null;
    inputTokens = payload?.usage?.input_tokens ?? null;
    outputTokens = payload?.usage?.output_tokens ?? null;
    if (!openAiResponse.ok) {
      console.error("ask-pdf provider failure", {
        status: openAiResponse.status,
        requestId: openAiResponse.headers.get("x-request-id") ?? "unavailable",
      });
      return jsonError("The AI service could not answer right now. Please try again.", 502);
    }

    const answer = extractOutputText(payload);
    if (!answer) return jsonError("The AI returned an empty response. Please try again.", 502);
    succeeded = true;
    return Response.json({
      answer,
      model: MODEL,
      usage: {
        dailyRemaining: reservation.daily_remaining,
        monthlyRemaining: reservation.monthly_remaining,
      },
    });
  } catch (error) {
    console.error("ask-pdf request failed", {
      kind: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network",
    });
    return jsonError("The AI service could not answer right now. Please try again.", 502);
  } finally {
    const { error } = await userClient.rpc("finish_ai_request", {
      p_request_id: reservation.request_id,
      p_succeeded: succeeded,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
    });
    if (error) console.error("ask-pdf usage finalization failed", error.code ?? "unknown");
  }
});
