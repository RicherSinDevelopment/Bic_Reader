/* eslint-disable import/first */
const mockSetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockVerifyOtp = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { auth: {
    setSession: (...args: unknown[]) => mockSetSession(...args),
    exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
  } },
}));

import { createSessionFromAuthUrl } from "@/lib/auth-deep-link";

describe("authentication callbacks", () => {
  beforeEach(() => jest.clearAllMocks());

  test("exchanges a PKCE callback code", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });
    await expect(createSessionFromAuthUrl("bicreader://auth/callback?code=abc")).resolves.toEqual({ user: { id: "u1" } });
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  test("accepts token callbacks in the URL fragment", async () => {
    mockSetSession.mockResolvedValue({ data: { session: { access_token: "a" } }, error: null });
    await createSessionFromAuthUrl("bicreader://auth/callback#access_token=a&refresh_token=r");
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
  });

  test("surfaces provider errors and rejects expired links", async () => {
    await expect(createSessionFromAuthUrl("bicreader://auth/callback?error_description=Denied")).rejects.toThrow("Denied");
    await expect(createSessionFromAuthUrl("bicreader://auth/callback")).rejects.toThrow("invalid or has expired");
  });
});
