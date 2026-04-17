import { escapeHtml } from "../core/html.js";

function score(text, query) {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  return 0;
}

function fuzzyFilter(nodes, query, limit = 30) {
  return nodes
    .map((n) => ({ n, s: score(`${n.name} ${n.oneLine}`, query) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.n);
}

function renderRow(n) {
  return `
    <button type="button" class="pl-row" data-role="pl-row" data-id="${n.id}">
      <span class="pl-badge" style="--hue: ${n.badge.hue}">${escapeHtml(n.badge.label)}</span>
      <span class="pl-name">${escapeHtml(n.name)}</span>
      <span class="pl-one">${escapeHtml(n.oneLine)}</span>
      <span class="pl-domain">${escapeHtml(n.domain)}</span>
    </button>
  `;
}

export function mountPalette(dataset, api) {
  const root = document.getElementById("overlays");
  const nodes = dataset.nodes;

  root.innerHTML = `
    <div class="pl-overlay" data-role="palette-overlay" ${api.opened ? "" : "hidden"}>
      <div class="pl-backdrop" data-role="pl-backdrop"></div>
      <div class="pl-dialog" role="dialog" aria-label="Command palette">
        <input type="text" class="pl-input" data-role="pl-input"
               placeholder="Search tools, commands, quizzes…" autocomplete="off" />
        <div class="pl-results" data-role="pl-results">
          ${fuzzyFilter(nodes, "").map(renderRow).join("")}
        </div>
        <div class="pl-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> jump</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  `;

  const overlay = root.querySelector('[data-role="palette-overlay"]');
  const input = root.querySelector('[data-role="pl-input"]');
  const results = root.querySelector('[data-role="pl-results"]');

  function rerender(query) {
    results.innerHTML = fuzzyFilter(nodes, query).map(renderRow).join("");
  }

  input.addEventListener("input", () => rerender(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { api.onClose(); return; }
    if (e.key === "Enter") {
      const first = results.querySelector('[data-role="pl-row"]');
      if (first) {
        api.focus(first.dataset.id);
        api.onClose();
      }
    }
  });

  root.querySelector('[data-role="pl-backdrop"]').addEventListener("click", () => api.onClose());
  results.addEventListener("click", (e) => {
    const row = e.target.closest('[data-role="pl-row"]');
    if (row) { api.focus(row.dataset.id); api.onClose(); }
  });

  return function update({ opened, query }) {
    overlay.hidden = !opened;
    if (opened) {
      if (typeof query === "string") { input.value = query; rerender(query); }
      input.focus();
      overlay.addEventListener("keydown", trapFocus);
    } else {
      overlay.removeEventListener("keydown", trapFocus);
    }
  };
}

function trapFocus(e) {
  if (e.key !== "Tab") return;
  const focusable = e.currentTarget.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
