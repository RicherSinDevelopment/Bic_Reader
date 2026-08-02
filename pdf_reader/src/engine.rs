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
    let width = page.width().value;
    let height = page.height().value;
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
                left: rect.left().value,
                top: height - rect.top().value,
                right: rect.right().value,
                bottom: height - rect.bottom().value,
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
    let requires_ocr = usable < 12;
    Ok(ExtractedPage {
        page: number,
        width,
        height,
        blocks,
        confidence: if requires_ocr { 0.1 } else { 0.86 },
        requires_ocr,
    })
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
