import { claimGuestLibrary } from "@/services/guestLibraryMigration";

describe("guest-to-account migration", () => {
  test("claims only unowned PDFs for the signed-in account", async () => {
    const db = { runAsync: jest.fn().mockResolvedValue(undefined) } as any;
    await claimGuestLibrary(db, "user-123");
    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE pdf_documents SET cloud_owner_id = ? WHERE cloud_owner_id IS NULL",
      "user-123",
    );
  });
});
