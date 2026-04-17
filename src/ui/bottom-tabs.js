import { VIEWS } from "../core/router.js";

const ICONS = { neuromap: "◉", reference: "≡", worklist: "✓" };

export function mountBottomTabs({ currentView }, api) {
  const root = document.getElementById("bottom-tabs");
  root.innerHTML = VIEWS.map((v) => `
    <button type="button" data-role="bt-tab" data-view="${v}"
            ${v === currentView ? 'aria-current="page"' : ""}>
      <span class="bt-icon" aria-hidden="true">${ICONS[v]}</span>
      <span class="bt-label">${v}</span>
    </button>
  `).join("");
  root.addEventListener("click", (e) => {
    const t = e.target.closest('[data-role="bt-tab"]');
    if (t) api.go(t.dataset.view);
  });
  return function update(view) {
    root.querySelectorAll('[data-role="bt-tab"]').forEach((b) => {
      if (b.dataset.view === view) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  };
}
