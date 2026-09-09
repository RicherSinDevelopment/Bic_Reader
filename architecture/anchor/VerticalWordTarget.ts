/** Source offsets stay stable across highlight/note spans and soft hyphenation. */
export const VERTICAL_WORD_TARGET = String.raw`
window.__readerTextModel = function(block) {
  const entries = [];
  let text = '';
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      return node.parentElement.closest('.reader-note-marker')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.textContent || '';
    const clean = raw.replace(/\u00ad/g, '');
    entries.push({ node: node, raw: raw, start: text.length, end: text.length + clean.length });
    text += clean;
  }
  return { entries: entries, text: text, words: Array.from(text.matchAll(/\S+/g)) };
};
window.__resolveReaderWord = function(block, offset, index, progress) {
  const model = window.__readerTextModel(block);
  if (!model.words.length) return null;
  let wordIndex = -1;
  if (Number.isInteger(offset) && offset >= 0 && offset < model.text.length) {
    wordIndex = model.words.findIndex(function(word) { return word.index + word[0].length > offset; });
  } else if (Number.isInteger(index) && index >= 0 && index < model.words.length) {
    wordIndex = index;
  } else if (Number.isFinite(progress)) {
    wordIndex = Math.round(Math.max(0, Math.min(1, progress)) * (model.words.length - 1));
  }
  if (wordIndex < 0) return null;
  const word = model.words[wordIndex];
  function point(offset, end) {
    const entry = model.entries.find(function(item) { return offset >= item.start && (end ? offset <= item.end : offset < item.end); });
    if (!entry) return null;
    let rawOffset = 0, cleanOffset = 0;
    while (rawOffset < entry.raw.length && cleanOffset < offset - entry.start) {
      if (entry.raw[rawOffset] !== '\u00ad') cleanOffset++;
      rawOffset++;
    }
    return { node: entry.node, offset: rawOffset };
  }
  const start = point(word.index, false), end = point(word.index + word[0].length, true);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return { range: range, wordIndex: wordIndex, offset: word.index, word: word[0] };
};
window.__alignActiveReaderDestination = function() {
  let range = window.__activeProgrammaticRange;
  const target = window.__activeProgrammaticWord;
  if (range && !range.startContainer.isConnected && target) {
    const block = document.querySelector('[data-block-id="' + CSS.escape(target.blockId) + '"]');
    const resolved = block && window.__resolveReaderWord(block, target.offset, target.wordIndex);
    range = resolved && resolved.range;
    window.__activeProgrammaticRange = range;
  }
  if (!range || !range.startContainer.isConnected) return;
  const rect = range.getBoundingClientRect();
  const boundary = Math.max(0, Number(window.__readerTopBoundary) || 0);
  const delta = rect.top - boundary - 8;
  if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
};
`;
