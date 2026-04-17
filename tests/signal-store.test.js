import { describe, it, expect, vi } from "vitest";
import { createStore } from "../src/core/store.js";

describe("createStore", () => {
  it("exposes initial state via get()", () => {
    const s = createStore({ a: 1, b: "x" });
    expect(s.get()).toEqual({ a: 1, b: "x" });
  });

  it("notifies subscribers on set()", () => {
    const s = createStore({ n: 0 });
    const spy = vi.fn();
    s.subscribe(spy);
    s.set({ n: 1 });
    expect(spy).toHaveBeenCalledWith({ n: 1 }, { n: 0 });
  });

  it("does not notify when the new state is referentially equal", () => {
    const s = createStore({ n: 0 });
    const spy = vi.fn();
    s.subscribe(spy);
    const cur = s.get();
    s.set(cur);
    expect(spy).not.toHaveBeenCalled();
  });

  it("supports unsubscribe", () => {
    const s = createStore({ n: 0 });
    const spy = vi.fn();
    const off = s.subscribe(spy);
    off();
    s.set({ n: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("accepts an updater function", () => {
    const s = createStore({ n: 0 });
    s.set((prev) => ({ n: prev.n + 1 }));
    expect(s.get()).toEqual({ n: 1 });
  });

  it("shallow-merges when patch() is used", () => {
    const s = createStore({ a: 1, b: 2 });
    s.patch({ b: 3 });
    expect(s.get()).toEqual({ a: 1, b: 3 });
  });
});
