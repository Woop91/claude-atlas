import { validateDataset } from "./validate.js";

/** @type {import("./schema.js").Node[]} */
const nodes = [
  // --- Claude tools (from neuromap_7) ---

  // design category → ui/meta → hue 340 (pink)
  {
    id: "tool.impeccable",
    kind: "tool",
    domain: "claude",
    name: "Impeccable",
    category: "ui/meta",
    badge: { label: "UI", hue: 340 },
    oneLine: "UI design polish enforcer — catches bad contrast, spacing and typography.",
    description: "Enforces visual and layout polish rules for Claude-generated UIs. Catches common design mistakes — poor contrast, inconsistent spacing, bad typography. Drop `impeccable.md` into your Claude project's knowledge base and it activates automatically whenever Claude generates HTML/CSS. No special commands needed — it acts as a persistent quality layer on all UI outputs.",
    syntax: "add impeccable.md to Claude project knowledge base",
    examples: [
      "Add to project knowledge → Claude auto-enforces contrast and spacing rules",
      "Generates UI artifact → Impeccable layer rejects low-contrast color pairs automatically",
    ],
    tags: ["design", "ui", "polish", "accessibility"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.webgpu_skill",
    kind: "tool",
    domain: "claude",
    name: "WebGPU Skill",
    category: "ui/meta",
    badge: { label: "GPU", hue: 340 },
    oneLine: "Graphics design aided by GPU — teaches Claude modern WebGPU shader code.",
    description: "Teaches Claude to write WebGPU shaders and GPU-accelerated graphics code correctly, using the modern API instead of deprecated WebGL patterns. Add the skill markdown to your project and Claude will generate syntactically valid WebGPU code, use correct pipeline/bind group patterns, and avoid common async pitfalls in the GPU API. Ideal for 3D scenes, particle systems, and data visualizations.",
    syntax: "add webgpu-skill.md to Claude project knowledge base",
    examples: [
      "Add skill → Claude writes correct WebGPU compute shaders",
      "Ask for particle system → Claude generates valid GPURenderPipeline with bind groups",
    ],
    tags: ["graphics", "webgpu", "shader", "gpu"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.awesome_design",
    kind: "tool",
    domain: "claude",
    name: "Awesome Design",
    category: "ui/meta",
    badge: { label: "DSN", hue: 340 },
    oneLine: "Curated design skills library — layout, color, typography, accessibility.",
    description: "A curated collection of design skill files covering layout, color, typography, component patterns, and accessibility. A meta-library of design rules — browse the repo, pick the design domains you care about (e.g. color theory, grid systems), and add those `.md` files to your Claude project. They stack — each file gives Claude more design vocabulary. Don't add everything; pick what's relevant.",
    syntax: "add chosen .md files from awesome-design-md to Claude project",
    examples: [
      "Add typography.md → Claude follows type scale and line-height rules",
      "Add color.md + grid.md → Claude applies consistent palettes and column layouts",
    ],
    tags: ["design", "library", "typography", "layout"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.ui_ux_pro_max",
    kind: "tool",
    domain: "claude",
    name: "UI UX Pro Max",
    category: "ui/meta",
    badge: { label: "UX", hue: 340 },
    oneLine: "Production quality interface creator — enforces hierarchy, states and accessibility.",
    description: "Opinionated skill that pushes Claude toward production-quality UI output — enforcing component hierarchy, interaction states, and accessibility patterns. Once added to a project, this skill raises Claude's bar for UI outputs: attention to hover/focus/active states, ARIA labels, responsive breakpoints, and visual consistency. Most useful for React and HTML artifact generation.",
    syntax: "add ui-ux-pro-max.md to Claude project knowledge base",
    examples: [
      "Add skill → Claude generates accessible button states and focus rings",
      "Ask for a modal → Claude includes focus trap, escape-key handler, and ARIA role",
    ],
    tags: ["ui", "ux", "accessibility", "production"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.21st_dev",
    kind: "tool",
    domain: "claude",
    name: "21st.dev",
    category: "ui/meta",
    badge: { label: "MKT", hue: 340 },
    oneLine: "Marketplace for design components — browse and drop UI pieces into Claude.",
    description: "A component marketplace where designers share ready-to-use UI components, with a Claude integration that lets you browse and drop components directly into prompts. Install the 21st.dev MCP server to give Claude direct access to the marketplace — Claude can search for, preview, and insert components on request. Particularly useful for design-heavy projects where consistency with a design system matters.",
    syntax: "browse 21st.dev  or  install @21st-dev/mcp-server for autonomous access",
    examples: [
      "Install MCP → reference component by name in Claude prompt",
      "Ask Claude for a data table component → MCP fetches matching component from marketplace",
    ],
    tags: ["marketplace", "components", "mcp", "ui"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.taste_skill",
    kind: "tool",
    domain: "claude",
    name: "Taste Skill",
    category: "ui/meta",
    badge: { label: "TST", hue: 340 },
    oneLine: "Visual taste skill — teaches Claude aesthetic judgment and style decisions.",
    description: "A skill focused on aesthetic judgment — teaches Claude to reason about visual taste, style coherence, and 'does this look good' decisions rather than just technical correctness. Helps Claude move beyond 'is it technically correct' to 'does this look right'. Useful when generating mood boards, brand assets, or any UI where subjective visual quality is the primary goal.",
    syntax: "add taste-skill.md (Pencil Playbook) to Claude project knowledge base",
    examples: [
      "Add skill → Claude critiques color palette harmony and typographic consistency",
      "Ask for brand mood board → Claude evaluates aesthetic coherence, not just hex validity",
    ],
    tags: ["aesthetics", "design", "taste", "style"],
    views: ["neuromap", "reference"],
  },
  // reason: Google Fonts is a design integration/resource, mapped to ui/meta (hue 340)
  {
    id: "tool.google_fonts",
    kind: "tool",
    domain: "claude",
    name: "Google Fonts",
    category: "ui/meta",
    badge: { label: "FONT", hue: 340 },
    oneLine: "Large library of fonts — connects Claude to Google Fonts for typeface suggestions.",
    description: "Connects Claude to the Google Fonts library so it can suggest, reference, and embed typefaces by name in generated CSS/HTML with correct import URLs. Claude already knows Google Fonts by name from training. For live lookups or embedding correct `@import` URLs, reference the site or add it as an MCP tool — Claude can then generate accurate `@font-face` or `<link>` tags for any font in the library.",
    syntax: "reference fonts.google.com in prompts  or  configure Google Fonts MCP",
    examples: [
      "Ask Claude to pick a font pair → returns correct @import URLs",
      "Ask for a serif + mono pairing → Claude returns <link> tags with correct weights",
    ],
    tags: ["fonts", "typography", "css", "design"],
    views: ["neuromap", "reference"],
  },

  // connectors category → sync/net → hue 42 (amber)
  {
    id: "tool.composio",
    kind: "tool",
    domain: "claude",
    name: "Composio",
    category: "sync/net",
    badge: { label: "NET", hue: 42 },
    oneLine: "100+ service connector — GitHub, Slack, Notion via one unified interface.",
    description: "A layer that connects Claude to 100+ external services (GitHub, Slack, Linear, Notion, etc.) via a single unified tool interface, exposing them as Claude skills. Composio handles OAuth and API abstraction — once authenticated, Claude can call actions like 'create a GitHub issue' or 'add a row to Notion' without you managing credentials per tool. Works as an MCP server or direct SDK integration.",
    syntax: "install Composio SDK → authenticate services → add to Claude project",
    examples: [
      "composio connect github → Claude can open PRs and issues",
      "composio connect notion → Claude writes meeting notes directly to a database",
    ],
    tags: ["integrations", "oauth", "api", "connectors"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.mcp_servers",
    kind: "tool",
    domain: "claude",
    name: "MCP Servers",
    category: "sync/net",
    badge: { label: "MCP", hue: 42 },
    oneLine: "The open protocol powering all Claude tool integrations.",
    description: "The Model Context Protocol — an open standard that lets Claude connect to external data sources, tools, and APIs through a consistent interface. The underlying layer for most 'Claude + external tool' integrations. MCP servers expose tools, resources, and prompts to Claude. You can run local servers (stdio) or connect to remote ones (HTTP/SSE). The modelcontextprotocol.io registry lists available servers.",
    syntax: "configure in claude_desktop_config.json or .mcp.json",
    examples: [
      '{"mcpServers": {"myserver": {"command": "node", "args": ["server.js"]}}}',
      "Add Google Drive MCP → Claude can read and write files in Drive mid-conversation",
    ],
    tags: ["protocol", "mcp", "integration", "standard"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.elevenlabs_mcp",
    kind: "tool",
    domain: "claude",
    name: "ElevenLabs MCP",
    category: "sync/net",
    badge: { label: "TTS", hue: 42 },
    oneLine: "Text to speech — gives Claude access to ElevenLabs voice synthesis.",
    description: "An MCP server that gives Claude access to ElevenLabs' text-to-speech and voice cloning APIs, so Claude can generate audio output as part of a workflow. Once configured, Claude can call ElevenLabs to generate speech from text, select voices, or trigger voice jobs. Requires an ElevenLabs API key. Most useful in Claude Code or Claude Desktop where MCP server support is available.",
    syntax: "npx @elevenlabs/mcp-server → configure in MCP settings",
    examples: [
      "Configure MCP → Claude can call elevenlabs.synthesize(text, voiceId)",
      "Ask Claude to narrate a summary → MCP server returns audio file URL",
    ],
    tags: ["tts", "voice", "audio", "elevenlabs"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.google_workspace",
    kind: "tool",
    domain: "claude",
    name: "Google Workspace",
    category: "sync/net",
    badge: { label: "GWS", hue: 42 },
    oneLine: "Full Google Suite integrator — Docs, Sheets, Drive, Gmail from the terminal.",
    description: "A CLI tool for interacting with Google Workspace (Docs, Sheets, Drive, Calendar, Gmail) from the terminal, designed to work alongside Claude for document and data workflows. Authenticate once with OAuth, then use commands like `gws docs create`, `gws sheets read`, etc. Claude can generate the correct CLI commands for your task, or write shell scripts that use gws. Pairs naturally with Claude Code for automating Workspace-heavy workflows.",
    syntax: "npm i -g @googleworkspace/cli  then  gws <command>",
    examples: [
      "gws sheets create 'Budget Q4' → Claude fills cells via follow-up commands",
      "gws docs list → Claude reads doc titles and drafts a summary",
    ],
    tags: ["google", "workspace", "gmail", "sheets"],
    views: ["neuromap", "reference"],
  },

  // data category → navigation/search → hue 265 (purple)
  {
    id: "tool.firecrawl",
    kind: "tool",
    domain: "claude",
    name: "Firecrawl",
    category: "navigation/search",
    badge: { label: "SCRP", hue: 265 },
    oneLine: "Website scraper — converts any site to clean Markdown for Claude.",
    description: "A web scraping and crawling tool that converts any website into clean Markdown — bypassing JS rendering, paywalls, and noisy HTML — for Claude to read and analyze. Install via npm or pip; the CLI outputs clean Markdown from any URL. Pipe output directly into a Claude prompt. The MCP server version lets Claude call Firecrawl autonomously during a session — useful for research-heavy workflows.",
    syntax: "firecrawl scrape <url>  or  firecrawl crawl <url>  or  use MCP server",
    examples: [
      "firecrawl scrape https://docs.example.com → piped to Claude context",
      "firecrawl crawl https://blog.example.com --depth 2 → bulk Markdown for analysis",
    ],
    tags: ["scraping", "web", "markdown", "crawl"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.valyu",
    kind: "tool",
    domain: "claude",
    name: "Valyu",
    category: "navigation/search",
    badge: { label: "SRCH", hue: 265 },
    oneLine: "Document indexer — lets Claude search proprietary document sets.",
    description: "A knowledge retrieval platform that lets Claude search over proprietary or curated document sets — going beyond web search to query specific knowledge bases you control. Valyu indexes documents you upload or connect, then exposes a search API. Claude calls it like a retrieval tool. The MCP server version lets Claude autonomously query your knowledge base mid-conversation without you doing the lookup manually.",
    syntax: 'valyu search "<query>"  or  configure valyu MCP server',
    examples: [
      'valyu search "Q4 revenue projections" → returns ranked passages',
      "Configure MCP → Claude queries internal docs while answering user questions",
    ],
    tags: ["search", "retrieval", "documents", "knowledge"],
    views: ["neuromap", "reference"],
  },
  {
    id: "tool.shannon",
    kind: "tool",
    domain: "claude",
    name: "Shannon",
    category: "navigation/search",
    badge: { label: "INFO", hue: 265 },
    oneLine: "Information hierarchy skill — structures complex info using information theory.",
    description: "A skill focused on information architecture — helps Claude structure complex information clearly using principles from information theory and communication design. Named after Claude Shannon (information theory), this skill gives Claude a framework for deciding what to show, what to hide, what to group together, and how to label things. Useful for designing dashboards, menus, and doc sites where clarity beats completeness.",
    syntax: "add shannon.md to Claude project knowledge base",
    examples: [
      "Add skill → Claude organizes spec into ranked sections by entropy/importance",
      "Ask Claude to redesign a menu → it groups by frequency of use, not alphabet",
    ],
    tags: ["information", "architecture", "hierarchy", "documentation"],
    views: ["neuromap", "reference"],
  },

  // viz category → ui/meta → hue 340 (pink)
  // reason: visualization is a UI output concern; closest canonical category is ui/meta
  {
    id: "tool.autodream",
    kind: "tool",
    domain: "claude",
    name: "AutoDream",
    category: "ui/meta",
    badge: { label: "VIZ", hue: 340 },
    oneLine: "Project visualization tool — turns a description into a full project scaffold.",
    description: "A CLI that turns a plain-text description into a full project scaffold — directory structure, starter files, and boilerplate — by prompting Claude under the hood. You describe the project (e.g. 'a React dashboard with auth and a dark mode toggle') and AutoDream generates the file tree and starter code. Think of it as `create-react-app` but driven by Claude — output still needs your customization but scaffolding is handled.",
    syntax: 'npx claude-dream "describe your project"',
    examples: [
      'npx claude-dream "React dashboard with Supabase auth"',
      'npx claude-dream "CLI tool in Go that parses CSV and outputs JSON"',
    ],
    tags: ["scaffold", "cli", "bootstrap", "visualization"],
    views: ["neuromap", "reference"],
  },

  // auto category → code-exec/shell → hue 18 (orange)
  {
    id: "tool.playwright_cli",
    kind: "tool",
    domain: "claude",
    name: "Playwright CLI",
    category: "code-exec/shell",
    badge: { label: "E2E", hue: 18 },
    oneLine: "Browser automation and control tool — record, run and test browser flows.",
    description: "Browser automation and end-to-end testing framework. The CLI lets you record browser interactions, run test suites, and inspect elements — all from the terminal. Install with `npm i -D playwright`. Use `npx playwright codegen <url>` to record a session into a test file. Claude can write, debug, and explain Playwright test scripts — paste error output back into chat for diagnosis. Works well with Claude Code.",
    syntax: "npx playwright test  or  npx playwright codegen <url>",
    examples: [
      "npx playwright codegen https://app.example.com → generates test script",
      "npx playwright test --reporter=list → Claude reads failures and suggests fixes",
    ],
    tags: ["playwright", "e2e", "testing", "automation"],
    views: ["neuromap", "reference"],
  },
];

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
