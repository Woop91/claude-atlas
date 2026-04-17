import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATASET } from "../src/data/data.js";
import { mountWorklist } from "../src/views/worklist.js";

beforeEach(() => {
  document.body.innerHTML = `<main id="view"></main>`;
  localStorage.clear();
});

describe("worklist view — commands tab", () => {
  it("renders three tab buttons (Commands / Quiz / Insights)", () => {
    mountWorklist(DATASET, { focus: vi.fn() });
    const tabs = document.querySelectorAll('[data-role="wl-tab"]');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toMatch(/commands/i);
    expect(tabs[1].textContent).toMatch(/quiz/i);
    expect(tabs[2].textContent).toMatch(/insights/i);
  });

  it("Commands tab lists every wl.* command", () => {
    mountWorklist(DATASET, { focus: vi.fn() });
    const entries = document.querySelectorAll('[data-role="wl-cmd-entry"]');
    const expected = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command").length;
    expect(entries.length).toBe(expected);
  });
});

describe("worklist view — quiz tab", () => {
  it("renders one card per quiz question", () => {
    mountWorklist(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const cards = document.querySelectorAll('[data-role="wl-quiz-card"]');
    expect(cards.length).toBe(DATASET.quizzes.length);
  });

  it("shows explanation after selecting a choice", () => {
    mountWorklist(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const firstChoice = document.querySelector('[data-role="wl-choice"]');
    firstChoice.click();
    const card = firstChoice.closest('[data-role="wl-quiz-card"]');
    const explanation = card.querySelector('[data-role="wl-explanation"]');
    expect(explanation.hidden).toBe(false);
  });

  it("persists correct-count to localStorage", () => {
    mountWorklist(DATASET, { focus: vi.fn(), highlight: vi.fn() });
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const firstQuiz = DATASET.quizzes[0];
    const correctButton = document.querySelector(
      `[data-role="wl-choice"][data-quiz="${firstQuiz.id}"][data-choice="${firstQuiz.correctChoiceId}"]`
    );
    correctButton.click();
    const raw = localStorage.getItem("atlas.quiz.v1");
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw);
    expect(state[firstQuiz.id]).toBe(firstQuiz.correctChoiceId);
  });

  it("highlights related nodes via api.highlight on choice click", () => {
    const api = { focus: vi.fn(), highlight: vi.fn() };
    mountWorklist(DATASET, api);
    document.querySelector('[data-role="wl-tab"][data-tab="quiz"]').click();
    const firstChoice = document.querySelector('[data-role="wl-choice"]');
    firstChoice.click();
    expect(api.highlight).toHaveBeenCalled();
  });
});
