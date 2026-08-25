#pragma once

char *bic_pdf_extract_document_json(const char *path);
char *bic_pdf_organize_ocr_page_json(const char *input);
void bic_pdf_free_string(char *value);
