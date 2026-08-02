// Client-side analysis engine derived from 48 ground-truth request/response pairs.
// Produces the same response structure that analysis-screen.js expects.

import {
  MALT_DESCRIPTORS,
  HOP_DESCRIPTORS,
  YEAST_PROFILES,
  HOP_OIL_RETENTION,
  STYLE_DB,
  STYLE_OPTIONS,
} from "./ingredient-db.js";
import { CONTROLS } from "./controls.js";
import {
  gravityEstimate,
  calculateIbu,
  abvBrewfather,
} from "../engine.js";

// ─── OLS regression coefficients per control ────────────────────────────────
// Features: [intercept, og_pts, srm, ibu, abv, mash_temp, is_lager,
//             crystal_frac, roast_frac, wheat_frac, late_frac, wp_frac, dry_frac]
const CTRL_COEFFS = {
  maltAroma: [
    -2.371, -0.0143, 0.1292, 0.0058, 0.2758, 0.0344, 0.3718, 0, 0, 0, 0.3214, 0,
    -1.4963,
  ],
  hopAroma: [
    2.834, -0.0133, -0.0176, 0.0226, 0.0093, -0.0293, 0.7518, 0, 0, 0, 0.5651,
    0, 7.7823,
  ],
  fermentationAroma: [
    6.584, -0.0359, 0, -0.011, 0.4248, -0.0559, -1.2767, 0, 0, 0, -0.4442, 0,
    0.6188,
  ],
  color: [
    -0.705, 0, 0.192, 0.0059, 0.0227, 0, 0.169, 0, 0, 0, 0.1159, 0, -0.3344,
  ],
  clarity: [
    1.04, 0, 0.0437, -0.0079, 0.0405, -0.013, -0.2927, 0, 0, 0, -0.3725, 0,
    -0.2826,
  ],
  foamFormation: [
    2.188, -0.0084, -0.0246, -0.0074, -0.041, 0.027, -0.0664, 0, 0, 0, -0.24, 0,
    1.6759,
  ],
  retention: [
    2.834, -0.0092, -0.0443, 0, -0.0188, 0.0119, -0.4225, 0, 0, 0, -0.9499, 0,
    0.6591,
  ],
  maltFlavor: [
    -1.665, 0.01, 0.1357, 0.017, 0.0709, 0.0179, 0.2508, 0, 0, 0, 0.129, 0,
    -2.63,
  ],
  hopFlavor: [
    3.543, -0.0135, -0.0135, 0.0227, -0.0193, -0.0375, 0.7578, 0, 0, 0, 0.4821,
    0, 7.881,
  ],
  fermentationFlavor: [
    6.584, -0.0359, 0, -0.011, 0.4248, -0.0559, -1.2767, 0, 0, 0, -0.4442, 0,
    0.6188,
  ],
  bitterness: [
    1.636, -0.0783, 0.0327, 0.1379, 0.0502, 0.0058, -0.2119, 0, 0, 0, 0.1932, 0,
    -1.5362,
  ],
  balance: [
    -1.38, 0.005, 0.0465, -0.0827, 0.3229, 0.0461, 0.1835, 0, 0, 0, 0.1913, 0,
    0.7919,
  ],
  finish: [
    -1.419, 0.1739, 0.0094, 0.0057, -1.3705, 0.0147, 0.2271, 0, 0, 0, -0.0445,
    0, -0.5882,
  ],
  body: [
    -0.43, 0.1571, 0.0408, 0.0186, -1.2659, 0.0092, -0.319, 0, 0, 0, -0.5005, 0,
    -1.7033,
  ],
  warming: [
    -0.102, 0.0222, -0.0064, 0, 0.2351, -0.0113, -0.1736, 0, 0, 0, 0.0495, 0,
    0.3839,
  ],
  creaminess: [
    1.12, 0.0359, 0.0298, -0.0135, -0.2364, 0, -0.3295, 0, 0, 0, -0.4453, 0,
    1.107,
  ],
  astringency: [
    -0.006, 0, 0.006, 0, 0.0258, 0, -0.034, 0, 0, 0, -0.0204, 0, 0.1602,
  ],
};

const AXIS_COEFFS = {
  maltosidade: [
    -1.677, 0.0326, 0.0233, 0.0078, -0.0985, 0.0195, 0.0691, 0, 0, 0, 0.1171, 0,
    -1.9307,
  ],
  cor: [
    -2.194, -0.0564, 0.2291, 0.0362, 0.3102, 0.0362, -0.0304, 0, 0, 0, 0.254, 0,
    -2.5122,
  ],
  corpo: [
    -2.489, 0.0494, 0.0711, 0.0382, -0.5377, 0.0334, 0.3524, 0, 0, 0, -0.2855,
    0, -3.8212,
  ],
  atenuacao: [
    4.055, -0.0621, -0.0296, -0.019, 0.6168, -0.0517, -0.4114, 0, 0, 0, 0.0034,
    0, 2.1597,
  ],
  adstringencia: [
    -0.059, -0.0056, 0.0147, -0.0034, 0.0315, 0.0035, -0.0461, 0, 0, 0, -0.0701,
    0, 0.1378,
  ],
  turbidez: [
    0.412, -0.0108, -0.0144, -0.0125, 0.1313, 0.0024, -0.3656, 0, 0, 0, -0.3961,
    0, -0.5935,
  ],
};

// Thresholds for word labels on axes
const AXIS_WORDS = {
  maltosidade: [
    [0.8, "baixo"],
    [1.5, "médio-baixo"],
    [2.2, "médio"],
    [2.8, "médio-alto"],
    [Infinity, "alto"],
  ],
  cor: [
    [1, "muito baixo"],
    [2, "baixo"],
    [3, "médio"],
    [4, "alto"],
    [Infinity, "muito alto"],
  ],
  corpo: [
    [-0.5, "ralo"],
    [-0.2, "leve"],
    [0.2, "médio"],
    [0.5, "médio-alto"],
    [Infinity, "cheio"],
  ],
  atenuacao: [
    [-0.2, "baixo"],
    [0, "médio-baixo"],
    [0.2, "médio"],
    [0.5, "médio-alto"],
    [Infinity, "alto"],
  ],
  adstringencia: [
    [0.05, "baixo"],
    [0.15, "médio"],
    [Infinity, "alto"],
  ],
  turbidez: [
    [-0.5, "baixo"],
    [-0.1, "médio"],
    [Infinity, "alto"],
  ],
};

