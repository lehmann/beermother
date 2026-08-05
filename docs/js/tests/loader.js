// Custom ESM loader that replaces heavy browser-dependent modules with stubs
// when running tests in Node.js.

const STUBS = new Map([
  ["./i18n.js", `export function t(s) { return s; }`],
  ["./state.js", `export function loadDriveFolderName() { return "Beer Mother"; }`],
]);

export function resolve(specifier, context, nextResolve) {
  if (STUBS.has(specifier)) {
    return { shortCircuit: true, url: "node:stub:" + specifier };
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url.startsWith("node:stub:")) {
    const specifier = url.slice("node:stub:".length);
    const source = STUBS.get(specifier);
    return { shortCircuit: true, format: "module", source };
  }
  return nextLoad(url, context);
}
