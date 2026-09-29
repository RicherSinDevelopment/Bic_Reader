use crate::model::{BlockKind, Glyph, Line, TextBlock};

pub(crate) fn glyphs_to_lines(mut glyphs: Vec<Glyph>, page_width: f32) -> Vec<Line> {
    glyphs.retain(|glyph| !glyph.character.is_control());
    glyphs.sort_by(|a, b| {
        a.bounds
            .top
            .total_cmp(&b.bounds.top)
            .then(a.bounds.left.total_cmp(&b.bounds.left))
    });

    let mut rows: Vec<Vec<Glyph>> = Vec::new();
    for glyph in glyphs {
        let center = (glyph.bounds.top + glyph.bounds.bottom) / 2.0;
        let tolerance = (glyph.font_size * 0.45).max(2.0);
        if let Some(row) = rows.iter_mut().find(|row| {
            let first = &row[0];
            let row_center = (first.bounds.top + first.bounds.bottom) / 2.0;
            (row_center - center).abs() <= tolerance
        }) {
            row.push(glyph);
        } else {
            rows.push(vec![glyph]);
        }
    }

    // Probe smaller gaps only to locate a consistent sidebar. Applying that
    // threshold to every row would split justified body text into fragments.
    let mut probe: Vec<Line> = rows
        .iter()
        .cloned()
        .flat_map(|row| split_row(row, page_width, None, true))
        .filter_map(build_line)
        .collect();
    assign_columns(&mut probe, page_width);
    let sidebar_bounds = probe
        .iter()
        .filter(|line| line.column == 2)
        .map(|line| line.bounds)
        .reduce(|a, b| a.union(b));
    let body_bounds = probe
        .iter()
        .filter(|line| line.column == 0)
        .map(|line| line.bounds)
        .reduce(|a, b| a.union(b));
    let sidebar_split = sidebar_bounds.zip(body_bounds).and_then(|(side, body)| {
        if side.right < body.left {
            Some((side.right + body.left) / 2.0)
        } else if body.right < side.left {
            Some((body.right + side.left) / 2.0)
        } else {
            None
        }
    });
    let mut lines: Vec<Line> = rows
        .into_iter()
        .flat_map(|row| split_row(row, page_width, sidebar_split, false))
        .filter_map(build_line)
        .collect();
    assign_columns(&mut lines, page_width);
    order_lines(&mut lines);
    lines
}

#[cfg(test)]
fn split_visual_row(row: Vec<Glyph>, page_width: f32) -> Vec<Vec<Glyph>> {
    split_row(row, page_width, None, false)
}

fn split_row(
    mut row: Vec<Glyph>,
    page_width: f32,
    sidebar_split: Option<f32>,
    probe: bool,
) -> Vec<Vec<Glyph>> {
    row.sort_by(|a, b| a.bounds.left.total_cmp(&b.bounds.left));
    if row.len() < 2 {
        return vec![row];
    }

    let mut segments = Vec::new();
    let mut current = vec![row[0].clone()];
    let mut previous_right = row[0].bounds.right;

    for glyph in row.into_iter().skip(1) {
        let font_size = glyph
            .font_size
            .max(current.last().map_or(0.0, |item| item.font_size));
        let gap = glyph.bounds.left - previous_right;
        let column_gap = (page_width * 0.055).max(font_size * 2.4);

        let crosses_sidebar = sidebar_split.is_some_and(|split| {
            previous_right <= split && glyph.bounds.left >= split && gap > font_size * 0.8
        });
        if gap > column_gap || crosses_sidebar || (probe && gap > font_size * 1.2) {
            segments.push(current);
            current = Vec::new();
        }

        previous_right = previous_right.max(glyph.bounds.right);
        current.push(glyph);
    }
    segments.push(current);
    segments
}

