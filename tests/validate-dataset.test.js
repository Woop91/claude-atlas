import { describe, it, expect } from "vitest";
import { validateDataset } from "../src/data/validate.js";

const okNode = {
  id: "tool.read",
  kind: "tool",
  domain: "claude",
  name: "Read",
  category: "file-io",
  badge: { label: "FS", hue: 192 },
  oneLine: "Read a file from the filesystem.",
  description: "Reads any file on disk and returns its contents.",
  tags: ["file", "io"],
  views: ["neuromap", "reference"],
};

const okEdge = { source: "tool.read", target: "tool.write", kind: "related", weight: 0.5 };

describe("validateDataset", () => {
  it("accepts a minimal valid dataset", () => {
    const ds = { nodes: [okNode], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).not.toThrow();
  });

  it("rejects duplicate node ids", () => {
    const ds = { nodes: [okNode, okNode], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).toThrow(/duplicate node id/i);
  });

  it("rejects edges pointing to unknown nodes", () => {
    const ds = {
      nodes: [okNode],
      edges: [{ source: "tool.read", target: "tool.ghost", kind: "related", weight: 0.5 }],
      quizzes: [],
      version: "0.1.0",
    };
    expect(() => validateDataset(ds)).toThrow(/unknown node/i);
  });

  it("rejects nodes with unknown kind", () => {
    const bad = { ...okNode, id: "x", kind: "widget" };
    const ds = { nodes: [okNode, bad], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).toThrow(/invalid kind/i);
  });

  it("rejects nodes with views outside the allowed set", () => {
    const bad = { ...okNode, id: "x", views: ["neuromap", "dashboard"] };
    const ds = { nodes: [okNode, bad], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).toThrow(/invalid view/i);
  });

  it("rejects quizzes whose correctChoiceId is not in choices", () => {
    const ds = {
      nodes: [okNode],
      edges: [],
      quizzes: [{
        id: "q1",
        prompt: "?",
        choices: [
          { id: "a", text: "A", nodeIds: [] },
          { id: "b", text: "B", nodeIds: [] }
        ],
        correctChoiceId: "z",
        explanation: "x",
      }],
      version: "0.1.0",
    };
    expect(() => validateDataset(ds)).toThrow(/correctChoiceId/i);
  });
});
