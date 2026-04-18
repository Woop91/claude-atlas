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
                aria-selected="${v === currentView ? "true" : "false"}">${v}</button>
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
      b.setAttribute("aria-selected", b.dataset.view === view ? "true" : "false");
    });
  };
}
