import { VIEWS } from "../core/router.js";

export function mountTopbar({ currentView }, api) {
  const root = document.getElementById("topbar");
  root.innerHTML = `
    <div class="tb-left">
      <span data-role="wordmark">ATLAS</span>
    </div>
    <div class="tb-center" role="tablist">
      ${VIEWS.map((v) => `
        <button type="button" role="tab" data-role="view-tab" data-view="${v}"
                ${v === currentView ? 'aria-current="page" aria-selected="true"' : 'aria-selected="false"'}>${v}</button>
      `).join("")}
    </div>
    <div class="tb-right">
      <button type="button" data-role="palette-hint" aria-label="Open command palette">
        <span class="kbd">⌘K</span>
      </button>
    </div>
  `;
  root.addEventListener("click", (e) => {
    const tab = e.target.closest('[data-role="view-tab"]');
    if (tab) { api.go(tab.dataset.view); return; }
    const hint = e.target.closest('[data-role="palette-hint"]');
    if (hint) { api.openPalette(); return; }
  });
  return function updateTopbar(view) {
    root.querySelectorAll('[data-role="view-tab"]').forEach((b) => {
      const active = b.dataset.view === view;
      if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  };
}
