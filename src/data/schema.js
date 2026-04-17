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