// Mash temp tag thresholds
const MASH_SACAR_ALTA = 67; // ≥ this → sacar-alta
const MASH_SACAR_BAIXA = 67; // < this → sacar-baixa
const MASH_BETAGLUC = 40; // ≤ this → betaglucanase
const MASH_FERUL = 44; // ≤ this → ferulico-liberado (also betagluc range)
const MASH_PROT = 53; // 45–55 → rest-proteico
const MASH_ACID = 38; // < 40 → rest-acido

// Boil time threshold for "fervura-curta"
const BOIL_CURTA_MAX_MIN = 20;

// g/L threshold for crystal dose classification
const CRYSTAL_ALTA_GL = 20;
const CRYSTAL_MEDIA_GL = 10;

// g/L threshold for roasted malt classification
const ROAST_ALTA_GL = 15;
const ROAST_MEDIA_GL = 8;

// Pitch rate below this → ferm-sub-inoculo
const PITCH_RATE_LOW = 0.6;

// ABV above this → ferm-alcool-superior risk (ale)
const ABV_FUSEL_RISK = 7.0;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ─── Helpers ────────────────────────────────────────────────────────────────

function evalLinear(coeffs, feats) {
  let s = 0;
  for (let i = 0; i < coeffs.length; i++) s += coeffs[i] * feats[i];
  return s;
}

function axisWord(axis, value) {
  const bands = AXIS_WORDS[axis];
  if (!bands) return "médio";
  for (const [thresh, word] of bands) {
    if (value < thresh) return word;
  }
  return bands[bands.length - 1][1];
}

function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hopOilRetentionPct(timeMin, isWhirlpool) {
  if (isWhirlpool) return 55; // warm-side; ~42–55% based on data
  if (timeMin === undefined || timeMin === null) return 55;
  const breakpoints = Object.keys(HOP_OIL_RETENTION)
    .map(Number)
    .sort((a, b) => a - b);
  for (const bp of breakpoints) {
    if (timeMin <= bp) return HOP_OIL_RETENTION[bp];
  }
  return HOP_OIL_RETENTION[breakpoints[breakpoints.length - 1]];
}

// Find best-match yeast profile by exact name then fuzzy
function resolveYeastProfile(yname) {
  if (!yname) return null;
  if (YEAST_PROFILES[yname]) return { ...YEAST_PROFILES[yname], _name: yname };
  const lower = yname.toLowerCase();
  // Fuzzy match on key substrings
  for (const [key, prof] of Object.entries(YEAST_PROFILES)) {
    if (
      lower.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lower)
    ) {
      return { ...prof, _name: key };
    }
  }
  // Family fallback from name keywords
  const isLager =
    /lager|bohemian|czech pil|fermolager|saflager|w3470|sy001/i.test(yname);
  const isWheat = /wheat|weizen|weiss|hefewei/i.test(yname);
  const isSaison = /saison|farmhouse/i.test(yname);
  if (isLager)
    return {
      lo: 9,
      hi: 15,
      family: "lager",
      tags: ["tiol-liberacao-baixa"],
      _name: yname,
    };
  if (isWheat)
    return {
      lo: 18,
      hi: 24,
      family: "wheat",
      tags: [
        "aroma-emergente-condimentado",
        "levedura-ester-banana",
        "pof-4vg",
      ],
      _name: yname,
    };
  if (isSaison)
    return {
      lo: 18,
      hi: 24,
      family: "saison",
      tags: ["levedura-ester-banana", "sta1-superatenua"],
      _name: yname,
    };
  return {
    lo: 18,
    hi: 24,
    family: "ale",
    tags: ["levedura-ester-banana", "tiol-liberacao-baixa"],
    _name: yname,
  };
}

function fermentableGPerL(ferm, batchVolumeL) {
  return (ferm.amountKg * 1000) / (batchVolumeL || 20);
}

function classifyFermentable(ferm) {
  const n = (ferm.name || "").toLowerCase();
  const colorL = ferm.colorLovibond || 0;
  if (/ácido|acidulado|acid malt|acid/.test(n)) return "acid";
  if (
    /sugar|candi|syrup|mel|honey|sucrose|glucose|dextrose|maltose|melaço|mascavo|corn sugar/.test(
      n,
    )
  )
    return "sugar";
  if (/black|chocolate|roast|carafa|cara black|midnight|coffee/.test(n))
    return "roast";
  if (
    colorL >= 25 ||
    /crystal|caramunich|caravienna|caramel|carabohemian|caramalt|special b|special w|melanoidin|biscuit|amber|brown|carafoam|carahell|carared|light crystal|cara \d/.test(
      n,
    )
  )
    return "crystal";
  if (/wheat|weizen|trigo|rye|oat|aveia|centeio|spelt|rice|milho|corn/.test(n))
    return "wheat";
  if (/pilsner|pilsen|pils/.test(n)) return "pilsner";
  if (/munich|münchen|vienna|vienne/.test(n)) return "kilned";
  return "base";
}

// Build stochastic distribution from a continuous value
function valueToDistribution(value, maxVal, stdFactor = 0.25) {
  const bins = maxVal + 1;
  const std = Math.max(0.3, maxVal * stdFactor);
  const dist = new Array(bins).fill(0);
  let total = 0;
  for (let i = 0; i < bins; i++) {
    const x = i - value;
    const w = Math.exp((-x * x) / (2 * std * std));
    dist[i] = w;
    total += w;
  }
  return dist.map((v) => Math.round((v / total) * 200) / 200);
}

function distributionMode(dist) {
  let best = 0;
  for (let i = 1; i < dist.length; i++) {
    if (dist[i] > dist[best]) best = i;
  }
  return best;
}

function distributionMean(dist, maxVal) {
  let s = 0;
  let total = 0;
  for (let i = 0; i < dist.length; i++) {
    s += i * dist[i];
    total += dist[i];
  }
  return total > 0 ? s / total : maxVal / 2;
}

