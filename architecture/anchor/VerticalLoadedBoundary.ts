/** Keep native scrolling inside the mounted text window until delivery catches up. */
export const VERTICAL_LOADED_BOUNDARY = String.raw`
(function() {
  let anchor = null;
  let touchY = null;
  let requestedPage = null;
  let requestedEdge = null;
  let requestedWindowPage = null;
  let upperLock = null;
  function releaseUpperLock() {
    if (!upperLock) return;
    upperLock.elements.forEach(function(entry) {
      entry.element.style.overflowY = entry.overflowY;
    });
    upperLock = null;
  }
  function stopUpperScroll(y) {
    if (!upperLock) {
      const elements = [document.documentElement, document.body].filter(Boolean);
      upperLock = { elements: elements.map(function(element) {
        return { element, overflowY: element.style.overflowY };
      }) };
      // Stop the scroll container itself, rather than repeatedly chasing its
      // compositor-driven momentum with scrollTo corrections.
      elements.forEach(function(element) { element.style.overflowY = 'hidden'; });
      // Cancel iOS momentum at its owner. CSS alone does not cancel a native
      // pan/deceleration already in progress at this internal document edge.
      window.webkit?.messageHandlers?.ReactNativeWebView?.postMessage(
        'bicReaderStopUpperMomentum'
      );
    }
    if (Math.abs(window.scrollY - y) > 0.5) window.scrollTo(0, y);
  }
  window.__releaseReaderUpperBoundary = releaseUpperLock;
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
  function requestPage(page, windowPage, edge) {
    if (!Number.isFinite(page) || page < 1) return;
    if (requestedPage !== page) {
      requestedPage = page;
      requestedEdge = edge;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'readerBoundaryPage', page,
        runtimeId: window.__readerRuntimeId
      }));
    }
    // Prefetch may already have requested this source page. The actual hard
    // stop must still tell React which mounted page owns the visible window.
    if (Number.isFinite(windowPage) && requestedWindowPage !== windowPage) {
      requestedWindowPage = windowPage;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'readerWindowPage', page: windowPage,
        runtimeId: window.__readerRuntimeId
      }));
    }
  }
  function constrain(target, predictedTouch) {
    if (!active()) { releaseUpperLock(); return false; }
    const range = bounds();
    if (!range) return false;
    const firstPage = Number(range.first.dataset.sourcePageSection);
    const preloadDistance = Math.max(480, window.innerHeight * 2);
    // The hard native-momentum stop below prevents WebKit from crossing the
    // unloaded seam, so the viewport can stop exactly on the page divider.
    const upperStop = range.min;
    // After a distant TOC jump, ask native extraction for the preceding page
    // before momentum reaches the top of the mounted island. Hydrating while
    // there is still real text above the viewport avoids a same-frame WebKit
    // clamp + prepend, which can briefly leave duplicated compositor tiles.
    if (target >= range.min && target <= range.min + preloadDistance) {
      requestPage(firstPage - 1, null, 'before');
    }
    const next = Math.max(upperStop, Math.min(range.max, target));
    if (Math.abs(next - target) < 0.5) {
      // scrollTo emits another scroll event at the boundary. That acknowledgement
      // must not rearm requests: native momentum can overshoot again before it
      // stops. Rearm only after moving back inside, or after delivery expands
      // the loaded range around this position.
      const movedAway = requestedEdge === 'before'
        ? target > range.min + preloadDistance
        : requestedEdge === 'after'
          ? target < range.max - 1
          : target > range.min + 1 && target < range.max - 1;
      if (movedAway) {
        requestedPage = null;
        requestedEdge = null;
        requestedWindowPage = null;
      }
      capture();
      return false;
    }
    const page = Number((target < upperStop ? range.first : range.last).dataset.sourcePageSection);
    requestPage(
      page + (target < upperStop ? -1 : 1),
      page,
      target < upperStop ? 'before' : 'after'
    );
    // If this finger move would cross the upper edge, cancel it without
    // moving already-visible text. Calling scrollTo during the same gesture
    // introduces a second movement before preventDefault takes effect.
    // Actual overshoot (including momentum) still needs correction.
    const heldAboveUpperEdge = predictedTouch && target < upperStop &&
      window.scrollY >= upperStop && window.scrollY <= range.max;
    if (target < upperStop && range.min > 0) {
      stopUpperScroll(heldAboveUpperEdge ? window.scrollY : next);
    } else if (Math.abs(window.scrollY - next) > 0.5) window.scrollTo(0, next);
    return true;
  }
  window.addEventListener('touchstart', function(event) {
    releaseUpperLock();
    constrain(window.scrollY);
    capture();
    touchY = event.touches[0]?.clientY ?? null;
  }, { passive: true, capture: true });
  window.addEventListener('touchmove', function(event) {
    const y = event.touches[0]?.clientY;
    if (touchY !== null && y !== undefined && y < touchY) releaseUpperLock();
    if (touchY !== null && y !== undefined && constrain(window.scrollY + touchY - y, true)) {
      if (event.cancelable) event.preventDefault();
    }
    touchY = y ?? null;
  }, { passive: false, capture: true });
  window.addEventListener('scroll', function() { constrain(window.scrollY); }, { passive: true });
  function releaseForViewportChange() {
    // overflow:hidden is used only to cancel momentum at an unloaded edge.
    // Carrying it into an orientation reflow changes WebKit's scroll geometry
    // while the semantic rotation anchor is being restored, causing drift.
    releaseUpperLock();
    touchY = null;
  }
  window.addEventListener('resize', releaseForViewportChange, { passive: true });
  window.addEventListener('orientationchange', releaseForViewportChange, { passive: true });
  window.visualViewport?.addEventListener('resize', releaseForViewportChange, { passive: true });
  window.__captureReaderLoadedBoundary = function() { releaseUpperLock(); capture(true); };
  window.__constrainReaderLoadedBoundary = function() { return constrain(window.scrollY); };
  capture(true);
})();
`;
