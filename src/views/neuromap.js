function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

export function mountNeuromap(dataset, api) {
  const root = document.getElementById("view");
  const nodes = dataset.nodes.filter((n) => n.views.includes("neuromap"));
  const categories = [...new Set(nodes.map((n) => n.category))].sort();

  root.innerHTML = `
    <div class="nm-root">
      <div class="nm-filters" role="group" aria-label="Category filters">
        ${categories.map((c) => `
          <button type="button" class="nm-chip" data-role="nm-filter-chip" data-category="${escapeHtml(c)}"
                  aria-pressed="true">${escapeHtml(c)}</button>
        `).join("")}
      </div>
      <div class="nm-placeholder" data-role="nm-placeholder">
        <p class="nm-hint">Graph rendering lands in Plan 03 (WebGL2) and Plan 04 (WebGPU).</p>
        <p class="nm-count">Dataset: <strong>${nodes.length}</strong> nodes in neuromap view</p>
        <p class="nm-hint2">Use Reference or Worklist tabs for now.</p>
      </div>
    </div>
  `;
  return function unmount() { root.innerHTML = ""; };
}
