import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountBottomTabs } from "../src/ui/bottom-tabs.js";

beforeEach(() => {
  document.body.innerHTML = `<nav id="bottom-tabs"></nav>`;
});

describe("mountBottomTabs", () => {
  it("renders three view buttons", () => {
    mountBottomTabs({ currentView: "neuromap" }, { go: vi.fn() });
    expect(document.querySelectorAll('[data-role="bt-tab"]').length).toBe(3);
  });

  it("marks current view with aria-current=page", () => {
    mountBottomTabs({ currentView: "worklist" }, { go: vi.fn() });
    const b = document.querySelector('[data-role="bt-tab"][data-view="worklist"]');
    expect(b.getAttribute("aria-current")).toBe("page");
  });

  it("calls api.go on tap", () => {
    const api = { go: vi.fn() };
    mountBottomTabs({ currentView: "neuromap" }, api);
    document.querySelector('[data-role="bt-tab"][data-view="reference"]').click();
    expect(api.go).toHaveBeenCalledWith("reference");
  });
});
