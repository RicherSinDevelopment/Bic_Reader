#pragma once
#include <stdint.h>

char *bic_pdf_extract_document_json(const char *path);
char *bic_pdf_extract_document_range_json(const char *path, uint16_t first_page, uint16_t max_pages);
void bic_pdf_free_string(char *value);
