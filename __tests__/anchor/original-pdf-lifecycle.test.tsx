/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import OriginalPDF from "@/components/OriginalPDF.ios";
const { act, create } = require("react-test-renderer");

const mockMount = jest.fn();
const mockUnmount = jest.fn();
jest.mock("react-native-pdf", () => {
  const React = require("react");
  return React.forwardRef(function MockNativePdf(props: any, _ref: any) {
    React.useEffect(() => { mockMount(); return mockUnmount; }, []);
    return React.createElement("NativePdf", props);
  });
});
jest.mock("@/components/ui/text", () => ({ Text: "Text" }));
jest.mock("@/stores/readerSettingsStore", () => ({
  useReaderSettingsStore: (selector: any) => selector({ switchHighlightColor: "#123456" }),
}));
jest.mock("@/hooks/usePdfKitHighlight", () => ({
  usePdfKitHighlight: () => ({ markDocumentReady: () => {}, pdfRef: { current: null } }),
}));

test("canonical page updates do not reload or navigate the hidden native PDF", () => {
  mockMount.mockClear(); mockUnmount.mockClear();
  let tree: ReturnType<typeof create>;
  act(() => { tree = create(<OriginalPDF pdfUri="file:///book.pdf" initialPage={1} />); });
  for (let page = 2; page < 30; page++) {
    act(() => { tree.update(<OriginalPDF pdfUri="file:///book.pdf" initialPage={page} />); });
  }
  expect(mockMount).toHaveBeenCalledTimes(1);
  expect(mockUnmount).not.toHaveBeenCalled();
  expect(tree!.root.findByType("NativePdf" as any).props.page).toBe(1);
  act(() => tree.unmount());
});
