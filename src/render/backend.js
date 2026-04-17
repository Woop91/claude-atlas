/**
 * @typedef {Object} LayoutHint
 * @property {"force"|"grid"|"flow"|"radial"} mode
 * @property {(n: any) => boolean} [filter]
 * @property {{x:number,y:number,w:number,h:number}} cameraFraction
 * @property {string[]} [highlights]
 */

/**
 * @typedef {Object} RenderBackend
 * @property {(canvas: HTMLCanvasElement) => Promise<void>} init
 * @property {(nodes: any[], edges: any[]) => void} loadScene
 * @property {(hint: LayoutHint, durationMs: number) => void} setLayout
 * @property {(nodeId: string | null) => void} setFocus
 * @property {(nodeIds: string[]) => void} setHighlight
 * @property {(rect: {x:number,y:number,w:number,h:number}) => void} setCameraFraction
 * @property {() => void} render
 * @property {() => void} destroy
 * @property {string} name
 */

export const BACKEND_METHODS = [
  "init", "loadScene", "setLayout", "setFocus", "setHighlight",
  "setCameraFraction", "render", "destroy",
];
