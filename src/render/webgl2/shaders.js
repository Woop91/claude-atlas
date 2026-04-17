/** Compile a single shader stage. Throws with the full info log on failure. */
export function compileShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed:\n${log}`);
  }
  return sh;
}

/** Link vertex+fragment into a program. Deletes shaders after linking. */
export function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`program link failed:\n${log}`);
  }
  return prog;
}

/** Fetch shader source from the shaders/ directory. */
export async function loadShader(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`shader fetch failed: ${path} ${res.status}`);
  return await res.text();
}
