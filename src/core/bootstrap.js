import { DATASET } from "../data/data.js";
import { createStore } from "./store.js";
import { createRouter, VIEWS } from "./router.js";
import { createMockBackend } from "../render/mock-backend.js";

const store = createStore({
  view: "neuromap",
  focusedId: null,
  highlight: [],
  paletteOpen: false,
  theme: "dark",
  ready: false,
});

const router = createRouter();
const backend = createMockBackend();

async function main() {
  const canvas = document.getElementById("gpu");
  await backend.init(canvas);
  backend.loadScene(DATASET.nodes, DATASET.edges);

  router.start();
  store.patch({ view: router.current(), ready: true });

  router.subscribe((next) => store.patch({ view: next }));

  document.getElementById("shell").dataset.view = store.get().view;
  store.subscribe((s, p) => {
    if (s.view !== p.view) {
      document.getElementById("shell").dataset.view = s.view;
    }
  });

  document.body.dataset.ready = "true";
}

main().catch((err) => {
  document.body.dataset.ready = "error";
  document.body.textContent = `Claude Atlas failed to boot: ${err.message}`;
  throw err;
});

export { store, router, backend, VIEWS };
