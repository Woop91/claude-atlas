import { linkProgram } from "./shaders.js";

export function createBackgroundPipeline(gl, glslSrc) {
  const prog = linkProgram(gl, `#define VERT\n${glslSrc}`, glslSrc);
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
