import CoreFoundation
import ExpoModulesCore
import Foundation
import NaturalLanguage

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

    Function("hyphenateText") { (text: String) -> String in
      AppleTextHyphenator.hyphenate(text)
    }

    AsyncFunction("extractDocument") { (path: String) throws -> String in
#if BIC_PDF_RUST_LINKED
      guard let result = bic_pdf_extract_document_json(path) else {
        throw ExtractionException("Rust returned no extraction result")
      }
      defer { bic_pdf_free_string(result) }
      return try AppleVisionOcr.fillPagesRequiringOcr(
        in: String(cString: result),
        pdfPath: path
      )
#else
      throw ExtractionException("The Rust/PDFium iOS library has not been built. Run pdf_reader/scripts/build-ios.sh on macOS before the native build.")
#endif
    }

    // Accept Double at the Expo bridge boundary. Expo converts arguments before
    // entering this closure, and converting NaN/Infinity directly to Swift Int
    // is a fatal trap. Validate the dynamic numbers first, then convert safely.
    AsyncFunction("extractDocumentRange") { (path: String, firstPageValue: Double, maxPagesValue: Double) throws -> String in
#if BIC_PDF_RUST_LINKED
      guard firstPageValue.isFinite,
            maxPagesValue.isFinite,
            firstPageValue.rounded(.towardZero) == firstPageValue,
            maxPagesValue.rounded(.towardZero) == maxPagesValue,
            firstPageValue >= 0,
            firstPageValue <= Double(UInt16.max),
            maxPagesValue > 0,
            maxPagesValue <= Double(UInt16.max) else {
        throw ExtractionException("Invalid extraction page range")
      }
      let firstPage = Int(firstPageValue)
      let maxPages = Int(maxPagesValue)
      guard let result = bic_pdf_extract_document_range_bridge(
        path,
        UInt16(firstPage),
        UInt16(maxPages)
      ) else {
        throw ExtractionException("Rust returned no extraction result")
      }
      defer { bic_pdf_free_string(result) }
      return try AppleVisionOcr.fillPagesRequiringOcr(
        in: String(cString: result),
        pdfPath: path,
        maxOcrPages: 1
      )
#else
      throw ExtractionException("The Rust/PDFium iOS library has not been built. Run pdf_reader/scripts/build-ios.sh on macOS before the native build.")
#endif
    }
  }
}

private enum AppleTextHyphenator {
  static func hyphenate(_ text: String) -> String {
    guard text.count >= 6 else { return text }

    let language = NLLanguageRecognizer.dominantLanguage(for: text)?.rawValue
      ?? Locale.preferredLanguages.first
      ?? "en"
    let locale = CFLocaleCreate(
      kCFAllocatorDefault,
      CFLocaleIdentifier(rawValue: language as NSString)
    )
    guard CFStringIsHyphenationAvailableForLocale(locale) else { return text }

    let source = text as CFString
    var insertionLocations: [Int] = []

    text.enumerateSubstrings(
      in: text.startIndex..<text.endIndex,
      options: [.byWords, .substringNotRequired]
    ) { _, wordRange, _, _ in
      let range = NSRange(wordRange, in: text)
      guard range.length >= 6 else { return }

      let limitRange = CFRange(location: range.location, length: range.length)
      var searchBefore = NSMaxRange(range)

      while searchBefore > range.location {
        let location = CFStringGetHyphenationLocationBeforeIndex(
          source,
          searchBefore,
          limitRange,
          0,
          locale,
          nil
        )
        guard location != kCFNotFound, location > range.location else { break }
        insertionLocations.append(location)
        searchBefore = location
      }
    }

    guard !insertionLocations.isEmpty else { return text }
    let result = NSMutableString(string: text)
    for location in Set(insertionLocations).sorted(by: >) {
      result.insert("\u{00AD}", at: location)
    }
    return result as String
  }
}

private final class ExtractionException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}
