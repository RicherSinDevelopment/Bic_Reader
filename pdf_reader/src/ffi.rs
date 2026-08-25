use crate::layout::ocr_lines_to_blocks;
use crate::model::{Bounds, Line, TextBlock};
use crate::{ExtractionOptions, extract_document};
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString, c_char};
use std::panic::{AssertUnwindSafe, catch_unwind};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Response<T: Serialize> {
    ok: bool,
    data: Option<T>,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OcrPageInput {
    page: u16,
    width: f32,
    height: f32,
    lines: Vec<OcrLineInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OcrLineInput {
    text: String,
    bounds: Bounds,
    word_bounds: Vec<[f32; 4]>,
    confidence: f32,
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn bic_pdf_extract_document_json(path: *const c_char) -> *mut c_char {
    unsafe { bic_pdf_extract_document_range_json(path, 0, 0) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn bic_pdf_extract_document_range_json(
    path: *const c_char,
    first_page: u16,
    max_pages: u16,
) -> *mut c_char {
    let response = catch_unwind(AssertUnwindSafe(|| {
        if path.is_null() {
            return failure("path is null");
        }
        let path = unsafe { CStr::from_ptr(path) };
        let Ok(path) = path.to_str() else {
            return failure("path is not valid UTF-8");
        };
        let options = ExtractionOptions {
            first_page,
            max_pages: (max_pages > 0).then_some(max_pages),
        };
        match extract_document(path, options) {
            Ok(data) => Response {
                ok: true,
                data: Some(data),
                error: None,
            },
            Err(error) => failure(&format!("{error:#}")),
        }
    }))
    .unwrap_or_else(|_| failure("the extraction engine panicked"));
    let json = serde_json::to_string(&response).unwrap_or_else(|_| {
        r#"{"ok":false,"data":null,"error":"serialization failed"}"#.to_owned()
    });
    CString::new(json).expect("JSON contains no NUL").into_raw()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn bic_pdf_free_string(value: *mut c_char) {
    if !value.is_null() {
        drop(unsafe { CString::from_raw(value) });
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn bic_pdf_organize_ocr_page_json(input: *const c_char) -> *mut c_char {
    let response = catch_unwind(AssertUnwindSafe(|| {
        if input.is_null() {
            return failure("OCR page input is null");
        }
        let input = unsafe { CStr::from_ptr(input) };
        let Ok(input) = input.to_str() else {
            return failure("OCR page input is not valid UTF-8");
        };
        let Ok(page) = serde_json::from_str::<OcrPageInput>(input) else {
            return failure("OCR page input is not valid JSON");
        };
        let average_confidence = if page.lines.is_empty() {
            0.0
        } else {
            page.lines.iter().map(|line| line.confidence).sum::<f32>() / page.lines.len() as f32
        };
        let lines = page
            .lines
            .into_iter()
            .map(|line| Line {
                font_size: (line.bounds.bottom - line.bounds.top).abs().max(1.0),
                bold: false,
                column: 0,
                text: line.text,
                bounds: line.bounds,
                word_bounds: line
                    .word_bounds
                    .into_iter()
                    .map(|bounds| Bounds {
                        left: bounds[0],
                        top: bounds[1],
                        right: bounds[2],
                        bottom: bounds[3],
                    })
                    .collect(),
            })
            .collect();
        let mut blocks = ocr_lines_to_blocks(lines, page.page, page.width, page.height);
        for block in &mut blocks {
            block.confidence = average_confidence;
        }
        Response::<Vec<TextBlock>> {
            ok: true,
            data: Some(blocks),
            error: None,
        }
    }))
    .unwrap_or_else(|_| failure("the OCR organizer panicked"));
    let json = serde_json::to_string(&response).unwrap_or_else(|_| {
        r#"{"ok":false,"data":null,"error":"serialization failed"}"#.to_owned()
    });
    CString::new(json).expect("JSON contains no NUL").into_raw()
}

fn failure<T: Serialize>(message: &str) -> Response<T> {
    Response {
        ok: false,
        data: None,
        error: Some(message.to_owned()),
    }
}
