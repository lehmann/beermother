const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const PH_STAGES = [
    "mash-water",
    "mash",
    "sparge-water",
    "pre-boil",
    "post-boil",
  ],
  PH_STAGE_TITLES = {
    "mash-water": "\xC1gua de mostura",
    "mash": "Mostura",
    "sparge-water": "\xC1gua de lavagem",
    "pre-boil": "Pr\xE9-fervura",
    "post-boil": "P\xF3s-fervura",
  },
  PH_TARGETS = {
    "mash-water": { target: 5.5 },
    "mash": { min: 5.2, max: 5.6, target: 5.4 },
    "sparge-water": { target: 5.5 },
    "pre-boil": null,
    "post-boil": null,
  },
  PH_ACID_TYPES = [
    {
      type: "latico",
      label: "\xC1cido l\xE1tico",
      short: "L\xE1tico",
      defaultConcentration: 80,
    },
    {
      type: "fosforico",
      label: "\xC1cido fosf\xF3rico",
      short: "Fosf\xF3rico",
      defaultConcentration: 10,
    },
  ],
  DEFAULT_PH_ACID_TYPE = "latico",
  PH_GENERIC_PRIORS = { water: 0.08, mash: 0.5 };
export function phAcidId(acidType, concentration) {
  return `${acidType}-${Math.round(num(concentration))}`;
}
export function phAcidLabel(acidType, concentration) {
  const acid = PH_ACID_TYPES.find((entry) => entry.type === acidType);
  return `${acid ? acid.label : "\xC1cido"} ${Math.round(num(concentration) * 10) / 10}%`;
}
export const DEFAULT_PH_ACID = phAcidId(
  DEFAULT_PH_ACID_TYPE,
  PH_ACID_TYPES.find((entry) => entry.type === DEFAULT_PH_ACID_TYPE)
    .defaultConcentration,
);

const MASH_PH_TOLERANCE = 0.05,
  WATER_PH_TOLERANCE = 0.1;

function stagePhTolerance(stage) {
  return stage === "mash-water" || stage === "sparge-water"
    ? WATER_PH_TOLERANCE
    : MASH_PH_TOLERANCE;
}

function memoryBucketForStage(stage) {
  return stage === "mash" ? "mash" : "water";
}

