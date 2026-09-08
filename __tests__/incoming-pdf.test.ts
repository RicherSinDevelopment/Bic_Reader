/* eslint-disable import/first */
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///documents/" }));

import { clearIncomingPdfUrl, getIncomingPdf, normalizeIncomingPdfUrl, registerIncomingPdfUrl } from "@/services/incomingPdfService";
import { redirectSystemPath } from "@/app/+native-intent";

describe("iOS Share / Open In", () => {
  afterEach(() => {
    const pending = getIncomingPdf();
    if (pending) clearIncomingPdfUrl(pending.url);
  });

  test("normalizes an iOS Inbox scheme URL", () => {
    expect(normalizeIncomingPdfUrl("bicreader://private/var/mobile/book.pdf"))
      .toBe("file:///private/var/mobile/book.pdf");
  });
  test("redirects a PDF to the importer and retains its source URL", () => {
    expect(redirectSystemPath({ path: "file:///Inbox/My%20Book.pdf", initial: true })).toBe("/OpenPdf");
    expect(getIncomingPdf()).toEqual({ initial: true, url: "file:///Inbox/My%20Book.pdf" });
  });
  test("does not intercept ordinary application links", () => {
    expect(registerIncomingPdfUrl("bicreader://Profile")).toBe(false);
  });
});
