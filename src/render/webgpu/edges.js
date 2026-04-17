export function createEdgesPipeline(device, format, module, viewBuffer) {
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module, entryPoint: "edge_vs",
      buffers: [
        { arrayStride: 8, stepMode: "vertex", attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }] },
        {
          arrayStride: 20, stepMode: "instance",
          attributes: [
            { shaderLocation: 1, format: "float32x4", offset: 0 },
            { shaderLocation: 2, format: "float32",   offset: 16 },
          ],
        },
      ],
    },
    fragment: { module, entryPoint: "edge_fs", targets: [{ format, blend: premulBlend() }] },
    primitive: { topology: "triangle-list" },
  });

  const cornerBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(cornerBuf, 0, new Float32Array([0,0, 1,0, 1,1,  0,0, 1,1, 0,1]));

  let instBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  let instanceCount = 0;

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: viewBuffer } }],
  });

  return {
    update(f32arr, count) {
      const bytes = f32arr.byteLength;
      if (instBuf.size < bytes) {
        instBuf.destroy();
        instBuf = device.createBuffer({ size: Math.max(bytes, 256), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      }
      device.queue.writeBuffer(instBuf, 0, f32arr);
      instanceCount = count;
    },
    draw(pass) {
      if (!instanceCount) return;
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, cornerBuf);
      pass.setVertexBuffer(1, instBuf);
      pass.draw(6, instanceCount, 0, 0);
    },
    destroy() { cornerBuf.destroy(); instBuf.destroy(); },
  };
}

function premulBlend() {
  return {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  };
}
