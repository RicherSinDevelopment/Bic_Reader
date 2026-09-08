/* eslint-disable import/first */
const mockInvoke = jest.fn();
const mockSignOut = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: { signOut: (...args: unknown[]) => mockSignOut(...args) },
  },
}));

import { deleteCurrentAccount } from "@/services/accountDeletionService";

describe("account deletion", () => {
  beforeEach(() => jest.clearAllMocks());

  test("deletes server data, clears account-linked local data, and signs out", async () => {
    mockInvoke.mockResolvedValue({ data: { deleted: true }, error: null });
    const transaction = { runAsync: jest.fn().mockResolvedValue(undefined) };
    const db = { withExclusiveTransactionAsync: jest.fn((task) => task(transaction)) } as any;
    await deleteCurrentAccount(db);
    expect(mockInvoke).toHaveBeenCalledWith("delete-account", { body: { confirmation: "DELETE" } });
    expect(transaction.runAsync).toHaveBeenCalledTimes(3);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  test("does not erase local data when server deletion fails", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("offline") });
    const db = { withExclusiveTransactionAsync: jest.fn() } as any;
    await expect(deleteCurrentAccount(db)).rejects.toThrow("Unable to delete");
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
