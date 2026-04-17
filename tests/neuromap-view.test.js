import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountNeuromap } from "../src/views/neuromap.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
});

describe("neuromap placeholder view", () => {
  it("renders a placeholder notice + category filter chips", () => {
    mountNeuromap(DATASET, { focus: vi.fn() });
    expect(document.querySelector('[data-role="nm-placeholder"]')).toBeTruthy();
    const chips = document.querySelectorAll('[data-role="nm-filter-chip"]');
    expect(chips.length).toBeGreaterThan(0);
  });

  it("includes one chip per unique category in the neuromap dataset", () => {
    mountNeuromap(DATASET, { focus: vi.fn() });
    const chips = document.querySelectorAll('[data-role="nm-filter-chip"]');
    const cats = new Set(DATASET.nodes.filter((n) => n.views.includes("neuromap")).map((n) => n.category));
    expect(chips.length).toBe(cats.size);
  });
});
