/** Keep native scrolling inside the mounted text window until delivery catches up. */
export const VERTICAL_LOADED_BOUNDARY = String.raw`
(function() {
  let anchor = null;
  let touchY = null;
  let requestedPage = null;
  function loaded(section) {
    return section && section.dataset.readerPlaceholder !== 'true';
  }
  function adjacent(left, right) {
    if (!loaded(left) || !loaded(right)) return false;
    const from = Number(left.dataset.sourcePageSection);
    const to = Number(right.dataset.sourcePageSection);
    if (to === from + 1) return true;
    // Absence from a partial extraction is NOT proof that a page is blank.
    // Only pages explicitly confirmed empty by extraction may bridge a gap.
    if (to <= from) return false;
    for (let page = from + 1; page < to; page++) {
      if (!window.__readerBlankPages?.has(page)) return false;
    }
    return true;
  }
  function capture(force) {
    const sections = Array.from(document.getElementById('reader-pages')?.children || []);
    const y = (Number(window.__readerTopBoundary) || 0) + 12;
    const hit = document.elementFromPoint(window.innerWidth / 2, y);
    let section = hit?.closest?.('[data-source-page-section]');
    // Hit testing can return the body in paragraph margins or under overlays.
    // Keep tracking the actual visible section instead of retaining a distant
    // anchor that the idle pruner will eventually empty.
    if (!loaded(section)) section = sections.find(function(candidate) {
      const rect = candidate.getBoundingClientRect();
      return loaded(candidate) && rect.top <= y && rect.bottom > y;
    });
    if (!loaded(section)) return;
    if (!force && anchor && section !== anchor) {
      const from = sections.indexOf(anchor), to = sections.indexOf(section);
      if (from < 0 || to < 0) return;
      // Never let an overshooting touch or hit test transfer ownership across
      // a gap. Explicit navigation settlement alone may choose a new island.
      for (let index = Math.min(from, to); index < Math.max(from, to); index++) {
        if (!adjacent(sections[index], sections[index + 1])) return;
      }
    }
    anchor = section;
  }
  function bounds() {
    const sections = Array.from(document.getElementById('reader-pages')?.children || []);
    if (!anchor || !sections.includes(anchor)) capture();
    const index = sections.indexOf(anchor);
    if (index < 0 || !loaded(anchor)) return null;
    let first = index, last = index;
    while (first > 0 && adjacent(sections[first - 1], sections[first])) first--;
    while (last + 1 < sections.length && adjacent(sections[last], sections[last + 1])) last++;
    const top = Number(window.__readerTopBoundary) || 0;
    const min = first === 0 ? 0 : Math.max(0,
      sections[first].getBoundingClientRect().top + window.scrollY - top);
    const max = last === sections.length - 1 && window.__readerHasMore === false ? Infinity : Math.max(min,
      sections[last].getBoundingClientRect().bottom + window.scrollY - window.innerHeight);
    return { min, max, first: sections[first], last: sections[last] };
  }
  function active() {
    return window.__readerTransition === 'scroll' &&
      !window.__readerNavigation?.suppressed && !window.__verticalScrollFlipRestoring;
  }
  function constrain(target) {
    if (!active()) return false;
    const range = bounds();
    if (!range) return false;
    const next = Math.max(range.min, Math.min(range.max, target));
    if (Math.abs(next - target) < 0.5) { requestedPage = null; capture(); return false; }
    const page = Number((target < range.min ? range.first : range.last).dataset.sourcePageSection);
    if (requestedPage !== page) {
      requestedPage = page;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'readerBoundaryPage', page: page + (target < range.min ? -1 : 1),
        runtimeId: window.__readerRuntimeId
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'readerWindowPage', page, runtimeId: window.__readerRuntimeId
      }));
    }
    if (Math.abs(window.scrollY - next) > 0.5) window.scrollTo(0, next);
    return true;
  }
  window.addEventListener('touchstart', function(event) {
    constrain(window.scrollY);
    capture();
    touchY = event.touches[0]?.clientY ?? null;
  }, { passive: true });
  window.addEventListener('touchmove', function(event) {
    const y = event.touches[0]?.clientY;
    if (touchY !== null && y !== undefined && constrain(window.scrollY + touchY - y)) {
      if (event.cancelable) event.preventDefault();
    }
    touchY = y ?? null;
  }, { passive: false });
  window.addEventListener('scroll', function() { constrain(window.scrollY); }, { passive: true });
  window.__captureReaderLoadedBoundary = function() { capture(true); };
  window.__constrainReaderLoadedBoundary = function() { return constrain(window.scrollY); };
  capture(true);
})();
`;
