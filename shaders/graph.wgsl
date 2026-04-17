struct View {
  sx: f32,
  sy: f32,
  tx: f32,
  ty: f32,
  size: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> u: View;

struct NodeInst {
  @location(1) pos: vec2f,
  @location(2) hue: f32,
  @location(3) highlight: f32,
};

struct NodeVOut {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
  @location(1) hue: f32,
  @location(2) highlight: f32,
};

@vertex
fn node_vs(@location(0) corner: vec2f, inst: NodeInst) -> NodeVOut {
  let world = inst.pos + (corner - vec2f(0.5)) * u.size;
  let cx = u.sx * world.x + u.tx;
  let cy = u.sy * world.y + u.ty;
  var o: NodeVOut;
  o.clip = vec4f(cx, cy, 0.0, 1.0);
  o.uv = corner;
  o.hue = inst.hue;
  o.highlight = inst.highlight;
  return o;
}

fn hsl_to_rgb(h: f32, s: f32, l: f32) -> vec3f {
  let c = (1.0 - abs(2.0 * l - 1.0)) * s;
  let hp = h * 6.0;
  let x = c * (1.0 - abs((hp % 2.0) - 1.0));
  var rgb = vec3f(0.0);
  if (hp < 1.0) { rgb = vec3f(c, x, 0.0); }
  else if (hp < 2.0) { rgb = vec3f(x, c, 0.0); }
  else if (hp < 3.0) { rgb = vec3f(0.0, c, x); }
  else if (hp < 4.0) { rgb = vec3f(0.0, x, c); }
  else if (hp < 5.0) { rgb = vec3f(x, 0.0, c); }
  else { rgb = vec3f(c, 0.0, x); }
  let m = l - 0.5 * c;
  return rgb + vec3f(m);
}

@fragment
fn node_fs(in: NodeVOut) -> @location(0) vec4f {
  let p = in.uv - vec2f(0.5);
  let d = length(p);
  let disc = smoothstep(0.48, 0.44, d);
  let halo = smoothstep(0.5, 0.35, d) - disc;
  let base = hsl_to_rgb(in.hue / 6.2831853, 0.7, 0.62);
  let bright = mix(base, vec3f(1.0), in.highlight * 0.6);
  let alpha = disc + halo * (0.25 + in.highlight * 0.5);
  return vec4f(bright * alpha, alpha);
}

struct EdgeInst {
  @location(1) seg: vec4f,
  @location(2) weight: f32,
};

struct EdgeVOut {
  @builtin(position) clip: vec4f,
  @location(0) weight: f32,
};

@vertex
fn edge_vs(@location(0) corner: vec2f, inst: EdgeInst) -> EdgeVOut {
  let a = inst.seg.xy;
  let b = inst.seg.zw;
  let dir = normalize(b - a);
  let perp = vec2f(-dir.y, dir.x);
  let thickness = mix(1.0, 3.0, inst.weight);
  let world = mix(a, b, corner.x) + perp * (corner.y - 0.5) * thickness;
  let cx = u.sx * world.x + u.tx;
  let cy = u.sy * world.y + u.ty;
  var o: EdgeVOut;
  o.clip = vec4f(cx, cy, 0.0, 1.0);
  o.weight = inst.weight;
  return o;
}

@fragment
fn edge_fs(in: EdgeVOut) -> @location(0) vec4f {
  return vec4f(1.0, 1.0, 1.0, in.weight * 0.35);
}
