/**
 * WebView runtime for rotation-safe vertical reading.
 *
 * A document-height percentage cannot survive text reflow: changing width
 * changes line count. Instead we remember the first visible word at the
 * reading edge and realign that exact DOM range after WebKit settles.
 */
export const VERTICAL_SCROLL_FLIP_SCRIPT = String.raw`
  (function installVerticalScrollFlip() {
    if (window.__verticalScrollFlipInstalled) return;
    window.__verticalScrollFlipInstalled = true;

    let savedAnchor = null;
    let captureFrame = 0;
    let restoreGeneration = 0;
    let restoring = false;
    let orientationAnchorCaptured = false;

    function visibleTop() {
      return window.scrollY <= 1
        ? 0
        : Math.max(0, Number(window.__readerTopBoundary) || 0);
    }

    function textPoint(block, cleanOffset) {
      let cursor = 0;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const length = (node.textContent || '').length;
        if (cleanOffset <= cursor + length) {
          return { node: node, offset: Math.max(0, Math.min(length, cleanOffset - cursor)) };
        }
        cursor += length;
        node = walker.nextNode();
      }
      return null;
    }

    function capture(force) {
      if (window.__readerTransition !== 'scroll') return;
      if (!force && (restoring || window.__activeProgrammaticTarget)) return;
      const boundary = visibleTop();
      const rtl = document.documentElement.dir === 'rtl';
      const blocks = Array.from(document.querySelectorAll('[data-reader-block]'))
        .filter(function(block) {
          const rect = block.getBoundingClientRect();
          return rect.bottom > boundary && rect.top < window.innerHeight;
        });
      let best = null;
      blocks.forEach(function(block) {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        let prefixLength = 0;
        while (node) {
          const text = node.textContent || '';
          Array.from(text.matchAll(/\S+/g)).forEach(function(match) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const rect = Array.from(range.getClientRects()).find(function(candidate) {
              return candidate.width > 0 && candidate.height > 0 &&
                candidate.bottom > boundary && candidate.top < window.innerHeight;
            });
            if (!rect) return;
            const top = Math.max(boundary, rect.top);
            const edge = rtl ? -rect.right : rect.left;
            if (!best || top < best.top - 1 ||
              (Math.abs(top - best.top) <= 1 && edge < best.edge)) {
              best = {
                blockId: block.dataset.blockId,
                offset: prefixLength + match.index,
                length: match[0].length,
                top: top,
                edge: edge
              };
            }
          });
          prefixLength += text.length;
          node = walker.nextNode();
        }
      });
      if (best && best.blockId) savedAnchor = best;
    }

    function restore(generation) {
      if (generation !== restoreGeneration ||
        window.__readerTransition !== 'scroll') return;
      // Native coordinates are not stable while source-page sections are
      // being appended or pruned. When React has pinned an exact canonical
      // destination, that block/word identity outranks the saved pixel range.
      if (window.__activeProgrammaticTarget) {
        const aligned = window.__realignActiveProgrammaticWord?.();
        if (!aligned && window.__activeProgrammaticTarget.isConnected) {
          window.__activeProgrammaticTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
        return;
      }
      if (!savedAnchor) return;
      const block = Array.from(document.querySelectorAll('[data-reader-block]'))
        .find(function(candidate) { return candidate.dataset.blockId === savedAnchor.blockId; });
      if (!block) return;
      const start = textPoint(block, savedAnchor.offset);
      const end = textPoint(block, savedAnchor.offset + savedAnchor.length);
      if (!start || !end) return;
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const rect = Array.from(range.getClientRects()).find(function(candidate) {
        return candidate.width > 0 && candidate.height > 0;
      });
      if (!rect) return;
      const delta = rect.top - savedAnchor.top;
      if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
    }

    function scheduleCapture() {
      if (captureFrame) return;
      captureFrame = requestAnimationFrame(function() {
        captureFrame = 0;
        capture(false);
      });
    }

    function captureBeforeOrientationChange() {
      // orientationchange is delivered before WKWebView finishes applying its
      // new viewport. Capture here rather than waiting for resize, whose first
      // frame may already have reset the native scroll position. A forced
      // capture is safe even when a navigation target is pinned: the visible
      // word is still the vertical renderer's authoritative location.
      capture(true);
      orientationAnchorCaptured = true;
    }

    function handleResize() {
      if (window.__readerTransition !== 'scroll') return;
      // Some iOS versions omit orientationchange for split-view/window
      // resizing. Preserve the last visible word before handling the first
      // resize pulse, but never replace it during the remaining pulses.
      if (!restoring && !orientationAnchorCaptured) capture(true);
      orientationAnchorCaptured = false;
      restoring = true;
      window.__verticalScrollFlipRestoring = true;
      const generation = ++restoreGeneration;
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { restore(generation); });
      });
      setTimeout(function() { restore(generation); }, 40);
      setTimeout(function() { restore(generation); }, 100);
      setTimeout(function() { restore(generation); }, 180);
      setTimeout(function() {
        restore(generation);
        if (generation !== restoreGeneration) return;
        restoring = false;
        window.__verticalScrollFlipRestoring = false;
        capture(false);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'verticalRotationSettled' }));
        requestAnimationFrame(function() {
          window.__reportSwitchAnchor?.(true);
        });
      }, 260);
    }

    window.addEventListener('scroll', scheduleCapture, { passive: true });
    window.addEventListener('orientationchange', captureBeforeOrientationChange);
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    requestAnimationFrame(function() { capture(false); });

    window.__captureVerticalScrollFlipAnchor = function() { capture(true); };
    window.__restoreVerticalScrollFlipAnchor = function() {
      const generation = ++restoreGeneration;
      restore(generation);
    };
  })();
`;
