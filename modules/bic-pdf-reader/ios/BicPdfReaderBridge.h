#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

char *bic_pdf_extract_document_range_bridge(
  const char *path,
  uint16_t first_page,
  uint16_t max_pages
);

#ifdef __cplusplus
}
#endif
