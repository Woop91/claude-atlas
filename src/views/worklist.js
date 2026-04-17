import { escapeHtml } from "../core/html.js";

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

const STORAGE_KEY = "atlas.quiz.v1";

function loadQuizState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveQuizState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function renderQuiz(q, chosenId) {
  const choices = q.choices.map((c) => {
    const isChosen = chosenId === c.id;
    const isCorrect = c.id === q.correctChoiceId;
    const classes = ["wl-choice"];
    if (chosenId) {
      if (isCorrect) classes.push("is-correct");
      if (isChosen && !isCorrect) classes.push("is-wrong");
    }
    return `<button type="button" class="${classes.join(" ")}" data-role="wl-choice"
              data-quiz="${q.id}" data-choice="${c.id}" ${chosenId ? "disabled" : ""}>${escapeHtml(c.text)}</button>`;
  }).join("");
  return `
    <div class="wl-quiz-card" data-role="wl-quiz-card" data-quiz="${q.id}">
      <p class="wl-prompt">${escapeHtml(q.prompt)}</p>
      <div class="wl-choices">${choices}</div>
      <p class="wl-explanation" data-role="wl-explanation" ${chosenId ? "" : "hidden"}>${escapeHtml(q.explanation)}</p>
    </div>
  `;
}

function renderQuizPanel(quizzes, state) {
  return `<div class="wl-quiz-list">${quizzes.map((q) => renderQuiz(q, state[q.id] ?? null)).join("")}</div>`;
}

function renderInsight(n) {
  return `
    <article class="wl-insight" data-role="wl-insight-card" id="wl-${n.id.replace(/\./g, "-")}">
      <h3>${escapeHtml(n.name)}</h3>
      <p class="wl-insight-lede">${escapeHtml(n.oneLine)}</p>
      <p class="wl-insight-body">${escapeHtml(n.description)}</p>
    </article>
  `;
}

export function mountWorklist(dataset, api) {
  const root = document.getElementById("view");
  const commands = dataset.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
  let quizState = loadQuizState();

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
      <section data-role="wl-panel" data-tab="quiz" hidden>
        ${renderQuizPanel(dataset.quizzes, quizState)}
      </section>
      <section data-role="wl-panel" data-tab="insights" hidden>
        ${dataset.nodes.filter((n) => n.kind === "concept").map(renderInsight).join("")}
      </section>
    </div>
  `;

  function handleClick(e) {
    // tab switch
    const tab = e.target.closest('[data-role="wl-tab"]');
    if (tab) {
      const target = tab.dataset.tab;
      root.querySelectorAll('[data-role="wl-tab"]').forEach((t) => {
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      root.querySelectorAll('[data-role="wl-panel"]').forEach((p) => {
        p.hidden = p.dataset.tab !== target;
      });
      return;
    }
    // quiz choice
    const choice = e.target.closest('[data-role="wl-choice"]');
    if (choice) {
      const qid = choice.dataset.quiz;
      const cid = choice.dataset.choice;
      if (quizState[qid]) return; // already answered
      quizState = { ...quizState, [qid]: cid };
      saveQuizState(quizState);
      const quiz = dataset.quizzes.find((q) => q.id === qid);
      const chosenChoice = quiz.choices.find((c) => c.id === cid);
      api.highlight(chosenChoice.nodeIds ?? []);
      const card = choice.closest('[data-role="wl-quiz-card"]');
      // Update choice buttons in-place (mark correct/wrong, disable all)
      card.querySelectorAll('[data-role="wl-choice"]').forEach((btn) => {
        const btnCid = btn.dataset.choice;
        btn.disabled = true;
        if (btnCid === quiz.correctChoiceId) btn.classList.add("is-correct");
        if (btnCid === cid && cid !== quiz.correctChoiceId) btn.classList.add("is-wrong");
      });
      // Show explanation
      const explanation = card.querySelector('[data-role="wl-explanation"]');
      if (explanation) explanation.hidden = false;
      return;
    }
  }
  root.addEventListener("click", handleClick);

  return function unmount() {
    root.removeEventListener("click", handleClick);
    root.innerHTML = "";
  };
}