function distributionPercentile(dist, p) {
  const total = dist.reduce((a, b) => a + b, 0);
  let cum = 0;
  for (let i = 0; i < dist.length; i++) {
    cum += dist[i] / total;
    if (cum >= p) return i;
  }
  return dist.length - 1;
}

// Compute stochastic control entry from regression value
function makeControl(key, rawValue, section, maxVal, labels) {
  const clamped = clamp(rawValue, 0, maxVal);
  const dist = valueToDistribution(clamped, maxVal);
  const mode = distributionMode(dist);
  const mean = distributionMean(dist, maxVal);
  const p10 = distributionPercentile(dist, 0.1);
  const p50 = distributionPercentile(dist, 0.5);
  const p90 = distributionPercentile(dist, 0.9);
  const std = Math.sqrt(
    dist.reduce((acc, v, i) => acc + v * (i - mean) ** 2, 0),
  );

  return {
    key,
    section,
    max: maxVal,
    labels: labels || [],
    distribution: dist,
    mode,
    interval80: {
      lo: p10,
      hi: p90,
      mass: dist.slice(p10, p90 + 1).reduce((a, b) => a + b, 0),
    },
    assumed: false,
    censoring: {
      floor: dist[0] || 0,
      ceiling: dist[maxVal] || 0,
      status: null,
    },
    style: null,
  };
}

// Inject style band info into a forecast control
function injectStyleBand(ctrl, styleEntry) {
  if (!styleEntry) return ctrl;
  const band = styleEntry.bands && styleEntry.bands[ctrl.key];
  if (!band) return ctrl;
  const [lo, hi, ideal] = band;
  const maxVal = ctrl.max;
  const dist = ctrl.distribution;
  const below = dist.slice(0, lo).reduce((a, b) => a + b, 0);
  const inside = dist.slice(lo, hi + 1).reduce((a, b) => a + b, 0);
  const above = dist.slice(hi + 1).reduce((a, b) => a + b, 0);
  return {
    ...ctrl,
    style: {
      below,
      inside,
      above,
      band: [lo, hi, ideal],
    },
  };
}

// ─── Step builders ───────────────────────────────────────────────────────────

function buildConfigStep(draft, efficiencyPct) {
  const fired = [];
  const effects = [];
  if (efficiencyPct < 70) {
    fired.push("efic-baixa-maltosidade");
    effects.push({
      text: "Rendimento baixo potencializa a maltosidade, o perfil sensorial do malte e a cor.",
      tone: "neutro",
      confidence: "média",
    });
  }
  return {
    id: "config",
    kind: "config",
    titleKey: "Configuração",
    effects,
    fired,
  };
}

function buildFermentableSteps(fermentables, batchVolumeL) {
  return fermentables
    .filter((f) => f.use === "Mostura" || !f.use)
    .map((f) => {
      const gPerL =
        Math.round(((f.amountKg * 1000) / (batchVolumeL || 20)) * 10) / 10;
      const cat = classifyFermentable(f);
      const fired = [];
      const effects = [];
      const nameSlug = "ferm-" + slugify(f.name || "unknown");

      if (cat === "pilsner" || cat === "base") {
        fired.push(
          cat === "pilsner" ? "malte-base-pilsen" : "malte-base-neutro",
        );
        effects.push(
          cat === "pilsner"
            ? {
                text: "Malte Pilsen: pão leve e cereal cru leve — base limpa.",
                tone: "bom",
                confidence: "alta",
              }
            : {
                text: "Malte base pálido: dulçor de malte leve e limpo.",
                tone: "bom",
                confidence: "média",
              },
        );
      } else if (cat === "kilned") {
        fired.push("malte-familia-kilned");
      } else if (cat === "crystal") {
        const level =
          gPerL >= CRYSTAL_ALTA_GL
            ? "alta"
            : gPerL >= CRYSTAL_MEDIA_GL
              ? "média"
              : "baixa";
        fired.push("cristal-caramel60", `cristal-caramel60:${level}`);
        const crystalTexts = {
          baixa: {
            text: "Caramelo em dose baixa: leve toque de toffee e cor dourada.",
            tone: "bom",
            confidence: "média",
          },
          média: {
            text: "Caramelo em dose média: caramelo e toffee pronunciados, corpo redondo.",
            tone: "bom",
            confidence: "alta",
          },
          alta: {
            text: "Caramelo em dose alta: caramelo intenso, uva passa e mais corpo — tende a atenuar menos.",
            tone: "alerta",
            confidence: "alta",
          },
        };
        effects.push(crystalTexts[level]);
      } else if (cat === "roast") {
        const level =
          gPerL >= ROAST_ALTA_GL
            ? "alta"
            : gPerL >= ROAST_MEDIA_GL
              ? "média"
              : "baixa";
        fired.push("torrado-chocolate", `torrado-chocolate:${level}`);
        const roastTexts = {
          baixa: {
            text: "Chocolate em dose baixa: cor e um toque de cacau / chocolate ao leite.",
            tone: "bom",
            confidence: "média",
          },
          média: {
            text: "Chocolate em dose média: chocolate escuro e cacau nítidos.",
            tone: "bom",
            confidence: "alta",
          },
          alta: {
            text: "Chocolate em dose alta: chocolate amargo e café, com risco de adstringência torrada.",
            tone: "alerta",
            confidence: "média",
          },
        };
        effects.push(roastTexts[level]);
      } else if (cat === "wheat") {
        fired.push("malte-familia-base");
        if (/oat|aveia/.test(f.name.toLowerCase())) {
          fired.push("adjunto-betaglucano");
          effects.push({
            text: "β-glucanos: maciez e sensação de corpo, mas turbidez e efeito negativo na espuma.",
            tone: "alerta",
            confidence: "média",
          });
        }
      } else if (cat === "sugar") {
        fired.push("malte-familia-acucar");
      } else {
        fired.push("malte-familia-base");
      }

      return {
        id: nameSlug,
        kind: "fermentable",
        titleData: f.name,
        gPerL,
        effects,
        fired,
      };
    });
}

