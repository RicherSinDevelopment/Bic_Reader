use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
}

impl Bounds {
    pub(crate) fn union(self, other: Self) -> Self {
        Self {
            left: self.left.min(other.left),
            top: self.top.min(other.top),
            right: self.right.max(other.right),
            bottom: self.bottom.max(other.bottom),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum BlockKind {
    Title,
    Heading,
    Paragraph,
    ListItem,
    Footnote,
    Header,
    Footer,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextBlock {
    pub id: String,
    pub kind: BlockKind,
    pub text: String,
    pub page: u16,
    pub source_bounds: Bounds,
    pub reading_order: u32,
    pub confidence: f32,
    pub hidden_in_reader: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedPage {
    pub page: u16,
    pub width: f32,
    pub height: f32,
    pub blocks: Vec<TextBlock>,
    pub confidence: f32,
    pub requires_ocr: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedDocument {
    pub page_count: u16,
    pub pages: Vec<ExtractedPage>,
}

#[derive(Debug, Clone)]
pub(crate) struct Glyph {
    pub character: char,
    pub whitespace_before: bool,
    pub bounds: Bounds,
    pub font_size: f32,
    pub bold: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct Line {
    pub text: String,
    pub bounds: Bounds,
    pub font_size: f32,
    pub bold: bool,
    pub column: i8,
}
