import { getAiDenial } from "@/supabase/functions/_shared/aiPolicy";

describe("AI quota responses", () => {
  test.each([
    ["premium_required", 403], ["request_in_progress", 409],
    ["duplicate_request", 409], ["minute_limit", 429],
    ["daily_limit", 429], ["monthly_limit", 429], ["invalid_request", 400],
  ])("maps %s to HTTP %i", (reason, status) => {
    expect(getAiDenial(reason)).toMatchObject({ code: reason, status });
  });
  test("fails closed for unknown reservation responses", () => {
    expect(getAiDenial("unexpected")).toMatchObject({ status: 401 });
  });
});
