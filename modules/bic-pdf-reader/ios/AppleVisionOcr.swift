import Foundation
import PDFKit
import UIKit
import Vision

enum AppleVisionOcr {
  static func fillPagesRequiringOcr(in json: String, pdfPath: String) throws -> String {
    guard
      let input = json.data(using: .utf8),
      var response = try JSONSerialization.jsonObject(with: input) as? [String: Any],
      var document = response["data"] as? [String: Any],
      var pages = document["pages"] as? [[String: Any]],
      let pdf = PDFDocument(url: URL(fileURLWithPath: pdfPath))
    else {
      return json
    }

    // Keep PDFium's native extraction for digital PDFs. Rust scores page and
    // document structure, flagging likely scans even when hidden OCR text exists.
    for index in pages.indices where pages[index]["requiresOcr"] as? Bool == true {
      guard
        let pageNumber = pages[index]["page"] as? Int,
        let pdfPage = pdf.page(at: pageNumber - 1)
      else { continue }

      let result = try recognize(page: pdfPage, pageNumber: pageNumber)
      guard !result.blocks.isEmpty else { continue }

      pages[index]["blocks"] = result.blocks
      pages[index]["confidence"] = result.confidence
      pages[index]["requiresOcr"] = false
    }

    document["pages"] = pages
    response["data"] = document
    let output = try JSONSerialization.data(withJSONObject: response)
    guard let value = String(data: output, encoding: .utf8) else {
      throw failure("Apple Vision produced an invalid OCR response.")
    }
    return value
  }

  private static func recognize(
    page: PDFPage,
    pageNumber: Int
  ) throws -> (blocks: [[String: Any]], confidence: Double) {
    let bounds = page.bounds(for: .mediaBox)
    let scale = min(3.0, max(2.0, 2400.0 / max(bounds.width, bounds.height)))
    let image = page.thumbnail(
      of: CGSize(width: bounds.width * scale, height: bounds.height * scale),
      for: .mediaBox
    )
    guard let cgImage = image.cgImage else {
      throw failure("Unable to render PDF page \(pageNumber) for OCR.")
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    if #available(iOS 16.0, *) {
      request.automaticallyDetectsLanguage = true
    }
    request.minimumTextHeight = 0.006
    try VNImageRequestHandler(cgImage: cgImage, orientation: .up).perform([request])

    let observations = (request.results ?? []).compactMap { observation -> (VNRecognizedTextObservation, VNRecognizedText)? in
      guard let candidate = observation.topCandidates(1).first else { return nil }
      return (observation, candidate)
    }.sorted { left, right in
      let verticalDifference = abs(left.0.boundingBox.midY - right.0.boundingBox.midY)
      if verticalDifference < 0.012 {
        return left.0.boundingBox.minX < right.0.boundingBox.minX
      }
      return left.0.boundingBox.midY > right.0.boundingBox.midY
    }

    let wordRegex = try NSRegularExpression(pattern: "\\S+")
    let rawBlocks: [[String: Any]] = observations.enumerated().map { index, item in
      let candidate = item.1
      let box = item.0.boundingBox
      let left = box.minX * bounds.width
      let top = (1 - box.maxY) * bounds.height
      let right = box.maxX * bounds.width
      let bottom = (1 - box.minY) * bounds.height
      let wordBounds: [[Double]] = wordRegex.matches(
        in: candidate.string,
        range: NSRange(candidate.string.startIndex..., in: candidate.string)
      ).map { match in
        guard
          let stringRange = Range(match.range, in: candidate.string),
          let wordObservation = try? candidate.boundingBox(for: stringRange)
        else {
          // Preserve one bounds entry per regex word so a failed Vision range
          // cannot shift every following word onto the wrong rectangle.
          return [0, 0, 0, 0]
        }
        let wordBox = wordObservation.boundingBox
        return [
          Double(wordBox.minX * bounds.width),
          Double((1 - wordBox.maxY) * bounds.height),
          Double(wordBox.maxX * bounds.width),
          Double((1 - wordBox.minY) * bounds.height),
        ]
      }
      return [
        "id": "ocr-\(pageNumber)-\(index)",
        "kind": "paragraph",
        "text": candidate.string,
        "page": pageNumber,
        "sourceBounds": [
          "left": left,
          "top": top,
          "right": right,
          "bottom": bottom,
        ],
        "wordBounds": wordBounds,
        "readingOrder": index,
        "confidence": Double(candidate.confidence),
        "hiddenInReader": false,
      ]
    }
    let confidence = observations.isEmpty
      ? 0
      : observations.reduce(0.0) { $0 + Double($1.1.confidence) } / Double(observations.count)
    let blocks = organizeWithRust(
      rawBlocks,
      pageNumber: pageNumber,
      pageWidth: bounds.width,
      pageHeight: bounds.height
    ) ?? rawBlocks
    return (blocks, confidence)
  }

  /// Vision owns recognition and exact word geometry; Rust owns the same
  /// reading-order and semantic layout pass used for native PDFium text.
  private static func organizeWithRust(
    _ lines: [[String: Any]],
    pageNumber: Int,
    pageWidth: CGFloat,
    pageHeight: CGFloat
  ) -> [[String: Any]]? {
    let organizerLines: [[String: Any]] = lines.compactMap { block in
      guard
        let text = block["text"] as? String,
        let bounds = block["sourceBounds"] as? [String: Any],
        let wordBounds = block["wordBounds"] as? [[Double]],
        let confidence = block["confidence"] as? Double
      else { return nil }
      return [
        "text": text,
        "bounds": bounds,
        "wordBounds": wordBounds,
        "confidence": confidence,
      ]
    }
    let input: [String: Any] = [
      "page": pageNumber,
      "width": Double(pageWidth),
      "height": Double(pageHeight),
      "lines": organizerLines,
    ]
    guard
      JSONSerialization.isValidJSONObject(input),
      let data = try? JSONSerialization.data(withJSONObject: input),
      let json = String(data: data, encoding: .utf8),
      let result = bic_pdf_organize_ocr_page_json(json)
    else { return nil }
    defer { bic_pdf_free_string(result) }
    guard
      let responseData = String(cString: result).data(using: .utf8),
      let response = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
      response["ok"] as? Bool == true,
      let blocks = response["data"] as? [[String: Any]],
      !blocks.isEmpty
    else { return nil }
    return blocks
  }

  private static func failure(_ message: String) -> NSError {
    NSError(
      domain: "com.bicreader.ocr",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }
}
