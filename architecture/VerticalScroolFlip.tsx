/** Rotation consumes the semantic word already observed by the reader probe. */
export const VERTICAL_SCROLL_FLIP_SCRIPT = String.raw`
(function() {
  if (window.__verticalScrollFlipInstalled) return;
  window.__verticalScrollFlipInstalled = true;
  let savedAnchor = null;
  let viewportWidth = window.innerWidth;
  let restoreGeneration = 0;
  let restoring = false;

  window.__rememberVerticalAnchor = function(anchor) {
    if (!restoring && !window.__readerNavigation?.suppressed) savedAnchor = anchor;
  };

  function textPoint(block, offset) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const length = (node.textContent || '').length;
      if (offset <= length) return { node, offset: Math.max(0, offset) };
      offset -= length;
      node = walker.nextNode();
    }
    return null;
  }

  function restore(anchor) {
    if (!anchor) return false;
    if (anchor.documentStart) {
      window.scrollTo(0, 0);
      return true;
    }
    const block = document.querySelector('[data-block-id="' + CSS.escape(anchor.blockId) + '"]');
    if (!block) return false;
    const start = textPoint(block, anchor.offset);
    const end = textPoint(block, anchor.offset + anchor.length);
    if (!start || !end) return false;
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const rect = range.getBoundingClientRect();
    if (!rect.height) return false;
    // Recompute chrome coordinates in the new layout. Never restore to the
    // old portrait screen Y when landscape has removed the header.
    const boundary = Math.max(0, Number(window.__readerTopBoundary) || 0);
    const delta = rect.top - boundary - anchor.edgeOffset;
    if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
    return true;
  }

  function handleResize() {
    if (Math.abs(viewportWidth - window.innerWidth) < 1) return;
    viewportWidth = window.innerWidth;
    if (window.__readerTransition !== 'scroll') return;
    const navigation = window.__readerNavigation;
    if (!navigation || (navigation.suppressed && !restoring)) return;
    const anchor = savedAnchor;
    restoring = true;
    window.__verticalScrollFlipRestoring = true;
    const generation = ++restoreGeneration;
    const token = navigation.begin();
    navigation.settle(token, function() {
      return Number(window.__readerTopBoundary) || 0;
    }, function(stable) {
      if (generation !== restoreGeneration) return;
      const nextToken = navigation.begin();
      const restored = stable && restore(anchor);
      navigation.settle(nextToken, null, function(settled) {
        if (generation !== restoreGeneration) return;
        restoring = false;
        window.__verticalScrollFlipRestoring = false;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'verticalRotationSettled', runtimeId: window.__readerRuntimeId, ok: Boolean(restored && settled)
        }));
        if (restored && settled) window.__reportSwitchAnchor?.(true);
      });
    });
  }

  window.__cancelVerticalScrollFlip = function() {
    ++restoreGeneration;
    restoring = false;
    window.__verticalScrollFlipRestoring = false;
  };
  window.addEventListener('touchstart', window.__cancelVerticalScrollFlip, { passive: true });
  window.addEventListener('resize', handleResize);
  window.visualViewport?.addEventListener('resize', handleResize);
})();
true;
`;
