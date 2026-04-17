const VIEWS = ["neuromap", "reference", "worklist"];

function parseHash() {
  const m = location.hash.match(/^#\/(\w+)/);
  if (m && VIEWS.includes(m[1])) return m[1];
  return "neuromap";
}

export function createRouter() {
  let current = "neuromap";
  let started = false;
  const subs = new Set();

  function onHashChange() {
    if (!started) return;
    const next = parseHash();
    if (next === current) return;
    const prev = current;
    current = next;
    for (const s of subs) s(current, prev);
  }

  return {
    start() {
      started = true;
      current = parseHash();
      window.addEventListener("hashchange", onHashChange);
    },
    stop() {
      started = false;
      window.removeEventListener("hashchange", onHashChange);
    },
    current() { return current; },
    go(view) {
      if (!VIEWS.includes(view)) throw new Error(`unknown view: ${view}`);
      if (!started) {
        current = view;
        return;
      }
      const prev = current;
      location.hash = `#/${view}`;
      // In jsdom, hashchange fires asynchronously, so we manually update state
      current = view;
      for (const s of subs) s(current, prev);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export { VIEWS };
