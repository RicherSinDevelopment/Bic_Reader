import { loadReaderPosition, saveReaderPosition } from "@/database/readerPositionRepository";

describe("reader position persistence", () => {
  test("restores the complete canonical anchor after an app restart", async () => {
    const row = {
      pdf_id: "book-1", source_page: 42, source_block_id: "p42-b7",
      word_index: 18, character_offset: 113, block_progress: 0.45,
      revision: 9, updated_at: "2026-09-04T10:00:00.000Z",
    };
    const db = { getFirstAsync: jest.fn().mockResolvedValue(row) } as any;
    await expect(loadReaderPosition(db, "book-1")).resolves.toEqual({
      documentId: "book-1", sourcePage: 42, sourceBlockId: "p42-b7",
      wordIndex: 18, characterOffset: 113, blockProgress: 0.45,
      revision: 9, updatedAt: row.updated_at,
    });
  });

  test("upserts rather than creating competing positions", async () => {
    const db = { runAsync: jest.fn().mockResolvedValue(undefined) } as any;
    await saveReaderPosition(db, {
      documentId: "book-1", sourcePage: 3, sourceBlockId: "p3-b2",
      wordIndex: 4, characterOffset: 20, blockProgress: 0.2,
      revision: 2, updatedAt: "2026-09-04T10:00:00.000Z",
    });
    expect(db.runAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync.mock.calls[0][0]).toContain("ON CONFLICT(pdf_id) DO UPDATE");
    expect(db.runAsync.mock.calls[0].slice(1)).toEqual([
      "book-1", 3, "p3-b2", 4, 20, 0.2, 2, "2026-09-04T10:00:00.000Z",
    ]);
  });
});
