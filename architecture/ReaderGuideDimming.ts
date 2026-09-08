/** Four viewport-bounded panels; never rasterize a giant spread shadow. */
export const READER_GUIDE_DIMMING_SCRIPT = String.raw`
(function() {
  const panels = ['top', 'bottom', 'left', 'right'].map(function(side) {
    return document.getElementById('reader-guide-dim-' + side);
  });
  window.__drawReaderGuideDimming = function(rect) {
    const width = Math.max(0, window.innerWidth);
    const height = Math.max(0, window.innerHeight);
    if (!rect || ![rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite)) {
      panels.forEach(function(panel) { if (panel) panel.style.display = 'none'; });
      return;
    }
    const left = Math.max(0, Math.min(width, rect.left - 3));
    const right = Math.max(left, Math.min(width, rect.right + 3));
    const top = Math.max(0, Math.min(height, rect.top - 2));
    const bottom = Math.max(top, Math.min(height, rect.bottom + 2));
    const boxes = [
      [0, 0, width, top], [0, bottom, width, height - bottom],
      [0, top, left, bottom - top], [right, top, width - right, bottom - top]
    ];
    panels.forEach(function(panel, index) {
      if (!panel) return;
      const box = boxes[index];
      panel.style.display = 'block';
      panel.style.left = box[0] + 'px'; panel.style.top = box[1] + 'px';
      panel.style.width = box[2] + 'px'; panel.style.height = box[3] + 'px';
    });
  };
})();
true;
`;
