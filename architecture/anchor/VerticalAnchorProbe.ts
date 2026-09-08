/** Bounded hit testing: at most 56 word ranges, regardless of document length. */
export const VERTICAL_ANCHOR_PROBE = String.raw`
(function() {
  const tokens = new WeakMap();
  window.__probeReaderAnchor = function(boundary) {
    const rtl = document.documentElement.dir === 'rtl';
    const columns = [0.06, 0.16, 0.3, 0.5, 0.7, 0.84, 0.94];
    const rows = [1, 4, 8, 16, 24, 40, 64, 96];
    let best = null;
    for (const dy of rows) {
      const y = boundary + dy;
      if (y >= window.innerHeight) break;
      for (const fraction of columns) {
        const x = window.innerWidth * (rtl ? 1 - fraction : fraction);
        const hit = document.elementFromPoint(x, y);
        const block = hit?.closest?.('[data-reader-block]');
        if (!block) continue;
        const bounds = block.getBoundingClientRect();
        const leadingX = Math.max(1, Math.min(window.innerWidth - 1,
          rtl ? bounds.right - 1 : bounds.left + 1));
        const caret = document.caretRangeFromPoint?.(leadingX, y);
        const node = caret?.startContainer;
        if (!node || node.nodeType !== 3 || !block.contains(node)) continue;
        const text = node.textContent || '';
        let cached = tokens.get(node);
        if (!cached || cached.text !== text) {
          cached = { text, words: Array.from(text.matchAll(/\S+/g)) };
          tokens.set(node, cached);
        }
        const words = cached.words;
        if (!words.length) continue;
        let lo = 0, hi = words.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (words[mid].index + words[mid][0].length <= caret.startOffset) lo = mid + 1;
          else hi = mid;
        }
        const match = words[Math.min(lo, words.length - 1)];
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom <= boundary ||
            rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) continue;
        const top = Math.max(boundary, rect.top);
        const edge = rtl ? -rect.right : rect.left;
        if (!best || top < best.top - 1 || (Math.abs(top - best.top) <= 1 && edge < best.edge)) {
          best = { block, textNode: node, match, range, rect, top, edge };
        }
      }
      if (best && best.rect.top <= y) break;
    }
    return best;
  };
})();
`;
