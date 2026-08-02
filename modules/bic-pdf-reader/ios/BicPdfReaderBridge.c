#include "BicPdfReaderBridge.h"

extern char *bic_pdf_extract_document_range_json(
  const char *path,
  uint16_t first_page,
  uint16_t max_pages
);

char *bic_pdf_extract_document_range_bridge(
  const char *path,
  uint16_t first_page,
  uint16_t max_pages
) {
  return bic_pdf_extract_document_range_json(path, first_page, max_pages);
}
