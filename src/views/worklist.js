function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

function renderCommand(n) {
  return `
    <div class="wl-cmd" data-role="wl-cmd-entry" id="wl-${n.id.replace(/\./g, "-")}">
      <header>
        <span class="wl-badge" style="--hue: ${n.badge.hue}">${escapeHtml(n.badge.label)}</span>
        <h3>${escapeHtml(n.name)}</h3>
      </header>
      <p class="wl-lede">${escapeHtml(n.oneLine)}</p>
      <pre><code>${escapeHtml(n.syntax ?? n.name)}</code></pre>
      ${(n.examples ?? []).map((e) => `<pre><code>${escapeHtml(e)}</code></pre>`).join("")}
    </div>
  `;
}

export function mountWorklist(dataset, api) {
  const root = document.getElementById("view");
  const commands = dataset.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");

  root.innerHTML = `
    <div class="wl-root">
      <nav class="wl-tabs" role="tablist">
        <button type="button" role="tab" data-role="wl-tab" data-tab="commands" aria-selected="true">Commands</button>
        <button type="button" role="tab" data-role="wl-tab" data-tab="quiz" aria-selected="false">Quiz</button>
        <button type="button" role="tab" data-role="wl-tab" data-tab="insights" aria-selected="false">Insights</button>
      </nav>
      <section data-role="wl-panel" data-tab="commands">
        ${commands.map(renderCommand).join("")}
      </section>
      <section data-role="wl-panel" data-tab="quiz" hidden></section>
      <section data-role="wl-panel" data-tab="insights" hidden></section>
    </div>
  `;

  function handleClick(e) {
    const tab = e.target.closest('[data-role="wl-tab"]');
    if (!tab) return;
    const target = tab.dataset.tab;
    root.querySelectorAll('[data-role="wl-tab"]').forEach((t) => {
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    root.querySelectorAll('[data-role="wl-panel"]').forEach((p) => {
      p.hidden = p.dataset.tab !== target;
    });
  }
  root.addEventListener("click", handleClick);

  return function unmount() {
    root.removeEventListener("click", handleClick);
    root.innerHTML = "";
  };
}
