import { NODE_KINDS, DOMAINS, VIEW_NAMES, EDGE_KINDS } from "./schema.js";

/**
 * Validate a dataset. Throws a descriptive Error on the first failure.
 * Returns the dataset unchanged on success.
 * @param {import("./schema.js").Dataset} ds
 * @returns {import("./schema.js").Dataset}
 */
export function validateDataset(ds) {
  if (!ds || typeof ds !== "object") throw new Error("dataset must be an object");
  for (const key of ["nodes", "edges", "quizzes"]) {
    if (!Array.isArray(ds[key])) throw new Error(`dataset.${key} must be an array`);
  }
  if (typeof ds.version !== "string") throw new Error("dataset.version must be a string");

  const ids = new Set();
  for (const n of ds.nodes) {
    if (!n || typeof n !== "object") throw new Error("dataset.nodes contains a non-object entry");
    if (!n.id || typeof n.id !== "string") throw new Error("node missing id");
    if (ids.has(n.id)) throw new Error(`duplicate node id: ${n.id}`);
    ids.add(n.id);
    if (!NODE_KINDS.includes(n.kind)) throw new Error(`invalid kind on ${n.id}: ${n.kind}`);
    if (!DOMAINS.includes(n.domain)) throw new Error(`invalid domain on ${n.id}: ${n.domain}`);
    if (!n.name) throw new Error(`node ${n.id} missing name`);
    if (!n.category) throw new Error(`node ${n.id} missing category`);
    if (!n.badge || !Number.isFinite(n.badge.hue) || n.badge.hue < 0 || n.badge.hue > 360) {
      throw new Error(`node ${n.id} badge.hue must be a finite number in 0..360`);
    }
    if (!n.oneLine) throw new Error(`node ${n.id} missing oneLine`);
    if (!n.description) throw new Error(`node ${n.id} missing description`);
    if (!Array.isArray(n.tags)) throw new Error(`node ${n.id} tags must be array`);
    if (!Array.isArray(n.views) || n.views.length === 0) {
      throw new Error(`node ${n.id} must declare at least one view`);
    }
    for (const v of n.views) {
      if (!VIEW_NAMES.includes(v)) throw new Error(`invalid view on ${n.id}: ${v}`);
    }
  }

  for (const e of ds.edges) {
    if (!e || typeof e !== "object") throw new Error("dataset.edges contains a non-object entry");
    if (!ids.has(e.source)) throw new Error(`edge source unknown node: ${e.source}`);
    if (!ids.has(e.target)) throw new Error(`edge target unknown node: ${e.target}`);
    if (!EDGE_KINDS.includes(e.kind)) throw new Error(`invalid edge kind: ${e.kind}`);
    if (!Number.isFinite(e.weight) || e.weight < 0 || e.weight > 1) {
      throw new Error(`edge weight must be a finite number in 0..1, got ${e.weight}`);
    }
  }

  for (const q of ds.quizzes) {
    if (!q || typeof q !== "object") throw new Error("dataset.quizzes contains a non-object entry");
    if (!q.id) throw new Error("quiz missing id");
    if (!Array.isArray(q.choices) || q.choices.length < 2) {
      throw new Error(`quiz ${q.id} must have at least 2 choices`);
    }
    const choiceIds = new Set(q.choices.map((c) => c.id));
    if (!choiceIds.has(q.correctChoiceId)) {
      throw new Error(`quiz ${q.id} correctChoiceId not in choices`);
    }
    for (const c of q.choices) {
      if (!Array.isArray(c.nodeIds)) throw new Error(`quiz ${q.id} choice ${c.id} nodeIds must be array`);
      for (const nid of c.nodeIds) {
        if (!ids.has(nid)) throw new Error(`quiz ${q.id} choice ${c.id} references unknown node: ${nid}`);
      }
    }
  }

  return ds;
}
