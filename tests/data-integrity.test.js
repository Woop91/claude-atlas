import { describe, it, expect } from "vitest";
import { DATASET } from "../src/data/data.js";

describe("dataset integrity", () => {
  it("every node id is unique", () => {
    const seen = new Set();
    for (const n of DATASET.nodes) {
      expect(seen.has(n.id), `duplicate id ${n.id}`).toBe(false);
      seen.add(n.id);
    }
  });

  it("every node has a badge.hue in [0, 360]", () => {
    for (const n of DATASET.nodes) {
      expect(n.badge.hue).toBeGreaterThanOrEqual(0);
      expect(n.badge.hue).toBeLessThanOrEqual(360);
    }
  });

  it("every edge endpoint is a known node", () => {
    const ids = new Set(DATASET.nodes.map((n) => n.id));
    for (const e of DATASET.edges) {
      expect(ids.has(e.source), `edge source ${e.source} unknown`).toBe(true);
      expect(ids.has(e.target), `edge target ${e.target} unknown`).toBe(true);
    }
  });

  it("every node appears in at least one view", () => {
    for (const n of DATASET.nodes) {
      expect(n.views.length, `${n.id} has no views`).toBeGreaterThan(0);
    }
  });

  it("neuromap view has ≥10 nodes", () => {
    const n = DATASET.nodes.filter((x) => x.views.includes("neuromap"));
    expect(n.length).toBeGreaterThanOrEqual(10);
  });

  it("reference view covers both domains", () => {
    const r = DATASET.nodes.filter((x) => x.views.includes("reference"));
    expect(r.some((x) => x.domain === "claude")).toBe(true);
    expect(r.some((x) => x.domain === "worklist")).toBe(true);
  });

  it("worklist view only contains worklist-domain nodes", () => {
    const w = DATASET.nodes.filter((x) => x.views.includes("worklist"));
    for (const n of w) expect(n.domain, `${n.id} leaked into worklist view`).toBe("worklist");
  });

  it("no self-loops", () => {
    for (const e of DATASET.edges) {
      expect(e.source).not.toBe(e.target);
    }
  });

  it("no duplicate edges", () => {
    const seen = new Set();
    for (const e of DATASET.edges) {
      const key = `${e.source}->${e.target}:${e.kind}`;
      expect(seen.has(key), `duplicate edge ${key}`).toBe(false);
      seen.add(key);
    }
  });
});
