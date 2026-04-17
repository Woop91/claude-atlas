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
  // Resolve relative to the module's URL so subpath deploys still find shaders.
  // From src/render/webgl2/shaders.js, shaders/ is at ../../../shaders/<name>.
  const resolved = path.startsWith("./shaders/")
    ? new URL(`../../../${path.slice(2)}`, import.meta.url)
    : new URL(path, import.meta.url);
  const res = await fetch(resolved);
  if (!res.ok) throw new Error(`shader fetch failed: ${resolved} ${res.status}`);
  return await res.text();
}