export function phSlopeFromReadings(readings, volumeL) {
  const list = Array.isArray(readings) ? readings : [],
    volume = num(volumeL);
  if (volume <= 0) return null;
  let weightedSum = 0,
    weightTotal = 0;
  for (let index = 0; index < list.length - 1; index += 1) {
    const doseMl = num(list[index]?.doseMl),
      phDrop = num(list[index]?.ph) - num(list[index + 1]?.ph);
    if (doseMl <= 0 || phDrop <= 0.02) continue;
    const slopeSample = doseMl / (phDrop * volume),
      weight = 2 ** index;
    weightedSum += slopeSample * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : null;
}

export function phPriorFor(stage, memory, acidId = DEFAULT_PH_ACID) {
  const bucket = memoryBucketForStage(stage),
    entry = memory && memory.acidId === acidId ? memory[bucket] : null;
  return entry && num(entry.slope) > 0
    ? {
        slope: num(entry.slope),
        source: "memoria",
        spreadPct: num(entry.spreadPct),
        samples: num(entry.samples),
      }
    : {
        slope: PH_GENERIC_PRIORS[bucket],
        source: "prior",
        spreadPct: 0,
        samples: 0,
      };
}

function confidenceFactor({ source, spreadPct, gap }) {
  let factor = 0.6;
  return (
    source === "leitura" && (factor = 0.75),
    source === "memoria" &&
      (factor =
        0.75 - 0.25 * Math.max(0, Math.min(1, (num(spreadPct) - 10) / 30))),
    gap <= 0.3 && (factor = Math.min(factor, 0.5)),
    factor
  );
}

const roundToTenth = (value) => Math.round(value * 10) / 10;

export function phDoseSuggestion({
  stage,
  volumeL,
  currentPh,
  targetPh,
  readings = [],
  memory = null,
  acidId = DEFAULT_PH_ACID,
} = {}) {
  const targetConfig = PH_TARGETS[stage],
    target = targetPh !== void 0 ? num(targetPh) : num(targetConfig?.target, 0),
    volume = num(volumeL),
    current = num(currentPh);
  if (!target || volume <= 0 || current <= 0)
    return { doseMl: 0, slope: null, source: "prior" };
  const measuredSlope = phSlopeFromReadings(
      [...(Array.isArray(readings) ? readings : []), { ph: current }],
      volume,
    ),
    prior = phPriorFor(stage, memory, acidId),
    slope = measuredSlope ?? prior.slope,
    source = measuredSlope !== null ? "leitura" : prior.source,
    phGap = current - target;
  if (phGap <= stagePhTolerance(stage)) return { doseMl: 0, slope, source };
  const confidence = confidenceFactor({
      source,
      spreadPct: prior.spreadPct,
      gap: phGap,
    }),
    dose = roundToTenth(confidence * phGap * slope * volume);
  return { doseMl: Math.max(0, dose), slope, source };
}

export function spargeDoseFromWaterSlope({
  slope,
  volumeL,
  currentPh,
  targetPh = 5.5,
} = {}) {
  const waterSlope = num(slope),
    volume = num(volumeL),
    phGap = num(currentPh) - num(targetPh);
  return waterSlope <= 0 || volume <= 0 || phGap <= WATER_PH_TOLERANCE
    ? { doseMl: 0 }
    : { doseMl: Math.max(0, roundToTenth(0.85 * phGap * waterSlope * volume)) };
}

export function updatePhMemory(
  memory,
  { kind, slope, acidId = DEFAULT_PH_ACID, at } = {},
) {
  const newSlope = num(slope);
  if (!kind || newSlope <= 0) return memory || null;
  const updated =
    memory && memory.acidId === acidId ? { ...memory } : { acidId };
  updated.acidId = acidId;
  const existing = updated[kind],
    timestamp = String(at || new Date().toISOString());
  if (!existing || !(num(existing.slope) > 0))
    return (
      (updated[kind] = {
        slope: newSlope,
        samples: 1,
        spreadPct: 0,
        lastAt: timestamp,
      }),
      updated
    );
  const blendedSlope = 0.65 * newSlope + 0.35 * num(existing.slope),
    deviationPct =
      (Math.abs(newSlope - num(existing.slope)) / blendedSlope) * 100;
  return (
    (updated[kind] = {
      slope: blendedSlope,
      samples: num(existing.samples, 0) + 1,
      spreadPct: Math.min(
        100,
        0.5 * deviationPct + 0.5 * num(existing.spreadPct),
      ),
      lastAt: timestamp,
    }),
    updated
  );
}

export function isPhLogSane(log) {
  return !log || typeof log != "object" || Array.isArray(log)
    ? !1
    : PH_STAGES.every((stage) => {
        const entry = log[stage];
        return (
          entry && typeof entry == "object" && Array.isArray(entry.readings)
        );
      });
}

export function sanitizePhLog(log = {}) {
  const source =
      log && typeof log == "object" && !Array.isArray(log) ? log : {},
    result = {};
  return (
    PH_STAGES.forEach((stage) => {
      const entry =
          source[stage] && typeof source[stage] == "object"
            ? source[stage]
            : {},
        readings = (Array.isArray(entry.readings) ? entry.readings : [])
          .map((reading) => ({
            ph: num(reading?.ph),
            doseMl: Math.max(0, num(reading?.doseMl)),
            at: String(reading?.at || ""),
          }))
          .filter((reading) => reading.ph > 0 && reading.ph < 14);
      result[stage] = {
        readings,
        skipped: !!entry.skipped,
        learnedAt: String(entry.learnedAt || ""),
      };
    }),
    result
  );
}

export function phLogSummary(log) {
  const sane = isPhLogSane(log) ? log : sanitizePhLog(log);
  return PH_STAGES.map((stage) => {
    const entry = sane[stage],
      readings = entry.readings || [],
      totalMl = readings.reduce((sum, reading) => sum + num(reading.doseMl), 0),
      finalPh = readings.length ? readings[readings.length - 1].ph : null;
    return {
      stage,
      title: PH_STAGE_TITLES[stage] || stage,
      readings: readings.length,
      finalPh,
      totalMl: Math.round(totalMl * 10) / 10,
      skipped: !!entry.skipped,
    };
  }).filter((entry) => entry.readings > 0 || entry.skipped);
}