fn build_line(mut row: Vec<Glyph>) -> Option<Line> {
    let rtl = row.iter().filter(|glyph| is_rtl(glyph.character)).count() * 2 > row.len();
    row.sort_by(|a, b| {
        if rtl {
            b.bounds.left.total_cmp(&a.bounds.left)
        } else {
            a.bounds.left.total_cmp(&b.bounds.left)
        }
    });

    let mut text = String::new();
    let mut previous: Option<&Glyph> = None;
    let mut word_bounds = Vec::new();
    let mut current_word: Option<crate::model::Bounds> = None;
    for glyph in &row {
        if glyph.character.is_whitespace() {
            if !text.ends_with(' ') {
                text.push(' ');
            }
        } else {
            let mut starts_word = false;
            if let Some(prior) = previous {
                let gap = if rtl {
                    prior.bounds.left - glyph.bounds.right
                } else {
                    glyph.bounds.left - prior.bounds.right
                };
                let typical_width = ((prior.bounds.right - prior.bounds.left)
                    + (glyph.bounds.right - glyph.bounds.left))
                    / 2.0;
                let word_gap = (glyph.font_size * 0.32).max(typical_width * 0.9);
                let explicit_space = glyph.whitespace_before && gap > glyph.font_size * 0.03;
                if (explicit_space || gap > word_gap) && !text.ends_with(' ') {
                    text.push(' ');
                    starts_word = true;
                }
            }
            if starts_word {
                if let Some(bounds) = current_word.take() {
                    word_bounds.push(bounds);
                }
            }
            current_word =
                Some(current_word.map_or(glyph.bounds, |bounds| bounds.union(glyph.bounds)));
            text.push(glyph.character);
        }
        previous = Some(glyph);
    }
    if let Some(bounds) = current_word {
        word_bounds.push(bounds);
    }
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.is_empty() {
        return None;
    }
    let bounds = row
        .iter()
        .skip(1)
        .fold(row[0].bounds, |all, glyph| all.union(glyph.bounds));
    let font_size = median(row.iter().map(|glyph| glyph.font_size).collect());
    let bold = row.iter().filter(|glyph| glyph.bold).count() * 2 >= row.len();
    Some(Line {
        text,
        bounds,
        word_bounds,
        font_size,
        bold,
        column: 0,
    })
}

fn assign_columns(lines: &mut [Line], page_width: f32) {
    if lines.len() < 8 {
        return;
    }
    // Textbooks often reserve a narrow outer 20–30% band for definitions,
    // while articles usually use two balanced columns around the center.
    let candidates = (20..=80)
        .step_by(2)
        .map(|percent| page_width * percent as f32 / 100.0);
    let split = candidates
        .filter_map(|candidate| {
            let gutter = page_width * 0.01;
            let left = lines
                .iter()
                .filter(|line| line.bounds.right < candidate - gutter)
                .count();
            let right = lines
                .iter()
                .filter(|line| line.bounds.left > candidate + gutter)
                .count();
            (left >= 4 && right >= 4).then_some((candidate, left.min(right)))
        })
        .max_by_key(|(_, balanced_count)| *balanced_count)
        .map(|(candidate, _)| candidate);
    let Some(split) = split else {
        return;
    };

    let left_bounds = lines
        .iter()
        .filter(|line| line.bounds.right < split)
        .map(|line| line.bounds)
        .reduce(|all, bounds| all.union(bounds));
    let right_bounds = lines
        .iter()
        .filter(|line| line.bounds.left > split)
        .map(|line| line.bounds)
        .reduce(|all, bounds| all.union(bounds));
    let (Some(left_bounds), Some(right_bounds)) = (left_bounds, right_bounds) else {
        return;
    };
    let left_span = left_bounds.right - left_bounds.left;
    let right_span = right_bounds.right - right_bounds.left;
    let narrower_span = left_span.min(right_span);
    let wider_span = left_span.max(right_span);
    let is_asymmetric_sidebar = narrower_span < page_width * 0.28
        && wider_span > page_width * 0.42
        && narrower_span < wider_span * 0.58;
    let main_is_left = left_span >= right_span;
    let gutter = 0.0;
    for line in lines {
        line.column = if line.bounds.right < split - gutter {
            if is_asymmetric_sidebar && !main_is_left {
                2
            } else {
                0
            }
        } else if line.bounds.left > split + gutter {
            if is_asymmetric_sidebar && main_is_left {
                2
            } else if is_asymmetric_sidebar {
                0
            } else {
                1
            }
        } else {
            -1
        };
    }
}

fn order_lines(lines: &mut [Line]) {
    let top = lines
        .iter()
        .filter(|line| line.column >= 0)
        .map(|line| line.bounds.top)
        .min_by(f32::total_cmp)
        .unwrap_or(0.0);
    lines.sort_by(|a, b| {
        order_group(a, top)
            .cmp(&order_group(b, top))
            .then(a.bounds.top.total_cmp(&b.bounds.top))
            .then(a.bounds.left.total_cmp(&b.bounds.left))
    });
}

