/** Four viewport-bounded panels; never rasterize a giant spread shadow. */
export const READER_GUIDE_DIMMING_SCRIPT = String.raw`
(function() {
  const panels = ['top', 'bottom', 'left', 'right'].map(function(side) {
    return document.getElementById('reader-guide-dim-' + side);
  });
  let extraPanels = [];
  function boxesForRects(rects) {
    const width = Math.max(0, window.innerWidth);
    const height = Math.max(0, window.innerHeight);
    const boxes = [];
    let cursor = 0;
    rects.slice().sort(function(first, second) { return first.top - second.top; })
      .forEach(function(rect) {
        const left = Math.max(0, Math.min(width, rect.left - 3));
        const right = Math.max(left, Math.min(width, rect.right + 3));
        const top = Math.max(0, Math.min(height, rect.top - 2));
        const bottom = Math.max(top, Math.min(height, rect.bottom + 2));
        if (top > cursor) boxes.push([0, cursor, width, top - cursor]);
        if (left > 0) boxes.push([0, top, left, bottom - top]);
        if (right < width) boxes.push([right, top, width - right, bottom - top]);
        cursor = Math.max(cursor, bottom);
      });
    if (cursor < height) boxes.push([0, cursor, width, height - cursor]);
    return boxes;
  }
  window.__drawReaderGuideDimming = function(rect) {
    const width = Math.max(0, window.innerWidth);
    const height = Math.max(0, window.innerHeight);
    const rects = Array.isArray(rect) ? rect : [rect];
    if (!rects.length || rects.some(function(item) {
      return !item || ![item.left, item.right, item.top, item.bottom].every(Number.isFinite);
    })) {
      panels.concat(extraPanels).forEach(function(panel) { if (panel) panel.style.display = 'none'; });
      return;
    }
    const boxes = boxesForRects(rects);
    while (extraPanels.length < Math.max(0, boxes.length - panels.length)) {
      const panel = document.createElement('div');
      panel.className = 'reader-guide-dim';
      document.body.appendChild(panel);
      extraPanels.push(panel);
    }
    const allPanels = panels.concat(extraPanels);
    allPanels.forEach(function(panel, index) {
      if (!panel) return;
      const box = boxes[index];
      if (!box) {
        panel.style.display = 'none';
        panel.style.left = '0px'; panel.style.top = '0px';
        panel.style.width = '0px'; panel.style.height = '0px';
        return;
      }
      panel.style.display = 'block';
      panel.style.left = box[0] + 'px'; panel.style.top = box[1] + 'px';
      panel.style.width = box[2] + 'px'; panel.style.height = box[3] + 'px';
    });
  };
})();
true;
`;