function buildMashSteps(mashSteps) {
  if (!Array.isArray(mashSteps) || !mashSteps.length) return [];
  return mashSteps
    .filter((s) => typeof s === "object")
    .map((s) => {
      const t = s.temperatureC;
      const fired = [];
      const effects = [];

      if (t <= MASH_ACID) {
        fired.push("rest-acido");
        effects.push({
          text: "Descanso ácido/proteico baixo: pouca ação enzimática, leve ajuste de pH.",
          tone: "neutro",
          confidence: "baixa",
        });
      } else if (t <= MASH_FERUL) {
        fired.push("betaglucanase", "ferulico-liberado");
        effects.push(
          {
            text: "β-glucanase quebra os β-glucanos — reduz espessura e turbidez.",
            tone: "bom",
            confidence: "alta",
          },
          {
            text: "Libera ácido ferúlico dos maltes — precursor de 4-VG na fermentação.",
            tone: "neutro",
            confidence: "média",
          },
        );
      } else if (t <= MASH_PROT) {
        fired.push("rest-proteico");
        effects.push({
          text: "Descanso proteico: mexe em espuma e clareza; use com parcimônia.",
          tone: "neutro",
          confidence: "baixa",
        });
      } else if (t < MASH_SACAR_ALTA) {
        fired.push("sacar-baixa");
        effects.push({
          text: "Sacarificação baixa favorece a β-amilase — mosto mais fermentável, corpo mais seco.",
          tone: "neutro",
          confidence: "média",
        });
      } else if (t < 77) {
        fired.push("sacar-alta");
        effects.push({
          text: "Sacarificação alta favorece a α-amilase — mais dextrinas, corpo e menos atenuação.",
          tone: "neutro",
          confidence: "média",
        });
      } else {
        effects.push({
          text: "Fora das bandas enzimáticas mapeadas — sem efeito enzimático relevante.",
          tone: "neutro",
          confidence: "baixa",
        });
      }

      return {
        id: `mash-${t}`,
        kind: "mash",
        titleData: s.name || `${t}°C`,
        titleMeta: `${t}°C`,
        effects,
        fired,
      };
    });
}

function buildHopSteps(hops, whirlpoolTempC) {
  if (!Array.isArray(hops) || !hops.length) return [];
  return hops.map((h) => {
    const use = (h.use || "").toLowerCase();
    const nameSlug = "hop-" + slugify(h.name || "");
    const timeMin = h.timeMin ?? h.time ?? 60;
    const isDryHop = /dry|seco/.test(use);
    const isWhirlpool = /whirl|flame|hopback|hopstand/.test(use);
    const fired = [];
    const effects = [];

    if (isDryHop) {
      fired.push("wp-oleos-sobreviventes");
      effects.push({
        text: "Dry hop preserva mirceno e todo o óleo — máximo de potência aromática, mas tarde demais para a levedura converter geraniol em citronelol.",
        tone: "bom",
        confidence: "média",
      });
    } else if (isWhirlpool) {
      const wt = whirlpoolTempC || 90;
      const pct = Math.round(55 - (wt - 60) * 0.5);
      fired.push("wp-oleos-sobreviventes");
      effects.push({
        text: `Whirlpool a ${wt}°C: sobra cerca de ${pct}% do óleo aromático — quanto mais perto da fervura, menos sobra. E este geraniol a levedura ainda alcança.`,
        tone: "bom",
        confidence: "média",
        data: { t: wt, pct, min: timeMin },
      });
    } else {
      // Kettle hop
      if (timeMin >= 30) {
        fired.push("kettle-aroma");
        effects.push({
          text: "Fervura longa: o óleo volátil evapora, mas humuleno e cariofileno OXIDAM — sobra um aroma condimentado e amadeirado, o caráter 'lager'.",
          tone: "neutro",
          confidence: "média",
        });
      } else if (timeMin <= BOIL_CURTA_MAX_MIN) {
        const pct = hopOilRetentionPct(timeMin, false);
        fired.push("fervura-curta-preserva-oleo", "kettle-aroma");
        effects.push(
          {
            text: `Adição a ${timeMin} min de fervura: sobra cerca de ${pct}% do óleo — pouco, mas não zero.`,
            tone: "bom",
            confidence: "média",
            data: { min: timeMin, pct, t: timeMin },
          },
          {
            text: "Adição de fervura: parte do óleo evapora; o que fica é o caráter condimentado dos oxigenados.",
            tone: "neutro",
            confidence: "média",
          },
        );
      } else {
        fired.push("kettle-aroma");
        effects.push({
          text: "Adição de fervura: parte do óleo evapora; o que fica é o caráter condimentado dos oxigenados.",
          tone: "neutro",
          confidence: "média",
        });
      }
    }

    return {
      id: nameSlug,
      kind: "hop",
      titleData: h.name,
      titleUse: h.use,
      effects,
      fired,
    };
  });
}

