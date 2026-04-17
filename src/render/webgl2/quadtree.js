/**
 * Barnes-Hut quadtree. Nodes are either leaves (0 or 1 body) or internal
 * (mass = sum of children, com = mass-weighted center of mass).
 * theta < 1 = more accurate (more recursion). theta = 0.5 is the classic.
 */

function makeNode(bounds) {
  return { bounds, count: 0, mass: 0, com: { x: 0, y: 0 }, body: null, children: null };
}

function inside(b, p) {
  return p.x >= b.x && p.x < b.x + b.size && p.y >= b.y && p.y < b.y + b.size;
}

function subdivide(node) {
  const { x, y, size } = node.bounds;
  const half = size / 2;
  node.children = [
    makeNode({ x,        y,        size: half }),
    makeNode({ x: x+half, y,       size: half }),
    makeNode({ x,        y: y+half, size: half }),
    makeNode({ x: x+half, y: y+half, size: half }),
  ];
}

function insertInto(node, body) {
  if (node.children === null && node.body === null) {
    node.body = body;
    node.count = 1;
    node.mass = body.mass;
    node.com = { x: body.x, y: body.y };
    return;
  }
  if (node.children === null) {
    // was a leaf with one body — subdivide and re-insert existing
    const existing = node.body;
    node.body = null;
    subdivide(node);
    insertInto(node.children.find((c) => inside(c.bounds, existing)), existing);
  }
  // internal node: accumulate and recurse
  const newMass = node.mass + body.mass;
  node.com = {
    x: (node.com.x * node.mass + body.x * body.mass) / newMass,
    y: (node.com.y * node.mass + body.y * body.mass) / newMass,
  };
  node.mass = newMass;
  node.count += 1;
  const target = node.children.find((c) => inside(c.bounds, body));
  if (target) insertInto(target, body);
}

function forceFromNode(node, p, theta) {
  if (node.count === 0) return { x: 0, y: 0 };
  const dx = node.com.x - p.x;
  const dy = node.com.y - p.y;
  const dist2 = dx * dx + dy * dy + 1e-6;
  const dist = Math.sqrt(dist2);
  // leaf or sufficiently far → single-node approximation
  if (node.children === null || (node.bounds.size / dist) < theta) {
    const f = node.mass / dist2;
    return { x: f * dx / dist, y: f * dy / dist };
  }
  // otherwise recurse
  let fx = 0, fy = 0;
  for (const c of node.children) {
    const f = forceFromNode(c, p, theta);
    fx += f.x; fy += f.y;
  }
  return { x: fx, y: fy };
}

export function createQuadtree(bounds) {
  const root = makeNode(bounds);
  return {
    root,
    insert(body) { if (inside(bounds, body)) insertInto(root, body); },
    forceAt(p, { theta = 0.5 } = {}) { return forceFromNode(root, p, theta); },
  };
}
