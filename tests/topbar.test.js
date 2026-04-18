import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountTopbar } from "../src/ui/topbar.js";

beforeEach(() => {
  document.body.innerHTML = `<header id="topbar"></header>`;
});

describe("mountTopbar", () => {
  it("renders wordmark, three view buttons, and palette hint", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "neuromap" }, api);
    const root = document.getElementById("topbar");
    expect(root.querySelector('[data-role="wordmark"]').textContent).toMatch(/ATLAS/i);
    const tabs = root.querySelectorAll('[data-role="view-tab"]');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toMatch(/neuromap/i);
    expect(root.querySelector('[data-role="palette-hint"]')).toBeTruthy();
  });

  it("marks the current view's tab as [aria-selected=true]", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "reference" }, api);
    const refTab = document.querySelector('[data-role="view-tab"][data-view="reference"]');
    expect(refTab.getAttribute("aria-selected")).toBe("true");
  });

  it("calls api.go when a tab is clicked", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "neuromap" }, api);
    document.querySelector('[data-role="view-tab"][data-view="worklist"]').click();
    expect(api.go).toHaveBeenCalledWith("worklist");
  });

  it("opens the palette when the hint is clicked", () => {
    const api = { openPalette: vi.fn(), go: vi.fn() };
    mountTopbar({ currentView: "neuromap" }, api);
    document.querySelector('[data-role="palette-hint"]').click();
    expect(api.openPalette).toHaveBeenCalledOnce();
  });
});
