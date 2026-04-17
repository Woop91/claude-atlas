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

## Tests

```bash
npm test             # unit tests (vitest)
npm run test:watch
```

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