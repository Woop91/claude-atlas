# Claude Atlas — Plan 01: Scaffold & Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `claude-atlas/` project with its folder skeleton, tooling, design tokens, self-hosted fonts, a JSDoc-typed canonical dataset extracted from the 4 unique source files in `COMBINE/`, and passing data-integrity tests — ready for Plan 02 (Shell & DOM Views) to build against.

**Architecture:** Plain ES modules, no bundler. Vitest for fast unit tests on schema and data integrity. Node.js ≥20. http-server for local dev. Git initialised inside `claude-atlas/`. Canonical dataset lives at `src/data/data.js` as a frozen `Dataset` export, validated at boot.

**Tech Stack:** Node.js 20, npm, Vitest, http-server, JSDoc (no TS build step), HSL CSS custom properties, self-hosted woff2 fonts (Syne, Inter, IBM Plex Mono).

**Reference spec:** `docs/superpowers/specs/2026-04-17-claude-atlas-design.md` — Sections 6 (data model), 8 (visual language), 5.3 (module boundaries).

**Source files to extract from (read-only):**
- `../COMBINE/claude-tools-neuromap_7.html`
- `../COMBINE/claude-tools-reference_2.html`
- `../COMBINE/wl_command_reference.html`
- (Ignore `claude-tools-neuromap_3.html` — superseded by v7; ignore `wl_command_reference_1.html` — byte-identical duplicate.)

---

## Task 1: Initialise the project folder

**Files:**
- Create: `claude-atlas/.gitignore`
- Create: `claude-atlas/.nvmrc`
- Git init at `claude-atlas/`

- [ ] **Step 1: Verify working directory**

Run: `pwd`
Expected: path ends with `claude-atlas`. If not, `cd "C:/Users/deskc/Desktop/HTML files - Copy (2)/claude-atlas"`.

- [ ] **Step 2: Initialise git**

Run: `git init -b main`
Expected: `Initialized empty Git repository in .../claude-atlas/.git/`

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
test-results/
playwright-report/
.vite/
.DS_Store
Thumbs.db
*.log
.env*
/src/fonts/*.woff2
!/src/fonts/.gitkeep
```
(Fonts excluded so we don't bloat the repo; subagent re-downloads via Task 6.)

- [ ] **Step 4: Write `.nvmrc`**

```
20
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore .nvmrc
git commit -m "chore: init claude-atlas with gitignore and nvmrc"
```

---

## Task 2: Create folder skeleton with `.gitkeep` placeholders

**Files:**
- Create: empty directories for all module folders from spec §5.3

- [ ] **Step 1: Make directories**

Run:
```bash
mkdir -p src/core src/render src/data src/views src/ui \
         shaders styles tests scripts src/fonts \
         docs/superpowers/{specs,plans}
```

- [ ] **Step 2: Add `.gitkeep` to each empty directory**

Run:
```bash
for d in src/core src/render src/data src/views src/ui shaders styles tests scripts src/fonts; do
  touch "$d/.gitkeep"
done
```

- [ ] **Step 3: Verify structure**

Run: `find . -type d -not -path './.git*' | sort`
Expected: all directories from step 1 present.

- [ ] **Step 4: Commit**

```bash
git add src shaders styles tests scripts
git commit -m "chore: scaffold folder skeleton"
```

---

## Task 3: Create `package.json`

**Files:**
- Create: `package.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "claude-atlas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Unified, WebGPU-driven explorer for Claude tools and worklist commands.",
  "scripts": {
    "dev": "http-server -c-1 -p 4173 -s",
    "test": "vitest run",
    "test:watch": "vitest",
    "fmt": "prettier --write ."
  },
  "devDependencies": {
    "http-server": "^14.1.1",
    "vitest": "^2.1.9",
    "prettier": "^3.3.3",
    "@types/node": "^20.14.11"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: `node_modules/` created, lockfile written, no errors.

- [ ] **Step 3: Smoke-test scripts**

Run: `npx vitest --version`
Expected: prints a version like `2.1.x`.

Run: `npx http-server --version`
Expected: prints a version like `v14.x`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add package.json with vitest and http-server"
```

---

## Task 4: Write the launchers (`run.cmd`, `run.sh`)

**Files:**
- Create: `run.cmd`
- Create: `run.sh`

- [ ] **Step 1: Write `run.cmd`**

```bat
@echo off
REM Launch Claude Atlas dev server and open in default browser.
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install || exit /b 1
)
start "" "http://localhost:4173/"
call npm run dev
endlocal
```

- [ ] **Step 2: Write `run.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
( sleep 1 && ( command -v xdg-open >/dev/null && xdg-open http://localhost:4173/ \
              || command -v open >/dev/null && open http://localhost:4173/ \
              || true ) ) &
exec npm run dev
```

- [ ] **Step 3: Make the POSIX launcher executable**

Run: `chmod +x run.sh`
(On Windows this is a no-op but doesn't error.)

- [ ] **Step 4: Verify `run.cmd` can parse**

Run: `cmd //c "echo test && exit"`
Expected: prints `test`. (We're not *running* `run.cmd` here since it would start a server; syntax is verified by visual inspection + the above smoke check.)

- [ ] **Step 5: Commit**

```bash
git add run.cmd run.sh
git commit -m "feat: add run.cmd and run.sh launchers"
```

---

## Task 5: Write the design-token stylesheet

**Files:**
- Create: `styles/tokens.css`

- [ ] **Step 1: Write `styles/tokens.css`**

```css
/* Claude Atlas — design tokens. Mirrored into shader uniforms at boot. */
:root {
  /* surface */
  --bg-0: #07070f;
  --bg-1: #0d0d14;
  --bg-2: #15151f;
  --bg-3: #1e1e2c;
  --line: rgba(255, 255, 255, 0.07);
  --line-2: rgba(255, 255, 255, 0.14);

  /* text */
  --fg-1: #f2f0f8;
  --fg-2: #a6a4b8;
  --fg-3: #605f70;

  /* hue wheel (shared with WGSL/GLSL uniforms) */
  --hue-pink: 340;
  --hue-purple: 265;
  --hue-cyan: 192;
  --hue-green: 150;
  --hue-amber: 42;
  --hue-orange: 18;

  /* derived */
  --accent: hsl(var(--hue-purple) 85% 72%);
  --accent-dim: hsl(var(--hue-purple) 60% 55%);
  --ok: hsl(var(--hue-green) 70% 60%);
  --warn: hsl(var(--hue-amber) 85% 62%);
  --err: hsl(var(--hue-orange) 85% 62%);

  /* radii */
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;

  /* motion */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --d-micro: 120ms;
  --d-sm: 220ms;
  --d-md: 350ms;
  --d-pulse: 900ms;

  /* type */
  --ff-display: "Syne", system-ui, sans-serif;
  --ff-body: "Inter", system-ui, sans-serif;
  --ff-mono: "IBM Plex Mono", ui-monospace, monospace;
}

