#version 300 es
// ----- VERTEX (node & edge draw) -----
// Build flag: pass -DEDGE when linking the edge program, otherwise nodes.

#ifdef EDGE
// per-vertex quad corner (0..1)
in vec2 a_corner;
// per-instance: x,y of source and x,y of target
in vec4 a_segment;
// per-instance: weight in [0,1]
in float a_weight;
uniform mat3 u_view; // world → clip
out float v_weight;
void main() {
  vec2 a = a_segment.xy;
  vec2 b = a_segment.zw;
  vec2 dir = normalize(b - a);
  vec2 perp = vec2(-dir.y, dir.x);
  float thickness = mix(1.0, 3.0, a_weight);
  vec2 world = mix(a, b, a_corner.x) + perp * (a_corner.y - 0.5) * thickness;
  vec3 clip = u_view * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_weight = a_weight;
}

#else
// node: per-instance x,y,hue,highlight
in vec2 a_corner;           // quad corner 0..1
in vec4 a_node;              // xy = pos, z = hue (radians), w = highlight in [0,1]
uniform mat3 u_view;
uniform float u_size;         // pixel size in world units
out vec2 v_uv;
out float v_hue;
out float v_highlight;
void main() {
  vec2 world = a_node.xy + (a_corner - 0.5) * u_size;
  vec3 clip = u_view * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_corner;
  v_hue = a_node.z;
  v_highlight = a_node.w;
}
#endif

// ----- FRAGMENT (node) -----
#ifndef EDGE
in vec2 v_uv; in float v_hue; in float v_highlight;
out vec4 o_col;
vec3 hslToRgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgb;
  if      (hp < 1.0) rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else               rgb = vec3(c, 0.0, x);
  float m = l - 0.5 * c;
  return rgb + vec3(m);
}
void main() {
  vec2 p = v_uv - 0.5;
  float d = length(p);
  float disc = smoothstep(0.48, 0.44, d);
  float halo = smoothstep(0.5, 0.35, d) - disc;
  vec3 base = hslToRgb(v_hue / 6.2831853, 0.7, 0.62);
  vec3 bright = mix(base, vec3(1.0), v_highlight * 0.6);
  float alpha = disc + halo * (0.25 + v_highlight * 0.5);
  o_col = vec4(bright * alpha, alpha);
}

// ----- FRAGMENT (edge) -----
#else
in float v_weight;
out vec4 o_col;
void main() {
  o_col = vec4(1.0, 1.0, 1.0, v_weight * 0.35);
}
#endif
