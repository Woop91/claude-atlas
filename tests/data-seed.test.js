import { describe, it, expect } from "vitest";
import { DATASET } from "../src/data/data.js";

describe("data seed — claude tools", () => {
  it("loads and validates without throwing", () => {
    expect(DATASET).toBeDefined();
    expect(DATASET.version).toBe("0.1.0");
  });

  it("has at least 10 claude-domain tool nodes", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    expect(tools.length).toBeGreaterThanOrEqual(10);
  });

  it("every claude tool is tagged for neuromap and reference", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    for (const t of tools) {
      expect(t.views).toContain("neuromap");
      expect(t.views).toContain("reference");
    }
  });

  it("no tool has an empty oneLine or description", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    for (const t of tools) {
      expect(t.oneLine.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it("every claude tool description is ≥60 characters", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    for (const t of tools) {
      expect(t.description.length, `description too short for ${t.id}`).toBeGreaterThanOrEqual(60);
    }
  });

  it("every claude tool has a syntax line", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    for (const t of tools) {
      expect(t.syntax, `missing syntax for ${t.id}`).toBeTruthy();
    }
  });
});

describe("data seed — worklist commands", () => {
  it("has at least 6 worklist commands", () => {
    const wl = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
    expect(wl.length).toBeGreaterThanOrEqual(6);
  });

  it("every worklist command is in all three views", () => {
    const wl = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
    for (const c of wl) {
      for (const v of ["neuromap", "reference", "worklist"]) {
        expect(c.views, `${c.id} missing view ${v}`).toContain(v);
      }
    }
  });

  it("worklist command names start with 'wl '", () => {
    const wl = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
    for (const c of wl) expect(c.name).toMatch(/^wl /);
  });
});
