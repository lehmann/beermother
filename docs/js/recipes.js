import {
  DEFAULT_PROFILE as f,
  DEFAULT_HEATING_RATE_C_MIN as v,
  DEFAULT_BASE_WATER_PROFILE as I,
  SALT_ION_CONTRIBUTIONS as mt,
  WATER_IONS as B,
  PPG_100 as ut,
  n as e,
  round as u,
  clonePlain as Z,
  isPlainObject as d,
  slugify as lt,
  gravityEstimate as _,
  moreyEbc as pt,
  hotPostBoilVolume as ht,
  evaporationLhFromPct as Mt,
  sanitizeBaseWaterProfile as $,
  sgPoints as T,
  sgToPlato as ft,
  calculate as Et,
  abvBrewfather as Pt,
  pickParameterValue as w,
  finalParameterCode as gt,
} from "./engine.js";
import { findStyle as bt, FERMENTATION_PRESETS as Lt } from "./library.js";
import { t as N } from "./i18n.js";
export const FERMENTABLE_TYPES = [
  "Gr\xE3o",
  "A\xE7\xFAcar",
  "A\xE7\xFAcar n\xE3o ferment\xE1vel",
  "Extrato",
];
const At = 122,
  St = { pacote: 148, sachê: 148, "un.": 148, g: 13.5, mL: 1 };
export const MY_RECIPES_KEY = "beermother.fable.myRecipes.v1",
  BREW_HISTORY_KEY = "beermother.fable.brewHistory.v1";
const Tt = 24;
export const BASE_EQUIPMENT_PROFILE = {
    id: "builtin-base",
    name: "Equipamento padr\xE3o",
    builtin: !0,
    params: {
      targetVolumeL: 20,
      mashEfficiencyPct: 74.75,
      evaporationPct: 13,
      trubLossPct: 0.15,
      grainAbsorptionLkg: 1,
      waterToGrainRatioLkg: 3,
      heatingRateCMin: 1.5,
    },
  },
  MAX_FERMENTATION_PRESSURE_ATM = 3;
