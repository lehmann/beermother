export const WRI_FACTOR = 1.04,
  PPG_100 = 46,
  HECTOLITER_THRESHOLD_L = 1e3,
  THERMAL_SHRINKAGE = 0.96,
  DEFAULT_PROFILE = {
    targetVolumeL: 20,
    mashEfficiencyPct: 65,
    evaporationPct: 13,
    trubLossPct: 0.15,
    grainAbsorptionLkg: 1.2,
    waterToGrainRatioLkg: 3,
    wriFactor: 1.04,
    mashTunDeadSpaceL: 0,
    heatingRateCMin: 1.5,
  };
export function effectiveWriFactor(t = {}) {
  const e = Number(t.wriFactor);
  return Number.isFinite(e) && e > 0.5 && e < 2 ? e : 1.04;
}
export const CALIBRATION_PROFILE = {
    mashEfficiencyPct: 57.5,
    evaporationPct: 8,
    trubLossPct: 0.15,
    grainAbsorptionLkg: 1,
  },
  DEFAULT_WATER_SALTS = [
    { id: "cacl2", formula: "CaCl2", name: "CaCl2" },
    { id: "caso4", formula: "CaSO4", name: "CaSO4" },
    { id: "mgso4", formula: "MgSO4", name: "MgSO4" },
    { id: "nacl", formula: "NaCl", name: "NaCl" },
  ],
  WATER_IONS = [
    { key: "calciumPpm", label: "Ca\xB2\u207A", plainLabel: "Ca" },
    { key: "magnesiumPpm", label: "Mg\xB2\u207A", plainLabel: "Mg" },
    { key: "sodiumPpm", label: "Na\u207A", plainLabel: "Na" },
    { key: "chloridePpm", label: "Cl\u207B", plainLabel: "Cl" },
    { key: "sulfatePpm", label: "SO\u2084\xB2\u207B", plainLabel: "SO4" },
    { key: "bicarbonatePpm", label: "HCO\u2083\u207B", plainLabel: "HCO3" },
  ],
  EMPTY_BASE_WATER_PROFILE = WATER_IONS.reduce(
    (t, e) => ({ ...t, [e.key]: 0 }),
    {},
  ),
  DEFAULT_BASE_WATER_PROFILE = {
    calciumPpm: 10,
    magnesiumPpm: 4,
    sodiumPpm: 4,
    chloridePpm: 12,
    sulfatePpm: 10,
    bicarbonatePpm: 30,
  },
  SALT_ION_CONTRIBUTIONS = {
    CaCl2: { calciumPpm: 272.6, chloridePpm: 482.3 },
    CaSO4: { calciumPpm: 232.8, sulfatePpm: 557.6 },
    MgSO4: { magnesiumPpm: 98.6, sulfatePpm: 389.6 },
    NaCl: { sodiumPpm: 393.4, chloridePpm: 606.6 },
  },
  PROFILE_KEYS = Object.keys(DEFAULT_PROFILE);
