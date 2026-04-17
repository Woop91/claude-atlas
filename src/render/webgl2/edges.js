import { linkProgram } from "./shaders.js";

export function createEdgesPipeline(gl, glslSrc) {
  const prog = linkProgram(gl, `#define EDGE\n${glslSrc}`, `#define EDGE\n${glslSrc}`);
  const aCorner  = gl.getAttribLocation(prog, "a_corner");
  const aSegment = gl.getAttribLocation(prog, "a_segment");
  const aWeight  = gl.getAttribLocation(prog, "a_weight");
  const uView    = gl.getUniformLocation(prog, "u_view");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const cornerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

  const segBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  gl.enableVertexAttribArray(aSegment);
  gl.vertexAttribPointer(aSegment, 4, gl.FLOAT, false, 5 * 4, 0);
  gl.vertexAttribDivisor(aSegment, 1);
  gl.enableVertexAttribArray(aWeight);
  gl.vertexAttribPointer(aWeight, 1, gl.FLOAT, false, 5 * 4, 4 * 4);
  gl.vertexAttribDivisor(aWeight, 1);

  gl.bindVertexArray(null);

  let count = 0;

  return {
    updateInstances(float32Array, instanceCount) {
      gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
      gl.bufferData(gl.ARRAY_BUFFER, float32Array, gl.DYNAMIC_DRAW);
      count = instanceCount;
    },
    draw(view) {
      if (!count) return;
      gl.useProgram(prog);
      gl.uniformMatrix3fv(uView, false, view);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      gl.bindVertexArray(null);
    },
    destroy() { gl.deleteProgram(prog); gl.deleteBuffer(cornerBuf); gl.deleteBuffer(segBuf); gl.deleteVertexArray(vao); },
  };
}
