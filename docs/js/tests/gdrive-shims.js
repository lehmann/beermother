// Minimal browser API shims needed so gdrive.js can be imported in Node.js.
// Only the surface area actually used at module-load time is shimmed here.

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};

globalThis.window = {
  google: undefined,
};
