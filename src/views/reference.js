const DOMAINS = [
  { id: "all", label: "All" },
  { id: "claude", label: "Claude Tools" },
  { id: "worklist", label: "Worklist" },
  { id: "concept", label: "Concepts" },
];

function renderEntry(n) {
  const syntax = n.syntax ? `<pre><code>${escapeHtml(n.syntax)}</code></pre>` : "";
  const examples = (n.examples ?? []).map((e) =>
    `<pre><code>${escapeHtml(e)}</code></pre>`
  ).join("");
  const tags = n.tags.map((t) => `<span class="ref-tag">${escapeHtml(t)}</span>`).join("");
  return `
    <section class="ref-entry" data-role="ref-entry" data-domain="${n.domain}" data-kind="${n.kind}" id="ref-${n.id.replace(/\./g, "-")}">
      <header>
        <span class="ref-badge" style="--hue: ${n.badge.hue}">${escapeHtml(n.badge.label)}</span>
        <h2>${escapeHtml(n.name)}</h2>
      </header>
      <p class="ref-lede">${escapeHtml(n.oneLine)}</p>
      <div class="ref-body">${escapeHtml(n.description).replace(/\n\n/g, "</p><p>").replace(/^/, "<p>").replace(/$/, "</p>")}</div>
      ${syntax}
      ${examples}
      <div class="ref-tags">${tags}</div>
    </section>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

export function mountReference(dataset, api) {
  const root = document.getElementById("view");
  const nodes = dataset.nodes.filter((n) => n.views.includes("reference"));
  root.innerHTML = `
    <div class="ref-root">
      <nav class="ref-tabs" role="tablist">
        ${DOMAINS.map((d) => `
          <button type="button" role="tab" data-role="ref-domain-tab" data-domain="${d.id}"
                  ${d.id === "all" ? 'aria-selected="true"' : 'aria-selected="false"'}>${d.label}</button>
        `).join("")}
      </nav>
      <div class="ref-list">
        ${nodes.map(renderEntry).join("")}
      </div>
    </div>
  `;

  root.addEventListener("click", (e) => {
    const tab = e.target.closest('[data-role="ref-domain-tab"]');
    if (!tab) return;
    const domain = tab.dataset.domain;
    root.querySelectorAll('[data-role="ref-domain-tab"]').forEach((t) => {
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    root.querySelectorAll('[data-role="ref-entry"]').forEach((s) => {
      const match = domain === "all"
        || (domain === "concept" && s.dataset.kind === "concept")
        || (domain !== "concept" && s.dataset.domain === domain);
      s.hidden = !match;
    });
  });

  return function unmount() { root.innerHTML = ""; };
}
