use crate::layout::{glyphs_to_lines, lines_to_blocks};
use crate::model::{Bounds, ExtractedDocument, ExtractedPage, Glyph};
use anyhow::{Context, Result, bail};
use pdfium_render::prelude::*;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Copy)]
pub struct ExtractionOptions {
    pub first_page: u16,
    pub max_pages: Option<u16>,
}

impl Default for ExtractionOptions {
    fn default() -> Self {
        Self {
            first_page: 0,
            max_pages: None,
        }
    }
}

pub fn extract_document(
    path: impl AsRef<Path>,
    options: ExtractionOptions,
) -> Result<ExtractedDocument> {
    let pdfium = create_pdfium()?;
    let document = pdfium
        .load_pdf_from_file(path.as_ref(), None)
        .with_context(|| format!("could not open {}", path.as_ref().display()))?;
    let page_count = document.pages().len();
    if options.first_page >= page_count {
        bail!("first page is outside the document");
    }
    let end = options
        .max_pages
        .map(|count| options.first_page.saturating_add(count))
        .unwrap_or(page_count)
        .min(page_count);
    let mut pages = Vec::with_capacity((end - options.first_page) as usize);
    for index in options.first_page..end {
        pages.push(extract_page(&document.pages().get(index)?, index + 1)?);
    }
    hide_repeated_marginalia(&mut pages);
    Ok(ExtractedDocument { page_count, pages })
}

fn extract_page(page: &PdfPage<'_>, number: u16) -> Result<ExtractedPage> {
    let visible_box = page
        .boundaries()
        .crop()
        .or_else(|_| page.boundaries().media())
        .ok();
    let origin_left = visible_box
        .as_ref()
        .map(|boundary| boundary.bounds.left().value)
        .unwrap_or(0.0);
    let origin_top = visible_box
        .as_ref()
        .map(|boundary| boundary.bounds.top().value)
        .unwrap_or(page.height().value);
    let width = visible_box
        .as_ref()
        .map(|boundary| boundary.bounds.width().value)
        .unwrap_or(page.width().value);
    let height = visible_box
        .as_ref()
        .map(|boundary| boundary.bounds.height().value)
        .unwrap_or(page.height().value);
    let text = page.text()?;
    let mut glyphs = Vec::with_capacity(text.len().max(0) as usize);
    let mut whitespace_before = false;
    for character in text.chars().iter() {
        let Some(value) = character.unicode_char() else {
            continue;
        };
        if value.is_whitespace() {
            whitespace_before = true;
            continue;
        }
        let Ok(rect) = character.loose_bounds() else {
            continue;
        };
        let font = character.font_name().to_ascii_lowercase();
        glyphs.push(Glyph {
            character: value,
            whitespace_before,
            bounds: Bounds {
                left: rect.left().value - origin_left,
                top: origin_top - rect.top().value,
                right: rect.right().value - origin_left,
                bottom: origin_top - rect.bottom().value,
            },
            font_size: character.scaled_font_size().value.max(1.0),
            bold: font.contains("bold") || font.contains("black"),
        });
        whitespace_before = false;
    }
    let usable = glyphs
        .iter()
        .filter(|glyph| !glyph.character.is_whitespace())
        .count();
    let blocks = lines_to_blocks(glyphs_to_lines(glyphs, width), number, height);
    // A scan can contain a large, invisible OCR text layer. Glyph count alone
    // therefore cannot distinguish it from a digitally-authored PDF. Scanner
    // output also commonly nests the page image inside a Form/XObject or splits
    // it into tiles, so inspect raster-bearing top-level objects recursively and
    // use their combined page coverage.
    let raster_objects = page
        .objects()
        .iter()
        .filter(|object| contains_raster_image(object, 0))
        .collect::<Vec<_>>();
    let has_raster = !raster_objects.is_empty();
    let raster_area = raster_objects
        .iter()
        .filter_map(|object| object.width().ok().zip(object.height().ok()))
        .map(|(object_width, object_height)| object_width.value.abs() * object_height.value.abs())
        .sum::<f32>();
    let has_dominant_raster = is_dominant_raster_area(raster_area, width, height);
    let has_hidden_ocr_layer = page
        .objects()
        .iter()
        .any(|object| contains_hidden_text(object, 0));
    let requires_ocr = usable < 12 || has_dominant_raster || (has_raster && has_hidden_ocr_layer);
    Ok(ExtractedPage {
        page: number,
        width,
        height,
        blocks,
        confidence: if requires_ocr { 0.1 } else { 0.86 },
        requires_ocr,
    })
}

