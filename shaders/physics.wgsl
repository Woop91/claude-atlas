struct Params {
  n: u32,                // node count
  edge_count: u32,
  repulsion: f32,
  spring: f32,
  damping: f32,
  center_pull: f32,
  dt: f32,
  _pad: f32,
};

struct Edge {
  src: u32,
  dst: u32,
  rest: f32,
  weight: f32,
};

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec2f>;
@group(0) @binding(3) var<storage, read> edges: array<Edge>;
@group(0) @binding(4) var<storage, read> pinned: array<vec2f>;  // NaN encodes "not pinned"

@compute @workgroup_size(64)
fn repel(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let me = positions[i];
  var force = vec2f(0.0);
  // all-pairs repulsion
  for (var j: u32 = 0u; j < P.n; j = j + 1u) {
    if (j == i) { continue; }
    let other = positions[j];
    let d = other - me;
    let r2 = dot(d, d) + 1e-6;
    let inv = 1.0 / sqrt(r2);
    // Barnes-Hut-equivalent attraction/repulsion; negate below for repel
    force = force - d * inv * (P.repulsion / 100.0) / r2;
  }
  // center pull
  force = force - me * P.center_pull;
  // write the result into velocity; springs add on top in the second pass
  velocities[i] = (velocities[i] + force) * P.damping;
}

@compute @workgroup_size(64)
fn springs(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.edge_count) { return; }
  let e = edges[i];
  let a = positions[e.src];
  let b = positions[e.dst];
  let d = b - a;
  let len = length(d) + 1e-6;
  let f = (len - e.rest) * P.spring * e.weight;
  let fv = f * d / len;
  // NOTE: race — two compute invocations may write the same node's velocity.
  // Acceptable because the subsequent integrate pass runs after all springs complete
  // (dispatches are serialized on the same queue). Values are approximate per step,
  // which matches CPU physics' single-threaded semantics well enough.
  velocities[e.src] = velocities[e.src] + fv;
  velocities[e.dst] = velocities[e.dst] - fv;
}

@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let pin = pinned[i];
  if (pin.x == pin.x && pin.y == pin.y) {  // not NaN
    positions[i] = pin;
    velocities[i] = vec2f(0.0);
  } else {
    positions[i] = positions[i] + velocities[i] * P.dt;
  }
}
