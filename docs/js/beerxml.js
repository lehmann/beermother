import {
  DEFAULT_PROFILE as l,
  DEFAULT_BASE_WATER_PROFILE as nt,
  PPG_100 as it,
  THERMAL_SHRINKAGE as ot,
  n as a,
  round as u,
  parseUserNumber as f,
  sanitizeBaseWaterProfile as st,
  hotPostBoilVolume as R,
  sourceWaterTotalVolume as ut,
  evaporationLhFromPct as d,
  evaporationPctFromLh as C,
  saltFormulaFromName as at,
} from "./engine.js";
import { t as b } from "./i18n.js";
export function sanitizeXmlText(e) {
  const t = String(e || "").replace(/&#(x[0-9a-fA-F]+|\d+);/g, (i, r) => {
    const o =
      r[0]?.toLowerCase() === "x"
        ? Number.parseInt(r.slice(1), 16)
        : Number.parseInt(r, 10);
    return Number.isFinite(o) && isValidXmlCodePoint(o) ? i : "";
  });
  return Array.from(t)
    .filter((i) => isValidXmlCodePoint(i.codePointAt(0)))
    .join("");
}
export function isValidXmlCodePoint(e) {
  return (
    e === 9 ||
    e === 10 ||
    e === 13 ||
    (e >= 32 && e <= 55295) ||
    (e >= 57344 && e <= 65533) ||
    (e >= 65536 && e <= 1114111)
  );
}
export function parseBeerXml(e) {
  if (!e || !e.trim())
    throw new Error(b("Abra uma receita pela comunidade antes de iniciar."));
  const t = new DOMParser().parseFromString(
    sanitizeXmlText(e),
    "application/xml",
  );
  if (t.querySelector("parsererror"))
    throw new Error(b("Receita inv\xE1lida. Confira o arquivo publicado."));
  const r = t.getElementsByTagName("RECIPE")[0] || t.documentElement;
  if (!r) throw new Error(b("Nenhuma receita encontrada."));
  const o = first(r, "EQUIPMENT"),
    E = first(r, "STYLE"),
    M = first(r, "FERMENTABLES"),
    T = first(r, "HOPS"),
    U = first(r, "YEASTS"),
    B = first(r, "MISCS"),
    v = first(r, "WATERS"),
    H = first(v || r, "WATER"),
    w = first(r, "MASH"),
    D = first(w || r, "MASH_STEPS"),
    m = number(r, "BATCH_SIZE", 20),
    P = number(o || r, "BOIL_SIZE", number(r, "BOIL_SIZE", m * 1.35)),
    p = number(o || r, "BOIL_TIME", number(r, "BOIL_TIME", 60)),
    A = number(o || r, "TRUB_CHILLER_LOSS", 2.5),
    h = optionalNumber(o || r, "EVAP_RATE"),
    O = importedDirectEvaporationLh(o || r),
    L = importedEvaporationLh(o || r, {
      batchVolumeL: m,
      boilSize: P,
      boilTimeMin: p,
      trubLossL: A,
    }),
    _ = R(m, A),
    N = optionalNumber(r, "EFFICIENCY"),
    I = Number.isFinite(N) ? N : 70,
    G = importedMashEfficiencyPct(r, {
      batchVolumeL: m,
      trubLossL: A,
      equipmentEfficiencyPct: I,
      hasEquipmentEfficiency: Number.isFinite(N),
    }),
    Y =
      Number.isFinite(O) && O > 0
        ? C(L, _, p)
        : Number.isFinite(h)
          ? h
          : C(L, _, p),
    W = number(r, "OG", number(r, "EST_OG", 0)),
    V = number(r, "FG", number(r, "EST_FG", 0)),
    z = number(r, "IBU", 0),
    k = importedColorEbc(r),
    x = children(M, "FERMENTABLE").map((n, s) => {
      const c = normalizeFermentableType(textOf(n, "TYPE", "Grain")),
        rt = /true|1|yes/i.test(textOf(n, "ADD_AFTER_BOIL", "")),
        g = number(n, "YIELD", 78);
      return {
        id: "f" + s,
        name: textOf(n, "NAME", "Ferment\xE1vel"),
        type: c,
        use: rt
          ? "Fermenta\xE7\xE3o"
          : c === "Gr\xE3o" || c === "Adjunto"
            ? "Mostura"
            : "Fervura",
        timeMin: optionalNumber(n, "TIME"),
        amountKg: number(n, "AMOUNT", 0),
        ppg: (g / 100) * it,
        yieldPct: g,
        colorLovibond: number(n, "COLOR", 0),
        notFermentable: /true|1|yes/i.test(textOf(n, "NOT_FERMENTABLE", "")),
      };
    }),
    q = children(T, "HOP").map((n, s) => ({
      id: "h" + s,
      name: textOf(n, "NAME", "L\xFApulo"),
      alphaAcidPct: number(n, "ALPHA", 0),
      type: normalizeHopForm(textOf(n, "FORM", "Pellet")),
      use: normalizeHopUse(textOf(n, "USE", "Boil")),
      timeMin: number(n, "TIME", 0),
      temperatureC: optionalNumber(n, "HOP_TEMP"),
      amountG: u(number(n, "AMOUNT", 0) * 1e3, 1),
    })),
    j = children(U, "YEAST").map((n, s) => {
      const c = yeastAmount(n);
      return {
        id: "y" + s,
        name: textOf(n, "NAME", "Levedura"),
        type: textOf(n, "TYPE", ""),
        form: textOf(n, "FORM", ""),
        laboratory: textOf(n, "LABORATORY", ""),
        productId: textOf(n, "PRODUCT_ID", ""),
        attenuationPct: optionalNumber(n, "ATTENUATION"),
        amount: c.value,
        unit: c.unit,
        displayAmount: textOf(n, "DISPLAY_AMOUNT", ""),
      };
    }),
    S = children(B, "MISC"),
    K = S.filter(isWaterMisc).map((n, s) => ({
      id: "s" + s,
      name: textOf(n, "NAME", "Sal"),
      formula: at(textOf(n, "NAME", "")),
      amountG: u(miscAmountGrams(n), 1),
      use: normalizeSaltUse(textOf(n, "USE", "Mash")),
    })),
    X = S.filter((n) => !isWaterMisc(n)).map((n, s) => {
      const c = miscAmountInfo(n);
      return {
        id: "m" + s,
        name: textOf(n, "NAME", "Insumo"),
        type: normalizeMiscType(textOf(n, "TYPE", "Misc")),
        use: normalizeMiscUse(textOf(n, "USE", "Boil")),
        timeMin: optionalNumber(n, "TIME"),
        amount: c.amount,
        unit: c.unit,
      };
    }),
    F = children(D, "MASH_STEP").map((n, s) => ({
      id: "m" + s,
      name: normalizeMashName(textOf(n, "NAME", "Mostura")),
      type: textOf(n, "TYPE", ""),
      temperatureC: number(n, "STEP_TEMP", 66),
      timeMin: number(n, "STEP_TIME", 60),
      waterVolumeL: optionalNumber(n, "INFUSE_AMOUNT"),
    })),
    Z = fermentationProfile(r),
    Q = x
      .filter((n) => n.use === "Mostura")
      .reduce((n, s) => n + a(s.amountKg), 0),
    y = F.reduce((n, s) => n + a(s.waterVolumeL), 0),
    J = Q * l.grainAbsorptionLkg,
    $ = (L * p) / 60,
    tt = ut(m, A, $, J),
    et = u(y + Math.max(0, tt - y), 2);
  return {
    name: textOf(r, "NAME", "Receita importada"),
    styleName: textOf(E, "NAME", b("Estilo importado")),
    brewer: textOf(r, "BREWER", ""),
    batchVolumeL: m,
    boilTimeMin: p,
    boilSize: P,
    trubLossL: A,
    evaporationLh: u(L, 2),
    evaporationPct: u(Y, 1),
    efficiencyPct: I,
    mashEfficiencyPct: G,
    og: W,
    fg: V,
    ibu: z,
    colorEbc: k,
    fermentables: x,
    hops: q,
    yeasts: j,
    salts: K,
    miscs: X,
    baseWaterProfile: baseWaterProfileFromNode(H),
    saltReferenceWaterL: et,
    fermentationProfileName: textOf(r, "BF_FERMENTATION_PROFILE_NAME", ""),
    fermentation: Z,
    mash: F.length
      ? F
      : [
          { id: "m0", name: "Mostura", temperatureC: 66, timeMin: 60 },
          { id: "m1", name: "Mash out", temperatureC: 75, timeMin: 10 },
        ],
  };
}
export function importedColorEbc(e) {
  const t = textOf(e, "EST_COLOR", "") || textOf(e, "COLOR", ""),
    i = f(t);
  return !Number.isFinite(i) || i <= 0
    ? 0
    : /ebc/i.test(t)
      ? u(i, 1)
      : /srm/i.test(t)
        ? u(i * 1.97, 1)
        : /lov|°?\s*l\b/i.test(t)
          ? u(Math.max(0, i * 1.3546 - 0.76) * 1.97, 1)
          : u(i * 1.97, 1);
}
export function baseWaterProfileFromNode(e) {
  return e
    ? st({
        calciumPpm: optionalNumber(e, "CALCIUM"),
        magnesiumPpm: optionalNumber(e, "MAGNESIUM"),
        sodiumPpm: optionalNumber(e, "SODIUM"),
        chloridePpm: optionalNumber(e, "CHLORIDE"),
        sulfatePpm: optionalNumber(e, "SULFATE"),
        bicarbonatePpm: optionalNumber(e, "BICARBONATE"),
      })
    : { ...nt };
}
export function importedDirectEvaporationLh(e) {
  return firstOptionalNumber(e, [
    "BOIL_OFF_PER_HOUR",
    "BOIL_OFF_PER_HR",
    "BOIL_OFF_HOUR",
    "BOIL_OFF_RATE",
    "BOIL_OFF_LH",
    "BOIL_OFF_L_PER_HOUR",
    "EVAPORATION_LH",
    "EVAPORATION_L_PER_HOUR",
  ]);
}
export function importedEvaporationLh(e, t = {}) {
  const i = importedDirectEvaporationLh(e);
  if (Number.isFinite(i) && i > 0) return i;
  const r = optionalNumber(e, "EVAP_RATE"),
    o = a(t.boilSize);
  if (Number.isFinite(r) && r > 0 && o > 0) return u((o * r) / 100, 2);
  const E = Math.max(0.01, a(t.boilTimeMin, 60) / 60),
    M = (a(t.batchVolumeL) + a(t.trubLossL)) / ot;
  if (Number.isFinite(r) && r > 0) return u(d(r, M, t.boilTimeMin), 2);
  const T = Math.max(0, o - M) / E;
  return T > 0
    ? u(T, 2)
    : u(
        d(
          l.evaporationPct,
          R(l.targetVolumeL, l.targetVolumeL * l.trubLossPct),
          t.boilTimeMin,
        ),
        2,
      );
}
export function importedMashEfficiencyPct(e, t = {}) {
  const i = optionalNumber(e, "MASH_EFFICIENCY");
  return Number.isFinite(i)
    ? i
    : t.hasEquipmentEfficiency
      ? ct(t.equipmentEfficiencyPct, t.batchVolumeL, t.trubLossL)
      : a(t.equipmentEfficiencyPct, 70);
}
function ct(e, t, i) {
  const r = Math.max(0.01, a(t)),
    o = r + Math.max(0, a(i));
  return u((a(e, l.mashEfficiencyPct) * o) / r, 1);
}
export function fermentationProfile(e) {
  return [
    { name: "Inocula\xE7\xE3o", temp: "PRIMARY_TEMP", days: "PRIMARY_AGE" },
    { name: "Prim\xE1ria", temp: "SECONDARY_TEMP", days: "SECONDARY_AGE" },
    { name: "Prim\xE1ria", temp: "TERTIARY_TEMP", days: "TERTIARY_AGE" },
    { name: "Cold crash", temp: "AGE_TEMP", days: "AGE" },
  ]
    .map((t) => {
      const i = optionalNumber(e, t.temp),
        r = optionalNumber(e, t.days);
      return !Number.isFinite(i) && !Number.isFinite(r)
        ? null
        : {
            name:
              t.temp === "AGE_TEMP" && Number.isFinite(i) && i > 12
                ? "Matura\xE7\xE3o"
                : t.name,
            temperatureC: i,
            days: r,
          };
    })
    .filter(Boolean);
}
export function first(e, t) {
  return e ? e.getElementsByTagName(t)[0] : null;
}
export function children(e, t) {
  return Array.from(e ? e.getElementsByTagName(t) : []);
}
export function textOf(e, t, i = "") {
  const r = first(e, t);
  return (r && r.textContent ? r.textContent.trim() : "") || i;
}
export function number(e, t, i = 0) {
  const r = f(textOf(e, t, ""));
  return Number.isFinite(r) ? r : i;
}
export function optionalNumber(e, t) {
  const i = f(textOf(e, t, ""));
  return Number.isFinite(i) ? i : void 0;
}
export function firstOptionalNumber(e, t = []) {
  for (const i of t) {
    const r = optionalNumber(e, i);
    if (Number.isFinite(r)) return r;
  }
}
export function miscAmountGrams(e) {
  const t = textOf(e, "DISPLAY_AMOUNT", ""),
    i = f(t);
  if (Number.isFinite(i)) {
    if (/mg/i.test(t)) return i / 1e3;
    if (/\bg\b/i.test(t)) return i;
  }
  return number(e, "AMOUNT", 0) * 1e3;
}
export function miscAmountInfo(e) {
  const t = textOf(e, "DISPLAY_AMOUNT", ""),
    i = f(t),
    r = ingredientUnitFromText(t);
  if (Number.isFinite(i) && r) return { amount: i, unit: r };
  const o = number(e, "AMOUNT", 0);
  return /true|1|yes/i.test(textOf(e, "AMOUNT_IS_WEIGHT", ""))
    ? o && Math.abs(o) < 1
      ? { amount: o * 1e3, unit: "g" }
      : { amount: o, unit: "kg" }
    : o && Math.abs(o) < 1
      ? { amount: o * 1e3, unit: "mL" }
      : { amount: o, unit: "L" };
}
export function ingredientUnitFromText(e) {
  const t = String(e || "").toLowerCase();
  return /\bmg\b/.test(t)
    ? "mg"
    : /\bkg\b/.test(t)
      ? "kg"
      : /\bg\b/.test(t)
        ? "g"
        : /\bml\b/.test(t)
          ? "mL"
          : /(^|[\d\s])l\b/.test(t)
            ? "L"
            : "";
}
export function yeastAmount(e) {
  const t = textOf(e, "DISPLAY_AMOUNT", ""),
    i = f(t),
    r = yeastUnitFromText(t);
  if (Number.isFinite(i)) return { value: i, unit: r || "un." };
  const o = number(e, "AMOUNT", 0);
  return /true|1|yes/i.test(textOf(e, "AMOUNT_IS_WEIGHT", ""))
    ? o && Math.abs(o) < 1
      ? { value: o * 1e3, unit: "g" }
      : { value: o, unit: "kg" }
    : o && Math.abs(o) < 1
      ? { value: o * 1e3, unit: "mL" }
      : { value: o, unit: "un." };
}
export function yeastUnitFromText(e) {
  const t = String(e || "").toLowerCase();
  return /pacote/.test(t)
    ? "pacote"
    : /sach[eê]|sachet/.test(t)
      ? "sach\xEA"
      : /\bmg\b/.test(t)
        ? "mg"
        : /\bkg\b/.test(t)
          ? "kg"
          : /\bg\b/.test(t)
            ? "g"
            : /\bml\b/.test(t)
              ? "mL"
              : /(^|[\d\s])l\b/.test(t)
                ? "L"
                : "";
}
export function normalizeFermentableType(e) {
  const t = String(e).toLowerCase();
  return t.includes("sugar")
    ? "A\xE7\xFAcar"
    : t.includes("extract")
      ? "Extrato"
      : t.includes("adjunct")
        ? "Adjunto"
        : "Gr\xE3o";
}
export function isWaterMisc(e) {
  return /water/i.test(textOf(e, "TYPE", ""));
}
export function normalizeSaltUse(e) {
  return /sparge|lavagem/i.test(String(e || "")) ? "Lavagem" : "Mostura";
}
export function normalizeHopUse(e) {
  const t = String(e).toLowerCase();
  return t.includes("mash")
    ? "Mostura"
    : t.includes("dry")
      ? "Dry hop"
      : t.includes("first")
        ? "First wort"
        : t.includes("whirlpool")
          ? "Whirlpool"
          : t.includes("aroma") || t.includes("hopstand")
            ? "Hopstand"
            : "Fervura";
}
export function normalizeMiscUse(e) {
  const t = String(e || "").toLowerCase();
  return t.includes("mash")
    ? "Mostura"
    : t.includes("first")
      ? "First wort"
      : t.includes("whirlpool")
        ? "Whirlpool"
        : t.includes("aroma") || t.includes("hopstand")
          ? "Hopstand"
          : t.includes("dry")
            ? "Dry hop"
            : t.includes("primary") ||
                t.includes("secondary") ||
                t.includes("ferment")
              ? "Fermenta\xE7\xE3o"
              : t.includes("bottl") || t.includes("packag")
                ? "Envase"
                : "Fervura";
}
export function normalizeMiscType(e) {
  const t = String(e || "").toLowerCase();
  return t.includes("spice")
    ? "Especiaria"
    : t.includes("fining")
      ? "Clarificante"
      : t.includes("herb")
        ? "Erva"
        : t.includes("flavor")
          ? "Aroma"
          : "Insumo";
}
export function normalizeHopForm(e) {
  return /leaf|whole|cone|flor/i.test(e) ? "Flor/cone" : "Pellet";
}
export function normalizeMashName(e) {
  return /out/i.test(e) ? "Mash out" : e;
}
