/** Runs inside a single mounted page, after its fonts have loaded. */
export const HORIZONTAL_PAGE_FIT_SCRIPT = String.raw`
// A word that crossed the reserved footer space is moved to the next generated
// page. Remove it here instead of waiting for a rewritten document: it already
// sits outside the readable area, so removing it changes nothing the reader can
// see, and it avoids navigating (and blanking) the WKWebView.
window.__clipReaderPageOverflow = function(segment, textNode, offset) {
  try {
    if (!textNode || textNode.nodeType !== 3 || !textNode.parentNode) return;
    var length = (textNode.textContent || '').length;
    var tail = offset > 0 && offset < length ? textNode.splitText(offset) : textNode;
    while (tail) {
      var adjacent = tail.nextSibling;
      if (tail.parentNode) tail.parentNode.removeChild(tail);
      tail = adjacent;
    }
    // Later paragraphs on the page continue on the next generated page.
    var following = segment.nextElementSibling;
    while (following) {
      var after = following.nextElementSibling;
      if (following.className && (' ' + following.className + ' ').indexOf(' segment ') >= 0 && following.parentNode) {
        following.parentNode.removeChild(following);
      }
      following = after;
    }
  } catch (error) {}
};
window.__reportHorizontalPageFit = function(bottomPadding) {
  const limit = window.innerHeight - bottomPadding;
  const segments = document.querySelectorAll('.segment');
  let visited = 0;
  for (const segment of segments) {
    if (segment.getBoundingClientRect().bottom <= limit) continue;
    visited += 1;
    const pageStart = Number(segment.dataset.start) || 0;
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
          const blockOffset = offset + raw.slice(0, word.index).replace(/\u00ad/g, '').length;
          // Never empty the page: a word that already starts the page is the
          // worst the estimate can produce, and the pager keeps that page.
          if (visited > 1 || blockOffset > pageStart) {
            window.__clipReaderPageOverflow(segment, node, word.index);
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'horizontalPageOverflow', layoutKey: window.__readerFitLayoutKey, blockId: segment.dataset.blockId,
            blockOffset: blockOffset
          }));
          return;
        }
      }
      offset += raw.replace(/\u00ad/g, '').length;
    }
  }
};
`;

