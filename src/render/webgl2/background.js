import { linkProgram } from "./shaders.js";

export function createBackgroundPipeline(gl, glslSrc) {
  // VERT flag selects the vertex branch; fragment uses default. Inject after #version.
  const vsSrc = glslSrc.replace(/^(#version[^\n]*\n)/, "$1#define VERT\n");
  const fsSrc = glslSrc;
  const prog = linkProgram(gl, vsSrc, fsSrc);
  const uTime = gl.getUniformLocation(prog, "u_time");
  const vao = gl.createVertexArray();
  return {
    draw(tSeconds) {
      gl.useProgram(prog);
      gl.uniform1f(uTime, tSeconds);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    destroy() { gl.deleteProgram(prog); gl.deleteVertexArray(vao); },
  };
}
