import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountPalette } from "../src/ui/palette.js";

beforeEach(() => {
  document.body.innerHTML = `<div id="overlays"></div>`;
});

describe("command palette", () => {
  it("is hidden when opened=false", () => {
    mountPalette(DATASET, { opened: false, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() });
    const overlay = document.querySelector('[data-role="palette-overlay"]');
    expect(overlay.hidden).toBe(true);
  });

  it("shows results matching fuzzy query", () => {
    const update = mountPalette(DATASET, { opened: true, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() });
    update({ opened: true, query: "claim" });
    const rows = document.querySelectorAll('[data-role="pl-row"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.textContent.toLowerCase()).toMatch(/claim/);
    }
  });

  it("Enter triggers focus on the first result's node", () => {
    const api = { opened: true, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() };
    const update = mountPalette(DATASET, api);
    update({ opened: true, query: "wl" });
    const input = document.querySelector('[data-role="pl-input"]');
    input.value = "wl";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(api.focus).toHaveBeenCalled();
  });

  it("Escape calls onClose", () => {
    const api = { opened: true, onClose: vi.fn(), go: vi.fn(), focus: vi.fn() };
    mountPalette(DATASET, api);
    document.querySelector('[data-role="pl-input"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(api.onClose).toHaveBeenCalled();
  });
});
