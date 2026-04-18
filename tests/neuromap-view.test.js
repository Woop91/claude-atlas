import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountNeuromap } from "../src/views/neuromap.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
});

describe("neuromap view", () => {
  it("renders the HUD + category filter chips", () => {
    mountNeuromap(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    expect(document.querySelector('[data-role="nm-hud"]')).toBeTruthy();
    const chips = document.querySelectorAll('[data-role="nm-filter-chip"]');
    expect(chips.length).toBeGreaterThan(0);
  });

  it("includes one chip per unique category in the neuromap dataset", () => {
    mountNeuromap(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    const chips = document.querySelectorAll('[data-role="nm-filter-chip"]');
    const cats = new Set(DATASET.nodes.filter((n) => n.views.includes("neuromap")).map((n) => n.category));
    expect(chips.length).toBe(cats.size);
  });

  it("calls api.highlight on mount with all category nodes", () => {
    const api = { focus: vi.fn(), highlight: vi.fn() };
    mountNeuromap(DATASET, api);
    expect(api.highlight).toHaveBeenCalled();
    const call = api.highlight.mock.calls[0][0];
    expect(Array.isArray(call)).toBe(true);
    expect(call.length).toBeGreaterThan(0);
  });

  it("toggles a chip off when clicked, firing api.highlight with fewer nodes", () => {
    const api = { focus: vi.fn(), highlight: vi.fn() };
    mountNeuromap(DATASET, api);
    const initial = api.highlight.mock.calls[0][0].length;
    document.querySelector('[data-role="nm-filter-chip"]').click();
    const afterClick = api.highlight.mock.calls[api.highlight.mock.calls.length - 1][0];
    expect(afterClick.length).toBeLessThan(initial);
  });
});
