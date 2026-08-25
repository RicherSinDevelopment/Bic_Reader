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
    let document_scan_likely = document_scan_likely(&document)?;
    let end = options
        .max_pages
        .map(|count| options.first_page.saturating_add(count))
        .unwrap_or(page_count)
        .min(page_count);
    let mut pages = Vec::with_capacity((end - options.first_page) as usize);
    for index in options.first_page..end {
        pages.push(extract_page(
            &document.pages().get(index)?,
            index + 1,
            document_scan_likely,
        )?);
    }
    hide_repeated_marginalia(&mut pages);
    Ok(ExtractedDocument { page_count, pages })
}

fn extract_page(
    page: &PdfPage<'_>,
    number: u16,
    document_scan_likely: bool,
) -> Result<ExtractedPage> {
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
    let analysis = analyze_page(page, usable, width, height);
    let requires_ocr = usable < 12
        || analysis.score >= 5
        || (document_scan_likely && analysis.has_raster && analysis.raster_coverage >= 0.10);
    Ok(ExtractedPage {
        page: number,
        width,
        height,
        blocks,
        confidence: if requires_ocr { 0.1 } else { 0.86 },
        requires_ocr,
    })
}

#[derive(Debug, Clone, Copy)]
struct PageScanAnalysis {
    score: i16,
    raster_coverage: f32,
    has_raster: bool,
    has_hidden_text: bool,
}

fn document_scan_likely(document: &PdfDocument<'_>) -> Result<bool> {
    let page_count = document.pages().len();
    if page_count == 0 {
        return Ok(false);
    }
    let last = page_count - 1;
    let mut sample_indices = vec![
        0,
        page_count / 4,
        page_count / 2,
        page_count.saturating_mul(3) / 4,
        last,
    ];
    sample_indices.sort_unstable();
    sample_indices.dedup();

    let metadata_scan_hint = document.metadata().iter().any(|tag| {
        let value = tag.value().to_ascii_lowercase();
        [
            "abbyy",
            "finereader",
            "tesseract",
            "camscanner",
            "scan snap",
            "scansnap",
            "adobe scan",
            "paperport",
            "ocrmypdf",
        ]
        .iter()
        .any(|keyword| value.contains(keyword))
    });

    let mut analyses = Vec::with_capacity(sample_indices.len());
    for index in sample_indices {
        let page = document.pages().get(index)?;
        let width = page.width().value;
        let height = page.height().value;
        let text = page.text()?;
        let usable = text
            .chars()
            .iter()
            .filter_map(|character| character.unicode_char())
            .filter(|character| !character.is_whitespace())
            .count();
        analyses.push(analyze_page(&page, usable, width, height));
    }
    let strong_scan_pages = analyses
        .iter()
        .filter(|analysis| {
            analysis.has_raster && (analysis.has_hidden_text || analysis.raster_coverage >= 0.55)
        })
        .count();
    let average_score = analyses
        .iter()
        .map(|analysis| analysis.score as f32)
        .sum::<f32>()
        / analyses.len() as f32;

    Ok(strong_scan_pages * 5 >= analyses.len() * 3
        || average_score + if metadata_scan_hint { 1.0 } else { 0.0 } >= 4.0)
}

fn analyze_page(
    page: &PdfPage<'_>,
    usable_text: usize,
    width: f32,
    height: f32,
) -> PageScanAnalysis {
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
    let page_area = width.abs() * height.abs();
    let raster_coverage = if page_area > 0.0 {
        (raster_area / page_area).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let has_hidden_text = page
        .objects()
        .iter()
        .any(|object| contains_hidden_text(&object, 0));
    let has_visible_text = page
        .objects()
        .iter()
        .any(|object| contains_visible_text(&object, 0));

    let mut score = 0i16;
    if usable_text < 12 {
        score += 7;
    }
    if has_raster && has_hidden_text {
        score += 9;
    }
    score += if raster_coverage >= 0.80 {
        6
    } else if raster_coverage >= 0.55 {
        4
    } else if raster_coverage >= 0.20 {
        2
    } else {
        0
    };
    if has_visible_text && usable_text >= 12 {
        score -= if raster_coverage >= 0.55 { 3 } else { 6 };
    }
    if !has_raster && usable_text >= 12 {
        score -= 4;
    }

    PageScanAnalysis {
        score,
        raster_coverage,
        has_raster,
        has_hidden_text,
    }
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
        if text_object_is_hidden(text) {
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

fn contains_visible_text(object: &PdfPageObject<'_>, depth: u8) -> bool {
    if let Some(text) = object.as_text_object()
        && !text_object_is_hidden(text)
        && !text.text().trim().is_empty()
    {
        return true;
    }
    if depth >= 8 {
        return false;
    }
    object.as_x_object_form_object().is_some_and(|form| {
        (0..form.len()).any(|index| {
            form.get(index)
                .is_ok_and(|child| contains_visible_text(&child, depth + 1))
        })
    })
}

fn text_object_is_hidden(text: &PdfPageTextObject<'_>) -> bool {
    let transparent_fill = text.fill_color().is_ok_and(|color| color.alpha() <= 8);
    let transparent_stroke = text.stroke_color().is_ok_and(|color| color.alpha() <= 8);
    match text.render_mode() {
        PdfPageTextRenderMode::Invisible | PdfPageTextRenderMode::InvisibleClipping => true,
        PdfPageTextRenderMode::FilledUnstroked | PdfPageTextRenderMode::FilledUnstrokedClipping => {
            transparent_fill
        }
        PdfPageTextRenderMode::StrokedUnfilled | PdfPageTextRenderMode::StrokedUnfilledClipping => {
            transparent_stroke
        }
        PdfPageTextRenderMode::FilledThenStroked
        | PdfPageTextRenderMode::FilledThenStrokedClipping
        | PdfPageTextRenderMode::Unknown => transparent_fill && transparent_stroke,
    }
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
