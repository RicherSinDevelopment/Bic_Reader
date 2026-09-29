/** Installed with the page, independent of WebView load-end timing.
 * Geometry stays opt-in; requests before the next paint share one measurement.
 */
export const HORIZONTAL_GUIDE_RUNTIME = String.raw`
(function() {
  if (window.__reportGuideGeometry) return;
        let pending = false;
        window.__reportGuideGeometry = function() {
          if (!window.__readerGuideActive || pending) return;
          pending = true;
          Promise.resolve(document.fonts && document.fonts.ready).then(function() {
          requestAnimationFrame(function() {
          pending = false;
          if (!window.__readerGuideActive) return;
          const rects = [];
          document.querySelectorAll('.segment').forEach(function(segment) {
            const range = document.createRange();
            range.selectNodeContents(segment);
            Array.from(range.getClientRects()).forEach(function(rect) {
              if (rect.width > 0 && rect.height > 0) {
                rects.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
              }
            });
          });
          const uniqueRects = rects.filter(function(rect, index) {
            return !rects.slice(0, index).some(function(previous) {
              return Math.abs(previous.left - rect.left) < 0.5 && Math.abs(previous.top - rect.top) < 0.5 && Math.abs(previous.width - rect.width) < 0.5;
            });
          }).sort(function(a, b) {
            const vertical = a.top - b.top;
            if (Math.abs(vertical) > 1) return vertical;
            return document.documentElement.dir === 'rtl'
              ? (b.left + b.width) - (a.left + a.width)
              : a.left - b.left;
          });
          const lines = [];
          uniqueRects.forEach(function(rect) {
            const line = lines.find(function(candidate) {
              return Math.abs(candidate.top - rect.top) < 1.5;
            });
            if (!line) {
              lines.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
              return;
            }
            const right = Math.max(line.left + line.width, rect.left + rect.width);
            line.left = Math.min(line.left, rect.left);
            line.width = right - line.left;
            line.height = Math.max(line.height, rect.height);
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'guideLines', lines: lines }));
          window.__reportGuideWord = function(target) {
            if (!window.__readerGuideActive || !target || !target.blockId || !target.length) return;
            const segment = Array.from(document.querySelectorAll('[data-block-id]')).find(function(item) {
              const start = Number(item.dataset.start || 0);
              const prefix = Number(item.dataset.prefix || 0);
              return item.dataset.blockId === target.blockId && target.offset >= start && target.offset < start + cleanLength(item.textContent) - prefix;
            });
            if (!segment) return;
            const prefix = Number(segment.dataset.prefix || 0);
            const localStart = target.offset - Number(segment.dataset.start || 0) + prefix;
            const localEnd = localStart + target.length;
            const nodes = [];
            let cursor = 0;
            const walker = document.createTreeWalker(segment, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
              const length = cleanLength(node.textContent || '');
              nodes.push({ node: node, start: cursor, end: cursor + length });
              cursor += length;
              node = walker.nextNode();
            }
            const pointFor = function(offset, isEnd) {
              const entry = nodes.find(function(item) { return offset >= item.start && (offset < item.end || (isEnd && offset === item.end)); }) || nodes[nodes.length - 1];
              if (!entry) return null;
              return { node: entry.node, offset: rawIndexForClean(entry.node.textContent || '', Math.max(0, Math.min(entry.end - entry.start, offset - entry.start))) };
            };
            const startPoint = pointFor(localStart, false);
            const endPoint = pointFor(localEnd, true);
            if (!startPoint || !endPoint) return;
            const range = document.createRange();
            range.setStart(startPoint.node, startPoint.offset);
            range.setEnd(endPoint.node, endPoint.offset);
            const wordRects = Array.from(range.getClientRects()).filter(function(rect) { return rect.width > 0 && rect.height > 0; }).map(function(rect) {
              return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            }).sort(function(first, second) {
              const vertical = first.top - second.top;
              if (Math.abs(vertical) > 1) return vertical;
              return document.documentElement.dir === 'rtl'
                ? (second.left + second.width) - (first.left + first.width)
                : first.left - second.left;
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'guideWordRects', target: target, rects: wordRects }));
          };
          // Read the latest target: the guide may have been enabled or moved
          // after onLoadEnd, before this delayed geometry pass runs.
          window.__reportGuideWord(window.__readerGuideWord);
          });
          });
        };
})();
`;
