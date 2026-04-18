/**
 * GPU-side physics. Wraps the physics.wgsl compute passes.
 * Matches the CPU physics.js API: { positions (Float32Array mirror), step(dt), pin(i,x,y), unpin(i), dispose }.
 * positions mirror is an optional read-back for debugging/picking; populate via copyBufferToBuffer + mapReadAsync.
 */
export async function createGpuPhysics({ device, module, count, edges, bounds = 400, maxSteps = null }) {
  const paramsSize = 32; // 2*u32 + 6*f32, padded
  const paramsBuf = device.createBuffer({ size: paramsSize, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const posBuf = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  const velBuf = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const pinBuf = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

  // Initial positions in [-bounds/2, bounds/2]
  const initPos = new Float32Array(count * 2);
  for (let i = 0; i < count * 2; i++) initPos[i] = (Math.random() - 0.5) * bounds;
  device.queue.writeBuffer(posBuf, 0, initPos);

  const initVel = new Float32Array(count * 2);
  device.queue.writeBuffer(velBuf, 0, initVel);

  const initPin = new Float32Array(count * 2).fill(NaN);
  device.queue.writeBuffer(pinBuf, 0, initPin);

  // Edge storage: 2 u32 + 2 f32 = 16B each
  const edgeCount = edges.length;
  const edgeBytes = Math.max(16, edgeCount * 16);
  const edgeBuf = device.createBuffer({ size: edgeBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  if (edgeCount) {
    const ab = new ArrayBuffer(edgeCount * 16);
    const dv = new DataView(ab);
    for (let i = 0; i < edgeCount; i++) {
      dv.setUint32(i*16, edges[i].source, true);
      dv.setUint32(i*16+4, edges[i].target, true);
      dv.setFloat32(i*16+8, edges[i].rest ?? 60, true);
      dv.setFloat32(i*16+12, edges[i].weight ?? 1, true);
    }
    device.queue.writeBuffer(edgeBuf, 0, ab);
  }

  const repelPipe = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "repel" } });
  const springPipe = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "springs" } });
  const integratePipe = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "integrate" } });

  function bindFor(pipeline) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: posBuf } },
        { binding: 2, resource: { buffer: velBuf } },
        { binding: 3, resource: { buffer: edgeBuf } },
        { binding: 4, resource: { buffer: pinBuf } },
      ],
    });
  }

  let stepsTaken = 0;
  return {
    posBuf, velBuf,
    step(dt = 1/60) {
      if (maxSteps !== null && stepsTaken >= maxSteps) return;
      stepsTaken += 1;
      const params = new ArrayBuffer(paramsSize);
      const dv = new DataView(params);
      dv.setUint32(0, count, true);
      dv.setUint32(4, edgeCount, true);
      dv.setFloat32(8, 800, true);    // repulsion
      dv.setFloat32(12, 0.05, true);  // spring
      dv.setFloat32(16, 0.85, true);  // damping
      dv.setFloat32(20, 0.002, true); // centerPull
      dv.setFloat32(24, dt, true);
      device.queue.writeBuffer(paramsBuf, 0, params);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      const wg = Math.ceil(count / 64);
      const ewg = Math.max(1, Math.ceil(edgeCount / 64));

      pass.setPipeline(repelPipe);
      pass.setBindGroup(0, bindFor(repelPipe));
      pass.dispatchWorkgroups(wg);

      if (edgeCount) {
        pass.setPipeline(springPipe);
        pass.setBindGroup(0, bindFor(springPipe));
        pass.dispatchWorkgroups(ewg);
      }

      pass.setPipeline(integratePipe);
      pass.setBindGroup(0, bindFor(integratePipe));
      pass.dispatchWorkgroups(wg);

      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    pin(i, x, y) {
      const data = new Float32Array([x, y]);
      device.queue.writeBuffer(pinBuf, i * 8, data);
    },
    unpin(i) {
      const data = new Float32Array([NaN, NaN]);
      device.queue.writeBuffer(pinBuf, i * 8, data);
    },
    async readbackPositions() {
      const staging = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(posBuf, 0, staging, 0, count * 8);
      device.queue.submit([enc.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const out = new Float32Array(staging.getMappedRange().slice(0));
      staging.unmap(); staging.destroy();
      return out;
    },
    destroy() { paramsBuf.destroy(); posBuf.destroy(); velBuf.destroy(); pinBuf.destroy(); edgeBuf.destroy(); },
  };
}
