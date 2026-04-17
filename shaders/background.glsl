#version 300 es
// fullscreen triangle
#ifdef VERT
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
#else
precision highp float;
in vec2 v_uv;
uniform float u_time;
out vec4 o_col;
// cheap 2D noise (Perlin-ish, low-octave per spec 7.2)
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
void main() {
  vec2 p = v_uv * 4.0 + u_time * 0.04;
  float n = noise(p) * 0.8 + noise(p * 2.0) * 0.2;
  vec3 col = mix(vec3(0.028, 0.028, 0.060), vec3(0.05, 0.05, 0.10), n);
  o_col = vec4(col, 1.0);
}
#endif
