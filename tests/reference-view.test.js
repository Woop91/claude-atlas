import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountReference } from "../src/views/reference.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
});

describe("reference view", () => {
  it("renders one <section> per node in the reference view", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const sections = document.querySelectorAll('#view [data-role="ref-entry"]');
    const expected = DATASET.nodes.filter((n) => n.views.includes("reference")).length;
    expect(sections.length).toBe(expected);
  });

  it("section headings include the node name", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const first = document.querySelector('#view [data-role="ref-entry"] h2');
    expect(first.textContent.length).toBeGreaterThan(0);
  });

  it("domain tabs filter entries", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const worklistTab = document.querySelector('[data-role="ref-domain-tab"][data-domain="worklist"]');
    worklistTab.click();
    const visible = document.querySelectorAll('#view [data-role="ref-entry"]:not([hidden])');
    for (const s of visible) {
      expect(s.dataset.domain).toBe("worklist");
    }
  });

  it("has a real <section id> per entry so find-in-page works", () => {
    mountReference(DATASET, { focus: vi.fn() });
    const ids = Array.from(document.querySelectorAll('[data-role="ref-entry"]')).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // unique
    expect(ids[0]).toMatch(/^ref-/);
  });
});
