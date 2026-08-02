use crate::{ExtractionOptions, extract_document};
use serde::Serialize;
use std::ffi::{CStr, CString, c_char};
use std::panic::{AssertUnwindSafe, catch_unwind};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Response<T: Serialize> {
    ok: bool,
    data: Option<T>,
    error: Option<String>,
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

fn failure<T: Serialize>(message: &str) -> Response<T> {
    Response {
        ok: false,
        data: None,
        error: Some(message.to_owned()),
    }
}
