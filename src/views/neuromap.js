import { escapeHtml } from "../core/html.js";

export function mountNeuromap(dataset, api) {
  const root = document.getElementById("view");
  const nodes = dataset.nodes.filter((n) => n.views.includes("neuromap"));
  const categories = [...new Set(nodes.map((n) => n.category))].sort();
  const active = new Set(categories);

  root.innerHTML = `
    <div class="nm-root">
      <div class="nm-filters" role="group" aria-label="Category filters">
        ${categories.map((c) => `
          <button type="button" class="nm-chip" data-role="nm-filter-chip" data-category="${escapeHtml(c)}"
                  aria-pressed="true">${escapeHtml(c)}</button>
        `).join("")}
      </div>
      <div class="nm-hud" data-role="nm-hud">
        <span class="nm-hud-count"><strong>${nodes.length}</strong> nodes</span>
        <span class="nm-hud-hint">click a node · ⌘K to jump · drag filters to isolate</span>
      </div>
    </div>
  `;

  function applyHighlight() {
    const ids = nodes.filter((n) => active.has(n.category)).map((n) => n.id);
    api.highlight(ids);
  }

  function handleClick(e) {
    const chip = e.target.closest('[data-role="nm-filter-chip"]');
    if (!chip) return;
    const cat = chip.dataset.category;
    if (active.has(cat)) { active.delete(cat); chip.setAttribute("aria-pressed", "false"); }
    else                 { active.add(cat);    chip.setAttribute("aria-pressed", "true"); }
    applyHighlight();
  }
  root.addEventListener("click", handleClick);
  applyHighlight();

  return function unmount() {
    root.removeEventListener("click", handleClick);
    root.innerHTML = "";
  };
}