fn order_group(line: &Line, column_top: f32) -> u8 {
    if line.column < 0 && line.bounds.top <= column_top + line.font_size * 2.0 {
        0
    } else if line.column == 0 {
        1
    } else if line.column == 1 {
        2
    } else {
        3
    }
}

pub(crate) fn lines_to_blocks(lines: Vec<Line>, page: u16, height: f32) -> Vec<TextBlock> {
    if lines.is_empty() {
        return Vec::new();
    }
    let body_size = median(lines.iter().map(|line| line.font_size).collect());
    if lines.iter().any(|line| line.column == 2) {
        // A textbook sidebar is a parallel semantic stream, not a second
        // newspaper column. Build complete paragraphs in each stream first;
        // line-by-line interleaving would fragment or apparently omit the main
        // sentence beside a multi-line definition. Then place each complete
        // sidebar definition near the main paragraph at the same vertical area.
        let (sidebar, main): (Vec<_>, Vec<_>) =
            lines.into_iter().partition(|line| line.column == 2);
        let mut blocks = lines_to_blocks_in_order(main, page, height, body_size);
        blocks.extend(lines_to_blocks_in_order(sidebar, page, height, body_size));
        blocks.sort_by(|left, right| {
            left.source_bounds
                .top
                .total_cmp(&right.source_bounds.top)
                .then(left.source_bounds.left.total_cmp(&right.source_bounds.left))
        });
        for (reading_order, block) in blocks.iter_mut().enumerate() {
            block.reading_order = reading_order as u32;
            block.id = format!("p{page}-b{reading_order}");
        }
        return blocks;
    }
    lines_to_blocks_in_order(lines, page, height, body_size)
}

fn lines_to_blocks_in_order(
    lines: Vec<Line>,
    page: u16,
    height: f32,
    body_size: f32,
) -> Vec<TextBlock> {
    let mut blocks: Vec<TextBlock> = Vec::new();
    for line in lines {
        let kind = classify(&line, body_size, height);
        let can_join = kind == BlockKind::Paragraph
            && blocks.last().is_some_and(|block| {
                block.kind == BlockKind::Paragraph
                    && (block.source_bounds.left - line.bounds.left).abs() < body_size
                    && line.bounds.top - block.source_bounds.bottom < body_size * 2.2
            });
        if can_join {
            let block = blocks.last_mut().expect("previous block checked");
            let dehyphenate = ends_with_line_break_hyphen(&block.text)
                && line.text.chars().next().is_some_and(char::is_lowercase);
            if dehyphenate {
                block.text.pop();
            } else {
                block.text.push(' ');
            }
            block.text.push_str(&line.text);
            block.source_bounds = block.source_bounds.union(line.bounds);
            let mut next_words = line.word_bounds.into_iter();
            if dehyphenate
                && let (Some(previous), Some(next)) =
                    (block.word_bounds.last_mut(), next_words.next())
            {
                previous[0] = previous[0].min(next.left);
                previous[1] = previous[1].min(next.top);
                previous[2] = previous[2].max(next.right);
                previous[3] = previous[3].max(next.bottom);
            }
            block.word_bounds.extend(
                next_words.map(|bounds| [bounds.left, bounds.top, bounds.right, bounds.bottom]),
            );
        } else {
            let reading_order = blocks.len() as u32;
            let hidden = matches!(kind, BlockKind::Header | BlockKind::Footer);
            blocks.push(TextBlock {
                id: format!("p{page}-b{reading_order}"),
                kind,
                text: line.text,
                page,
                source_bounds: line.bounds,
                word_bounds: line
                    .word_bounds
                    .into_iter()
                    .map(|bounds| [bounds.left, bounds.top, bounds.right, bounds.bottom])
                    .collect(),
                reading_order,
                confidence: 0.88,
                hidden_in_reader: hidden,
            });
        }
    }
    blocks
}

fn ends_with_line_break_hyphen(text: &str) -> bool {
    matches!(
        text.chars().next_back(),
        Some('-' | '\u{00ad}' | '\u{2010}')
    )
}

pub(crate) fn ocr_lines_to_blocks(
    mut lines: Vec<Line>,
    page: u16,
    width: f32,
    height: f32,
) -> Vec<TextBlock> {
    assign_columns(&mut lines, width);
    order_lines(&mut lines);
    lines_to_blocks(lines, page, height)
}