export function n(t, e = 0) {
  if (t === "" || t === void 0 || t === null) return e;
  const r = Number(t);
  return Number.isFinite(r) ? r : e;
}
export function round(t, e = 2) {
  const r = Number(t);
  return Number.isFinite(r) ? Number(r.toFixed(e)) : 0;
}
export function parseUserNumber(t) {
  if (t == null || t === "") return NaN;
  const r = String(t)
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);
  return r ? Number(r[0]) : NaN;
}
export function kgToLb(t) {
  return t * 2.2046226218;
}
export function lToGal(t) {
  return t * 0.2641720524;
}
export function sgPoints(t) {
  return (t - 1) * 1e3;
}
export function sgToPlato(t) {
  return -616.868 + 1111.14 * t - 630.272 * t ** 2 + 135.997 * t ** 3;
}
export function platoToSg(t) {
  return round(1 + t / (258.6 - (t / 258.2) * 227.1), 3);
}
export function abvBrewfather(t, e) {
  const r = n(t, 1),
    o = n(e, 1),
    a = 1.775 - r;
  return r <= 1 || o <= 0 || a <= 0
    ? 0
    : Math.max(0, ((76.08 * (r - o)) / a) * (o / 0.794));
}
export function clonePlain(t) {
  return JSON.parse(JSON.stringify(t ?? null));
}
export function isPlainObject(t) {
  return !!t && typeof t == "object" && !Array.isArray(t);
}
export function slugify(t) {
  return (
    String(t || "brassagem")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brassagem"
  );
}
export function fmt(t, e = 1) {
  const r = Number(t);
  return Number.isFinite(r) ? r.toFixed(e).replace(".", ",") : "-";
}
export function fmtClean(t, e = 2) {
  return fmt(t, e).replace(/,?0+$/, "").replace(/,$/, "");
}
export function formatInputValue(t) {
  if (t === "" || t === void 0 || t === null) return "";
  const e = Number(t);
  return Number.isFinite(e)
    ? String(Math.round(e * 1e6) / 1e6).replace(".", ",")
    : String(t).replace(".", ",");
}
export function formatVolume(t, e = 1) {
  const r = Number(t);
  return Number.isFinite(r)
    ? Math.abs(r) >= 1e3
      ? `${fmt(r / 100, 1)} hL`
      : `${fmt(r, e)} L`
    : "-";
}
export function formatVolumeRate(t, e = 2) {
  return `${formatVolume(t, e)}/h`;
}
export function formatMaltMass(t) {
  const e = Number(t);
  if (!Number.isFinite(e)) return "-";
  const r = Math.abs(e);
  return r < 1
    ? `${fmt(e * 1e3, 1)} g`
    : r < 100
      ? `${fmt(e, 2)} kg`
      : `${fmt(e, 1)} kg`;
}
export function formatHopMass(t) {
  const e = Number(t);
  if (!Number.isFinite(e)) return "-";
  if (Math.abs(e) < 1e3) return `${fmt(e, 1)} g`;
  const o = e / 1e3;
  return `${fmt(o, Math.abs(o) < 10 ? 2 : 1)} kg`;
}
export function formatIngredientAmount(t, e) {
  const r = Number(t);
  return Number.isFinite(r)
    ? e === "kg"
      ? formatMaltMass(r)
      : e === "g"
        ? formatHopMass(r)
        : e === "mg"
          ? Math.abs(r) < 1e3
            ? `${fmt(r, 0)} mg`
            : formatHopMass(r / 1e3)
          : e === "L"
            ? formatVolume(r, 2)
            : e === "mL"
              ? Math.abs(r) < 1e3
                ? `${fmt(r, 1)} mL`
                : formatVolume(r / 1e3, 2)
              : `${fmt(r, 1)} ${e || ""}`.trim()
    : "-";
}
export function formatYeastAmount(t, e) {
  const r = Number(t);
  if (!Number.isFinite(r) || r <= 0) return "-";
  const o = fmtClean(r, ["pacote", "sach\xEA", "un."].includes(e) ? 2 : 1);
  return e === "pacote"
    ? `${o} ${Math.abs(r - 1) < 0.005 ? "pacote" : "pacotes"}`
    : e === "sach\xEA"
      ? `${o} ${Math.abs(r - 1) < 0.005 ? "sach\xEA" : "sach\xEAs"}`
      : `${o} ${e || "un."}`;
}
export function formatIonPpm(t) {
  const e = Number(t);
  return Number.isFinite(e) ? String(Math.max(0, Math.round(e))) : "0";
}
export function scaleIngredientAmount(t, e, r) {
  const o = ["kg", "L"].includes(e) ? 3 : 1;
  return round(n(t) * n(r, 1), o);
}
export function formatPlatoSg(t) {
  const e = Math.max(0, n(t));
  return `${fmt(e, 1)} \xB0P / ${platoToSg(e).toFixed(3)}`;
}
export function formatWriValue(t) {
  return n(t) ? `${fmt(t, 1)} WRI` : "-";
}
export function sanitizeBaseWaterProfile(t = {}, e = EMPTY_BASE_WATER_PROFILE) {
  return WATER_IONS.reduce((r, o) => {
    const a = n(e?.[o.key]),
      i = n(t?.[o.key], a);
    return ((r[o.key] = Number.isFinite(i) && i >= 0 ? i : a), r);
  }, {});
}
export function isEmptyBaseWaterProfile(t = {}) {
  return WATER_IONS.every((e) => n(t?.[e.key]) === 0);
}
export function sanitizeProductionProfile(t = {}) {
  const e = {};
  return (
    PROFILE_KEYS.forEach((r) => {
      const o = DEFAULT_PROFILE[r],
        a = n(t[r], o);
      e[r] = Number.isFinite(a) && a >= 0 ? a : o;
    }),
    Object.prototype.hasOwnProperty.call(t, "baseWaterProfile") &&
      (e.baseWaterProfile = sanitizeBaseWaterProfile(t.baseWaterProfile)),
    e.trubLossPct > 1 && (e.trubLossPct = e.trubLossPct / 100),
    (e.wriFactor = effectiveWriFactor(e)),
    e
  );
}
export function hotPostBoilVolume(t, e) {
  return (n(t) + n(e)) / 0.96;
}
export function sourceWaterTotalVolume(t, e, r, o) {
  return Math.max(0, n(t) + n(e) + Math.max(0, n(r)) + Math.max(0, n(o)));
}
export function evaporationLhFromPct(t, e, r = 60) {
  const o = Math.max(0.01, n(r, 60) / 60),
    a = Math.max(0, n(t)) / 100,
    i = Math.max(0.05, 1 - a * o),
    s = n(e) / i;
  return Math.max(0, (s - n(e)) / o);
}
export function evaporationPctFromLh(t, e, r = 60) {
  const o = Math.max(0.01, n(r, 60) / 60),
    a = Math.max(0, n(t)) * o,
    i = n(e) + a;
  return i ? round((Math.max(0, n(t)) / i) * 100, 1) : 0;
}
export function equipmentEfficiencyPct(t) {
  const e = Math.max(0, n(t.targetVolumeL, 20)),
    r = e + Math.max(0, n(t.trubLossL, 0));
  return r ? round((n(t.mashEfficiencyPct, 65) * e) / r, 1) : 0;
}
export function mashEfficiencyFromEquipment(t, e, r) {
  const o = Math.max(0.01, n(e)),
    a = o + Math.max(0, n(r));
  return round((n(t, DEFAULT_PROFILE.mashEfficiencyPct) * a) / o, 1);
}
export function syncTrubLoss(t) {
  const e = Math.max(0, n(t.targetVolumeL, 20));
  (Number.isFinite(Number(t.trubLossPct)) ||
    (t.trubLossPct = e ? round(n(t.trubLossL, e * 0.15) / e, 4) : 0.15),
    t.trubLossEdited || (t.trubLossL = round(e * n(t.trubLossPct, 0.15), 2)));
}
export function importedProductionProfile(t = {}) {
  const e = (t.fermentables || [])
      .filter((u) => u.use === "Mostura")
      .reduce((u, c) => u + n(c.amountKg), 0),
    r = (t.mash || []).reduce((u, c) => u + n(c.waterVolumeL), 0),
    o = n(t.batchVolumeL, DEFAULT_PROFILE.targetVolumeL),
    a = n(t.trubLossL, o * DEFAULT_PROFILE.trubLossPct),
    i = hotPostBoilVolume(o, a),
    s = evaporationLhFromPct(
      n(t.evaporationPct, DEFAULT_PROFILE.evaporationPct),
      i,
      t.boilTimeMin,
    ),
    m = n(t.evaporationLh, s);
  return {
    targetVolumeL: o,
    mashEfficiencyPct: n(
      t.mashEfficiencyPct,
      n(t.efficiencyPct, DEFAULT_PROFILE.mashEfficiencyPct),
    ),
    evaporationPct: Number.isFinite(Number(t.evaporationPct))
      ? n(t.evaporationPct)
      : evaporationPctFromLh(m, i, t.boilTimeMin),
    trubLossPct: o ? round(a / o, 4) : DEFAULT_PROFILE.trubLossPct,
    trubLossL: round(a, 2),
    trubLossEdited: !1,
    grainAbsorptionLkg: DEFAULT_PROFILE.grainAbsorptionLkg,
    waterToGrainRatioLkg:
      e && r ? round(r / e, 2) : DEFAULT_PROFILE.waterToGrainRatioLkg,
    baseWaterProfile: sanitizeBaseWaterProfile(
      t.baseWaterProfile,
      DEFAULT_BASE_WATER_PROFILE,
    ),
  };
}
export function defaultProperties(t, e = {}) {
  const r = { ...DEFAULT_PROFILE, ...e },
    o = round(n(r.targetVolumeL, 20) * n(r.trubLossPct, 0.15), 2),
    a = hotPostBoilVolume(r.targetVolumeL, o);
  return {
    targetVolumeL: r.targetVolumeL,
    mashEfficiencyPct: r.mashEfficiencyPct,
    evaporationPct: r.evaporationPct,
    evaporationLh: round(
      evaporationLhFromPct(r.evaporationPct, a, t && t.boilTimeMin),
      2,
    ),
    trubLossPct: r.trubLossPct,
    trubLossL: o,
    trubLossEdited: !1,
    grainAbsorptionLkg: r.grainAbsorptionLkg,
    waterToGrainRatioLkg: r.waterToGrainRatioLkg,
    wriFactor: effectiveWriFactor(r),
    mashTunDeadSpaceL: Math.max(0, n(r.mashTunDeadSpaceL)),
    heatingRateCMin: Math.min(
      10,
      Math.max(0, n(r.heatingRateCMin, DEFAULT_PROFILE.heatingRateCMin)),
    ),
    baseWaterProfile:
      e.baseWaterProfile && !isEmptyBaseWaterProfile(e.baseWaterProfile)
        ? sanitizeBaseWaterProfile(
            e.baseWaterProfile,
            DEFAULT_BASE_WATER_PROFILE,
          )
        : sanitizeBaseWaterProfile(
            t.baseWaterProfile,
            DEFAULT_BASE_WATER_PROFILE,
          ),
    mashWaterUsedL: "",
    showWaterSalts: !1,
    waterSalts: waterSaltsFromRecipe(t),
  };
}
export function emptyWaterSalts() {
  return DEFAULT_WATER_SALTS.map((t) => ({
    ...t,
    sourceTotalG: 0,
    concentrationGPerL: 0,
  }));
}
export function saltFormulaFromName(t) {
  const e = String(t || "").toLowerCase();
  return /nacl/.test(e) ||
    e.includes("sodium chloride") ||
    e.includes("table salt")
    ? "NaCl"
    : /cacl/.test(e) || e.includes("calcium chloride")
      ? "CaCl2"
      : /caso/.test(e) || e.includes("gypsum")
        ? "CaSO4"
        : /mgso/.test(e) || e.includes("epsom")
          ? "MgSO4"
          : "";
}
export function waterSaltsFromRecipe(t = {}) {
  const e = emptyWaterSalts(),
    r = n(t.saltReferenceWaterL, t.batchVolumeL || 0);
  return (
    (t.salts || []).forEach((o) => {
      const a = saltFormulaFromName(o.formula || o.name),
        i = e.find((s) => s.formula === a);
      i && (i.sourceTotalG = round(n(i.sourceTotalG) + n(o.amountG), 2));
    }),
    e.forEach((o) => {
      o.concentrationGPerL = r ? o.sourceTotalG / r : 0;
    }),
    e
  );
}
export function ensureWaterSalts(t) {
  const e = Array.isArray(t.waterSalts) ? t.waterSalts : [],
    r = DEFAULT_WATER_SALTS.map((o) => {
      const a = e.find((i) => i.id === o.id || i.formula === o.formula);
      return {
        ...o,
        name: a?.name || o.name,
        sourceTotalG: n(a?.sourceTotalG),
        concentrationGPerL: n(a?.concentrationGPerL),
      };
    });
  return ((t.waterSalts = r), r);
}
export function ensureBaseWaterProfile(t) {
  return (
    (t.baseWaterProfile = sanitizeBaseWaterProfile(t.baseWaterProfile)),
    t.baseWaterProfile
  );
}
export function scaledWaterSalts(t, e) {
  const r = ensureWaterSalts(t),
    o = n(t.mashWaterUsedL, e.mashWater),
    a = Math.max(0, n(e.totalWater) - o);
  return r.map((i) => {
    const s = n(i.concentrationGPerL);
    return {
      ...i,
      mashG: round(s * o, 1),
      spargeG: round(s * a, 1),
      totalG: round(s * (o + a), 1),
    };
  });
}
export function adjustedWaterProfile(t, e) {
  const r = ensureBaseWaterProfile(t),
    o = scaledWaterSalts(t, e),
    a = Math.max(0.01, n(e.totalWater)),
    i = { ...EMPTY_BASE_WATER_PROFILE };
  o.forEach((m) => {
    const u = SALT_ION_CONTRIBUTIONS[m.formula];
    if (!u) return;
    const c = n(m.totalG) / a;
    Object.entries(u).forEach(([d, p]) => {
      i[d] = n(i[d]) + c * p;
    });
  });
  const s = WATER_IONS.reduce(
    (m, u) => ((m[u.key] = round(n(r[u.key]) + n(i[u.key]), 0)), m),
    {},
  );
  return { base: r, additions: i, adjusted: s };
}
export function waterProfileSummary(t = {}) {
  return WATER_IONS.map(
    (e) => `${e.plainLabel} ${formatIonPpm(t.adjusted?.[e.key])}`,
  ).join(" \xB7 ");
}
export const MALT_PH_PROFILES = {
    base: { distilledPh: 5.75, bufferMEqPerKg: 40 },
    munich: { distilledPh: 5.55, bufferMEqPerKg: 45 },
    trigo: { distilledPh: 5.95, bufferMEqPerKg: 30 },
    crystal: { distilledPh: 5.2, bufferMEqPerKg: 55 },
    torrado: { distilledPh: 4.65, bufferMEqPerKg: 65 },
    acidulado: { distilledPh: 3.45, bufferMEqPerKg: 40 },
  },
  ACID_PROPERTIES = {
    latico: {
      equivalentWeightG: 90.08,
      densityBase: 0.986,
      densitySlope: 0.0025,
    },
    fosforico: {
      equivalentWeightG: 98,
      densityBase: 0.965,
      densitySlope: 0.00853,
    },
  },
  DEFAULT_MASH_PH_TARGET = 5.4,
  ALKALINITY_DAMPING = 0.55;
