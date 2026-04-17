import { DATASET } from "../data/data.js";
import { createStore } from "./store.js";
import { createRouter, VIEWS } from "./router.js";
import { createMockBackend } from "../render/mock-backend.js";
import { createWebGL2Backend } from "../render/webgl2-backend.js";
import { mountTopbar } from "../ui/topbar.js";
import { mountBottomTabs } from "../ui/bottom-tabs.js";
import { mountNeuromap } from "../views/neuromap.js";
import { mountReference } from "../views/reference.js";
import { mountWorklist } from "../views/worklist.js";
import { mountPalette } from "../ui/palette.js";

const store = createStore({
  view: "neuromap",
  focusedId: null,
  highlight: [],
  paletteOpen: false,
  theme: "dark",
  ready: false,
});

const router = createRouter();
// Backend selection per spec 7.3. No WebGPU in Plan 03 — that lands in Plan 04.
// URL override: ?backend=mock|webgl2 for testing
const forced = new URLSearchParams(location.search).get("backend");
const backend = forced === "mock" ? createMockBackend()
               : forced === "webgl2" ? createWebGL2Backend()
               : createWebGL2Backend();

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

let unmountCurrent = null;

function switchView(view) {
  if (unmountCurrent) { unmountCurrent(); unmountCurrent = null; }
  const mounter = VIEW_MOUNTERS[view];
  unmountCurrent = mounter(DATASET, api);
  document.getElementById("shell").dataset.view = view;
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