:root[data-theme="warm"] {
  --bg-0: #0e0a09;
  --bg-1: #15100c;
  --bg-2: #1d160f;
  --bg-3: #261c14;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --d-md: 120ms;
    --d-sm: 120ms;
    --d-pulse: 0ms;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/tokens.css
git commit -m "feat(styles): design tokens with HSL hue wheel"
```

---

## Task 6: Self-host fonts (Syne, Inter, IBM Plex Mono)

**Files:**
- Create: `scripts/fetch-fonts.mjs`
- Create: `styles/fonts.css`

- [ ] **Step 1: Write `scripts/fetch-fonts.mjs`**

```js
// Downloads Latin-subset woff2 files for our three typefaces into src/fonts/.
// Source: jsDelivr's fontsource mirror (stable URLs, no login needed).
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const FONT_DIR = "src/fonts";
const CDN = "https://cdn.jsdelivr.net/fontsource";

const FONTS = [
  { slug: "inter", weight: "400", file: "inter-latin-400-normal.woff2" },
  { slug: "inter", weight: "500", file: "inter-latin-500-normal.woff2" },
  { slug: "inter", weight: "600", file: "inter-latin-600-normal.woff2" },
  { slug: "syne", weight: "600", file: "syne-latin-600-normal.woff2" },
  { slug: "syne", weight: "700", file: "syne-latin-700-normal.woff2" },
  { slug: "ibm-plex-mono", weight: "400", file: "ibm-plex-mono-latin-400-normal.woff2" },
  { slug: "ibm-plex-mono", weight: "500", file: "ibm-plex-mono-latin-500-normal.woff2" },
];

await mkdir(FONT_DIR, { recursive: true });

for (const f of FONTS) {
  const out = join(FONT_DIR, f.file);
  if (existsSync(out)) {
    console.log(`skip ${f.file} (exists)`);
    continue;
  }
  const url = `${CDN}/${f.slug}@latest/files/${f.file}`;
  process.stdout.write(`fetching ${f.file} ... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(out, buf);
  console.log(`${buf.length} bytes`);
}
console.log("done");
```

- [ ] **Step 2: Run the fetcher**

Run: `node scripts/fetch-fonts.mjs`
Expected: 7 `.woff2` files written to `src/fonts/`, each in the 15–50 KB range. No errors.

- [ ] **Step 3: Write `styles/fonts.css`**

```css
@font-face {
  font-family: "Inter";
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url("../src/fonts/inter-latin-400-normal.woff2") format("woff2");
}
@font-face {
  font-family: "Inter";
  font-weight: 500;
  font-style: normal;
  font-display: swap;
  src: url("../src/fonts/inter-latin-500-normal.woff2") format("woff2");
}
@font-face {
  font-family: "Inter";
  font-weight: 600;
  font-style: normal;
  font-display: swap;
  src: url("../src/fonts/inter-latin-600-normal.woff2") format("woff2");
}
@font-face {
  font-family: "Syne";
  font-weight: 600;
  font-style: normal;
  font-display: swap;
  src: url("../src/fonts/syne-latin-600-normal.woff2") format("woff2");
}
@font-face {
  font-family: "Syne";
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  src: url("../src/fonts/syne-latin-700-normal.woff2") format("woff2");
}
@font-face {
  font-family: "IBM Plex Mono";
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url("../src/fonts/ibm-plex-mono-latin-400-normal.woff2") format("woff2");
}
@font-face {
  font-family: "IBM Plex Mono";
  font-weight: 500;
  font-style: normal;
  font-display: swap;
  src: url("../src/fonts/ibm-plex-mono-latin-500-normal.woff2") format("woff2");
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-fonts.mjs styles/fonts.css
git commit -m "feat(fonts): self-host Inter, Syne, IBM Plex Mono as woff2"
```
(Note: `.woff2` files are git-ignored per Task 1; regenerated on clone via `node scripts/fetch-fonts.mjs`.)

---

## Task 7: Base shell stylesheet (reset + font wiring)

**Files:**
- Create: `styles/shell.css`

- [ ] **Step 1: Write `styles/shell.css`**

```css
@import url("./tokens.css");
@import url("./fonts.css");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  background: var(--bg-0);
  color: var(--fg-1);
  font-family: var(--ff-body);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

body {
  overflow: hidden; /* shell owns scrolling; views opt in */
}

h1, h2, h3 {
  font-family: var(--ff-display);
  letter-spacing: -0.02em;
  font-weight: 700;
}

code, pre, kbd {
  font-family: var(--ff-mono);
  font-size: 0.92em;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

/* iOS zoom prevention on inputs */
input, textarea, select, button {
  font-family: inherit;
  font-size: 16px;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/shell.css
git commit -m "feat(styles): base shell reset with font wiring"
```

---

## Task 8: Write the data schema (JSDoc typedefs)

**Files:**
- Create: `src/data/schema.js`

- [ ] **Step 1: Write `src/data/schema.js`**

```js
// Canonical data schema for Claude Atlas.
// Implemented with JSDoc so the codebase needs no TS build step,
// but IDEs and tsc --checkJs still type-check it.

/**
 * @typedef {"tool" | "command" | "concept"} NodeKind
 * @typedef {"claude" | "worklist"} Domain
 * @typedef {"neuromap" | "reference" | "worklist"} ViewName
 * @typedef {"related" | "category" | "sequence" | "composes"} EdgeKind
 */

/**
 * @typedef {Object} Badge
 * @property {string} label  - short uppercase token (≤4 chars), e.g. "FS", "NAV"
 * @property {number} hue    - degrees 0–360
 */

/**
 * @typedef {Object} Node
 * @property {string} id          - stable slug, e.g. "tool.read" or "wl.claim"
 * @property {NodeKind} kind
 * @property {Domain} domain
 * @property {string} name
 * @property {string} category
 * @property {Badge} badge
 * @property {string} oneLine     - tooltip + minimap subtitle (≤140 chars)
 * @property {string} description - long-form markdown
 * @property {string} [syntax]    - monospace signature
 * @property {string[]} [examples]
 * @property {string[]} tags
 * @property {ViewName[]} views
 */

/**
 * @typedef {Object} Edge
 * @property {string} source
 * @property {string} target
 * @property {EdgeKind} kind
 * @property {number} weight      - 0..1
 */

/**
 * @typedef {Object} QuizChoice
 * @property {string} id
 * @property {string} text
 * @property {string[]} nodeIds   - nodes to highlight on the minimap when chosen
 */

/**
 * @typedef {Object} Quiz
 * @property {string} id
 * @property {string} prompt
 * @property {QuizChoice[]} choices
 * @property {string} correctChoiceId
 * @property {string} explanation
 */

/**
 * @typedef {Object} Dataset
 * @property {Node[]} nodes
 * @property {Edge[]} edges
 * @property {Quiz[]} quizzes
 * @property {string} version
 */

export const NODE_KINDS = /** @type {const} */ (["tool", "command", "concept"]);
export const DOMAINS = /** @type {const} */ (["claude", "worklist"]);
export const VIEW_NAMES = /** @type {const} */ (["neuromap", "reference", "worklist"]);
export const EDGE_KINDS = /** @type {const} */ (["related", "category", "sequence", "composes"]);
```

- [ ] **Step 2: Commit**

```bash
git add src/data/schema.js
git commit -m "feat(data): add JSDoc schema for Node/Edge/Quiz/Dataset"
```

---

## Task 9: Write the dataset validator — TDD

**Files:**
- Create: `tests/validate-dataset.test.js`
- Create: `src/data/validate.js`

- [ ] **Step 1: Write the failing test**

Create `tests/validate-dataset.test.js`:
```js
import { describe, it, expect } from "vitest";
import { validateDataset } from "../src/data/validate.js";

const okNode = {
  id: "tool.read",
  kind: "tool",
  domain: "claude",
  name: "Read",
  category: "file-io",
  badge: { label: "FS", hue: 192 },
  oneLine: "Read a file from the filesystem.",
  description: "Reads any file on disk and returns its contents.",
  tags: ["file", "io"],
  views: ["neuromap", "reference"],
};

const okEdge = { source: "tool.read", target: "tool.write", kind: "related", weight: 0.5 };

describe("validateDataset", () => {
  it("accepts a minimal valid dataset", () => {
    const ds = { nodes: [okNode], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).not.toThrow();
  });

  it("rejects duplicate node ids", () => {
    const ds = { nodes: [okNode, okNode], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).toThrow(/duplicate node id/i);
  });

  it("rejects edges pointing to unknown nodes", () => {
    const ds = {
      nodes: [okNode],
      edges: [{ source: "tool.read", target: "tool.ghost", kind: "related", weight: 0.5 }],
      quizzes: [],
      version: "0.1.0",
    };
    expect(() => validateDataset(ds)).toThrow(/unknown node/i);
  });

  it("rejects nodes with unknown kind", () => {
    const bad = { ...okNode, id: "x", kind: "widget" };
    const ds = { nodes: [okNode, bad], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).toThrow(/invalid kind/i);
  });

  it("rejects nodes with views outside the allowed set", () => {
    const bad = { ...okNode, id: "x", views: ["neuromap", "dashboard"] };
    const ds = { nodes: [okNode, bad], edges: [], quizzes: [], version: "0.1.0" };
    expect(() => validateDataset(ds)).toThrow(/invalid view/i);
  });

  it("rejects quizzes whose correctChoiceId is not in choices", () => {
    const ds = {
      nodes: [okNode],
      edges: [],
      quizzes: [{
        id: "q1",
        prompt: "?",
        choices: [{ id: "a", text: "A", nodeIds: [] }],
        correctChoiceId: "z",
        explanation: "x",
      }],
      version: "0.1.0",
    };
    expect(() => validateDataset(ds)).toThrow(/correctChoiceId/i);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run tests/validate-dataset.test.js`
Expected: FAIL — module `../src/data/validate.js` not found.

- [ ] **Step 3: Write the validator**

Create `src/data/validate.js`:
```js
import { NODE_KINDS, DOMAINS, VIEW_NAMES, EDGE_KINDS } from "./schema.js";

/**
 * Validate a dataset. Throws a descriptive Error on the first failure.
 * Returns the dataset unchanged on success.
 * @param {import("./schema.js").Dataset} ds
 * @returns {import("./schema.js").Dataset}
 */
export function validateDataset(ds) {
  if (!ds || typeof ds !== "object") throw new Error("dataset must be an object");
  for (const key of ["nodes", "edges", "quizzes"]) {
    if (!Array.isArray(ds[key])) throw new Error(`dataset.${key} must be an array`);
  }
  if (typeof ds.version !== "string") throw new Error("dataset.version must be a string");

  const ids = new Set();
  for (const n of ds.nodes) {
    if (!n.id || typeof n.id !== "string") throw new Error("node missing id");
    if (ids.has(n.id)) throw new Error(`duplicate node id: ${n.id}`);
    ids.add(n.id);
    if (!NODE_KINDS.includes(n.kind)) throw new Error(`invalid kind on ${n.id}: ${n.kind}`);
    if (!DOMAINS.includes(n.domain)) throw new Error(`invalid domain on ${n.id}: ${n.domain}`);
    if (!n.name) throw new Error(`node ${n.id} missing name`);
    if (!n.category) throw new Error(`node ${n.id} missing category`);
    if (!n.badge || typeof n.badge.hue !== "number") throw new Error(`node ${n.id} missing badge.hue`);
    if (!n.oneLine) throw new Error(`node ${n.id} missing oneLine`);
    if (!n.description) throw new Error(`node ${n.id} missing description`);
    if (!Array.isArray(n.tags)) throw new Error(`node ${n.id} tags must be array`);
    if (!Array.isArray(n.views) || n.views.length === 0) {
      throw new Error(`node ${n.id} must declare at least one view`);
    }
    for (const v of n.views) {
      if (!VIEW_NAMES.includes(v)) throw new Error(`invalid view on ${n.id}: ${v}`);
    }
  }

  for (const e of ds.edges) {
    if (!ids.has(e.source)) throw new Error(`edge source unknown node: ${e.source}`);
    if (!ids.has(e.target)) throw new Error(`edge target unknown node: ${e.target}`);
    if (!EDGE_KINDS.includes(e.kind)) throw new Error(`invalid edge kind: ${e.kind}`);
    if (typeof e.weight !== "number" || e.weight < 0 || e.weight > 1) {
      throw new Error(`edge weight must be 0..1, got ${e.weight}`);
    }
  }

  for (const q of ds.quizzes) {
    if (!q.id) throw new Error("quiz missing id");
    if (!Array.isArray(q.choices) || q.choices.length < 2) {
      throw new Error(`quiz ${q.id} must have at least 2 choices`);
    }
    const choiceIds = new Set(q.choices.map((c) => c.id));
    if (!choiceIds.has(q.correctChoiceId)) {
      throw new Error(`quiz ${q.id} correctChoiceId not in choices`);
    }
    for (const c of q.choices) {
      if (!Array.isArray(c.nodeIds)) throw new Error(`quiz ${q.id} choice ${c.id} nodeIds must be array`);
      for (const nid of c.nodeIds) {
        if (!ids.has(nid)) throw new Error(`quiz ${q.id} choice ${c.id} references unknown node: ${nid}`);
      }
    }
  }

  return ds;
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run tests/validate-dataset.test.js`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/validate.js tests/validate-dataset.test.js
git commit -m "feat(data): validator with TDD coverage of schema invariants"
```

---

## Task 10: Seed `data.js` with Claude-tool nodes from `neuromap_7.html`

**Files:**
- Create: `src/data/data.js`
- Read (for extraction): `../HTML files - Copy (2)/COMBINE/claude-tools-neuromap_7.html`

**Context for the implementer:** The source file defines its tool list inside a `<script>` tag, typically as a `const nodes = [ ... ]` array with entries like `{id, name, category, ...}`. Open it, locate the array, and translate each entry into our canonical shape. Every Claude tool node gets `domain:"claude"`, `kind:"tool"`, `views:["neuromap","reference"]`. Category colours in the source map to the `--hue-*` tokens — translate using the table below.

**Category → hue mapping** (from spec §8.1):
- file-io / filesystem → `--hue-cyan` (192)
- navigation / search → `--hue-purple` (265)
- code-exec / shell → `--hue-orange` (18)
- annotate / edit → `--hue-green` (150)
- sync / net → `--hue-amber` (42)
- ui / meta → `--hue-pink` (340)

(If a source category doesn't match, pick the closest and leave a 1-line `// reason` comment above the entry.)

- [ ] **Step 1: Extract the nodes**

Open `../HTML files - Copy (2)/COMBINE/claude-tools-neuromap_7.html`, locate the node array, and translate each entry. Write `src/data/data.js` starting with:

```js
import { validateDataset } from "./validate.js";

/** @type {import("./schema.js").Node[]} */
const nodes = [
  // --- Claude tools (from neuromap_7) ---
  {
    id: "tool.read",
    kind: "tool",
    domain: "claude",
    name: "Read",
    category: "file-io",
    badge: { label: "FS", hue: 192 },
    oneLine: "Read a file from the filesystem.",
    description: "Reads any file on disk and returns its contents with line numbers.",
    syntax: "Read(file_path, [offset], [limit])",
    examples: ["Read('C:/path/to/file.txt')"],
    tags: ["file", "io", "read"],
    views: ["neuromap", "reference"],
  },
  // ... one entry per source tool node, preserving source order
];
```

Add one `Node` object per source entry. Fill `description`, `syntax`, `examples` with the best fit from the source (may be brief at this stage — Task 11 deepens them from `reference_2`).

- [ ] **Step 2: Append empty `edges`, `quizzes`, version, and export**

At the bottom of `data.js`, add:
```js
/** @type {import("./schema.js").Edge[]} */
const edges = [];

/** @type {import("./schema.js").Quiz[]} */
const quizzes = [];

/** @type {import("./schema.js").Dataset} */
export const DATASET = Object.freeze(validateDataset({
  nodes,
  edges,
  quizzes,
  version: "0.1.0",
}));
```

- [ ] **Step 3: Write a count/structure test**

Create `tests/data-seed.test.js`:
```js
import { describe, it, expect } from "vitest";
import { DATASET } from "../src/data/data.js";

describe("data seed — claude tools", () => {
  it("loads and validates without throwing", () => {
    expect(DATASET).toBeDefined();
    expect(DATASET.version).toBe("0.1.0");
  });

  it("has at least 10 claude-domain tool nodes", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    expect(tools.length).toBeGreaterThanOrEqual(10);
  });

  it("every claude tool is tagged for neuromap and reference", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    for (const t of tools) {
      expect(t.views).toContain("neuromap");
      expect(t.views).toContain("reference");
    }
  });

  it("no tool has an empty oneLine or description", () => {
    const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
    for (const t of tools) {
      expect(t.oneLine.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/data-seed.test.js`
Expected: 4 tests pass. If "at least 10 tools" fails, add more entries from the source.

- [ ] **Step 5: Commit**

```bash
git add src/data/data.js tests/data-seed.test.js
git commit -m "feat(data): seed claude tools from neuromap_7"
```

---

## Task 11: Enrich Claude-tool nodes with `reference_2` descriptions

**Files:**
- Modify: `src/data/data.js` — update each Claude tool `description`, `syntax`, `examples`
- Read (for extraction): `../HTML files - Copy (2)/COMBINE/claude-tools-reference_2.html`

**Context:** The reference file lays out each tool with a heading, prose description, a code-block signature, and usage examples. Match by tool name to the nodes added in Task 10 and replace the placeholder `description`/`syntax`/`examples` fields with the richer source content.

- [ ] **Step 1: Update `description`, `syntax`, `examples` for each Claude tool**

For every Claude tool node in `data.js`, open `reference_2.html`, find the matching heading, and replace:
- `description` → the full prose paragraph (convert inline code to backticks; preserve paragraph breaks as `\n\n`)
- `syntax` → the code-block signature
- `examples` → array of each example code block (as strings)

If `reference_2` describes a tool not yet in `data.js`, add it as a new node here with `views:["neuromap","reference"]`.

- [ ] **Step 2: Tighten the test**

Modify `tests/data-seed.test.js` — add:
```js
it("every claude tool description is ≥60 characters", () => {
  const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
  for (const t of tools) {
    expect(t.description.length, `description too short for ${t.id}`).toBeGreaterThanOrEqual(60);
  }
});

it("every claude tool has a syntax line", () => {
  const tools = DATASET.nodes.filter((n) => n.domain === "claude" && n.kind === "tool");
  for (const t of tools) {
    expect(t.syntax, `missing syntax for ${t.id}`).toBeTruthy();
  }
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/data-seed.test.js`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/data.js tests/data-seed.test.js
git commit -m "feat(data): enrich tools with reference_2 descriptions"
```

---

## Task 12: Add worklist command nodes from `wl_command_reference.html`

**Files:**
- Modify: `src/data/data.js`
- Read (for extraction): `../HTML files - Copy (2)/COMBINE/wl_command_reference.html`

**Context:** The worklist reference has several tabs; the "Reference" tab lists commands (`wl list`, `wl claim`, `wl annotate`, `wl sync`, `wl done`, etc.) grouped by kind (nav / claim / annotate / sync). Each has a syntax, purpose, and examples. Map each to a `Node` with `domain:"worklist"`, `kind:"command"`, `views:["neuromap","reference","worklist"]`.

**Category → hue mapping (worklist):**
- nav → `--hue-cyan` (192)
- claim → `--hue-purple` (265)
- annotate → `--hue-green` (150)
- sync → `--hue-orange` (18)

- [ ] **Step 1: Append worklist command nodes**

Extend `nodes` in `data.js`:
```js
  // --- Worklist commands (from wl_command_reference) ---
  {
    id: "wl.list",
    kind: "command",
    domain: "worklist",
    name: "wl list",
    category: "nav",
    badge: { label: "NAV", hue: 192 },
    oneLine: "Show worklist items with their state.",
    description: "Lists all items currently in the worklist, grouped by state (unclaimed / in-progress / blocked / done).",
    syntax: "wl list [--state <state>] [--mine]",
    examples: ["wl list", "wl list --state unclaimed"],
    tags: ["worklist", "nav", "list"],
    views: ["neuromap", "reference", "worklist"],
  },
  // ... one per source command
```

Cover every command present in the source. Preserve source ordering within each category.

- [ ] **Step 2: Add coverage test**

Add to `tests/data-seed.test.js`:
```js
describe("data seed — worklist commands", () => {
  it("has at least 6 worklist commands", () => {
    const wl = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
    expect(wl.length).toBeGreaterThanOrEqual(6);
  });

  it("every worklist command is in all three views", () => {
    const wl = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
    for (const c of wl) {
      for (const v of ["neuromap", "reference", "worklist"]) {
        expect(c.views, `${c.id} missing view ${v}`).toContain(v);
      }
    }
  });

  it("worklist command names start with 'wl '", () => {
    const wl = DATASET.nodes.filter((n) => n.domain === "worklist" && n.kind === "command");
    for (const c of wl) expect(c.name).toMatch(/^wl /);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/data-seed.test.js`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/data.js tests/data-seed.test.js
git commit -m "feat(data): add worklist commands with three-view coverage"
```

---

## Task 13: Add quizzes from `wl_command_reference.html`

**Files:**
- Modify: `src/data/data.js`
- Read (for extraction): `../HTML files - Copy (2)/COMBINE/wl_command_reference.html`

**Context:** The worklist file has a "Quiz" tab with multiple-choice questions. Each question becomes a `Quiz` entry. Map each choice's "correct answer" reference to the node ids added in Task 12.

- [ ] **Step 1: Populate `quizzes`**

Replace the empty `quizzes` array in `data.js`:
```js
/** @type {import("./schema.js").Quiz[]} */
const quizzes = [
  {
    id: "q.claim-before-edit",
    prompt: "You want to work on item #42. What do you run first?",
    choices: [
      { id: "a", text: "wl annotate 42", nodeIds: ["wl.annotate"] },
      { id: "b", text: "wl claim 42", nodeIds: ["wl.claim"] },
      { id: "c", text: "wl done 42", nodeIds: ["wl.done"] },
    ],
    correctChoiceId: "b",
    explanation: "Claim before touching an item — otherwise two people can work on the same thing.",
  },
  // ... one per source quiz question
];
```

Fill in every question from the source. Make sure every `nodeIds` entry references a node added in Task 12.

- [ ] **Step 2: Add quiz test**

Add to `tests/data-seed.test.js`:
```js
describe("data seed — quizzes", () => {
  it("has at least 3 quiz questions", () => {
    expect(DATASET.quizzes.length).toBeGreaterThanOrEqual(3);
  });

  it("every quiz has at least 2 choices and a valid correctChoiceId", () => {
    for (const q of DATASET.quizzes) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      const ids = q.choices.map((c) => c.id);
      expect(ids, `bad correctChoiceId on ${q.id}`).toContain(q.correctChoiceId);
    }
  });

  it("every quiz choice nodeId references an existing worklist node", () => {
    const ids = new Set(DATASET.nodes.map((n) => n.id));
    for (const q of DATASET.quizzes) {
      for (const c of q.choices) {
        for (const nid of c.nodeIds) {
          expect(ids, `quiz ${q.id} choice ${c.id} has unknown node ${nid}`).toContain(nid);
        }
      }
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/data-seed.test.js`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/data.js tests/data-seed.test.js
git commit -m "feat(data): add worklist quizzes with node-ref integrity"
```

---

## Task 14: Add concept nodes from `wl_command_reference.html` Insights tab

**Files:**
- Modify: `src/data/data.js`
- Read (for extraction): `../HTML files - Copy (2)/COMBINE/wl_command_reference.html`

**Context:** The "Insights" tab has prose explaining concepts like "why claim before editing", "annotation vs sync", etc. Each becomes a `Node` with `kind:"concept"`, `domain:"worklist"`, `views:["reference","worklist"]` (no neuromap — concepts don't render as nodes in the graph).

- [ ] **Step 1: Append concept nodes**

Add to `nodes` in `data.js`:
```js
  // --- Worklist concepts (from wl_command_reference insights tab) ---
  {
    id: "concept.claim-before-edit",
    kind: "concept",
    domain: "worklist",
    name: "Claim before edit",
    category: "principles",
    badge: { label: "IDEA", hue: 42 },
    oneLine: "Always claim an item before touching it.",
    description: "If two people edit the same unclaimed item, you get a merge conflict. Claim first, work, then `wl done`.",
    tags: ["worklist", "principle"],
    views: ["reference", "worklist"],
  },
  // ... one per source insight
```

- [ ] **Step 2: Add test**

Add to `tests/data-seed.test.js`:
```js
describe("data seed — concepts", () => {
  it("has at least 2 concept nodes", () => {
    const c = DATASET.nodes.filter((n) => n.kind === "concept");
    expect(c.length).toBeGreaterThanOrEqual(2);
  });

  it("concept nodes are not in the neuromap view", () => {
    const c = DATASET.nodes.filter((n) => n.kind === "concept");
    for (const n of c) expect(n.views).not.toContain("neuromap");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/data-seed.test.js`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/data.js tests/data-seed.test.js
git commit -m "feat(data): add worklist concept nodes from insights"
```

---

## Task 15: Author edges (category, sequence, related)

**Files:**
- Modify: `src/data/data.js`

**Context:** Edges drive the graph's shape. Three classes to author:

1. **`category`** — every node implicitly connects to sibling nodes in the same `category`. We don't hand-author these; the runtime will derive them. Skip here.
2. **`sequence`** — the worklist workflow has a canonical order (`claim` → `work` → `annotate` → `done`). Encode this as directed sequence edges between worklist command nodes.
3. **`related`** — cross-links between tools that are often used together (e.g. `tool.grep` ↔ `tool.read`, `tool.edit` ↔ `tool.read`, `wl.claim` ↔ `wl.annotate`). Author ~15–25.
4. **`composes`** — a higher-level action composed of lower-level ones (e.g. `tool.bash` composes many shell primitives). Optional; skip if none obvious.

- [ ] **Step 1: Write edges**

Replace the empty `edges` array:
```js
/** @type {import("./schema.js").Edge[]} */
const edges = [
  // sequence: worklist workflow
  { source: "wl.list",     target: "wl.claim",    kind: "sequence", weight: 0.9 },
  { source: "wl.claim",    target: "wl.annotate", kind: "sequence", weight: 0.9 },
  { source: "wl.annotate", target: "wl.sync",     kind: "sequence", weight: 0.8 },
  { source: "wl.sync",     target: "wl.done",     kind: "sequence", weight: 0.9 },

  // related: common tool co-usage
  { source: "tool.grep",   target: "tool.read",   kind: "related",  weight: 0.7 },
  { source: "tool.read",   target: "tool.edit",   kind: "related",  weight: 0.8 },
  { source: "tool.edit",   target: "tool.write",  kind: "related",  weight: 0.6 },
  { source: "tool.glob",   target: "tool.grep",   kind: "related",  weight: 0.6 },
  // ... add ~15–25 based on what pairs appear together in the sources
];
```

Use only ids that exist in the `nodes` array. The validator will flag typos.

- [ ] **Step 2: Add edge tests**

Add to `tests/data-seed.test.js`:
```js
describe("data seed — edges", () => {
  it("has at least 10 edges", () => {
    expect(DATASET.edges.length).toBeGreaterThanOrEqual(10);
  });

  it("has at least 4 worklist sequence edges forming a chain", () => {
    const seq = DATASET.edges.filter((e) => e.kind === "sequence");
    expect(seq.length).toBeGreaterThanOrEqual(4);
  });

  it("every sequence edge connects worklist-domain nodes", () => {
    const byId = new Map(DATASET.nodes.map((n) => [n.id, n]));
    const seq = DATASET.edges.filter((e) => e.kind === "sequence");
    for (const e of seq) {
      expect(byId.get(e.source)?.domain).toBe("worklist");
      expect(byId.get(e.target)?.domain).toBe("worklist");
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/data-seed.test.js`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/data.js tests/data-seed.test.js
git commit -m "feat(data): author sequence and related edges"
```

---

## Task 16: Full data-integrity sweep

**Files:**
- Create: `tests/data-integrity.test.js`

- [ ] **Step 1: Write the sweep test**

Create `tests/data-integrity.test.js`:
```js
import { describe, it, expect } from "vitest";
import { DATASET } from "../src/data/data.js";

describe("dataset integrity", () => {
  it("every node id is unique", () => {
    const seen = new Set();
    for (const n of DATASET.nodes) {
      expect(seen.has(n.id), `duplicate id ${n.id}`).toBe(false);
      seen.add(n.id);
    }
  });

  it("every node has a badge.hue in [0, 360]", () => {
    for (const n of DATASET.nodes) {
      expect(n.badge.hue).toBeGreaterThanOrEqual(0);
      expect(n.badge.hue).toBeLessThanOrEqual(360);
    }
  });

  it("every edge endpoint is a known node", () => {
    const ids = new Set(DATASET.nodes.map((n) => n.id));
    for (const e of DATASET.edges) {
      expect(ids.has(e.source), `edge source ${e.source} unknown`).toBe(true);
      expect(ids.has(e.target), `edge target ${e.target} unknown`).toBe(true);
    }
  });

  it("every node appears in at least one view", () => {
    for (const n of DATASET.nodes) {
      expect(n.views.length, `${n.id} has no views`).toBeGreaterThan(0);
    }
  });

  it("neuromap view has ≥10 nodes", () => {
    const n = DATASET.nodes.filter((x) => x.views.includes("neuromap"));
    expect(n.length).toBeGreaterThanOrEqual(10);
  });

  it("reference view covers both domains", () => {
    const r = DATASET.nodes.filter((x) => x.views.includes("reference"));
    expect(r.some((x) => x.domain === "claude")).toBe(true);
    expect(r.some((x) => x.domain === "worklist")).toBe(true);
  });

  it("worklist view only contains worklist-domain nodes", () => {
    const w = DATASET.nodes.filter((x) => x.views.includes("worklist"));
    for (const n of w) expect(n.domain, `${n.id} leaked into worklist view`).toBe("worklist");
  });

  it("no self-loops", () => {
    for (const e of DATASET.edges) {
      expect(e.source).not.toBe(e.target);
    }
  });

  it("no duplicate edges", () => {
    const seen = new Set();
    for (const e of DATASET.edges) {
      const key = `${e.source}->${e.target}:${e.kind}`;
      expect(seen.has(key), `duplicate edge ${key}`).toBe(false);
      seen.add(key);
    }
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npx vitest run`
Expected: all tests across `validate-dataset`, `data-seed`, and `data-integrity` pass.

- [ ] **Step 3: Commit**

```bash
git add tests/data-integrity.test.js
git commit -m "test(data): full integrity sweep"
```

---

## Task 17: Write README quickstart

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README quickstart"
```

---

## Task 18: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass, zero failures.

- [ ] **Step 2: File tree check**

Run: `find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './src/fonts/*' | sort`
Expected — at minimum these appear:
```
./.gitignore
./.nvmrc
./README.md
./docs/superpowers/plans/2026-04-17-plan-01-scaffold-data.md
./docs/superpowers/specs/2026-04-17-claude-atlas-design.md
./package-lock.json
./package.json
./run.cmd
./run.sh
./scripts/fetch-fonts.mjs
./src/data/data.js
./src/data/schema.js
./src/data/validate.js
./styles/fonts.css
./styles/shell.css
./styles/tokens.css
./tests/data-integrity.test.js
./tests/data-seed.test.js
./tests/validate-dataset.test.js
```

- [ ] **Step 3: Dev server sanity-check**

Run: `npx http-server -c-1 -p 4173 -s` (Ctrl+C to stop).
Expected: serves — visit `http://localhost:4173/` and see a directory listing (no `index.html` yet; Plan 02 adds it).

- [ ] **Step 4: Confirm git log**

Run: `git log --oneline`
Expected: ~16–18 clean, descriptive commits.

- [ ] **Step 5: No uncommitted work**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Completion criteria

Plan 01 is done when:
- [x] `npm test` passes with ≥20 assertions green across 3 test files.
- [x] `src/data/data.js` exports a validated, frozen `DATASET` covering ≥10 Claude tools, ≥6 worklist commands, ≥2 concepts, ≥3 quizzes, and ≥10 edges including a full worklist sequence chain.
- [x] Self-hosted fonts download via `node scripts/fetch-fonts.mjs`.
- [x] Design tokens exist in `styles/tokens.css` and are ready for the shell and shader-uniform bridge in later plans.
- [x] Dev server starts cleanly.
- [x] Git log tells the story.

**Next:** Plan 02 — Shell & DOM Views.