export function classifyMaltForPh(name, colorLovibond) {
  const label = String(name || "").toLowerCase(),
    lov = n(colorLovibond);
  return /acidul|sauer|s\xE4ure|acid malt/.test(label)
    ? "acidulado"
    : /crystal|cristal|caramel|caramelo|\bcara|carared|caramunich|carahell/.test(
          label,
        )
      ? "crystal"
      : /chocolate|black|roast|torrad|preto|caf\xE9|coffee|carafa|patent/.test(
            label,
          ) || lov > 110
        ? "torrado"
        : /wheat|trigo|\boat|aveia|\brye|centeio/.test(label)
          ? "trigo"
          : /munich|munique|vienna|viena|melano/.test(label) ||
              (lov >= 3.5 && lov <= 12)
            ? "munich"
            : /pilsen|pale|maris|2-row|two-row|pilsner|base/.test(label) ||
                lov < 3.5
              ? "base"
              : null;
}
function maltPhProfile(malt) {
  const category = classifyMaltForPh(malt.name, malt.colorLovibond);
  if (category && MALT_PH_PROFILES[category]) return MALT_PH_PROFILES[category];
  const lov = n(malt.colorLovibond);
  return {
    distilledPh: Math.max(4.3, Math.min(5.8, 5.75 - 0.01 * lov)),
    bufferMEqPerKg: Math.max(30, Math.min(70, 35 + 0.3 * lov)),
  };
}
export function acidNormality(acidType, concentrationPct) {
  const props = ACID_PROPERTIES[acidType] || ACID_PROPERTIES.latico,
    conc = Math.max(0, n(concentrationPct)),
    density = props.densityBase + props.densitySlope * conc;
  return {
    mEqPerMl: ((conc / 100) * density * 1e3) / props.equivalentWeightG,
    densityGPerMl: density,
  };
}
export function predictMashPh({
  fermentables = [],
  ionProfile = {},
  mashWaterL = 0,
  grainKg = 0,
} = {}) {
  const grist = (Array.isArray(fermentables) ? fermentables : []).filter(
      (m) => n(m.amountKg) > 0,
    ),
    totalKg = grist.reduce((sum, m) => sum + n(m.amountKg), 0);
  if (totalKg <= 0) return null;
  let weightedPh = 0,
    bufferTotal = 0;
  grist.forEach((m) => {
    const profile = maltPhProfile(m),
      kg = n(m.amountKg);
    weightedPh += profile.distilledPh * kg;
    bufferTotal += profile.bufferMEqPerKg * kg;
  });
  const distilledPh = weightedPh / totalKg,
    alkalinityCaCO3 = n(ionProfile.bicarbonatePpm) * 0.8197,
    residualAlkalinity =
      alkalinityCaCO3 -
      (n(ionProfile.calciumPpm) / 1.4 + n(ionProfile.magnesiumPpm) / 1.7),
    water = Math.max(0, n(mashWaterL)),
    alkalinityMEq = (residualAlkalinity / 50) * water,
    deltaPh =
      bufferTotal > 0 ? (ALKALINITY_DAMPING * alkalinityMEq) / bufferTotal : 0,
    predictedPh = Math.max(4.5, Math.min(7, distilledPh + deltaPh));
  return {
    distilledPh: round(distilledPh, 2),
    residualAlkalinity: round(residualAlkalinity, 1),
    predictedPh: round(predictedPh, 2),
    bufferTotal: round(bufferTotal, 1),
    grainKg: round(n(grainKg) || totalKg, 2),
  };
}
export function acidDoseForTarget({
  predictedPh,
  targetPh = DEFAULT_MASH_PH_TARGET,
  bufferTotal = 0,
  acidType = "latico",
  concentrationPct = 0,
} = {}) {
  const gap = n(predictedPh) - n(targetPh, DEFAULT_MASH_PH_TARGET),
    buffer = n(bufferTotal);
  if (!(gap > 0) || buffer <= 0) return { doseMl: 0, doseG: 0, mEq: 0 };
  const mEq = buffer * gap,
    { mEqPerMl, densityGPerMl } = acidNormality(acidType, concentrationPct);
  if (!(mEqPerMl > 0)) return { doseMl: 0, doseG: 0, mEq: round(mEq, 1) };
  const doseMl = mEq / mEqPerMl;
  return {
    doseMl: round(Math.max(0, doseMl), 1),
    doseG: round(Math.max(0, doseMl * densityGPerMl), 1),
    mEq: round(mEq, 1),
  };
}
export function createRecipeSession(t, e = "", r = {}) {
  const o = clonePlain(t);
  return (
    (o.sourceUrl = e),
    {
      recipe: o,
      properties: defaultProperties(o, r),
      measurements: {
        preBoil: { volumeL: "", wri: "" },
        postBoil: { volumeL: "", wri: "" },
        cold: { trubVolumeL: "", fermenterVolumeL: "" },
      },
      correctionChecks: {
        pre: { volumeL: "", wri: "" },
        post: { volumeL: "", wri: "" },
      },
      hopLots: o.hops.map((a) => ({
        id: a.id,
        plannedAlpha: a.alphaAcidPct,
        actualAlpha: a.alphaAcidPct || "",
      })),
      timerEvents: [],
      notes: "",
      fermentationTracking: { readings: [] },
    }
  );
}
export function normalizeReading(t = {}, e = 1.04) {
  const r = n(t.wri),
    o = r ? round(r / e, 1) : 0;
  return {
    volumeL: t.volumeL === "" ? "" : n(t.volumeL),
    wri: t.wri === "" ? "" : r,
    realPlato: o,
    sg: o ? platoToSg(o) : 0,
  };
}
export function calculate(t) {
  const e = t.recipe,
    r = t.properties;
  syncTrubLoss(r);
  const o = Math.max(0.1, n(e.batchVolumeL, r.targetVolumeL)),
    a = n(r.targetVolumeL, o) / o,
    i =
      Math.max(0.1, n(e.mashEfficiencyPct, e.efficiencyPct || 70)) /
      Math.max(0.1, n(r.mashEfficiencyPct, 65)),
    s = e.fermentables.map((h) => ({
      ...h,
      amountKg: round(n(h.amountKg) * a * (h.use === "Mostura" ? i : 1), 3),
    })),
    m = e.hops.map((h) => ({ ...h, amountG: round(n(h.amountG) * a, 1) })),
    u = (e.yeasts || []).map((h) => ({
      ...h,
      amount: round(n(h.amount) * a, 3),
    })),
    c = (e.miscs || []).map((h) => ({
      ...h,
      amount: scaleIngredientAmount(n(h.amount), h.unit, a),
    })),
    d = s
      .filter((h) => h.use === "Mostura")
      .reduce((h, R) => h + n(R.amountKg), 0),
    p = n(r.targetVolumeL) + n(r.trubLossL),
    l = hotPostBoilVolume(r.targetVolumeL, r.trubLossL);
  r.evaporationLh = round(
    evaporationLhFromPct(r.evaporationPct, l, e.boilTimeMin),
    2,
  );
  const b = (r.evaporationLh * e.boilTimeMin) / 60,
    L = l + b,
    f = Math.max(0, n(r.mashTunDeadSpaceL)),
    g = effectiveWriFactor(r),
    M = n(r.waterToGrainRatioLkg, 3) * d + f,
    x = n(r.grainAbsorptionLkg, 1.2) * d,
    w = sourceWaterTotalVolume(r.targetVolumeL, r.trubLossL, b, x),
    E = Math.max(0, w - M),
    P = {
      grainKg: round(d, 2),
      boiloff: round(b, 2),
      preBoil: round(L, 2),
      hotPostBoil: round(l, 2),
      coldPostBoil: round(p, 2),
      mashWater: round(M, 2),
      absorption: round(x, 2),
      sparge: round(E, 2),
      totalWater: round(M + E, 2),
      mashTunDeadSpaceL: round(f, 2),
    },
    y = gravityEstimate(s, r),
    F = e.og || y.og,
    S = e.fg || 1 + (sgPoints(F) * 0.25) / 1e3,
    T = plannedPreBoilSg(F, y, P),
    N = sgToPlato(T),
    z = sgToPlato(F),
    A = correction(P.preBoil, N, t.measurements.preBoil, "pre", 0, g),
    $ = correctionCheckReading(t, "pre", A, N, g),
    V = A.status === "ready" ? A.factor : 1,
    K = $ ? $.realPlato / Math.max(0.1, N) : 1,
    B = $ ? $.volumeL : A.status === "ready" ? A.targetVolumeL : P.preBoil,
    v = m.map((h) => {
      const R = t.hopLots.find((tt) => tt.id === h.id) || {},
        k = n(R.plannedAlpha, h.alphaAcidPct),
        D = n(R.actualAlpha, 0),
        Z = k && D ? k / D : 1;
      return {
        ...h,
        plannedAlphaAcidPct: k,
        actualAlphaAcidPct: R.actualAlpha,
        alphaAcidPct: D || k,
        plannedAmountG: round(h.amountG * V, 1),
        amountG: round(h.amountG * V * Z, 1),
      };
    }),
    q = mashAdditionRows(m, c),
    j = boilAdditionRows(s, v, c, V),
    C = Math.max(0, B - P.boiloff),
    U = y.points ? Math.max(0, Math.min(1, y.preFermentPoints / y.points)) : 1,
    Y = 1 + (sgPoints(F) * U) / 1e3,
    W = correctedStageSg(Y, P.hotPostBoil, V * K, C),
    I = sgToPlato(W),
    H = e.ibu || calculateIbu(v, F, T, r.targetVolumeL),
    O = correction(C, I, t.measurements.postBoil, "post", r.evaporationLh, g),
    J = O.extraBoilMin
      ? calculateIbu(
          v.map((h) => ({
            ...h,
            timeMin: ["Fervura", "First wort"].includes(h.use)
              ? h.timeMin + O.extraBoilMin
              : h.timeMin,
          })),
          F,
          T,
          r.targetVolumeL,
        )
      : H,
    G = { ...O, estimatedIbu: Math.round(J) },
    _ = G.status === "ready" ? G.targetVolumeL : C,
    X = analyze(s, P, t.measurements, r, e, _, B, C),
    Q = v
      .filter((h) => h.actualAlphaAcidPct === 0 || h.actualAlphaAcidPct === "0")
      .map(
        (h) =>
          `${h.name}: alfa \xE1cido real zero n\xE3o \xE9 v\xE1lido; dose mant\xE9m o lote planejado.`,
      );
  return {
    recipe: e,
    props: r,
    scaledFermentables: s,
    scaledYeasts: u,
    scaledMiscs: c,
    hopSchedule: v,
    mashAdditions: q,
    boilAdditions: j,
    waterProfile: adjustedWaterProfile(r, P),
    volumes: P,
    gravity: y,
    og: F,
    fg: S,
    ibu: Math.round(H),
    ebc: n(e.colorEbc) > 0 ? round(n(e.colorEbc), 1) : moreyEbc(s, p),
    preBoilSg: T,
    preBoilPlato: N,
    ogPlato: z,
    postBoilSg: W,
    postBoilPlato: I,
    preCorrection: A,
    postCorrection: G,
    expected: {
      preBoilVolume: round(B, 2),
      hotPostBoil: round(C, 2),
      postBoilPlato: round(I, 1),
      postBoilSg: round(W, 3),
      finalHotVolume: round(_, 2),
      fermenterVolume: round(Math.max(0, _ * 0.96 - r.trubLossL), 2),
    },
    analysis: X,
    warnings: Q,
  };
}
export function moreyEbc(t, e) {
  const r = Math.max(0.1, lToGal(n(e, 20))),
    o =
      (t || []).reduce(
        (a, i) => a + kgToLb(n(i.amountKg)) * n(i.colorLovibond),
        0,
      ) / r;
  return o <= 0 ? 0 : round(1.4922 * Math.pow(o, 0.6859) * 1.97, 1);
}
export function gravityEstimate(t, e) {
  const r = Math.max(0.1, n(e.targetVolumeL, 20));
  let o = 0,
    a = 0,
    i = 0;
  return (
    t.forEach((s) => {
      const m = s.use === "Mostura" ? n(e.mashEfficiencyPct, 65) / 100 : 1,
        u = (kgToLb(n(s.amountKg)) * n(s.ppg, 36) * m) / lToGal(r);
      ((o += u),
        s.use === "Mostura" && (a += u),
        s.use !== "Fermenta\xE7\xE3o" && (i += u));
    }),
    { points: o, preBoilPoints: a, preFermentPoints: i, og: 1 + o / 1e3 }
  );
}
export function correctedStageSg(t, e, r, o) {
  const a = Math.max(0.1, n(o)),
    i = Math.max(0, n(e)),
    s = Math.max(0, n(r, 1));
  return 1 + (sgPoints(t) * i * s) / a / 1e3;
}
export function plannedPreBoilSg(t, e, r) {
  const o = Math.max(0, sgPoints(t)),
    a = Math.max(0, n(e.points)),
    i = Math.max(0, n(e.preBoilPoints, a)),
    s = a ? Math.max(0, Math.min(1, i / a)) : 1;
  return 1 + (o * s * n(r.hotPostBoil)) / Math.max(0.1, n(r.preBoil)) / 1e3;
}
export function correction(t, e, r, o, a = 0, i = 1.04) {
  const s = normalizeReading(r, i),
    m = n(s.volumeL),
    u = n(s.realPlato);
  if (!m || !u || !e || !t)
    return {
      status: "pending",
      action: "Aguardando leitura",
      targetVolumeL: round(t, 2),
      deltaL: 0,
      factor: 1,
      extraBoilMin: 0,
      warning: "",
    };
  const c = (m * u) / e,
    d = c - m,
    p =
      Math.abs(d) <= 0.05
        ? "Sem corre\xE7\xE3o"
        : d > 0
          ? "Adicionar \xE1gua"
          : o === "post"
            ? "Ferver mais"
            : "Evaporar",
    l = p === "Ferver mais" && a ? (Math.abs(d) / a) * 60 : 0;
  return {
    status: "ready",
    action: p,
    targetVolumeL: round(c, 2),
    deltaL: round(d, 2),
    factor: round(c / t, 4),
    extraBoilMin: round(l, 1),
    estimatedIbu: 0,
    warning:
      p === "Ferver mais"
        ? "Fervura extra pode aumentar o IBU. Reavalie amargor antes de confirmar."
        : "",
  };
}
export function negligibleCorrection(t = {}) {
  if (t.status !== "ready" || t.action === "Sem corre\xE7\xE3o") return !1;
  const e = Math.max(0.1, n(t.targetVolumeL) * 0.01);
  return Math.abs(n(t.deltaL)) <= e;
}
export function correctionCheckReading(t, e, r, o, a = 1.04) {
  if (!e || r.status !== "ready") return null;
  const i = t?.correctionChecks?.[e],
    s = normalizeReading({ volumeL: r.targetVolumeL, wri: i?.wri ?? "" }, a);
  return s.realPlato
    ? { ...s, volumeL: r.targetVolumeL, expectedPlato: o }
    : null;
}
export function correctionPlatoTolerance() {
  return 0.2;
}
export function correctionSoftPlatoTolerance() {
  return 0.4;
}
export function signedPlato(t) {
  const e = round(n(t), 1);
  return `${e > 0 ? "+" : ""}${fmt(e, 1)} \xB0P`;
}
export function correctionActionText(t) {
  const e = String(t || "");
  return /^Adicionar/.test(e)
    ? "Adicionar mais \xE1gua"
    : /^(Evaporar|Ferver)/.test(e)
      ? "Ferver mais"
      : e;
}
export function correctionCheckResult(t, e, r, o, a = 0, i = 1.04) {
  const s = normalizeReading(
      { volumeL: t.targetVolumeL, wri: e?.wri ?? "" },
      i,
    ),
    m = o === "post" ? "resfriamento" : "fervura";
  if (t.status !== "ready")
    return {
      status: "pending",
      title: "Aguardando leitura",
      summary: "Fa\xE7a a leitura principal antes de conferir",
    };
  if (t.action === "Sem corre\xE7\xE3o")
    return {
      status: "confirmed",
      title: "Sem corre\xE7\xE3o",
      summary: `Sem corre\xE7\xE3o necess\xE1ria: seguir para ${m}`,
    };
  if (!s.realPlato)
    return {
      status: "pending",
      title: "Aguardando confer\xEAncia",
      summary: "Informe WRI ap\xF3s corrigir para confirmar",
    };
  const u = correction(
      t.targetVolumeL,
      r,
      { volumeL: t.targetVolumeL, wri: e.wri },
      o,
      a,
    ),
    c = correctionPlatoTolerance(),
    d = correctionSoftPlatoTolerance(),
    p = s.realPlato - r,
    l = Math.abs(p),
    b = `dif. ${signedPlato(p)}`;
  if (l <= c)
    return {
      status: "confirmed",
      title: "Corre\xE7\xE3o confirmada",
      summary: `Dentro da margem: seguir para ${m}`,
      detail: b,
    };
  if (l <= d)
    return {
      status: "acceptable",
      title: "Desvio pequeno",
      summary: "Desvio pequeno: seguir se a leitura estiver confi\xE1vel",
      detail: b,
    };
  const L = u.extraBoilMin ? `; estimado ${fmt(u.extraBoilMin, 1)} min` : "",
    f = correctionActionText(u.action),
    g = formatVolume(Math.abs(u.deltaL), 2);
  return {
    status: "adjust",
    title: "Ajuste fino",
    summary:
      f === "Ferver mais"
        ? `${f}: reduzir ${g}${L}; conferir novamente`
        : `${f}: ${g}; conferir novamente`,
    detail: b,
  };
}
export function correctionSummary(t) {
  return t.status === "pending"
    ? "Aguardando leitura"
    : t.action === "Sem corre\xE7\xE3o"
      ? "Sem corre\xE7\xE3o"
      : `${t.action} ${formatVolume(Math.abs(t.deltaL), 2)}`;
}
export function calculateIbu(t, e, r, o) {
  const a = (e + r) / 2,
    i = Math.max(0.1, n(o, 20));
  return t.reduce((s, m) => {
    if (["Dry hop", "Mostura"].includes(m.use)) return s;
    const u = ["Hopstand", "Whirlpool"].includes(m.use)
        ? 0.3
        : m.use === "First wort"
          ? 1.1
          : 1,
      c =
        (1.65 *
          Math.pow(125e-6, a - 1) *
          (1 - Math.exp(-0.04 * n(m.timeMin)))) /
        4.15;
    return s + c * u * (((n(m.alphaAcidPct) / 100) * n(m.amountG) * 1e3) / i);
  }, 0);
}
export function analyze(t, e, r, o, a, i, s = e.preBoil, m = i) {
  const u = effectiveWriFactor(o),
    c = normalizeReading(r.preBoil, u),
    d = normalizeReading(r.postBoil, u),
    p = e.grainKg || 0,
    l = n(o.mashWaterUsedL, e.mashWater),
    b = Math.max(0, e.totalWater - l),
    L = n(c.volumeL),
    f = n(s, L || e.preBoil),
    g = d.volumeL === "" ? 0 : n(d.volumeL),
    M = Math.max(0, n(e.hotPostBoil) - n(e.coldPostBoil)),
    x = Math.max(0, L - M),
    w = c.sg ? sgPoints(c.sg) * lToGal(L) : 0,
    E = t
      .filter((S) => S.use === "Mostura")
      .reduce((S, T) => S + kgToLb(n(T.amountKg)) * n(T.ppg, 36), 0),
    P = r.cold || {},
    y = n(P.fermenterVolumeL, Math.max(0, i * 0.96 - o.trubLossL)),
    F = f && g ? Math.max(0, (f - g) / Math.max(0.01, a.boilTimeMin / 60)) : 0;
  return {
    mashEfficiencyPct: E ? round((w / E) * 100, 1) : 0,
    grainAbsorptionLkg: p && L ? round((l + b - x) / p, 2) : 0,
    evaporationLh: round(F, 2),
    evaporationPct: f ? round((F / f) * 100, 1) : 0,
    trubLossL: round(n(P.trubVolumeL, Math.max(0, i * 0.96 - y)), 2),
  };
}
export function isBoilAddition(t = {}) {
  return ["First wort", "Fervura", "Hopstand", "Whirlpool", "Dry hop"].includes(
    t.use,
  );
}
export function additionOrder(t = {}) {
  return t.use === "First wort"
    ? 1e4 + n(t.timeMin)
    : t.use === "Fervura"
      ? 5e3 + n(t.timeMin)
      : t.use === "Hopstand" || t.use === "Whirlpool"
        ? 1e3 + n(t.timeMin)
        : t.use === "Dry hop"
          ? -100
          : n(t.timeMin);
}
export function boilAdditionRows(t, e, r, o) {
  const a = n(o, 1);
  return [
    ...e.filter(isBoilAddition).map((i) => ({
      ...i,
      kind: "hop",
      type: "L\xFApulo",
      amount: i.amountG,
      unit: "g",
      order: additionOrder(i),
    })),
    ...t
      .filter((i) => i.use === "Fervura")
      .map((i) => ({
        id: i.id,
        kind: "fermentable",
        name: i.name,
        type: i.type,
        use: "Fervura",
        timeMin: i.timeMin,
        amount: scaleIngredientAmount(i.amountKg, "kg", a),
        unit: "kg",
        order: additionOrder({ use: "Fervura", timeMin: i.timeMin }),
      })),
    ...(r || []).filter(isBoilAddition).map((i) => ({
      ...i,
      kind: "misc",
      amount: scaleIngredientAmount(i.amount, i.unit, a),
      order: additionOrder(i),
    })),
  ].sort((i, s) => s.order - i.order);
}
export function mashAdditionRows(t, e) {
  return [
    ...t
      .filter((r) => r.use === "Mostura")
      .map((r) => ({
        ...r,
        kind: "hop",
        type: "L\xFApulo",
        amount: r.amountG,
        unit: "g",
        moment: "Mash hopping",
        order: n(r.timeMin),
      })),
    ...(e || [])
      .filter((r) => r.use === "Mostura")
      .map((r) => ({
        ...r,
        kind: "misc",
        moment: r.type,
        order: n(r.timeMin),
      })),
  ].sort((r, o) => o.order - r.order);
}
export function groupBySchedule(t = []) {
  const e = [];
  return (
    t.forEach((r) => {
      const o = /dry hop/i.test(r.use || ""),
        a = `${!o && Number.isFinite(Number(r.timeMin)) ? fmt(r.timeMin, 0) : ""}|${r.use || ""}`;
      let i = e.find((s) => s.key === a);
      (i ||
        ((i = {
          key: a,
          order: additionOrder(r),
          timeLabel:
            !o && Number.isFinite(Number(r.timeMin))
              ? `${fmt(r.timeMin, 0)} min`
              : "",
          useLabel: r.use || "",
          items: [],
        }),
        e.push(i)),
        i.items.push(r));
    }),
    e.sort((r, o) => o.order - r.order)
  );
}
export function additionScheduleLabel(t) {
  return /dry hop/i.test(t.use)
    ? "Dry hop"
    : Number.isFinite(Number(t.timeMin))
      ? `${fmt(t.timeMin, 0)} min \xB7 ${t.use}`
      : t.use;
}
export function mashStepName(t) {
  return String(t || "")
    .trim()
    .toLowerCase() === "temperature"
    ? "Temperatura"
    : t;
}
export function effectiveMashSteps(t = []) {
  return (t || []).filter((e) => {
    if (!n(e.timeMin)) return !1;
    const o = String(e.name || "").toLowerCase(),
      a = String(e.type || "").toLowerCase();
    return !(
      /mash\s*out|mashout|sa[ií]da|finaliza/.test(`${o} ${a}`) ||
      /ramp|subida|aquec|heat|rise|increase/.test(o)
    );
  });
}
export function totalMashTimeMin(t = []) {
  return effectiveMashSteps(t).reduce((e, r) => e + n(r.timeMin), 0);
}
export function operationalMashSteps(t = []) {
  return (t || []).filter((e) => n(e.timeMin) > 0);
}
export function mashTimerStepInfo(t = {}) {
  const e = mashStepName(t.name || "Mostura"),
    r = Number.isFinite(Number(t.temperatureC))
      ? `${fmt(t.temperatureC, 1)}\xB0C`
      : e;
  return { label: e, target: r, detail: r, info: `${fmt(t.timeMin, 0)} min` };
}
export const DEFAULT_HEATING_RATE_C_MIN = 1.5;
export function effectiveHeatingRateCMin(t = {}, e = {}) {
  return Math.min(
    10,
    Math.max(
      0,
      n(e.heatingRateCMin, n(t.heatingRateCMin, DEFAULT_HEATING_RATE_C_MIN)),
    ),
  );
}
export function mashTimerItems(t = [], e = 0) {
  const r = operationalMashSteps(t),
    o = Math.max(0, n(e)),
    a = [];
  r.forEach((u, c) => {
    const d = r[c - 1];
    if (o > 0 && d) {
      const p = n(u.temperatureC) - n(d.temperatureC);
      p > 0 &&
        a.push({ kind: "heat", from: d, to: u, durationMin: round(p / o, 1) });
    }
    a.push({ kind: "step", step: u });
  });
  const i = a.reduce(
      (u, c) => u + (c.kind === "step" ? n(c.step.timeMin) : c.durationMin),
      0,
    ),
    s = [];
  let m = i;
  return (
    a.forEach((u, c) => {
      const d = a[c + 1] || null,
        p = u.kind === "step" ? n(u.step.timeMin) : u.durationMin,
        l = Math.max(0, m - p);
      if (u.kind === "heat") {
        const b = mashTimerStepInfo(u.to);
        s.push({
          id: `mash-heat-${c}`,
          phase: "mash",
          label: "Aquecimento",
          detail: `${fmt(u.from.temperatureC, 1)}\xB0C \u2192 ${fmt(u.to.temperatureC, 1)}\xB0C`,
          durationMin: p,
          stageRemainingMin: m,
          targetStageRemainingMin: l,
          eventType: "mash-next",
          eventActionLabel: `Confirmar ${b.label}`,
          eventSummaryLabel: `Confirmar ${b.label}`,
          eventTimeLabel: b.label,
          eventTargetLabel: b.target,
          infoLabel: b.info,
          meta: `Aquecimento estimado \xB7 ~${fmt(p, 0)} min`,
        });
      } else {
        const b = mashTimerStepInfo(u.step),
          L = !!(d && d.kind === "heat"),
          f = d ? mashTimerStepInfo(d.kind === "heat" ? d.to : d.step) : null;
        s.push({
          id: `mash-run-${u.step.id || c}`,
          phase: "mash",
          label: b.label,
          detail: b.detail,
          durationMin: p,
          stageRemainingMin: m,
          targetStageRemainingMin: l,
          eventType: f ? "mash-next" : "mash-end",
          eventActionLabel: f
            ? L
              ? `Aquecer at\xE9 ${f.target}`
              : `Confirmar ${f.label}`
            : "Finalizar mostura",
          eventSummaryLabel: f
            ? L
              ? `Aquecer at\xE9 ${f.target}`
              : `Confirmar ${f.label}`
            : "Finalizar mostura",
          eventTimeLabel: f ? f.label : "mostura",
          eventTargetLabel: f ? f.detail : "agora",
          infoLabel: f ? f.info : "agora",
          meta: `${b.label} \xB7 ${b.info}`,
        });
      }
      m = l;
    }),
    s
  );
}
export function boilAdditionTimerTime(t, e) {
  return ["First wort", "Fervura"].includes(t.use)
    ? Number.isFinite(Number(t.timeMin))
      ? Math.max(0, Math.min(e, n(t.timeMin)))
      : t.use === "First wort"
        ? e
        : Math.min(10, e)
    : null;
}
export function hopstandAdditionTimerTime(t) {
  return ["Hopstand", "Whirlpool"].includes(t.use)
    ? Number.isFinite(Number(t.timeMin))
      ? Math.max(0, n(t.timeMin))
      : 0
    : null;
}
export function groupTimerAdditions(t, e) {
  const r = new Map();
  return (
    t.forEach((o) => {
      const a = e(o);
      if (a == null || !Number.isFinite(Number(a))) return;
      const i = timerTimeKey(a);
      (r.has(i) || r.set(i, []), r.get(i).push(o));
    }),
    r
  );
}
export function uniqueTimerTimes(t) {
  return Array.from(new Set(t.map((e) => timerTimeKey(e)))).map(Number);
}
export function timerTimeKey(t) {
  return String(round(n(t), 2));
}
export function additionCountLabel(t) {
  return `${t} ${t === 1 ? "adi\xE7\xE3o" : "adi\xE7\xF5es"}`;
}
export function timerAdditionSummary(t) {
  return {
    id: t.id,
    kind: t.kind,
    name: t.name,
    amount: t.amount,
    unit: t.unit,
    type: t.type,
    use: t.use,
  };
}
export const POST_READING_OFFSET_MIN = 0;
export function boilTimerItems(t) {
  const e = n(t.recipe.boilTimeMin, 60),
    r = t.boilAdditions || [],
    o = groupTimerAdditions(r, (l) => boilAdditionTimerTime(l, e)),
    a = groupTimerAdditions(r, hopstandAdditionTimerTime),
    i = Array.from(o.keys())
      .map(Number)
      .sort((l, b) => b - l),
    s = e > POST_READING_OFFSET_MIN ? POST_READING_OFFSET_MIN : null,
    m = uniqueTimerTimes([...i, ...(s === null ? [] : [s]), 0]).sort(
      (l, b) => b - l,
    ),
    u = [];
  let c = e;
  m.forEach((l, b) => {
    const L = Math.max(0, c - l),
      f = o.get(timerTimeKey(l)) || [],
      g = f.length > 0,
      M = s !== null ? l === s : l === 0,
      x = `${fmt(l, 0)} min`;
    (u.push({
      id: `boil-${b}-${round(l, 2)}`,
      phase: "boil",
      label: g
        ? `Adi\xE7\xE3o de ${x}`
        : M && l > 0
          ? "Leitura p\xF3s-fervura"
          : "Fim da fervura",
      detail: g
        ? additionCountLabel(f.length)
        : M && l > 0
          ? "leia volume e WRI ainda fervendo"
          : "fim da fervura",
      durationMin: L,
      boilRemainingMin: c,
      targetBoilRemainingMin: l,
      stageRemainingMin: c,
      targetStageRemainingMin: l,
      eventTimeLabel: x,
      eventType: g ? "addition" : M && l > 0 ? "reading" : "boil-end",
      eventCount: f.length,
      eventActionLabel: g
        ? `Confirmar adi\xE7\xE3o de ${x}`
        : M && l > 0
          ? "Fazer a leitura p\xF3s-fervura"
          : a.size
            ? "Iniciar hopstand"
            : "Finalizar fervura",
      eventSummaryLabel: g
        ? `Pr\xF3x. ${x}`
        : M && l > 0
          ? `Leitura ${x}`
          : "Fim",
      additions: f.map(timerAdditionSummary),
      withReading: M,
      meta: g
        ? `${additionCountLabel(f.length)} em ${x}`
        : `${fmt(L, 0)} min at\xE9 o fim da fervura`,
    }),
      (c = l));
  });
  const d = Array.from(a.keys())
    .map(Number)
    .sort((l, b) => b - l);
  let p = d[0] || 0;
  return (
    d.forEach((l, b) => {
      const L = Math.max(0, p - l),
        f = a.get(timerTimeKey(l)) || [],
        g = `${fmt(l, 0)} min`;
      (u.push({
        id: `hopstand-${b}-${round(l, 2)}`,
        phase: "hopstand",
        label: `Adi\xE7\xE3o de hopstand ${g}`,
        detail: additionCountLabel(f.length),
        durationMin: L,
        boilRemainingMin: 0,
        targetBoilRemainingMin: 0,
        stageRemainingMin: p,
        targetStageRemainingMin: l,
        eventTimeLabel: g,
        eventType: "addition",
        eventCount: f.length,
        eventActionLabel: `Confirmar adi\xE7\xE3o de hopstand ${g}`,
        eventSummaryLabel: `Pr\xF3x. ${g}`,
        additions: f.map(timerAdditionSummary),
        meta: `${additionCountLabel(f.length)} no hopstand ${g}`,
      }),
        (p = l));
    }),
    p > 0 &&
      u.push({
        id: `hopstand-end-${round(p, 2)}`,
        phase: "hopstand",
        label: "Fim do hopstand",
        detail: "fim do hopstand",
        durationMin: p,
        boilRemainingMin: 0,
        targetBoilRemainingMin: 0,
        stageRemainingMin: p,
        targetStageRemainingMin: 0,
        eventTimeLabel: "0 min",
        eventType: "hopstand-end",
        eventCount: 0,
        eventActionLabel: "Finalizar hopstand",
        eventSummaryLabel: "Fim hopstand",
        additions: [],
        meta: `${fmt(p, 0)} min at\xE9 o fim do hopstand`,
      }),
    u
  );
}
export function expectedFermentationTemperature(t = [], e = 0) {
  if (!Array.isArray(t) || !t.length) return "";
  let r = 0;
  const o = Math.max(0, n(e));
  for (const i of t) {
    const s = Math.max(0, n(i.days)),
      m = Number(i.temperatureC);
    if (Number.isFinite(m) && o <= r + s) return m;
    r += s;
  }
  const a = [...t]
    .reverse()
    .find((i) => Number.isFinite(Number(i.temperatureC)));
  return a ? Number(a.temperatureC) : "";
}
export function firstFermentationReadingDate(t = []) {
  const e = t.find((r) => parseFermentationDatetime(r.datetime));
  return e ? parseFermentationDatetime(e.datetime) : null;
}
export function fermentationDayFromDatetime(t = {}, e = null, r = 0) {
  const o = parseFermentationDatetime(t.datetime);
  return e && o
    ? Math.floor(Math.max(0, (o.getTime() - e.getTime()) / 864e5))
    : t.day === ""
      ? r + 1
      : Math.floor(Math.max(0, n(t.day, r + 1)));
}
export function parseFermentationDatetime(t) {
  if (!t) return null;
  const e = new Date(String(t));
  return Number.isFinite(e.getTime()) ? e : null;
}
export function fermentedRefractometerPlato(t, e, r = 1.04) {
  if (!n(e)) return "";
  const o = n(r) > 0 ? n(r) : 1.04,
    a = 1 - 0.002349 * n(t) + 0.006276 * (n(e) / o);
  return round(Math.max(0, sgToPlato(a)), 1);
}
export function sanitizeFermentationTracking(t = {}) {
  return {
    readings: (Array.isArray(t?.readings) ? t.readings : [])
      .map(sanitizeFermentationReading)
      .filter(Boolean),
  };
}
export function sanitizeFermentationReading(t = {}, e = 0) {
  return isPlainObject(t)
    ? {
        id: String(t.id || `fermentation-${e + 1}`),
        day: t.day === "" ? "" : Math.max(0, n(t.day, e + 1)),
        datetime: String(t.datetime || ""),
        temperatureC:
          t.temperatureC === "" ? "" : Math.max(0, n(t.temperatureC)),
        wri: t.wri === "" ? "" : Math.max(0, n(t.wri)),
      }
    : null;
}
export function fermentationInitialReadingValue(t, e, r, o = 1.04) {
  const a = round(Math.max(0, n(e)), 1);
  return { source: t, plato: a, wri: round(n(r, a * o), 1), sg: platoToSg(a) };
}
export function fermentationInitialReading(t, e) {
  const r = effectiveWriFactor(t.properties || {}),
    o = normalizeReading(t.correctionChecks?.post || {}, r);
  if (o.realPlato)
    return fermentationInitialReadingValue(
      "OG real \xB7 confer\xEAncia p\xF3s-corre\xE7\xE3o",
      o.realPlato,
      o.wri,
      r,
    );
  const a = normalizeReading(t.measurements?.postBoil || {}, r);
  return a.realPlato
    ? fermentationInitialReadingValue(
        "OG real \xB7 leitura p\xF3s-fervura",
        a.realPlato,
        a.wri,
        r,
      )
    : fermentationInitialReadingValue(
        "OG planejada",
        e.ogPlato,
        e.ogPlato * r,
        r,
      );
}
export function fermentationTrackingState(t, e) {
  const r = fermentationInitialReading(t, e);
  r.expectedTemperatureC = expectedFermentationTemperature(
    e.recipe.fermentation,
    0,
  );
  const o = { plato: round(Math.max(0, sgToPlato(e.fg)), 1), sg: e.fg };
  t.fermentationTracking = sanitizeFermentationTracking(t.fermentationTracking);
  const a = t.fermentationTracking.readings,
    i = firstFermentationReadingDate(a),
    s = effectiveWriFactor(t.properties || {}),
    m = a.map((u, c) => {
      const d = u.wri === "" ? "" : n(u.wri),
        p = d === "" ? "" : fermentedRefractometerPlato(r.plato, d, s),
        l = fermentationDayFromDatetime(u, i, c);
      return {
        id: u.id,
        day: l,
        datetime: u.datetime || "",
        expectedTemperatureC: expectedFermentationTemperature(
          e.recipe.fermentation,
          l,
        ),
        temperatureC: u.temperatureC === "" ? "" : n(u.temperatureC),
        wri: d,
        realPlato: p,
        sg: p === "" ? "" : platoToSg(p),
      };
    });
  return { initial: r, expected: o, readings: m };
}
export function fermentationTemperatureChartPoints(t = []) {
  const e = (t || [])
    .map((a) => ({
      day: Math.max(0, n(a.days)),
      value: Number(a.temperatureC),
    }))
    .filter((a) => Number.isFinite(a.value));
  if (!e.length) return [];
  const r = [];
  let o = 0;
  return (
    e.forEach((a, i) => {
      const s = e[i + 1],
        m = Math.max(0, a.day);
      (r.push({ day: o, value: a.value }),
        (o += m),
        r.push({ day: o, value: a.value }),
        s &&
          s.value !== a.value &&
          (r.push({ day: o + 0.18, value: s.value }), (o += 0.18)));
    }),
    r
  );
}
export function paddedRange(t, e = 1, r = 4) {
  const o = t.filter(Number.isFinite);
  if (!o.length) return { min: 0, max: r };
  let a = Math.min(...o),
    i = Math.max(...o);
  return (
    a === i && ((a -= r / 2), (i += r / 2)),
    {
      min: Math.max(0, Math.floor((a - e) * 2) / 2),
      max: Math.ceil((i + e) * 2) / 2,
    }
  );
}
export function fermentationChartModel(t, e) {
  const r = fermentationTrackingState(t, e),
    o = fermentationTemperatureChartPoints(e.recipe.fermentation || []),
    a = r.readings
      .filter((c) => c.temperatureC !== "")
      .map((c) => ({ day: c.day, value: c.temperatureC })),
    i = [
      { day: 0, value: r.initial.plato, label: r.initial.source },
      ...r.readings
        .filter((c) => c.realPlato !== "")
        .map((c) => ({ day: c.day, value: c.realPlato, label: "Leitura" })),
    ],
    s = [...o, ...a].map((c) => c.value).filter(Number.isFinite),
    m = [...i.map((c) => c.value), r.expected.plato].filter(Number.isFinite),
    u = Math.max(
      1,
      ...o.map((c) => c.day).filter(Number.isFinite),
      ...a.map((c) => c.day).filter(Number.isFinite),
      ...i.map((c) => c.day).filter(Number.isFinite),
    );
  return {
    maxDay: Math.ceil(u),
    tempPoints: o,
    realTempPoints: a,
    extractPoints: i,
    expectedFgPlato: r.expected.plato,
    tempRange: paddedRange(s, 1, 4),
    extractRange: paddedRange(m, 0.5, 4),
  };
}
export function chartTicks(t, e, r = 4) {
  const o = n(t),
    a = n(e, o + 1),
    i = Math.max(1, r - 1);
  return Array.from({ length: r }, (s, m) => round(o + ((a - o) / i) * m, 1));
}
export function dayTicks(t) {
  const e = Math.max(1, Math.ceil(n(t, 1))),
    r = e <= 5 ? 1 : Math.ceil(e / 5),
    o = [];
  for (let a = 0; a < e; a += r) o.push(a);
  return (o.includes(e) || o.push(e), o);
}
export function finalParameterCode(t) {
  const e = t.analysis || {},
    r = t.props || {},
    o = n(r.targetVolumeL, 20),
    a = pickParameterValue(e.trubLossL, r.trubLossL),
    i = o ? a / o : n(r.trubLossPct, 0.15),
    s = pickParameterValue(e.mashEfficiencyPct, r.mashEfficiencyPct),
    m = o + Math.max(0, n(a)),
    u = m ? (s * o) / m : s;
  return [
    `vol=${fmt(o, 1)}`,
    `equip=${fmt(u, 1)}`,
    `evap=${fmt(pickParameterValue(e.evaporationPct, r.evaporationPct), 1)}`,
    `trub=${fmt(i * 100, 1)}%`,
    `abs=${fmt(pickParameterValue(e.grainAbsorptionLkg, r.grainAbsorptionLkg), 2)}`,
    `agua=${fmt(r.waterToGrainRatioLkg, 2)}`,
  ].join("; ");
}
export function pickParameterValue(t, e) {
  const r = Number(t);
  return Number.isFinite(r) && r > 0 ? r : e;
}
export function hasCompleteParameterValues(t = {}) {
  return (
    ["V", "EV", "TR", "ABS", "RAM"].every((e) => Number.isFinite(t[e])) &&
    (Number.isFinite(t.EM) || Number.isFinite(t.EE)) &&
    t.V > 0 &&
    (t.EM > 0 || t.EE > 0) &&
    t.EV >= 0 &&
    t.TR >= 0 &&
    t.ABS > 0 &&
    t.RAM > 0
  );
}
export function applyProductionParameterValues(t, e) {
  (Number.isFinite(e.V) && (t.targetVolumeL = e.V),
    Number.isFinite(e.EV) && (t.evaporationPct = e.EV),
    Number.isFinite(e.ABS) && (t.grainAbsorptionLkg = e.ABS),
    Number.isFinite(e.RAM) && (t.waterToGrainRatioLkg = e.RAM),
    Number.isFinite(e.TR) &&
      ((t.trubLossPct = e.TR > 1 ? e.TR / 100 : e.TR),
      (t.trubLossL = round(n(t.targetVolumeL, 20) * t.trubLossPct, 2)),
      (t.trubLossEdited = !1)),
    Number.isFinite(e.EE)
      ? (t.mashEfficiencyPct = mashEfficiencyFromEquipment(
          e.EE,
          t.targetVolumeL,
          t.trubLossL,
        ))
      : Number.isFinite(e.EM) && (t.mashEfficiencyPct = e.EM));
}
export function normalizeParameterKey(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
export function parseReadableParameterCode(t) {
  const e = {};
  return (
    String(t || "")
      .split(/[;\n]+/)
      .forEach((r) => {
        const o = r.match(/^\s*([^=:]+?)\s*[:=]\s*(.+?)\s*$/);
        if (!o) return;
        const a = normalizeParameterKey(o[1]),
          i = o[2],
          s = parseUserNumber(i);
        Number.isFinite(s) &&
          (["v", "vol", "volume", "litros"].includes(a) && (e.V = s),
          ["em", "mostura", "eficienciamostura"].includes(a) && (e.EM = s),
          [
            "ee",
            "ef",
            "equip",
            "equipamento",
            "eficiencia",
            "eficienciaequipamento",
            "eficienciadoequipamento",
          ].includes(a) && (e.EE = s),
          ["ev", "evap", "evaporacao"].includes(a) && (e.EV = s),
          ["tr", "trub", "perdatrub"].includes(a) &&
            (e.TR = i.includes("%") || s > 1 ? s / 100 : s),
          ["abs", "absorcao", "absorcaoporgrao"].includes(a) && (e.ABS = s),
          ["agua", "aguamalte", "ram", "relacao", "relacaoaguamalte"].includes(
            a,
          ) && (e.RAM = s));
      }),
    e
  );
}
export function parseShortParameterCode(t) {
  const e = String(t || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!/^(V|EE|EM|EV|TR|ABS|RAM)/.test(e)) return {};
  const r = {},
    o = /(V|EE|EM|EV|TR|ABS|RAM)(-?\d+(?:[,.]\d+)?)/g;
  let a;
  for (; (a = o.exec(e));) r[a[1]] = parseUserNumber(a[2]);
  return r;
}
export function parsePipeParameterCode(t) {
  const e = String(t || "");
  if (!/^RD\|/i.test(e) && !/\|(V|EE|EM|EV|TR|ABS|RAM)=/i.test(e)) return {};
  const r = {};
  return (
    e.split("|").forEach((o) => {
      const [a, ...i] = o.split("="),
        s = String(a || "")
          .trim()
          .toUpperCase();
      if (!["V", "EE", "EM", "EV", "TR", "ABS", "RAM"].includes(s)) return;
      const m = parseUserNumber(i.join("="));
      Number.isFinite(m) && (r[s] = m);
    }),
    r
  );
}
export function parseParameterText(t) {
  const e = String(t || "").trim();
  return (
    (e &&
      [
        parseReadableParameterCode(e),
        parseShortParameterCode(e),
        parsePipeParameterCode(e),
      ].find(hasCompleteParameterValues)) ||
    null
  );
}
export function originalWaterPlan(t) {
  const e = (t.fermentables || [])
      .filter((u) => u.use === "Mostura")
      .reduce((u, c) => u + n(c.amountKg), 0),
    o =
      (t.mash || []).reduce((u, c) => u + n(c.waterVolumeL), 0) ||
      e * DEFAULT_PROFILE.waterToGrainRatioLkg,
    a = e * DEFAULT_PROFILE.grainAbsorptionLkg,
    i = (n(t.evaporationLh) * n(t.boilTimeMin, 60)) / 60,
    s = sourceWaterTotalVolume(t.batchVolumeL, t.trubLossL, i, a),
    m = Math.max(0, s - o);
  return {
    mashWaterL: round(o, 2),
    spargeWaterL: round(m, 2),
    totalWaterL: round(o + m, 2),
  };
}
