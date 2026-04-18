import { DATASET } from "../data/data.js";
import { createStore } from "./store.js";
import { createRouter, VIEWS } from "./router.js";
import { createMockBackend } from "../render/mock-backend.js";
import { createWebGL2Backend } from "../render/webgl2-backend.js";
import { createWebGPUBackend } from "../render/webgpu-backend.js";
import { detectBackend } from "../render/backend-detect.js";
import { mountTopbar } from "../ui/topbar.js";
import { mountBottomTabs } from "../ui/bottom-tabs.js";
import { mountNeuromap } from "../views/neuromap.js";
import { mountReference } from "../views/reference.js";
import { mountWorklist } from "../views/worklist.js";
import { mountPalette } from "../ui/palette.js";
import { installSeededRandom } from "./prng.js";

const params = new URLSearchParams(location.search);
const testSeedRaw = params.get("test");
export const IS_TEST_MODE = testSeedRaw !== null;
if (IS_TEST_MODE) {
  const seed = Number(testSeedRaw) || 42;
  installSeededRandom(seed); // irreversible for session — test harness controls the tab
}

document.body.dataset.ready = "loading";

const store = createStore({
  view: "neuromap",
  focusedId: null,
  highlight: [],
  paletteOpen: false,
  theme: "dark",
  ready: false,
});

const router = createRouter();
// Backend selection per spec 7.3. WebGPU-first with webgl2 fallback (Plan 04).
// URL override: ?backend=mock|webgl2|webgpu for testing
const forced = params.get("backend");
// async detection — module-level await blocks the module load until detectBackend resolves
const chosen = await detectBackend({ forced, gpu: navigator.gpu ?? null });
const backendOpts = IS_TEST_MODE ? { maxPhysicsSteps: 200 } : {};
const backend = chosen === "mock"    ? createMockBackend()
              : chosen === "webgpu"  ? createWebGPUBackend(backendOpts)
                                      : createWebGL2Backend(backendOpts);

const api = {
  go: (v) => router.go(v),
  focus: (id) => store.patch({ focusedId: id }),
  highlight: (ids) => { backend.setHighlight(ids); store.patch({ highlight: ids }); },
  openPalette: () => store.patch({ paletteOpen: true }),
};

const VIEW_MOUNTERS = {
  neuromap: mountNeuromap,
  reference: mountReference,
  worklist: mountWorklist,
};

const CAMERA_FRAC = {
  neuromap:  { x: 0, y: 0, w: 1,    h: 1 },
  reference: { x: 0, y: 0, w: 0.33, h: 1 },
  worklist:  { x: 0, y: 0, w: 0.33, h: 1 },
};

let unmountCurrent = null;

function switchView(view) {
  if (unmountCurrent) { unmountCurrent(); unmountCurrent = null; }
  const mounter = VIEW_MOUNTERS[view];
  unmountCurrent = mounter(DATASET, api);
  document.getElementById("shell").dataset.view = view;
  backend.setCameraFraction(CAMERA_FRAC[view] ?? CAMERA_FRAC.neuromap);
}

async function main() {
  const canvas = document.getElementById("gpu");
  await backend.init(canvas);
  canvas.addEventListener("atlas:pick", (e) => {
    api.focus(e.detail.id);
  });
  backend.loadScene(DATASET.nodes, DATASET.edges);

  router.start();
  const initialView = router.current();
  store.patch({ view: initialView });

  const updateTopbar = mountTopbar({ currentView: initialView }, api);
  const updateBottom = mountBottomTabs({ currentView: initialView }, api);

  switchView(initialView);

  // palette
  const updatePalette = mountPalette(DATASET, {
    opened: false,
    onClose: () => store.patch({ paletteOpen: false }),
    go: api.go,
    focus: api.focus,
  });
  store.subscribe((s, p) => {
    if (s.paletteOpen !== p.paletteOpen) updatePalette({ opened: s.paletteOpen });
  });

  // global hotkey
  window.addEventListener("keydown", (e) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key.toLowerCase() === "k") {
      e.preventDefault();
      api.openPalette();
    } else if (e.key === "Escape" && store.get().paletteOpen) {
      store.patch({ paletteOpen: false });
    } else if (!isMeta && ["1","2","3"].includes(e.key) && e.target === document.body) {
      api.go(VIEWS[Number(e.key) - 1]);
    }
  });

  router.subscribe((next) => {
    store.patch({ view: next });
    switchView(next);
    updateTopbar(next);
    updateBottom(next);
    const main = document.getElementById("view");
    main.setAttribute("aria-busy", "true");
    queueMicrotask(() => main.setAttribute("aria-busy", "false"));
  });

  store.patch({ ready: true });
  document.body.dataset.ready = "true";
}

main().catch((err) => {
  document.body.dataset.ready = "error";
  document.body.textContent = `Claude Atlas failed to boot: ${err.message}`;
  throw err;
});

export { store, router, backend, VIEWS, api };