fn contains_raster_image(object: &PdfPageObject<'_>, depth: u8) -> bool {
    if object.as_image_object().is_some() {
        return true;
    }
    if depth >= 8 {
        return false;
    }
    object.as_x_object_form_object().is_some_and(|form| {
        (0..form.len()).any(|index| {
            form.get(index)
                .is_ok_and(|child| contains_raster_image(&child, depth + 1))
        })
    })
}

fn contains_hidden_text(object: &PdfPageObject<'_>, depth: u8) -> bool {
    if let Some(text) = object.as_text_object() {
        let transparent_fill = text.fill_color().is_ok_and(|color| color.alpha() <= 8);
        let transparent_stroke = text.stroke_color().is_ok_and(|color| color.alpha() <= 8);
        let hidden = match text.render_mode() {
            PdfPageTextRenderMode::Invisible | PdfPageTextRenderMode::InvisibleClipping => true,
            PdfPageTextRenderMode::FilledUnstroked
            | PdfPageTextRenderMode::FilledUnstrokedClipping => transparent_fill,
            PdfPageTextRenderMode::StrokedUnfilled
            | PdfPageTextRenderMode::StrokedUnfilledClipping => transparent_stroke,
            PdfPageTextRenderMode::FilledThenStroked
            | PdfPageTextRenderMode::FilledThenStrokedClipping
            | PdfPageTextRenderMode::Unknown => transparent_fill && transparent_stroke,
        };
        if hidden {
            return true;
        }
    }
    if depth >= 8 {
        return false;
    }
    object.as_x_object_form_object().is_some_and(|form| {
        (0..form.len()).any(|index| {
            form.get(index)
                .is_ok_and(|child| contains_hidden_text(&child, depth + 1))
        })
    })
}

fn is_dominant_raster_area(raster_area: f32, page_width: f32, page_height: f32) -> bool {
    let page_area = page_width.abs() * page_height.abs();
    page_area > 0.0 && raster_area / page_area >= 0.55
}

fn hide_repeated_marginalia(pages: &mut [ExtractedPage]) {
    let signature = |value: &str| {
        let mut normalized = value
            .to_lowercase()
            .chars()
            .map(|character| {
                if character.is_ascii_digit() {
                    '#'
                } else {
                    character
                }
            })
            .collect::<String>();
        if let Some(page_marker) = normalized.rfind(" page ") {
            normalized.truncate(page_marker);
        }
        normalized.split_whitespace().collect::<Vec<_>>().join(" ")
    };
    let mut counts = HashMap::new();
    for page in pages.iter() {
        for block in page.blocks.iter().filter(|block| block.hidden_in_reader) {
            *counts.entry(signature(&block.text)).or_insert(0usize) += 1;
        }
    }
    let threshold = if pages.len() >= 3 { 3 } else { 2 };
    for page in pages {
        for block in &mut page.blocks {
            if block.hidden_in_reader {
                let lower = block.text.to_lowercase();
                let is_prepress_marker = lower.contains(".qxp")
                    || lower.contains("_fm.")
                    || lower.contains("_ch") && lower.contains(" page ");
                block.hidden_in_reader = is_prepress_marker
                    || counts.get(&signature(&block.text)).copied().unwrap_or(0) >= threshold
                    || block
                        .text
                        .trim()
                        .chars()
                        .all(|character| character.is_ascii_digit());
            }
        }
    }
}

#[cfg(feature = "ios-static")]
fn create_pdfium() -> Result<Pdfium> {
    Ok(Pdfium::new(Pdfium::bind_to_statically_linked_library()?))
}

#[cfg(not(feature = "ios-static"))]
fn create_pdfium() -> Result<Pdfium> {
    Ok(Pdfium::new(Pdfium::bind_to_system_library()?))
}

#[cfg(test)]
mod tests {
    use super::is_dominant_raster_area;

    #[test]
    fn full_page_scan_is_sent_to_ocr() {
        assert!(is_dominant_raster_area(595.0 * 842.0, 595.0, 842.0));
    }

    #[test]
    fn ordinary_inline_image_keeps_pdfium_text() {
        assert!(!is_dominant_raster_area(240.0 * 180.0, 595.0, 842.0));
    }

    #[test]
    fn tiled_scan_is_sent_to_ocr() {
        let two_half_page_tiles = 2.0 * (595.0 * 421.0);
        assert!(is_dominant_raster_area(two_half_page_tiles, 595.0, 842.0));
    }

    #[test]
    fn invalid_page_dimensions_are_not_scans() {
        assert!(!is_dominant_raster_area(595.0 * 842.0, 0.0, 842.0));
    }
}
