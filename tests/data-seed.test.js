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

describe("data seed — quizzes", () => {
  it("has at least 3 quiz questions", () => {
    expect(DATASET.quizzes.length).toBeGreaterThanOrEqual(3);
  });

  it("every quiz has at least 2 choices and a valid correctChoiceId", () => {
    for (const q of DATASET.quizzes) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      const ids = q.choices.map((c) => c.id);
      expect(ids, `bad correctChoiceId on ${q.id}`).toContain(q.correctChoiceId);
    }
  });

  it("every quiz choice nodeId references an existing worklist node", () => {
    const ids = new Set(DATASET.nodes.map((n) => n.id));
    for (const q of DATASET.quizzes) {
      for (const c of q.choices) {
        for (const nid of c.nodeIds) {
          expect(ids, `quiz ${q.id} choice ${c.id} has unknown node ${nid}`).toContain(nid);
        }
      }
    }
  });
});

describe("data seed — concepts", () => {
  it("has at least 2 concept nodes", () => {
    const c = DATASET.nodes.filter((n) => n.kind === "concept");
    expect(c.length).toBeGreaterThanOrEqual(2);
  });

  it("concept nodes are not in the neuromap view", () => {
    const c = DATASET.nodes.filter((n) => n.kind === "concept");
    for (const n of c) expect(n.views).not.toContain("neuromap");
  });
});

describe("data seed — edges", () => {
  it("has at least 10 edges", () => {
    expect(DATASET.edges.length).toBeGreaterThanOrEqual(10);
  });

  it("has at least 4 worklist sequence edges forming a chain", () => {
    const seq = DATASET.edges.filter((e) => e.kind === "sequence");
    expect(seq.length).toBeGreaterThanOrEqual(4);
  });

  it("every sequence edge connects worklist-domain nodes", () => {
    const byId = new Map(DATASET.nodes.map((n) => [n.id, n]));
    const seq = DATASET.edges.filter((e) => e.kind === "sequence");
    for (const e of seq) {
      expect(byId.get(e.source)?.domain).toBe("worklist");
      expect(byId.get(e.target)?.domain).toBe("worklist");
    }
  });
});
