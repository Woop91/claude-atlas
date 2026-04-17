// Silence noisy jsdom warnings for features we don't test here.
const origConsoleError = console.error;
console.error = (...args) => {
  const msg = String(args[0] ?? "");
  if (msg.includes("Not implemented: HTMLCanvasElement.prototype.getContext")) return;
  origConsoleError(...args);
};
