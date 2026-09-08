/** Shared suppression boundary for destination, reflow, and window transactions. */
export const VERTICAL_NAVIGATION_RUNTIME = String.raw`
(function() {
  if (window.__readerNavigation) return;
  let generation = 0;
  let frame = 0;
  const state = window.__readerNavigation = {
    id: null, suppressed: false, generation: 0,
    begin: function(id) {
      if (frame) cancelAnimationFrame(frame);
      state.id = id === undefined ? state.id : id;
      state.suppressed = true;
      state.generation = ++generation;
      if (window.__readerAnchorDebug) console.info("[Reader navigation] begin", { id: state.id, generation });
      return generation;
    },
    cancel: function() {
      if (frame) cancelAnimationFrame(frame);
      state.generation = ++generation;
      state.suppressed = false;
      window.__pendingSourceDestination = null;
    },
    settle: function(token, measure, complete) {
      let previous = null;
      let stable = 0;
      let frames = 0;
      const tick = function() {
        if (token !== generation) return;
        const sample = [window.scrollY, document.documentElement.scrollHeight,
          window.innerWidth, window.innerHeight, measure ? measure() : 0];
        stable = previous && sample.every(function(value, index) {
          return Number.isFinite(value) && Math.abs(value - previous[index]) <= 1;
        }) ? stable + 1 : 0;
        previous = sample;
        if (stable >= 3 || ++frames >= 120) {
          state.suppressed = false;
          if (window.__readerAnchorDebug) console.info("[Reader navigation] settled", { id: state.id, generation, frames, stable: stable >= 3 });
          if (complete) complete(stable >= 3);
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
  };
})();
`;
