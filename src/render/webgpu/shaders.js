const cache = new Map();

/** Fetch a WGSL source by path (relative to page). Cached across calls. */
export async function loadWGSL(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`wgsl fetch failed: ${path} ${res.status}`);
  const src = await res.text();
  cache.set(path, src);
  return src;
}

/** Build a GPUShaderModule and surface compilation diagnostics. */
export async function createModule(device, code, label = "wgsl") {
  const mod = device.createShaderModule({ label, code });
  const info = await mod.getCompilationInfo?.();
  if (info) {
    const errs = info.messages.filter((m) => m.type === "error");
    if (errs.length) {
      throw new Error(`wgsl compile (${label}):\n${errs.map((m) => `  ${m.lineNum}:${m.linePos} ${m.message}`).join("\n")}`);
    }
  }
  return mod;
}
