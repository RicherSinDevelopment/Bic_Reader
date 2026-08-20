import ExpoModulesCore

public final class BicPdfReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BicPdfReader")

    Constant("isEngineLinked") {
#if BIC_PDF_RUST_LINKED
      true
#else
      false
#endif
    }

    AsyncFunction("extractDocument") { (path: String) throws -> String in
#if BIC_PDF_RUST_LINKED
      guard let result = bic_pdf_extract_document_json(path) else {
        throw ExtractionException("Rust returned no extraction result")
      }
      defer { bic_pdf_free_string(result) }
      return try AppleVisionOcr.fillScannedPages(
        in: String(cString: result),
        pdfPath: path
      )
#else
      throw ExtractionException("The Rust/PDFium iOS library has not been built. Run pdf_reader/scripts/build-ios.sh on macOS before the native build.")
#endif
    }

    AsyncFunction("extractDocumentRange") { (path: String, firstPage: Int, maxPages: Int) throws -> String in
#if BIC_PDF_RUST_LINKED
      guard firstPage >= 0, firstPage <= Int(UInt16.max), maxPages > 0, maxPages <= Int(UInt16.max) else {
        throw ExtractionException("Invalid extraction page range")
      }
      guard let result = bic_pdf_extract_document_range_bridge(
        path,
        UInt16(firstPage),
        UInt16(maxPages)
      ) else {
        throw ExtractionException("Rust returned no extraction result")
      }
      defer { bic_pdf_free_string(result) }
      return try AppleVisionOcr.fillScannedPages(
        in: String(cString: result),
        pdfPath: path
      )
#else
      throw ExtractionException("The Rust/PDFium iOS library has not been built. Run pdf_reader/scripts/build-ios.sh on macOS before the native build.")
#endif
    }
  }
}

private final class ExtractionException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}
