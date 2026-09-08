export type AiDenial = { code?: string; message: string; status: number };

export function getAiDenial(reason?: string): AiDenial {
  switch (reason) {
    case "premium_required":
      return { code: reason, message: "An active Premium subscription is required.", status: 403 };
    case "request_in_progress":
      return { code: reason, message: "Your previous AI request is still running.", status: 409 };
    case "duplicate_request":
      return { code: reason, message: "That same request was just submitted.", status: 409 };
    case "minute_limit":
      return { code: reason, message: "Too many requests. Wait a minute and try again.", status: 429 };
    case "daily_limit":
      return { code: reason, message: "You reached today's AI limit. Try again tomorrow.", status: 429 };
    case "monthly_limit":
      return { code: reason, message: "You reached this month's 200-request AI limit.", status: 429 };
    case "invalid_request":
      return { code: reason, message: "The AI request was invalid.", status: 400 };
    default:
      return { code: reason, message: "Unable to authorize this AI request.", status: 401 };
  }
}
