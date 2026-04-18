# Claude Atlas

A unified, WebGPU-driven explorer for Claude tool and worklist-command knowledge.
One canonical dataset; three views (Neuromap · Reference · Worklist) sharing one scene.

> **Status:** Plan 01 complete. Shell & views land in Plan 02.

## Quick start

**Windows:** double-click `run.cmd`.
**macOS / Linux:** `./run.sh`.

Or manually:
```bash
npm install
node scripts/fetch-fonts.mjs   # one-time font download
npm run dev                    # http://localhost:4173
```

## Testing

### Unit tests (vitest)

```
npm test           # single run
npm run test:watch # watch mode
```

107 assertions across 20 test files covering dataset integrity, router, store, physics, pickers, views, palette, a11y semantics, and both backend contracts.

### End-to-end tests (Playwright)

```
npm run test:e2e           # all browsers, all suites
npm run test:e2e:desktop   # desktop-chromium only
npm run test:e2e:mobile    # iPhone 13 Chromium only
npm run test:e2e:update    # regenerate visual baselines
```

Test suites under `tests/e2e/`:
- `smoke.spec.ts` — console errors, canvas, tabs, palette
- `views.spec.ts` — all three views reach ready, landmarks present
- `a11y.spec.ts` — axe-core critical/serious violations per view
- `visual.spec.ts` — pixel regression against stored baselines (requires `?test=N` seed)
- `backend.spec.ts` — WebGL2 ↔ WebGPU DOM parity

### Deterministic visual mode

Any URL can be appended with `?test=N` (where N is a seed integer, default 42) to enable deterministic physics:
- `Math.random` is replaced by a seeded Mulberry32
- Physics runs for exactly 200 steps then freezes
- Screenshots are stable across runs at ~5% pixel tolerance (sub-pixel GL/text antialiasing variance accepted)

### CI

GitHub Actions workflow at `.github/workflows/test.yml` runs vitest + Playwright × 2 projects on every push and pull request.

## Project layout

```
src/
  core/     bootstrap, router, signal store, feature detection
  render/   RenderBackend interface + WebGPU + WebGL2 backends
  data/     data.js (canonical), schema.js (JSDoc), validate.js
  views/    neuromap.js, reference.js, worklist.js
  ui/       palette.js, topbar.js, minimap.js, toast.js, focus.js
  fonts/    self-hosted woff2 (git-ignored; re-fetch via scripts/fetch-fonts.mjs)
shaders/    graph / physics / background / bloom / transition (WGSL + GLSL)
styles/     tokens.css, shell.css, fonts.css, reference.css, worklist.css
tests/      unit + (later) playwright suites
docs/       spec + plan
```

## Design

See [`docs/superpowers/specs/2026-04-17-claude-atlas-design.md`](docs/superpowers/specs/2026-04-17-claude-atlas-design.md).