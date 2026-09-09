/** Runs inside a single mounted page, after its fonts have loaded. */
export const HORIZONTAL_PAGE_FIT_SCRIPT = String.raw`
window.__reportHorizontalPageFit = function(bottomPadding) {
  const limit = window.innerHeight - bottomPadding;
  const segments = document.querySelectorAll('.segment');
  for (const segment of segments) {
    if (segment.getBoundingClientRect().bottom <= limit) continue;
    const walker = document.createTreeWalker(segment, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        return node.parentElement.closest('.reader-note-marker')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let offset = Number(segment.dataset.start) || 0;
    let node;
    while ((node = walker.nextNode())) {
      const raw = node.textContent || '';
      const words = raw.matchAll(/\S+/g);
      for (const word of words) {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        if (Array.from(range.getClientRects()).some(function(rect) { return rect.bottom > limit + 0.5; })) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'horizontalPageOverflow', layoutKey: window.__readerFitLayoutKey, blockId: segment.dataset.blockId,
            blockOffset: offset + raw.slice(0, word.index).replace(/\u00ad/g, '').length
          }));
          return;
        }
      }
      offset += raw.replace(/\u00ad/g, '').length;
    }
  }
};
`;
