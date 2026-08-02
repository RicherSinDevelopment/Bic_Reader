use anyhow::{Context, Result};
use bic_pdf_reader::{ExtractionOptions, extract_document};

fn main() -> Result<()> {
    let path = std::env::args()
        .nth(1)
        .context("usage: pdf_reader <file.pdf> [output.json]")?;
    let output = std::env::args()
        .nth(2)
        .unwrap_or_else(|| "output.json".to_owned());
    let document = extract_document(path, ExtractionOptions::default())?;
    std::fs::write(&output, serde_json::to_vec_pretty(&document)?)?;
    println!("Extracted {} pages into {output}", document.pages.len());
    Ok(())
}
