/** Background DOM changes must not interrupt a finger drag or native momentum. */
export const VERTICAL_MUTATION_QUEUE = String.raw`
(function() {
  let touching = false;
  let lastScroll = -Infinity;
  let timer = null;
  const pending = new Map();
  function busy() { return window.__verticalScrollFlipRestoring || touching || Date.now() - lastScroll < 180; }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, 180);
  }
  function flush() {
    if (busy()) { schedule(); return; }
    const next = pending.entries().next().value;
    if (!next) return;
    pending.delete(next[0]);
    next[1]();
    if (pending.size) schedule();
  }
  window.__deferReaderAppend = function(revision, apply) {
    if (!window.__verticalScrollFlipRestoring && (window.__readerNavigation?.suppressed || !busy())) return false;
    pending.set(revision, apply);
    schedule();
    return true;
  };
  window.addEventListener('touchstart', function() { touching = true; }, { passive: true });
  function end() { touching = false; if (pending.size) schedule(); }
  window.addEventListener('touchend', end, { passive: true });
  window.addEventListener('touchcancel', end, { passive: true });
  window.addEventListener('scroll', function() {
    lastScroll = Date.now();
    if (pending.size) schedule();
  }, { passive: true });
})();
`;