function buildFermentStep(yeastProfile, fermTemp, ogPoints, pitchRate) {
  if (!yeastProfile) {
    return {
      id: "ferment",
      kind: "ferment",
      titleKey: "Fermentação",
      titleData: "Levedura",
      effects: [],
      fired: [],
    };
  }
  const { lo, hi } = yeastProfile;
  const fired = [...yeastProfile.tags];
  const effects = [];

  // Temperature position
  if (fermTemp < lo) {
    fired.push("ferm-temp-abaixo");
    effects.push({
      text: `${fermTemp}°C está ABAIXO da faixa da cepa (${lo}–${hi}°C): o éster é contido, mas não some — fica um frutado discreto.`,
      tone: "neutro",
      confidence: "alta",
      data: { t: fermTemp, lo, hi },
    });
  } else if (fermTemp > hi) {
    fired.push("ferm-temp-acima");
    effects.push({
      text: `${fermTemp}°C está ACIMA da faixa da cepa (${lo}–${hi}°C): éster e álcool superior sobem bastante.`,
      tone: "alerta",
      confidence: "alta",
      data: { t: fermTemp, lo, hi },
    });
  } else {
    fired.push("ferm-temp-na-faixa");
    effects.push({
      text: `${fermTemp}°C cai na faixa da cepa (${lo}–${hi}°C) — o éster fica no meio do potencial dela.`,
      tone: "neutro",
      confidence: "alta",
      data: { t: fermTemp, lo, hi },
    });
  }

  // Ester / aroma notes
  const isFruited =
    fired.includes("levedura-ester-banana") ||
    fired.includes("aroma-emergente-citrico");
  const isHighDensity = ogPoints > 65;
  if (isFruited && isHighDensity) {
    effects.push({
      text: "Fermentação frutada e intensa — a densidade alta puxa ainda mais éster.",
      tone: "bom",
      confidence: "média",
    });
  } else if (isFruited) {
    effects.push({
      text: "Fermentação com ésteres frutados.",
      tone: "bom",
      confidence: "média",
    });
  }

  // POF+ notes
  if (fired.includes("pof-4vg") && fired.includes("ferulico-liberado")) {
    effects.push({
      text: "Levedura POF+ encontra o ácido ferúlico e produz 4-VG (cravo, condimentado).",
      tone: "bom",
      confidence: "alta",
    });
  }

  // Biotransformation
  if (fired.includes("biotransf-citronelol")) {
    effects.push({
      text: "A levedura reduz o geraniol da parte quente a citronelol (cítrico/floral) — nota que o lúpulo sozinho não daria, e que o dry hop tardio não produz.",
      tone: "bom",
      confidence: "média",
    });
  }

  // Tiol note
  if (fired.includes("tiol-liberacao-baixa")) {
    effects.push({
      text: "Esta cepa tem baixa atividade de β-liase: pode liberar traços de tiol, mas não foi selecionada para essa biotransformação.",
      tone: "neutro",
      confidence: "baixa",
    });
  }

  // Fusel risk
  if (
    (fermTemp > hi || isHighDensity) &&
    fired.includes("ferm-alcool-superior")
  ) {
    effects.push({
      text: "Densidade alta e fermentação quente puxam álcoois superiores — calor alcoólico e risco de solvente se a temperatura subir mais.",
      tone: "alerta",
      confidence: "média",
    });
  }

  // Low pitch rate
  if (pitchRate && pitchRate < PITCH_RATE_LOW) {
    fired.push("ferm-sub-inoculo");
    effects.push({
      text: `Inóculo de ${pitchRate} M céls/mL/°P é baixo para esta densidade — levedura estressada produz MAIS éster e álcool superior.`,
      tone: "alerta",
      confidence: "média",
      data: { rate: pitchRate },
    });
  }

  // STA1
  if (fired.includes("sta1-superatenua")) {
    effects.push({
      text: "Cepa STA1+ (diastaticus): atenua além do previsto — final bem seco e mais fenol/apimentado.",
      tone: "alerta",
      confidence: "média",
    });
  }

  return {
    id: "ferment",
    kind: "ferment",
    titleKey: "Fermentação",
    titleData: yeastProfile._name,
    effects: effects.slice(0, 5),
    fired: [...new Set(fired)],
  };
}

// ─── Descriptor builder ──────────────────────────────────────────────────────

function buildDescriptors(fermentables, hops, distribution, batchVolumeL) {
  const seen = new Map(); // key → {entry, totalFrac, sources}
  const totalKg = fermentables.reduce((s, f) => s + (f.amountKg || 0), 0);

  for (const f of fermentables) {
    if (f.use && f.use !== "Mostura") continue;
    const descs = MALT_DESCRIPTORS[f.name];
    if (!descs) continue;
    const frac = totalKg > 0 ? f.amountKg / totalKg : 0;
    for (const d of descs) {
      const k = `malte:${d.key}`;
      if (!seen.has(k)) {
        seen.set(k, {
          ...d,
          familyId: "malte",
          family: "Malte",
          totalFrac: 0,
          sources: [],
        });
      }
      const entry = seen.get(k);
      entry.totalFrac += frac;
      if (!entry.sources.includes(f.name)) entry.sources.push(f.name);
    }
  }

  // Hop descriptors — only visible hops (not 100% bittering kettle)
  const aromaHops = hops.filter((h) => {
    const use = (h.use || "").toLowerCase();
    const timeMin = h.timeMin ?? h.time ?? 60;
    return /whirl|flame|hopback|hopstand|dry|seco/.test(use) || timeMin <= 15;
  });
  const totalAromaG = aromaHops.reduce(
    (s, h) => s + (h.amountG || h.amount || 0),
    0,
  );
  for (const h of aromaHops) {
    const descs = HOP_DESCRIPTORS[h.name];
    if (!descs) continue;
    const frac =
      totalAromaG > 0 ? (h.amountG || h.amount || 0) / totalAromaG : 0;
    for (const d of descs) {
      const k = `lupulo:${d.key}`;
      if (!seen.has(k)) {
        seen.set(k, {
          ...d,
          familyId: "lupulo",
          family: "Lúpulo",
          totalFrac: 0,
          sources: [],
        });
      }
      const entry = seen.get(k);
      entry.totalFrac += frac;
      if (!entry.sources.includes(h.name)) entry.sources.push(h.name);
    }
  }

  const RUNS = 200;
  return [...seen.entries()]
    .filter(([, e]) => e.totalFrac > 0.02)
    .sort(([, a], [, b]) => b.totalFrac - a.totalFrac)
    .map(([key, e]) => {
      const strength = Math.min(1, e.totalFrac * 2);
      const rawMode = clamp(strength * 5, 0, 5);
      const dist = valueToDistribution(rawMode, 5);
      const mode = distributionMode(dist);
      const p10 = distributionPercentile(dist, 0.1);
      const p90 = distributionPercentile(dist, 0.9);
      const presence = e.totalFrac > 0.15 ? 1 : e.totalFrac > 0.05 ? 0.9 : 0.7;
      return {
        key,
        id: e.key,
        family: e.family,
        familyId: e.familyId,
        label: e.label,
        group: e.group,
        known: true,
        unmapped: false,
        modeled: true,
        sources: e.sources,
        scenarioDistribution: dist,
        presentCount: Math.round(RUNS * presence),
        scenarioPresence: presence,
        mode,
        interval80: {
          lo: p10,
          hi: p90,
          mass: dist.slice(p10, p90 + 1).reduce((a, b) => a + b, 0),
        },
        censoring: { floor: dist[0] || 0, ceiling: dist[5] || 0, status: null },
        calibration: "uncalibrated",
        perceptionDistribution: null,
        detection: null,
        perceptionMode: null,
        perceptionInterval80: null,
        support:
          e.totalFrac > 0.5 ? "alto" : e.totalFrac > 0.2 ? "médio" : "baixo",
        typicalOfStyle: false,
      };
    });
}

