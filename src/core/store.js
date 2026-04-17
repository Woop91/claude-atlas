/**
 * Tiny reactive store. Subscribers are called with (next, prev).
 * Referentially-equal writes are skipped.
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial;
  const subs = new Set();

  function get() { return state; }

  function set(next) {
    const resolved = typeof next === "function" ? next(state) : next;
    if (Object.is(resolved, state)) return;
    const prev = state;
    state = resolved;
    for (const s of subs) s(state, prev);
  }

  function patch(partial) {
    set({ ...state, ...partial });
  }

  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  return { get, set, patch, subscribe };
}
