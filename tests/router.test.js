import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouter } from "../src/core/router.js";

beforeEach(() => { location.hash = ""; });

describe("createRouter", () => {
  it("parses current hash on start", () => {
    location.hash = "#/reference";
    const r = createRouter();
    r.start();
    expect(r.current()).toBe("reference");
  });

  it("defaults to 'neuromap' when hash is empty", () => {
    const r = createRouter();
    r.start();
    expect(r.current()).toBe("neuromap");
  });

  it("navigates to a new view via go()", () => {
    const r = createRouter();
    r.start();
    r.go("worklist");
    expect(r.current()).toBe("worklist");
    expect(location.hash).toBe("#/worklist");
  });

  it("notifies subscribers on hash change", () => {
    const r = createRouter();
    const spy = vi.fn();
    r.start();
    r.subscribe(spy);
    r.go("reference");
    expect(spy).toHaveBeenCalledWith("reference", "neuromap");
  });

  it("rejects unknown views", () => {
    const r = createRouter();
    r.start();
    expect(() => r.go("dashboard")).toThrow(/unknown view/i);
  });

  it("stops listening after stop()", () => {
    const r = createRouter();
    const spy = vi.fn();
    r.start();
    r.subscribe(spy);
    r.stop();
    r.go("reference"); // does not throw but also doesn't notify
    expect(spy).not.toHaveBeenCalled();
  });
});