// ─── Malt perception (for K() in analysis-screen) ────────────────────────────

function buildMaltPerception(fermentables, batchVolumeL) {
  const totalKg = fermentables.reduce((s, f) => s + (f.amountKg || 0), 0);
  const perceptions = [];

  for (const f of fermentables) {
    if (f.use && f.use !== "Mostura") continue;
    const descs = MALT_DESCRIPTORS[f.name];
    if (!descs || !descs.length) continue;
    const frac = totalKg > 0 ? f.amountKg / totalKg : 0;
    for (const d of descs.slice(0, 3)) {
      perceptions.push({
        d: d.label,
        forca: Math.round(frac * 100) / 100,
        from: [f.name],
      });
    }
  }

  return perceptions.sort((a, b) => b.forca - a.forca).slice(0, 8);
}

// ─── Counterfactual comparisons ───────────────────────────────────────────────

function buildComparisons(draft, ctx, baseControlDists, seed) {
  const ferms = (draft.fermentables || []).filter(
    (f) => f.use === "Mostura" || !f.use,
  );
  const hops = draft.hops || [];
  const RUNS = 200;

  const mutations = [
    {
      type: "fermentableAmount",
      index: 0,
      deltaPct: 10,
    },
    {
      type: "hopAmount",
      // pick last hop (most likely aromatic)
      index: Math.max(0, hops.length - 1),
      deltaPct: 10,
    },
    {
      type: "mashTemperature",
      index: 0,
      delta: 1,
    },
  ];

  return mutations
    .map((mut) => {
      let applied;
      let modFeats = null;

      if (mut.type === "fermentableAmount") {
        const ferm = ferms[mut.index];
        if (!ferm) return null;
        const before = ferm.amountKg;
        const after = before * (1 + mut.deltaPct / 100);
        applied = {
          type: mut.type,
          index: mut.index,
          field: "amountKg",
          before,
          after,
          label: ferm.name,
        };
        const extraKg = after - before;
        const ogDelta =
          (extraKg * (ferm.ppg || 38) * 0.264172) / (draft.batchVolumeL || 20);
        modFeats = {
          og_pts_delta: ogDelta,
          srm_delta: 0,
          crystal_frac_delta: 0,
        };
      } else if (mut.type === "hopAmount") {
        const hop = hops[mut.index];
        if (!hop) return null;
        const before = hop.amountG || hop.amount || 0;
        const after = before * (1 + mut.deltaPct / 100);
        applied = {
          type: mut.type,
          index: mut.index,
          field: "amountG",
          before,
          after,
          label: hop.name,
        };
        modFeats = { ibu_delta: (after - before) * 0.03, late_frac_delta: 0 };
      } else if (mut.type === "mashTemperature") {
        const mashSteps = draft.mash || [];
        const sacStep = mashSteps.find(
          (s) => s && s.temperatureC >= 62 && s.temperatureC < 77,
        );
        if (!sacStep) return null;
        const before = sacStep.temperatureC;
        const after = before + (mut.delta || 1);
        applied = {
          type: mut.type,
          index: mut.index,
          field: "temperatureC",
          before,
          after,
          label: sacStep.name || "Mostura",
        };
        modFeats = { mash_temp_delta: after - before };
      }

      if (!applied || !modFeats) return null;

      // Compute per-control deltas
      const controlDeltas = CONTROLS.map((ctrl) => {
        const baseDistEntry = baseControlDists[ctrl.key];
        if (!baseDistEntry)
          return {
            key: ctrl.key,
            beforeMode: null,
            afterMode: null,
            distributionDelta: null,
            insideBefore: null,
            insideAfter: null,
            insideDelta: null,
          };
        const baseDist = baseDistEntry.distribution;
        const baseMode = baseDistEntry.mode;

        // Small perturbation to model value
        let valueDelta = 0;
        const coeffs = CTRL_COEFFS[ctrl.key];
        if (coeffs && modFeats.og_pts_delta)
          valueDelta += coeffs[1] * (modFeats.og_pts_delta * 10);
        if (coeffs && modFeats.ibu_delta)
          valueDelta += coeffs[3] * modFeats.ibu_delta;
        if (coeffs && modFeats.mash_temp_delta)
          valueDelta += coeffs[5] * modFeats.mash_temp_delta;

        if (Math.abs(valueDelta) < 0.05) {
          return {
            key: ctrl.key,
            beforeMode: baseMode,
            afterMode: baseMode,
            distributionDelta: new Array(baseDist.length).fill(0),
            insideBefore: 0,
            insideAfter: 0,
            insideDelta: 0,
          };
        }

        const baseVal = distributionMean(baseDist, ctrl.max);
        const newVal = clamp(baseVal + valueDelta, 0, ctrl.max);
        const newDist = valueToDistribution(newVal, ctrl.max);
        const distDelta = baseDist.map(
          (v, i) => Math.round((newDist[i] - v) * 1000) / 1000,
        );

        return {
          key: ctrl.key,
          beforeMode: baseMode,
          afterMode: distributionMode(newDist),
          distributionDelta: distDelta,
          insideBefore: 0,
          insideAfter: 0,
          insideDelta: 0,
        };
      });

      return {
        schema: "beer-school-sensory-counterfactual/v1",
        seed,
        runs: RUNS,
        mutation: {
          type: mut.type,
          index: mut.index,
          deltaPct: mut.deltaPct || mut.delta,
        },
        applied,
        controlDeltas,
        descriptorDeltas: [],
        descriptorChanges: [],
      };
    })
    .filter(Boolean);
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export function runLocalAnalysis({ draft, seed = 1, styleSlug }) {
  const fermentables = draft.fermentables || [];
  const hops = draft.hops || [];
  const yeasts = draft.yeasts || [{}];
  const mashSteps = draft.mash || [];
  const fermSteps = draft.fermentation || [];
  const batchVolumeL = draft.batchVolumeL || 20;
  const boilTimeMin = draft.boilTimeMin || 60;
  const whirlpoolTempC = draft.whirlpoolTemperatureC || 90;
  const efficiencyPct =
    draft.mashEfficiencyPct || draft.efficiencyPct || 75;

  // ── Derived context — use engine.js estimators for accurate values ─────────
  // draft.fermentables use `when` ("Fervura"/"Fermentação") not `use` ("Mostura").
  // gravityEstimate expects use="Mostura" to apply mash efficiency.
  // draft also lacks `ppg`; derive it from yieldPct × PPG_100 (46 pts/lb/gal at 100%).
  const PPG_100 = 46;
  const fermsForGravity = fermentables.map((f) => ({
    ...f,
    use: f.when === "Fermentação" ? "Fermentação" : "Mostura",
    ppg: ((f.yieldPct ?? 78) / 100) * PPG_100,
  }));
  const gravProps = { targetVolumeL: batchVolumeL, mashEfficiencyPct: efficiencyPct };
  const gravResult = gravityEstimate(fermsForGravity, gravProps);
  const ogEst = gravResult.og || 1.05;
  const ogPoints = (ogEst - 1) * 1000;

  // FG from first yeast attenuation, else 75% apparent
  const attenPct = (yeasts[0] || {}).attenuationPct || 75;
  const fg = 1 + (ogEst - 1) * (1 - attenPct / 100);

  const abv = abvBrewfather(ogEst, fg);

  // IBU via Tinseth (hops in draft already have timeMin and alphaAcidPct)
  const preBoilSg = 1 + (ogPoints * 1.1) / 1000;
  const ibu = calculateIbu(hops, ogEst, preBoilSg, batchVolumeL) || 0;

  // SRM via Morey (draft fermentables use colorEbc; convert to Lovibond)
  const gallons = Math.max(0.1, batchVolumeL / 3.78541);
  const mcu =
    fermentables.reduce((s, f) => {
      const lov = f.colorLovibond ?? (f.colorEbc ? f.colorEbc / 1.97 : 0);
      return s + (f.amountKg || 0) * 2.20462 * lov;
    }, 0) / gallons;
  const srmRaw = mcu > 0 ? 1.4922 * Math.pow(mcu, 0.6859) : 5;

  const context = {
    ogPlato: ogPoints / 4,
    srm: srmRaw,
    ibu,
    ogPoints,
    fg,
    abv,
    pitchRate:
      draft.pitchRate ||
      (draft.yeastAmount
        ? draft.yeastAmount / (ogPoints * 0.1 * batchVolumeL)
        : 0.6),
  };

  // ── Recipe fractions ─────────────────────────────────────────────────────
  const mashFerms = fermentables.filter((f) => f.use === "Mostura" || !f.use);
  const totalKg = mashFerms.reduce((s, f) => s + (f.amountKg || 0), 0);

  const totalHopG = hops.reduce((s, h) => s + (h.amountG || h.amount || 0), 0);
  let lateG = 0,
    wpG = 0,
    dryG = 0;
  for (const h of hops) {
    const use = (h.use || "").toLowerCase();
    const amt = h.amountG || h.amount || 0;
    if (/dry|seco/.test(use)) dryG += amt;
    else if (/whirl|flame|hopback|hopstand/.test(use)) wpG += amt;
    else if ((h.timeMin ?? h.time ?? 60) <= 15) lateG += amt;
  }
  const lateFrac = totalHopG > 0 ? lateG / totalHopG : 0;
  const wpFrac = totalHopG > 0 ? wpG / totalHopG : 0;
  const dryFrac = totalHopG > 0 ? dryG / totalHopG : 0;

  let isLager = 0;
  const yname = (yeasts[0] || {}).name || "";
  if (/lager|bohemian|czech pil|fermolager|saflager|w3470|sy001/i.test(yname))
    isLager = 1;

  const features = [
    1,
    ogPoints,
    srmRaw,
    ibu,
    abv,
    mashSteps.length
      ? (() => {
          const sac = [...mashSteps]
            .reverse()
            .find((s) => s && s.temperatureC < 78);
          return sac ? sac.temperatureC : 67;
        })()
      : 67,
    isLager,
    0,
    0,
    0,
    lateFrac,
    wpFrac,
    dryFrac,
  ];

  // ── Regression controls ──────────────────────────────────────────────────
  const CTRL_META = Object.fromEntries(CONTROLS.map((c) => [c.key, c]));
  const baseControlDists = {};

  const controlsArr = CONTROLS.map((ctrl) => {
    const coeffs = CTRL_COEFFS[ctrl.key];
    let rawValue;

    if (ctrl.key === "carbonation") {
      rawValue = 2;
    } else if (coeffs) {
      rawValue = evalLinear(coeffs, features);
    } else {
      rawValue = ctrl.max / 2;
    }
    const clamped = clamp(rawValue, 0, ctrl.max);
    const entry = makeControl(ctrl.key, clamped, ctrl.section, ctrl.max, []);
    baseControlDists[ctrl.key] = entry;
    return entry;
  });

  // ── Stochastic axes ───────────────────────────────────────────────────────
  const axes = {};
  for (const [axis, coeffs] of Object.entries(AXIS_COEFFS)) {
    const mean = evalLinear(coeffs, features);
    const word = axisWord(axis, mean);
    axes[axis] = {
      mean,
      word,
      wordMin: word,
      wordMax: word,
      incerto: Math.abs(mean) < 0.5,
    };
  }

  // ── Stochastic notes from descriptors ────────────────────────────────────
  const descriptors = buildDescriptors(
    fermentables,
    hops,
    baseControlDists,
    batchVolumeL,
  );

  const notes = descriptors
    .filter((d) => d.scenarioPresence > 0.7)
    .slice(0, 5)
    .map((d) => ({
      categoria: d.familyId === "lupulo" ? "aroma" : "sabor",
      text: d.label,
      freq: d.scenarioPresence,
      word: d.scenarioPresence > 0.9 ? "provável" : "possível",
    }));

  // ── Stochastic output ─────────────────────────────────────────────────────
  const stochasticControls = {};
  for (const ctrl of controlsArr) {
    const mean = distributionMean(ctrl.distribution, ctrl.max);
    const std = Math.sqrt(
      ctrl.distribution.reduce((a, v, i) => a + v * (i - mean) ** 2, 0),
    );
    const p10 = distributionPercentile(ctrl.distribution, 0.1);
    const p50 = distributionPercentile(ctrl.distribution, 0.5);
    const p90 = distributionPercentile(ctrl.distribution, 0.9);
    stochasticControls[ctrl.key] = {
      p10,
      p50,
      p90,
      mean,
      standardDeviation: std,
      section: ctrl.section,
      max: ctrl.max,
      saturado:
        ctrl.mode === ctrl.max && ctrl.distribution[ctrl.max] > 0.5
          ? true
          : null,
    };
  }

  // ── Deterministic steps ────────────────────────────────────────────────────
  const yeastProfile = resolveYeastProfile(yname);
  const fermTemp =
    fermSteps.length && fermSteps[0] ? fermSteps[0].temperatureC || 20 : 20;
  const pitchRate = context.pitchRate;

  const steps = [
    buildConfigStep(draft, efficiencyPct),
    ...buildFermentableSteps(fermentables, batchVolumeL),
    ...buildMashSteps(mashSteps),
    ...buildHopSteps(hops, whirlpoolTempC),
    buildFermentStep(yeastProfile, fermTemp, ogPoints, pitchRate),
  ].filter(Boolean);

  const maltPerception = buildMaltPerception(fermentables, batchVolumeL);

  const hopAroma = hops
    .filter((h) => {
      const use = (h.use || "").toLowerCase();
      return (
        /whirl|flame|hopback|hopstand|dry|seco/.test(use) ||
        (h.timeMin ?? h.time ?? 60) <= 15
      );
    })
    .flatMap((h) => {
      const descs = HOP_DESCRIPTORS[h.name];
      if (!descs) return [];
      const amt = h.amountG || h.amount || 0;
      const totalAromaG2 = hops
        .filter((x) => {
          const u = (x.use || "").toLowerCase();
          return (
            /whirl|flame|hopback|hopstand|dry|seco/.test(u) ||
            (x.timeMin ?? x.time ?? 60) <= 15
          );
        })
        .reduce((s, x) => s + (x.amountG || x.amount || 0), 0);
      return descs.slice(0, 2).map((d) => ({
        d: d.label,
        forca:
          totalAromaG2 > 0 ? Math.round((amt / totalAromaG2) * 100) / 100 : 0,
        from: [h.name],
      }));
    })
    .sort((a, b) => b.forca - a.forca)
    .slice(0, 5);

  const redTone = Math.min(5, Math.round(srmRaw / 5));

  const deterministic = {
    steps,
    controls: Object.fromEntries(
      controlsArr.map((c) => [
        c.key,
        {
          value: distributionMean(c.distribution, c.max),
          section: c.section,
          max: c.max,
        },
      ]),
    ),
    maltPerception,
    ingredientDescriptors: [],
    hopAroma,
    ferment: yeastProfile
      ? {
          ester: 0.5,
          fenol:
            yeastProfile.family === "wheat" || yeastProfile.family === "saison"
              ? 0.5
              : 0,
          fusel: abv > 6 ? 0.6 : 0.3,
          tempC: fermTemp,
          tempPos:
            fermTemp < (yeastProfile.lo || 18)
              ? -0.33
              : fermTemp > (yeastProfile.hi || 24)
                ? 0.33
                : 0,
          family: yeastProfile.family,
        }
      : null,
    maltMasked: [],
    hopMasked: [],
    hopSilenced: null,
    provenance: {
      yeastName: yname,
      yeastConf: YEAST_PROFILES[yname] ? "alta" : "baixa",
      fermentSteps: fermSteps.length,
      fermentTemp: fermSteps.length > 0,
      water: false,
    },
    redTone,
  };

  // ── Forecast (controls + descriptors) ────────────────────────────────────
  const styleEntry = styleSlug ? STYLE_DB[styleSlug] : null;

  const forecastControls = controlsArr.map((c) => {
    const injected = injectStyleBand(c, styleEntry);
    return { ...injected, labels: [] };
  });

  const forecastDescriptors = descriptors.map((d) => {
    const typicalOfStyle = styleEntry
      ? Object.values(styleEntry.bands || {}).some(
          ([lo, hi]) => distributionMode(d.scenarioDistribution) >= lo,
        )
      : false;
    return { ...d, typicalOfStyle };
  });

  const RUNS = 200;
  const forecast = {
    schema: "beer-school-sensory-forecast/v1",
    seed,
    runs: RUNS,
    controls: forecastControls,
    descriptors: forecastDescriptors,
    typicalDescriptors: forecastDescriptors.filter((d) => d.typicalOfStyle),
    completeness: {
      pct: Math.min(95, 40 + fermentables.length * 8 + hops.length * 3),
      gaps: [],
    },
    calibrationVersion: "local-v1",
  };

  // ── Comparisons ────────────────────────────────────────────────────────────
  const comparisons = buildComparisons(draft, context, baseControlDists, seed);

  // ── Style entry for response ───────────────────────────────────────────────
  const resolvedStyleEntry = styleEntry
    ? {
        code: styleEntry.code,
        name: styleEntry.name,
        slug: styleSlug,
        desc: "",
        bands: styleEntry.bands,
      }
    : null;

  // ── Stochastic.controls: merge forecast distributions ─────────────────────
  // (stochasticControls already built above, use the same values)

  return {
    ok: true,
    analysis: {
      schema: "beer-school-sensory/v1",
      seed,
      styleSlug: styleSlug || null,
      styleEntry: resolvedStyleEntry,
      styleOptions: STYLE_OPTIONS,
      recipe: draft,
      context,
      deterministic,
      stochastic: {
        seed,
        runs: RUNS,
        notes,
        interactions: [],
        axes,
        controls: stochasticControls,
        descriptors: descriptors.slice(0, 12).map((d) => ({
          d: d.label,
          familia: d.family,
          from: d.sources,
          chance: d.scenarioPresence,
          word: d.scenarioPresence > 0.9 ? "provável" : "possível",
          p10: d.interval80.lo,
          p50: d.mode,
          p90: d.interval80.hi,
          bins: d.scenarioDistribution.map((v) => Math.round(v * RUNS)),
        })),
      },
      forecast,
      comparisons,
    },
  };
}
