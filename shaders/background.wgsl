struct Frame {
  time: f32,
  _pad: vec3f,
};

@group(0) @binding(0) var<uniform> f: Frame;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = p;
  return o;
}

fn hash2(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let g = fract(p);
  let u = g * g * (3.0 - 2.0 * g);
  return mix(
    mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), u.x),
    mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x),
    u.y
  );
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let p = in.uv * 4.0 + f.time * 0.04;
  let n = noise2(p) * 0.8 + noise2(p * 2.0) * 0.2;
  let col = mix(vec3f(0.028, 0.028, 0.060), vec3f(0.05, 0.05, 0.10), n);
  return vec4f(col, 1.0);
}
