import { BACKEND_METHODS } from "./backend.js";

/** @returns {import("./backend.js").RenderBackend} */
export function createMockBackend() {
  const log = [];
  const backend = {
    name: "mock",
    async init() { log.push(["init"]); },
    loadScene(nodes, edges) { log.push(["loadScene", nodes.length, edges.length]); },
    setLayout(hint, ms) { log.push(["setLayout", hint.mode, ms]); },
    setFocus(id) { log.push(["setFocus", id]); },
    setHighlight(ids) { log.push(["setHighlight", ids.length]); },
    setCameraFraction(rect) { log.push(["setCameraFraction", rect]); },
    render() { log.push(["render"]); },
    destroy() { log.push(["destroy"]); },
    _log: log,
  };
  return backend;
}
