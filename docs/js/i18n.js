import {
  fmt as l,
  fmtClean as f,
  formatInputValue as p,
  formatVolume as d,
  formatVolumeRate as g,
  formatMaltMass as x,
  formatIngredientAmount as A,
  formatYeastAmount as $,
  formatIonPpm as S,
  formatPlatoSg as h,
  formatWriValue as C,
} from "./engine.js";
import I from "./locales/pt.js";
import V from "./locales/en.js";
import F from "./locales/es.js";
export const LANGUAGES = ["pt", "en", "es"],
  LANGUAGE_STORAGE_KEY = "beermother.fable.language.v1";
const m = { pt: I, en: V, es: F };
export function detectLanguage(e) {
  const o = String(e || "").toLowerCase();
  return o.startsWith("es") ? "es" : o.startsWith("en") ? "en" : "pt";
}
let r = "pt";
export function getLanguage() {
  return r;
}
export function setLanguage(e) {
  r = LANGUAGES.includes(e) ? e : "pt";
  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, r);
  } catch {}
  return r;
}
export function initLanguage() {
  let e = null;
  try {
    e = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
  } catch {}
  return (
    (r = LANGUAGES.includes(e)
      ? e
      : detectLanguage(globalThis.navigator?.language)),
    r
  );
}
export function t(e, o) {
  const n = m[r]?.[e] ?? m.pt?.[e] ?? e;
  return o
    ? String(n).replace(/\{(\w+)\}/g, (s, i) => (i in o ? String(o[i]) : s))
    : n;
}
const L = [
  [
    /^Confirmar adição de hopstand (.+)$/,
    "Confirmar adi\xE7\xE3o de hopstand {x}",
  ],
  [/^Confirmar adição de (.+)$/, "Confirmar adi\xE7\xE3o de {x}"],
  [/^Confirmar início: (.+)$/, "Confirmar in\xEDcio: {x}"],
  [/^Confirmar (.+)$/, "Confirmar {x}"],
  [/^Aquecer até (.+)$/, "Aquecer at\xE9 {x}"],
  [/^Adição de hopstand (.+)$/, "Adi\xE7\xE3o de hopstand {x}"],
  [/^adição de hopstand (.+)$/, "adi\xE7\xE3o de hopstand {x}"],
  [/^Adição de (.+)$/, "Adi\xE7\xE3o de {x}"],
  [/^adição de (.+)$/, "adi\xE7\xE3o de {x}"],
  [/^Próx\. (.+)$/, "Pr\xF3x. {x}"],
  [/^Leitura (.+)$/, "Leitura {x}"],
  [/^(\d+) adições$/, "{x} adi\xE7\xF5es"],
  [/^(\d+) adição$/, "{x} adi\xE7\xE3o"],
  [/^Começar (.+)$/, "Come\xE7ar {x}"],
  [/^Aquecendo para (.+)$/, "Aquecendo para {x}"],
];
export function tEngine(e) {
  const o = String(e ?? "");
  if (r === "pt" || !o) return o;
  let n = null;
  if (m[r]?.[o] !== void 0) n = m[r][o];
  else
    for (const [s, i] of L) {
      const u = o.match(s);
      if (u) {
        n = t(i, { x: tEngine(u[1]) });
        break;
      }
    }
  return (
    n === null && (n = o),
    r === "en" ? n.replace(/(\d),(\d)/g, "$1.$2") : n
  );
}
const c = () => r === "en",
  E = { pt: "pt-BR", en: "en-US", es: "es-ES" };
export function localeTag() {
  return E[r] || "pt-BR";
}
export function fmt(e, o = 1) {
  const n = l(e, o);
  return c() ? n.replace(",", ".") : n;
}
export function fmtClean(e, o = 2) {
  const n = f(e, o);
  return c() ? n.replace(",", ".") : n;
}
export function formatInputValue(e) {
  const o = p(e);
  return c() ? o.replace(",", ".") : o;
}
const a = (e) => (c() ? String(e).replace(/(\d),(\d)/g, "$1.$2") : String(e));
export const formatVolume = (...e) => a(d(...e)),
  formatVolumeRate = (...e) => a(g(...e)),
  formatMaltMass = (...e) => a(x(...e)),
  formatIngredientAmount = (...e) => a(A(...e)),
  formatIonPpm = (...e) => a(S(...e)),
  formatPlatoSg = (...e) => a(h(...e)),
  formatWriValue = (...e) => a(C(...e));
export function formatYeastAmount(e, o) {
  const n = a($(e, o));
  return r === "pt" || n === "-"
    ? n
    : n.replace(/^([\d.,]+)\s+(.+)$/, (s, i, u) => `${i} ${t(u)}`);
}
initLanguage();