export function sanitizeFermentationPressure(t = {}) {
  return t.pressurized
    ? {
        pressurized: !0,
        pressureAtm: Math.min(
          MAX_FERMENTATION_PRESSURE_ATM,
          Math.max(0, e(t.pressureAtm, 0)),
        ),
      }
    : {};
}
export function ebcToLovibond(t) {
  return Math.max(0, (e(t) / 1.97 + 0.76) / 1.3546);
}
export function lovibondToEbc(t) {
  return Math.max(0, (e(t) * 1.3546 - 0.76) * 1.97);
}
export function newDraft() {
  return {
    id: draftId(),
    name: "",
    styleName: "",
    brewer: "",
    batchVolumeL: BASE_EQUIPMENT_PROFILE.params.targetVolumeL,
    boilTimeMin: 60,
    mashEfficiencyPct: BASE_EQUIPMENT_PROFILE.params.mashEfficiencyPct,
    manualFg: "",
    equipmentProfileName: "",
    trubLossPct: BASE_EQUIPMENT_PROFILE.params.trubLossPct,
    evaporationPct: BASE_EQUIPMENT_PROFILE.params.evaporationPct,
    whirlpoolNoChillMin: WHIRLPOOL_NOCHILL_MIN,
    whirlpoolTemperatureC: HOPSTAND_DEFAULT_TEMP_C,
    heatingRateCMin: v,
    fermentables: [],
    hops: [],
    yeasts: [],
    mash: [
      { name: "Sacarifica\xE7\xE3o", temperatureC: 66, timeMin: 60 },
      { name: "Mash out", temperatureC: 76, timeMin: 10 },
    ],
    fermentation: Lt[0].steps.map((t) => ({ ...t })),
    baseWaterProfile: { ...I },
    salts: [
      { formula: "CaCl2", amountG: 0 },
      { formula: "CaSO4", amountG: 0 },
      { formula: "MgSO4", amountG: 0 },
    ],
    miscs: [],
  };
}
export function draftId() {
  return `recipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function draftFromRecipe(t, a = {}) {
  const r = Z(t);
  return {
    id: a.keepId && r.editorId ? r.editorId : draftId(),
    name: a.copy
      ? N("{name} (c\xF3pia)", { name: r.name || N("Receita") })
      : r.name || "",
    styleName: r.styleName || "",
    brewer: r.brewer || "",
    batchVolumeL: e(r.batchVolumeL, 20),
    boilTimeMin: e(r.boilTimeMin, 60),
    mashEfficiencyPct: e(
      r.mashEfficiencyPct,
      e(r.efficiencyPct, f.mashEfficiencyPct),
    ),
    manualFg: r.fgManual ? e(r.fg) : "",
    equipmentProfileName: String(r.equipmentProfileName || ""),
    trubLossPct: Number.isFinite(Number(r.trubLossPct))
      ? Math.min(0.5, Math.max(0, e(r.trubLossPct)))
      : e(r.batchVolumeL) > 0 && Number.isFinite(Number(r.trubLossL))
        ? Math.min(0.5, Math.max(0, u(e(r.trubLossL) / e(r.batchVolumeL), 4)))
        : f.trubLossPct,
    evaporationPct: Math.min(
      40,
      Math.max(0, e(r.evaporationPct, f.evaporationPct)),
    ),
    whirlpoolNoChillMin: Math.min(
      120,
      Math.max(0, e(r.whirlpoolNoChillMin, WHIRLPOOL_NOCHILL_MIN)),
    ),
    whirlpoolTemperatureC: Math.min(
      100,
      Math.max(40, e(r.whirlpoolTemperatureC, HOPSTAND_DEFAULT_TEMP_C)),
    ),
    heatingRateCMin: Math.min(10, Math.max(0, e(r.heatingRateCMin, v))),
    fermentables: (r.fermentables || []).map((o) => ({
      name: o.name || "",
      type:
        o.notFermentable && (o.type || "Gr\xE3o") === "A\xE7\xFAcar"
          ? "A\xE7\xFAcar n\xE3o ferment\xE1vel"
          : o.type || "Gr\xE3o",
      yieldPct: e(o.yieldPct, 78),
      colorEbc: u(lovibondToEbc(o.colorLovibond), 1),
      amountKg: e(o.amountKg),
      when: o.use === "Fermenta\xE7\xE3o" ? "Fermenta\xE7\xE3o" : "Fervura",
    })),
    hops: (r.hops || []).map((o) => ({
      name: o.name || "",
      alphaAcidPct: e(o.alphaAcidPct),
      amountG: e(o.amountG),
      use: o.use || "Fervura",
      timeMin: e(o.timeMin),
      temperatureC: Number.isFinite(Number(o.temperatureC))
        ? e(o.temperatureC)
        : 90,
    })),
    yeasts: (r.yeasts || []).map((o) => ({
      name: o.name || "",
      attenuationPct: e(o.attenuationPct, 78),
      amount: e(o.amount, 1),
      unit: o.unit || "pacote",
    })),
    mash: (r.mash || []).map((o) => ({
      name: o.name || "Mostura",
      temperatureC: e(o.temperatureC, 66),
      timeMin: e(o.timeMin, 60),
    })),
    fermentation: (r.fermentation || []).map((o) => ({
      name: o.name || "Prim\xE1ria",
      temperatureC: e(o.temperatureC, 19),
      days: e(o.days, 7),
      ...sanitizeFermentationPressure(o),
    })),
    baseWaterProfile: $(r.baseWaterProfile, I),
    salts: ["CaCl2", "CaSO4", "MgSO4"].map((o) => ({
      formula: o,
      amountG: (r.salts || [])
        .filter((m) => m.formula === o)
        .reduce((m, s) => m + e(s.amountG), 0),
    })),
    miscs: (r.miscs || []).map((o) => ({
      name: o.name || "",
      amount: e(o.amount),
      unit: o.unit || "g",
      use: o.use || "Fervura",
      timeMin: e(o.timeMin, 10),
    })),
  };
}
function D(t) {
  return (t.fermentables || []).map((a, r) => {
    const o = a.type || "Gr\xE3o",
      m = o === "Gr\xE3o" || o === "Adjunto";
    return {
      id: `f${r}`,
      name: a.name || "Ferment\xE1vel",
      type: o === "A\xE7\xFAcar n\xE3o ferment\xE1vel" ? "A\xE7\xFAcar" : o,
      draftType: o,
      use: m
        ? "Mostura"
        : a.when === "Fermenta\xE7\xE3o"
          ? "Fermenta\xE7\xE3o"
          : "Fervura",
      timeMin: m || a.when === "Fermenta\xE7\xE3o" ? void 0 : 10,
      amountKg: e(a.amountKg),
      ppg: (e(a.yieldPct, 78) / 100) * ut,
      yieldPct: e(a.yieldPct, 78),
      colorLovibond: ebcToLovibond(a.colorEbc),
    };
  });
}
function tt(t, a, r) {
  return t === "A\xE7\xFAcar"
    ? At
    : t === "A\xE7\xFAcar n\xE3o ferment\xE1vel"
      ? 0
      : t === "Extrato"
        ? a
        : Math.min(100, Math.max(30, a + r));
}
export function mashAttenuationAdjust(t = []) {
  const a = (t || []).filter((s) => {
      const n = e(s.temperatureC);
      return n >= 60 && n <= 72 && e(s.timeMin) > 0;
    }),
    r = a.reduce((s, n) => s + e(n.timeMin), 0);
  if (!r) return 0;
  const o = a.reduce((s, n) => s + e(n.temperatureC) * e(n.timeMin), 0) / r,
    m = [
      [60, 4],
      [63, 3],
      [66.5, 0],
      [70, -5],
      [72, -6],
    ];
  if (o <= m[0][0]) return m[0][1];
  for (let s = 1; s < m.length; s += 1) {
    const [n, i] = m[s];
    if (o <= n) {
      const [M, l] = m[s - 1],
        E = (o - M) / (n - M);
      return u(l + (i - l) * E, 1);
    }
  }
  return m[m.length - 1][1];
}
export function tinsethUtilization(t, a) {
  return (
    (1.65 *
      Math.pow(125e-6, t - 1) *
      (1 - Math.exp(-0.04 * Math.max(0, e(a))))) /
    4.15
  );
}
const U = [
  [64, 0.06],
  [65, 0.07],
  [66, 0.07],
  [67, 0.08],
  [68, 0.09],
  [69, 0.09],
  [70, 0.1],
  [71, 0.11],
  [72, 0.12],
  [73, 0.13],
  [74, 0.14],
  [75, 0.15],
  [76, 0.17],
  [77, 0.18],
  [78, 0.2],
  [79, 0.21],
  [80, 0.23],
  [81, 0.25],
  [82, 0.27],
  [83, 0.29],
  [84, 0.31],
  [85, 0.34],
  [86, 0.36],
  [87, 0.39],
  [88, 0.42],
  [89, 0.46],
  [90, 0.49],
  [91, 0.53],
  [92, 0.57],
  [93, 0.61],
  [94, 0.66],
  [95, 0.71],
  [96, 0.76],
  [97, 0.82],
  [98, 0.88],
  [99, 0.94],
  [100, 1],
];
export function hopstandTemperatureFactor(t) {
  const a = e(t);
  if (a < 64) return 0;
  if (a >= 100) return 1;
  for (let r = 1; r < U.length; r += 1) {
    const [o, m] = U[r];
    if (a <= o) {
      const [s, n] = U[r - 1],
        i = (a - s) / (o - s);
      return n + (m - n) * i;
    }
  }
  return 1;
}
export const IBU_VOLUME_FACTOR = 1.075,
  WHIRLPOOL_NOCHILL_MIN = 5,
  HOPSTAND_DEFAULT_TEMP_C = 90;
export function whirlpoolOptions(t = {}) {
  return {
    noChillMin: Math.min(
      120,
      Math.max(0, e(t.whirlpoolNoChillMin, WHIRLPOOL_NOCHILL_MIN)),
    ),
    temperatureC: Math.min(
      100,
      Math.max(40, e(t.whirlpoolTemperatureC, HOPSTAND_DEFAULT_TEMP_C)),
    ),
  };
}
export function editorIbuContributions(t, a, r, o = {}) {
  const m = Math.max(0.1, e(r, 20)) * IBU_VOLUME_FACTOR,
    s = whirlpoolOptions(o),
    n = (p) => tinsethUtilization(a, Math.max(0, p)),
    M = (t || [])
      .filter(
        (p) => ["Hopstand", "Whirlpool"].includes(p.use) && e(p.timeMin) > 0,
      )
      .reduce((p, g) => (e(g.timeMin) > e(p?.timeMin) ? g : p), null),
    l = M ? e(M.timeMin) : s.noChillMin,
    E = M && e(M.temperatureC) > 0 ? e(M.temperatureC) : s.temperatureC;
  return (t || []).map((p) => {
    const g = p.use || "Fervura";
    if (g === "Dry hop" || g === "Mostura") return 0;
    const A = ((e(p.alphaAcidPct) / 100) * e(p.amountG) * 1e3) / m;
    if (!A) return 0;
    const P = g === "Hopstand" || g === "Whirlpool",
      L = P ? 0 : e(p.timeMin),
      S = n(L),
      y = P ? Math.max(0, e(p.timeMin) || s.noChillMin) : l;
    let x = S;
    if (y > 0 && (P || g === "Fervura" || g === "First wort")) {
      const R = P
          ? e(p.temperatureC) > 0
            ? e(p.temperatureC)
            : s.temperatureC
          : E,
        C = hopstandTemperatureFactor(R);
      x = S + Math.max(0, n(L + y) - S) * C;
    }
    return x * (g === "First wort" ? 1.1 : 1) * A;
  });
}
export function editorIbu(t, a, r, o = {}) {
  return editorIbuContributions(t, a, r, o).reduce((m, s) => m + s, 0);
}
export function computeTargets(t) {
  const a = Math.max(0.1, e(t.batchVolumeL, 20)),
    r = Math.max(1, e(t.mashEfficiencyPct, 65)),
    o = Math.max(1, e(t.boilTimeMin, 60)),
    m = Math.min(0.5, Math.max(0, e(t.trubLossPct, f.trubLossPct))),
    s = Math.min(40, Math.max(0, e(t.evaporationPct, f.evaporationPct))),
    n = u(a * m, 2),
    i = D(t),
    M = { targetVolumeL: a + n, mashEfficiencyPct: r },
    l = _(i, M),
    E = u(l.og, 3),
    p = Math.max(0, T(l.og)),
    g = Math.min(100, Math.max(30, e(t.yeasts?.[0]?.attenuationPct, 78))),
    A = mashAttenuationAdjust(t.mash);
  let P = 0;
  i.forEach((h) => {
    const b = Math.max(0, T(_([h], M).og));
    P += b * tt(h.draftType, g, A);
  });
  const L = p ? P / p : tt("Gr\xE3o", g, A),
    S = u(1 + (p * (1 - L / 100)) / 1e3, 3),
    y = e(t.manualFg),
    x = y >= 0.98 && y <= 1.2,
    O = x ? u(y, 3) : S,
    R = ht(a, n),
    C = Mt(s, R, o),
    H = R + (C * o) / 60,
    et = l.points ? Math.max(0, Math.min(1, l.preBoilPoints / l.points)) : 1,
    at = 1 + (p * et * R) / Math.max(0.1, H) / 1e3,
    k = (l.og + at) / 2,
    ot = (t.hops || []).map((h, b) => ({
      id: `h${b}`,
      name: h.name,
      alphaAcidPct: e(h.alphaAcidPct),
      use: h.use || "Fervura",
      timeMin: e(h.timeMin),
      temperatureC: e(h.temperatureC, 90),
      amountG: e(h.amountG),
    })),
    Y = editorIbuContributions(ot, k, a, t),
    K = Math.round(Y.reduce((h, b) => h + b, 0)),
    z = pt(i, a + n),
    J = u(Pt(E, O), 1),
    G = (t.yeasts || []).reduce(
      (h, b) => h + e(b.amount) * (St[b.unit] ?? 0),
      0,
    ),
    j = ft(E),
    nt = G > 0 && j > 0.5 ? u(G / (a * j), 2) : 0,
    q = i
      .filter((h) => h.use === "Mostura")
      .reduce((h, b) => h + e(b.amountKg), 0),
    rt = (C * o) / 60,
    Q = Math.max(1, a + n + rt + q * f.grainAbsorptionLkg),
    it = $(t.baseWaterProfile, I),
    F = B.reduce((h, b) => ({ ...h, [b.key]: e(it[b.key]) }), {});
  return (
    (t.salts || []).forEach((h) => {
      const b = mt[h.formula];
      if (!b) return;
      const st = e(h.amountG) / Q;
      Object.entries(b).forEach(([X, ct]) => {
        F[X] = F[X] + st * ct;
      });
    }),
    B.forEach((h) => {
      F[h.key] = Math.round(Math.max(0, F[h.key]));
    }),
    {
      og: E,
      fg: O,
      fgCalculated: S,
      fgManual: x,
      fgAssumed: !x && !(t.yeasts || []).length,
      abv: J,
      ibu: K,
      hopIbu: Y.map((h) => u(h, 1)),
      yeastPitch: { rate: nt, cellsBi: u(G, 0) },
      bg: u(k, 4),
      ebc: u(z, 1),
      ions: F,
      grainKg: u(q, 2),
      totalWaterL: u(Q, 1),
      mashAdjust: A,
      trubLossL: n,
      preBoil: u(H, 2),
      evaporationLh: u(C, 2),
      style: styleCheck(t.styleName, {
        og: E,
        fg: O,
        abv: J,
        ibu: K,
        ebc: u(z, 1),
      }),
    }
  );
}
export function scaleFermentablesToOg(t, a) {
  const r = computeTargets(t),
    o = Math.max(0.1, T(r.og)),
    s = Math.max(1, T(e(a))) / o;
  return (
    t.fermentables.forEach((n) => {
      n.amountKg = u(e(n.amountKg) * s, 2);
    }),
    s
  );
}
function W(t, a, r) {
  const o = t.fermentables || [],
    m = Math.max(0.1, e(t.batchVolumeL, 20)),
    s = Math.min(0.5, Math.max(0, e(t.trubLossPct, f.trubLossPct))),
    n = {
      targetVolumeL: m + u(m * s, 2),
      mashEfficiencyPct: Math.max(1, e(t.mashEfficiencyPct, 65)),
    },
    i = D(t),
    M = Number.isFinite(Number(r))
      ? Math.max(1, T(e(r)))
      : i.reduce((P, L) => P + Math.max(0, T(_([L], n).og)), 0),
    l = a.reduce((P, L) => P + Math.max(0, e(L)), 0);
  if (!M || !l) return !1;
  const E = a.map((P) => Math.max(0, e(P)) / l),
    p = i.map((P) => Math.max(0, T(_([{ ...P, amountKg: 1 }], n).og))),
    g = E.reduce((P, L, S) => P + L * p[S], 0);
  if (!g) return !1;
  const A = M / g;
  return (
    o.forEach((P, L) => {
      P.amountKg = u(A * E[L], 2);
    }),
    !0
  );
}
export function normalizeFermentablePercents(t, a) {
  return W(t, a);
}
export function applyFermentablePercentsWithOg(t, a, r) {
  return W(t, a, r);
}
export const BITTERING_MIN_BOIL_MIN = 30;
function V(t) {
  return (
    ["Fervura", "First wort"].includes(t.use || "Fervura") &&
    e(t.timeMin) >= BITTERING_MIN_BOIL_MIN
  );
}
export function scaleHopsToIbu(t, a) {
  const r = computeTargets(t),
    o = Math.max(0.1, e(t.batchVolumeL, 20)),
    m = t.hops || [],
    s = editorIbuContributions(m, r.bg, o, t),
    n = s.reduce((l, E, p) => l + (V(m[p]) ? E : 0), 0),
    i = s.reduce((l, E, p) => l + (V(m[p]) ? 0 : E), 0);
  if (!n) return { ok: !1, fixedIbu: Math.round(i) };
  const M = Math.max(0, (e(a) - i) / n);
  return (
    m.forEach((l) => {
      V(l) && (l.amountG = u(e(l.amountG) * M, 1));
    }),
    { ok: !0, factor: M, fixedIbu: Math.round(i) }
  );
}
export function rescaleDraftForEquipment(t, a, r) {
  const o = Math.max(0.1, e(t.batchVolumeL, 20)),
    m = Math.max(0.1, e(r, o)),
    s = o / m;
  return (
    (t.fermentables || []).forEach((n) => {
      n.amountKg = u(e(n.amountKg) * s, 3);
    }),
    (t.hops || []).forEach((n) => {
      n.amountG = u(e(n.amountG) * s, 1);
    }),
    (t.yeasts || []).forEach((n) => {
      n.amount = u(e(n.amount) * s, 2);
    }),
    (t.salts || []).forEach((n) => {
      n.amountG = u(e(n.amountG) * s, 1);
    }),
    (t.miscs || []).forEach((n) => {
      n.amount = u(e(n.amount) * s, 2);
    }),
    e(a?.og) > 1 &&
      (t.fermentables || []).some((n) => e(n.amountKg) > 0) &&
      scaleFermentablesToOg(t, e(a.og)),
    e(a?.ibu) > 0 && scaleHopsToIbu(t, e(a.ibu)),
    { factor: u(s, 4) }
  );
}
export function setFermentablePercentWithBase(t, a, r, o) {
  const m = t.fermentables || [];
  if (a === o || !m[a] || !m[o]) return !1;
  const s = m.reduce((l, E) => l + e(E.amountKg), 0);
  if (!s) return !1;
  const n = m.map((l) => (e(l.amountKg) / s) * 100),
    i = n.reduce((l, E, p) => (p === a || p === o ? l : l + E), 0),
    M = Math.min(Math.max(0, e(r)), 100 - i);
  return ((n[a] = M), (n[o] = Math.max(0, 100 - i - M)), W(t, n));
}
export function applyHopAlphaToAll(t, a, r) {
  const o = String(a || "")
    .trim()
    .toLowerCase();
  let m = 0;
  return (
    (t.hops || []).forEach((s) => {
      String(s.name || "")
        .trim()
        .toLowerCase() === o &&
        ((s.alphaAcidPct = Math.max(0, e(r))), (m += 1));
    }),
    m
  );
}
export const PROFILES_KEY = "beermother.fable.productionProfiles.v1",
  PRINCIPAL_PROFILE_KEY = "beermother.fable.principalProfileId.v1";
export function listProductionProfiles() {
  try {
    const t = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
    return Array.isArray(t) ? t.filter((a) => d(a) && d(a.params)) : [];
  } catch {
    return [];
  }
}
export function customizedBaseWater(t) {
  if (!d(t)) return null;
  const a = $(t, I);
  return B.every((o) => e(a[o.key]) === e(I[o.key])) ? null : a;
}
export function saveProductionProfileEntry(t) {
  const a = customizedBaseWater(t.params?.baseWaterProfile),
    r = {
      id:
        t.id ||
        `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: String(t.name || "Meu equipamento").trim() || "Meu equipamento",
      updatedAt: new Date().toISOString(),
      params: {
        targetVolumeL: Math.max(1, e(t.params?.targetVolumeL, f.targetVolumeL)),
        mashEfficiencyPct: Math.min(
          110,
          Math.max(20, e(t.params?.mashEfficiencyPct, f.mashEfficiencyPct)),
        ),
        evaporationPct: Math.min(
          40,
          Math.max(0, e(t.params?.evaporationPct, f.evaporationPct)),
        ),
        trubLossPct: Math.min(
          0.5,
          Math.max(0, e(t.params?.trubLossPct, f.trubLossPct)),
        ),
        grainAbsorptionLkg: Math.min(
          3,
          Math.max(0, e(t.params?.grainAbsorptionLkg, f.grainAbsorptionLkg)),
        ),
        waterToGrainRatioLkg: Math.min(
          8,
          Math.max(
            1,
            e(t.params?.waterToGrainRatioLkg, f.waterToGrainRatioLkg),
          ),
        ),
        mashTunDeadSpaceL: Math.min(
          50,
          Math.max(0, e(t.params?.mashTunDeadSpaceL, 0)),
        ),
        whirlpoolNoChillMin: Math.min(
          120,
          Math.max(0, e(t.params?.whirlpoolNoChillMin, WHIRLPOOL_NOCHILL_MIN)),
        ),
        whirlpoolTemperatureC: Math.min(
          100,
          Math.max(
            40,
            e(t.params?.whirlpoolTemperatureC, HOPSTAND_DEFAULT_TEMP_C),
          ),
        ),
        heatingRateCMin: Math.min(
          10,
          Math.max(0, e(t.params?.heatingRateCMin, v)),
        ),
        ...(a ? { baseWaterProfile: a } : {}),
      },
    },
    o = listProductionProfiles().filter((m) => m.id !== r.id);
  o.unshift(r);
  try {
    return (localStorage.setItem(PROFILES_KEY, JSON.stringify(o)), r);
  } catch {
    return null;
  }
}
export function productionParamsFromImportedRecipe(t, a = {}) {
  const r = Math.max(1, e(t.batchVolumeL, f.targetVolumeL)),
    o = (t.fermentables || [])
      .filter((n) => n.use === "Mostura")
      .reduce((n, i) => n + e(i.amountKg), 0),
    m = (t.mash || []).reduce((n, i) => n + e(i.waterVolumeL), 0),
    s = e(a.deadSpaceL, NaN);
  return {
    targetVolumeL: r,
    mashEfficiencyPct: e(t.mashEfficiencyPct, f.mashEfficiencyPct),
    evaporationPct: e(t.evaporationPct, f.evaporationPct),
    trubLossPct: u(Math.max(0, e(t.trubLossL)) / r, 4),
    grainAbsorptionLkg: f.grainAbsorptionLkg,
    waterToGrainRatioLkg:
      o > 0 && m > 0
        ? Math.min(8, Math.max(1, u(m / o, 2)))
        : f.waterToGrainRatioLkg,
    ...(Number.isFinite(s)
      ? { mashTunDeadSpaceL: Math.min(50, Math.max(0, s)) }
      : {}),
  };
}
export function deleteProductionProfileEntry(t) {
  const a = listProductionProfiles().filter((r) => r.id !== t);
  try {
    (localStorage.setItem(PROFILES_KEY, JSON.stringify(a)),
      getPrincipalProfileId() === t &&
        localStorage.removeItem(PRINCIPAL_PROFILE_KEY));
  } catch {}
}
export function getPrincipalProfileId() {
  try {
    return localStorage.getItem(PRINCIPAL_PROFILE_KEY) || "";
  } catch {
    return "";
  }
}
export function setPrincipalProfileId(t) {
  try {
    localStorage.setItem(PRINCIPAL_PROFILE_KEY, String(t || ""));
  } catch {}
}
export function getPrincipalProfile() {
  const t = getPrincipalProfileId();
  return listProductionProfiles().find((a) => a.id === t) || null;
}
export const USER_LIBRARY_KEY = "beermother.fable.userLibrary.v1";
export function loadUserLibrary() {
  try {
    const t = JSON.parse(localStorage.getItem(USER_LIBRARY_KEY) || "{}");
    return {
      malts: Array.isArray(t.malts) ? t.malts : [],
      hops: Array.isArray(t.hops) ? t.hops : [],
      yeasts: Array.isArray(t.yeasts) ? t.yeasts : [],
      miscs: Array.isArray(t.miscs) ? t.miscs : [],
    };
  } catch {
    return { malts: [], hops: [], yeasts: [], miscs: [] };
  }
}
export function saveUserIngredient(t, a) {
  const r = loadUserLibrary(),
    o = r[t];
  if (!Array.isArray(o) || !a?.name) return !1;
  const m = String(a.name).trim().toLowerCase(),
    s = o.filter((n) => String(n.name).trim().toLowerCase() !== m);
  (s.unshift({ ...a, name: String(a.name).trim() }), (r[t] = s.slice(0, 60)));
  try {
    return (localStorage.setItem(USER_LIBRARY_KEY, JSON.stringify(r)), !0);
  } catch {
    return !1;
  }
}
export function touchMyRecipe(t) {
  const a = getMyRecipe(t);
  a && saveMyRecipe(a.draft);
}
export function styleCheck(t, a) {
  const r = bt(t);
  if (!r) return null;
  const o = (m) => {
    const [s, n] = r[m],
      i = e(a[m]);
    return i < s ? -1 : i > n ? 1 : 0;
  };
  return {
    name: r.name,
    ranges: r,
    checks: {
      og: o("og"),
      fg: o("fg"),
      abv: o("abv"),
      ibu: o("ibu"),
      ebc: o("ebc"),
    },
  };
}
export function medianBrewParameters(t = listBrewHistory(), a = 5) {
  const r = t.slice(0, a);
  if (r.length < 2) return null;
  const o = (m) => {
    const s = r
      .map((i) => e(i[m]))
      .filter((i) => i > 0)
      .sort((i, M) => i - M);
    if (!s.length) return null;
    const n = Math.floor(s.length / 2);
    return s.length % 2 ? s[n] : u((s[n - 1] + s[n]) / 2, 2);
  };
  return {
    count: r.length,
    mashEfficiencyPct: o("mashEfficiencyPct"),
    evaporationPct: o("evaporationPct"),
    grainAbsorptionLkg: o("grainAbsorptionLkg"),
    trubLossL: o("trubLossL"),
    waterToGrainRatioLkg: o("waterToGrainRatioLkg"),
  };
}
export function recipeFromDraft(t) {
  const a = computeTargets(t),
    r = Math.max(0.1, e(t.batchVolumeL, 20)),
    o = Math.max(1, e(t.boilTimeMin, 60)),
    m = Math.max(1, e(t.mashEfficiencyPct, 65)),
    s = D(t);
  return {
    editorId: t.id,
    name: t.name || N("Receita sem nome"),
    styleName: t.styleName || N("Estilo pr\xF3prio"),
    brewer: t.brewer || "",
    batchVolumeL: r,
    boilTimeMin: o,
    boilSize: u(a.preBoil, 2),
    trubLossL: a.trubLossL,
    evaporationLh: a.evaporationLh,
    evaporationPct: Math.min(
      40,
      Math.max(0, e(t.evaporationPct, f.evaporationPct)),
    ),
    trubLossPct: Math.min(0.5, Math.max(0, e(t.trubLossPct, f.trubLossPct))),
    whirlpoolNoChillMin: Math.min(
      120,
      Math.max(0, e(t.whirlpoolNoChillMin, WHIRLPOOL_NOCHILL_MIN)),
    ),
    whirlpoolTemperatureC: Math.min(
      100,
      Math.max(40, e(t.whirlpoolTemperatureC, HOPSTAND_DEFAULT_TEMP_C)),
    ),
    heatingRateCMin: Math.min(10, Math.max(0, e(t.heatingRateCMin, v))),
    efficiencyPct: m,
    mashEfficiencyPct: m,
    og: a.og,
    fg: a.fg,
    fgManual: a.fgManual,
    ibu: a.ibu,
    colorEbc: a.ebc,
    fermentables: s,
    hops: (t.hops || []).map((n, i) => ({
      id: `h${i}`,
      name: n.name || "L\xFApulo",
      alphaAcidPct: e(n.alphaAcidPct),
      type: "Pellet",
      use: n.use || "Fervura",
      timeMin: e(n.timeMin),
      temperatureC: ["Hopstand", "Whirlpool"].includes(n.use)
        ? e(n.temperatureC, 90)
        : void 0,
      amountG: u(e(n.amountG), 1),
    })),
    yeasts: (t.yeasts || []).map((n, i) => ({
      id: `y${i}`,
      name: n.name || "Levedura",
      type: "",
      form: "",
      laboratory: "",
      productId: "",
      attenuationPct: e(n.attenuationPct, 78),
      amount: e(n.amount, 1),
      unit: n.unit || "pacote",
      displayAmount: "",
    })),
    salts: (t.salts || [])
      .filter((n) => e(n.amountG) > 0)
      .map((n, i) => ({
        id: `s${i}`,
        name: n.formula,
        formula: n.formula,
        amountG: u(e(n.amountG), 1),
        use: "Mostura",
      })),
    miscs: (t.miscs || [])
      .filter((n) => n.name)
      .map((n, i) => ({
        id: `m${i}`,
        name: n.name,
        type: "Insumo",
        use: n.use || "Fervura",
        timeMin:
          n.use === "Mostura" || n.use === "Fermenta\xE7\xE3o"
            ? void 0
            : e(n.timeMin),
        amount: e(n.amount),
        unit: n.unit || "g",
      })),
    baseWaterProfile: $(t.baseWaterProfile, I),
    saltReferenceWaterL: a.totalWaterL,
    fermentationProfileName: "",
    fermentation: (t.fermentation || []).map((n) => ({
      name: n.name || "Prim\xE1ria",
      temperatureC: e(n.temperatureC, 19),
      days: e(n.days, 7),
      ...sanitizeFermentationPressure(n),
    })),
    mash: (t.mash || []).length
      ? t.mash.map((n, i) => ({
          id: `m${i}`,
          name: n.name || "Mostura",
          type: "Temperature",
          temperatureC: e(n.temperatureC, 66),
          timeMin: e(n.timeMin, 60),
          waterVolumeL: void 0,
        }))
      : [{ id: "m0", name: "Mostura", temperatureC: 66, timeMin: 60 }],
  };
}
export function listMyRecipes() {
  try {
    const t = JSON.parse(localStorage.getItem(MY_RECIPES_KEY) || "[]");
    return Array.isArray(t) ? t.filter((a) => d(a) && d(a.draft)) : [];
  } catch {
    return [];
  }
}
export function saveMyRecipe(t, a = {}) {
  const r = computeTargets(t),
    o = {
      id: t.id || draftId(),
      updatedAt: new Date().toISOString(),
      name: t.name || N("Receita sem nome"),
      styleName: t.styleName || "",
      abv: r.abv,
      ebc: r.ebc,
      ibu: r.ibu,
      og: r.og,
      isDraft: !!a.isDraft,
      draft: Z({ ...t, id: t.id || draftId() }),
    },
    m = listMyRecipes().filter((s) => s.id !== o.id);
  m.unshift(o);
  try {
    return (localStorage.setItem(MY_RECIPES_KEY, JSON.stringify(m)), o);
  } catch {
    return null;
  }
}
export function deleteMyRecipe(t) {
  const a = listMyRecipes().filter((r) => r.id !== t);
  try {
    localStorage.setItem(MY_RECIPES_KEY, JSON.stringify(a));
  } catch {}
}
export function saveBrewedRecipe(t) {
  if (!t || !t.name) return null;
  const a = draftFromRecipe(t),
    r = listMyRecipes().find((o) => !o.isDraft && o.name === a.name);
  return (r && (a.id = r.id), saveMyRecipe(a, { isDraft: !1 }));
}
export function getMyRecipe(t) {
  return listMyRecipes().find((a) => a.id === t) || null;
}
export function listBrewHistory() {
  try {
    const t = JSON.parse(localStorage.getItem(BREW_HISTORY_KEY) || "[]");
    return Array.isArray(t) ? t.filter(d) : [];
  } catch {
    return [];
  }
}
export function upsertBrewHistory(t, a) {
  if (!(!t || !t.recipe || !a))
    try {
      const r = Et(t),
        o = r.props,
        m = r.analysis || {},
        s = !!(
          e(t.measurements?.preBoil?.volumeL) ||
          e(t.measurements?.postBoil?.volumeL)
        ),
        n = {
          id: a,
          recipeName: t.recipe.name || N("Receita"),
          styleName: t.recipe.styleName || "",
          savedAt: new Date().toISOString(),
          hasReadings: s,
          targetVolumeL: e(o.targetVolumeL, 20),
          mashEfficiencyPct: u(w(m.mashEfficiencyPct, o.mashEfficiencyPct), 1),
          evaporationPct: u(w(m.evaporationPct, o.evaporationPct), 1),
          grainAbsorptionLkg: u(
            w(m.grainAbsorptionLkg, o.grainAbsorptionLkg),
            2,
          ),
          trubLossL: u(w(m.trubLossL, o.trubLossL), 2),
          waterToGrainRatioLkg: e(o.waterToGrainRatioLkg, 3),
          parameterCode: gt(r),
        },
        i = listBrewHistory().filter((M) => M.id !== a);
      (i.unshift(n),
        localStorage.setItem(BREW_HISTORY_KEY, JSON.stringify(i.slice(0, Tt))));
    } catch {}
}
function yt(t) {
  return String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function c(t, a) {
  return `<${t}>${yt(a)}</${t}>`;
}
export function recipeToBeerXml(t) {
  const a = recipeFromDraft(t),
    r = {
      Fervura: "Boil",
      "First wort": "First Wort",
      Hopstand: "Aroma",
      Whirlpool: "Whirlpool",
      "Dry hop": "Dry Hop",
      Mostura: "Mash",
    },
    o = {
      Fervura: "Boil",
      Mostura: "Mash",
      Fermentação: "Primary",
      Envase: "Bottling",
    },
    m = [],
    s = a.fermentation;
  return (
    s[0] &&
      m.push(c("PRIMARY_TEMP", s[0].temperatureC), c("PRIMARY_AGE", s[0].days)),
    s[1] &&
      m.push(
        c("SECONDARY_TEMP", s[1].temperatureC),
        c("SECONDARY_AGE", s[1].days),
      ),
    s[2] &&
      m.push(
        c("TERTIARY_TEMP", s[2].temperatureC),
        c("TERTIARY_AGE", s[2].days),
      ),
    s[3] && m.push(c("AGE_TEMP", s[3].temperatureC), c("AGE", s[3].days)),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<RECIPES><RECIPE>",
      c("NAME", a.name),
      c("VERSION", 1),
      c("TYPE", "All Grain"),
      c("BREWER", a.brewer),
      c("BATCH_SIZE", a.batchVolumeL),
      c("BOIL_SIZE", a.boilSize),
      c("BOIL_TIME", a.boilTimeMin),
      c("EFFICIENCY", a.efficiencyPct),
      c("MASH_EFFICIENCY", a.mashEfficiencyPct),
      c("OG", a.og),
      c("FG", a.fg),
      c("IBU", a.ibu),
      c("EST_COLOR", `${a.colorEbc} EBC`),
      ...m,
      `<STYLE>${c("NAME", a.styleName)}<VERSION>1</VERSION></STYLE>`,
      `<EQUIPMENT>${c("NAME", "Editor Fable")}${c("BOIL_SIZE", a.boilSize)}${c("BOIL_TIME", a.boilTimeMin)}${c("TRUB_CHILLER_LOSS", a.trubLossL)}${c("BOIL_OFF_PER_HOUR", a.evaporationLh)}</EQUIPMENT>`,
      "<FERMENTABLES>",
      ...a.fermentables.map(
        (i) =>
          `<FERMENTABLE>${c("NAME", i.name)}${c("VERSION", 1)}${c("TYPE", i.type === "A\xE7\xFAcar" ? "Sugar" : i.type === "Extrato" ? "Dry Extract" : "Grain")}${c("AMOUNT", i.amountKg)}${c("YIELD", i.yieldPct)}${c("COLOR", u(i.colorLovibond, 2))}${i.use === "Fermenta\xE7\xE3o" ? c("ADD_AFTER_BOIL", "TRUE") : i.use === "Fervura" ? c("ADD_AFTER_BOIL", "FALSE") + c("TIME", e(i.timeMin, 10)) : ""}</FERMENTABLE>`,
      ),
      "</FERMENTABLES>",
      "<HOPS>",
      ...a.hops.map(
        (i) =>
          `<HOP>${c("NAME", i.name)}${c("VERSION", 1)}${c("ALPHA", i.alphaAcidPct)}${c("AMOUNT", u(i.amountG / 1e3, 4))}${c("USE", r[i.use] || "Boil")}${c("TIME", i.timeMin)}${Number.isFinite(Number(i.temperatureC)) ? c("HOP_TEMP", i.temperatureC) : ""}${c("FORM", "Pellet")}</HOP>`,
      ),
      "</HOPS>",
      "<YEASTS>",
      ...a.yeasts.map(
        (i) =>
          `<YEAST>${c("NAME", i.name)}${c("VERSION", 1)}${c("ATTENUATION", i.attenuationPct)}${c("AMOUNT", i.amount)}${c("DISPLAY_AMOUNT", `${i.amount} ${i.unit}`)}</YEAST>`,
      ),
      "</YEASTS>",
      "<MISCS>",
      ...a.salts.map(
        (i) =>
          `<MISC>${c("NAME", i.formula)}${c("VERSION", 1)}${c("TYPE", "Water Agent")}${c("USE", "Mash")}${c("AMOUNT", u(i.amountG / 1e3, 5))}${c("AMOUNT_IS_WEIGHT", "TRUE")}${c("DISPLAY_AMOUNT", `${i.amountG} g`)}</MISC>`,
      ),
      ...a.miscs.map(
        (i) =>
          `<MISC>${c("NAME", i.name)}${c("VERSION", 1)}${c("TYPE", "Other")}${c("USE", o[i.use] || "Boil")}${Number.isFinite(Number(i.timeMin)) ? c("TIME", i.timeMin) : ""}${c("AMOUNT", i.unit === "g" ? e(i.amount) / 1e3 : e(i.amount))}${c("AMOUNT_IS_WEIGHT", i.unit === "g" || i.unit === "kg" ? "TRUE" : "FALSE")}${c("DISPLAY_AMOUNT", `${i.amount} ${i.unit}`)}</MISC>`,
      ),
      "</MISCS>",
      `<WATERS><WATER>${c("NAME", "\xC1gua base")}${c("VERSION", 1)}${c("CALCIUM", a.baseWaterProfile.calciumPpm)}${c("MAGNESIUM", a.baseWaterProfile.magnesiumPpm)}${c("SODIUM", a.baseWaterProfile.sodiumPpm)}${c("CHLORIDE", a.baseWaterProfile.chloridePpm)}${c("SULFATE", a.baseWaterProfile.sulfatePpm)}${c("BICARBONATE", a.baseWaterProfile.bicarbonatePpm)}</WATER></WATERS>`,
      "<MASH><MASH_STEPS>",
      ...a.mash.map(
        (i) =>
          `<MASH_STEP>${c("NAME", i.name)}${c("VERSION", 1)}${c("TYPE", "Temperature")}${c("STEP_TEMP", i.temperatureC)}${c("STEP_TIME", i.timeMin)}</MASH_STEP>`,
      ),
      "</MASH_STEPS></MASH>",
      "</RECIPE></RECIPES>",
    ].join(`
`)
  );
}
export function beerXmlFileName(t) {
  return `${lt(t.name || "receita")}.xml`;
}