fn classify(line: &Line, body: f32, height: f32) -> BlockKind {
    let text = line.text.trim();
    if line.bounds.top < height * 0.06 {
        BlockKind::Header
    } else if line.bounds.bottom > height * 0.94
        && (text.len() < 80 || text.chars().all(|c| c.is_ascii_digit()))
    {
        BlockKind::Footer
    } else if line.font_size >= body * 1.55 && text.len() < 180 {
        BlockKind::Title
    } else if (line.font_size >= body * 1.18 || line.bold) && text.len() < 180 {
        BlockKind::Heading
    } else if text.starts_with("• ") || text.starts_with("- ") || text.starts_with("– ") {
        BlockKind::ListItem
    } else if line.font_size < body * 0.84 && line.bounds.bottom > height * 0.82 {
        BlockKind::Footnote
    } else {
        BlockKind::Paragraph
    }
}

fn median(mut values: Vec<f32>) -> f32 {
    values.sort_by(f32::total_cmp);
    values.get(values.len() / 2).copied().unwrap_or(0.0)
}

fn is_rtl(character: char) -> bool {
    matches!(character as u32, 0x0590..=0x08ff | 0xfb1d..=0xfdff | 0xfe70..=0xfeff)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Bounds;

    fn glyph(character: char, left: f32, right: f32) -> Glyph {
        Glyph {
            character,
            whitespace_before: false,
            bounds: Bounds {
                left,
                top: 100.0,
                right,
                bottom: 110.0,
            },
            font_size: 10.0,
            bold: false,
        }
    }

    fn line(text: &str, left: f32, top: f32, column: i8) -> Line {
        Line {
            text: text.into(),
            bounds: Bounds {
                left,
                top,
                right: left + 200.0,
                bottom: top + 10.0,
            },
            font_size: 11.0,
            bold: false,
            word_bounds: Vec::new(),
            column,
        }
    }

    fn text_glyphs(text: &str, left: f32, top: f32) -> Vec<Glyph> {
        text.chars()
            .enumerate()
            .map(|(index, character)| {
                let mut item = glyph(
                    character,
                    left + index as f32 * 5.0,
                    left + (index + 1) as f32 * 5.0,
                );
                item.bounds.top = top;
                item.bounds.bottom = top + 10.0;
                item
            })
            .collect()
    }

    #[test]
    fn narrow_definition_gutters_preserve_every_body_line_on_either_side() {
        for sidebar_on_left in [true, false] {
            let (side_left, body_left) = if sidebar_on_left {
                (40.0, 185.0)
            } else {
                (445.0, 40.0)
            };
            let mut glyphs = Vec::new();
            let mut expected_body = Vec::new();
            let mut expected_side = Vec::new();
            for index in 0..6 {
                // 20pt gutter: narrower than the old 33pt row split threshold.
                let body = format!("Body line {index} {}", "word ".repeat(13));
                let side = format!("Definition {index} stays here");
                let top = 100.0 + index as f32 * 12.0;
                glyphs.extend(text_glyphs(&body, body_left, top));
                glyphs.extend(text_glyphs(&side, side_left, top));
                expected_body.push(body.trim().to_owned());
                expected_side.push(side);
            }
            let blocks = lines_to_blocks(glyphs_to_lines(glyphs, 600.0), 42, 800.0);
            assert_eq!(blocks.len(), 2, "{blocks:?}");
            assert!(
                blocks
                    .iter()
                    .any(|block| block.text == expected_body.join(" "))
            );
            assert!(
                blocks
                    .iter()
                    .any(|block| block.text == expected_side.join(" "))
            );
            assert!(blocks.iter().all(|block| !block.hidden_in_reader));
        }
    }

    #[test]
    fn a_large_word_gap_without_a_sidebar_keeps_the_body_together() {
        let mut glyphs = Vec::new();
        for index in 0..6 {
            let top = 100.0 + index as f32 * 12.0;
            glyphs.extend(text_glyphs("Opening words", 40.0, top));
            glyphs.extend(text_glyphs(
                "and the rest of the ordinary body line",
                125.0,
                top,
            ));
        }
        let lines = glyphs_to_lines(glyphs, 600.0);
        assert_eq!(lines.len(), 6);
        assert!(
            lines
                .iter()
                .all(|line| line.text == "Opening words and the rest of the ordinary body line")
        );
    }

    #[test]
    fn rejoins_words_split_by_pdf_line_end_hyphens() {
        for hyphen in ['-', '\u{00ad}', '\u{2010}'] {
            let blocks = lines_to_blocks(
                vec![
                    line(&format!("he{hyphen}"), 40.0, 100.0, 0),
                    line("llo reader", 40.0, 112.0, 0),
                ],
                1,
                800.0,
            );

            assert_eq!(blocks.len(), 1);
            assert_eq!(blocks[0].text, "hello reader");
        }
    }

    #[test]
    fn preserves_hyphens_that_are_not_at_a_joined_line_boundary() {
        let blocks = lines_to_blocks(
            vec![
                line("a well-known fact", 40.0, 100.0, 0),
                line("Remains intact", 40.0, 112.0, 0),
            ],
            1,
            800.0,
        );

        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].text, "a well-known fact Remains intact");
    }

    #[test]
    fn flattens_left_column_before_right_column() {
        let mut lines = vec![
            line("R2", 320.0, 200.0, 1),
            line("L2", 50.0, 200.0, 0),
            line("R1", 320.0, 100.0, 1),
            line("L1", 50.0, 100.0, 0),
        ];
        order_lines(&mut lines);
        assert_eq!(
            lines
                .iter()
                .map(|line| line.text.as_str())
                .collect::<Vec<_>>(),
            ["L1", "L2", "R1", "R2"]
        );
    }

    #[test]
    fn separates_columns_before_building_lines() {
        let row = vec![
            glyph('L', 40.0, 46.0),
            glyph('1', 46.0, 52.0),
            glyph('R', 330.0, 336.0),
            glyph('1', 336.0, 342.0),
        ];
        let segments = split_visual_row(row, 600.0);
        assert_eq!(segments.len(), 2);
        assert_eq!(build_line(segments[0].clone()).unwrap().text, "L1");
        assert_eq!(build_line(segments[1].clone()).unwrap().text, "R1");
    }

    #[test]
    fn restores_spaces_from_character_gaps() {
        let row = vec![
            glyph('H', 40.0, 46.0),
            glyph('i', 46.0, 49.0),
            glyph('t', 54.0, 58.0),
            glyph('h', 58.0, 64.0),
            glyph('e', 64.0, 70.0),
            glyph('r', 70.0, 74.0),
            glyph('e', 74.0, 80.0),
        ];
        let line = build_line(row).unwrap();
        assert_eq!(line.text, "Hi there");
        assert_eq!(line.word_bounds.len(), 2);
    }

    #[test]
    fn places_a_narrow_textbook_sidebar_after_the_main_body() {
        let mut lines = vec![
            line("definition one", 55.0, 120.0, 0),
            line("definition two", 55.0, 135.0, 0),
            line("definition three", 55.0, 150.0, 0),
            line("definition four", 55.0, 165.0, 0),
            line("main body one", 220.0, 100.0, 0),
            line("main body two", 220.0, 115.0, 0),
            line("main body three", 220.0, 130.0, 0),
            line("main body four", 220.0, 145.0, 0),
        ];
        for line in lines.iter_mut().take(4) {
            line.bounds.right = 150.0;
        }
        for line in lines.iter_mut().skip(4) {
            line.bounds.right = 560.0;
        }

        assign_columns(&mut lines, 600.0);
        order_lines(&mut lines);

        assert_eq!(
            lines
                .iter()
                .map(|line| line.text.as_str())
                .collect::<Vec<_>>(),
            [
                "main body one",
                "main body two",
                "main body three",
                "main body four",
                "definition one",
                "definition two",
                "definition three",
                "definition four",
            ]
        );
        assert!(lines.iter().take(4).all(|line| line.column == 0));
        assert!(lines.iter().skip(4).all(|line| line.column == 2));
    }

    #[test]
    fn textbook_sidebars_do_not_split_or_skip_adjacent_main_paragraphs() {
        let lines = vec![
            line("Main paragraph starts", 220.0, 100.0, 0),
            line("and keeps its middle", 220.0, 112.0, 0),
            line("and its final words.", 220.0, 124.0, 0),
            line("opportunity cost", 55.0, 106.0, 2),
            line("whatever must be given", 55.0, 118.0, 2),
            line("up to obtain an item", 55.0, 130.0, 2),
            line("The next main paragraph.", 220.0, 160.0, 0),
        ];

        let blocks = lines_to_blocks(lines, 6, 800.0);
        assert_eq!(
            blocks
                .iter()
                .map(|block| block.text.as_str())
                .collect::<Vec<_>>(),
            [
                "Main paragraph starts and keeps its middle and its final words.",
                "opportunity cost whatever must be given up to obtain an item",
                "The next main paragraph.",
            ]
        );
    }
}
