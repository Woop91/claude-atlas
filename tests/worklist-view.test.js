import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountWorklist } from "../src/views/worklist.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
  localStorage.clear();
});

describe("worklist view — commands tab", () => {
  it("renders three tab buttons (Commands / Quiz / Insights)", () => {
    mountWorklist(DATASET, { focus: vi.fn() });
    const tabs = document.querySelectorAll('[data-role="wl-tab"]');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toMatch(/commands/i);
    expect(tabs[1].textContent).toMatch(/quiz/i);
    expect(tabs[2].textContent).toMatch(/insights/i);
  });

  it("Commands tab lists every wl.* command", () => {
    mountWorklist(DATASET, { focus: vi.fn() });
    const entries = document.querySelectorAll('[data-role="wl-cmd-entry"]');
    const expected = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command").length;
    expect(entries.length).toBe(expected);
  });
});
