import { linkProgram } from "./shaders.js";

/**
 * Instanced-quad node renderer. Reads GLSL source once, compiles once,
 * accepts position/hue/highlight updates via updateInstances().
 */
export function createNodesPipeline(gl, glslSrc) {
  // graph.glsl is a combined file. VERT flag selects vertex stage; omitting EDGE selects node branch.
  // Defines must go AFTER #version (GLSL: #version must be the first directive).
  const vsSrc = glslSrc.replace(/^(#version[^\n]*\n)/, "$1#define VERT\n");
  const fsSrc = glslSrc;
  const prog = linkProgram(gl, vsSrc, fsSrc);
  const aCorner = gl.getAttribLocation(prog, "a_corner");
  const aNode   = gl.getAttribLocation(prog, "a_node");
  const uView   = gl.getUniformLocation(prog, "u_view");
  const uSize   = gl.getUniformLocation(prog, "u_size");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // per-vertex quad corners (2 triangles)
  const cornerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

  // per-instance node data: xy, hue, highlight (vec4)
  const instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  gl.enableVertexAttribArray(aNode);
  gl.vertexAttribPointer(aNode, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aNode, 1);

  gl.bindVertexArray(null);

  let instanceCount = 0;

  return {
    updateInstances(float32Array, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, float32Array, gl.DYNAMIC_DRAW);
      instanceCount = count;
    },
    draw(view, sizeWorld) {
      if (!instanceCount) return;
      gl.useProgram(prog);
      gl.uniformMatrix3fv(uView, false, view);
      gl.uniform1f(uSize, sizeWorld);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
      gl.bindVertexArray(null);
    },
    destroy() { gl.deleteProgram(prog); gl.deleteBuffer(cornerBuf); gl.deleteBuffer(instBuf); gl.deleteVertexArray(vao); },
  };
}
