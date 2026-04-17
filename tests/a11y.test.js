import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("a11y — HTML landmarks & skip link", () => {
  const html = readFileSync("index.html", "utf8");
  it("has a skip link pointing to #view", () => {
    expect(html).toMatch(/class="skip-link"\s+href="#view"/);
  });
  it("main has aria-live='polite'", () => {
    expect(html).toMatch(/<main[^>]*aria-live="polite"/);
  });
  it("nav#bottom-tabs has aria-label", () => {
    expect(html).toMatch(/id="bottom-tabs"[^>]*aria-label=/);
  });
});
