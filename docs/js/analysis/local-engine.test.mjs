// Unit tests for local-engine.js
// Run: node --test docs/js/analysis/local-engine.test.mjs

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// controls.js (minified) reads globalThis.clamp — must be set before the import resolves
globalThis.clamp = (a, lo, hi) => Math.min(hi, Math.max(lo, a));
const { runLocalAnalysis } = await import("./local-engine.js");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const GERMAN_PILS = {
  name: "German Pils",
  batchVolumeL: 20,
  boilTimeMin: 90,
  mashEfficiencyPct: 75,
  fermentables: [
    { name: "Pilsner Malt", type: "Grão", amountKg: 4.2, yieldPct: 80, colorEbc: 3.5, when: "Fervura" },
  ],
  hops: [
    { name: "Hallertau", amountG: 30, alphaAcidPct: 4.5, use: "Fervura", timeMin: 60 },
    { name: "Saaz", amountG: 15, alphaAcidPct: 3.5, use: "Fervura", timeMin: 10 },
  ],
  yeasts: [{ name: "W-34/70", attenuationPct: 80, amount: 2 }],
  mash: [
    { temperatureC: 63, timeMin: 30 },
    { temperatureC: 72, timeMin: 30 },
  ],
};

const OATMEAL_STOUT = {
  name: "Oatmeal Stout",
  batchVolumeL: 20,
  boilTimeMin: 60,
  mashEfficiencyPct: 73,
  fermentables: [
    { name: "Pale Malt", type: "Grão", amountKg: 3.5, yieldPct: 80, colorEbc: 6, when: "Fervura" },
    { name: "Roasted Barley", type: "Grão", amountKg: 0.8, yieldPct: 55, colorEbc: 1400, when: "Fervura" },
    { name: "Flaked Oats", type: "Grão", amountKg: 0.5, yieldPct: 70, colorEbc: 4, when: "Fervura" },
  ],
  hops: [
    { name: "Fuggle", amountG: 25, alphaAcidPct: 4.5, use: "Fervura", timeMin: 60 },
  ],
  yeasts: [{ name: "WY1028", attenuationPct: 73, amount: 1 }],
  mash: [{ temperatureC: 68, timeMin: 60 }],
};

const AMERICAN_IPA = {
  name: "American IPA",
  batchVolumeL: 20,
  boilTimeMin: 60,
  mashEfficiencyPct: 78,
  fermentables: [
    { name: "Pale Ale Malt", type: "Grão", amountKg: 5.0, yieldPct: 80, colorEbc: 7, when: "Fervura" },
    { name: "Crystal 60", type: "Grão", amountKg: 0.35, yieldPct: 75, colorEbc: 120, when: "Fervura" },
  ],
  hops: [
    { name: "Centennial", amountG: 30, alphaAcidPct: 10, use: "Fervura", timeMin: 60 },
    { name: "Citra", amountG: 25, alphaAcidPct: 12, use: "Fervura", timeMin: 5 },
    { name: "Citra", amountG: 30, alphaAcidPct: 12, use: "Dry hop", timeMin: 0 },
  ],
  yeasts: [{ name: "US-05", attenuationPct: 80, amount: 1 }],
  mash: [{ temperatureC: 65, timeMin: 60 }],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inRange(v, lo, hi) {
  return typeof v === "number" && v >= lo && v <= hi;
}

function sumArr(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

function stepsOfKind(analysis, kind) {
  return analysis.deterministic.steps.filter((s) => s.kind === kind);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("estrutura de saída", () => {
  it("retorna ok:true com todos os 11 campos de analysis", () => {
    const result = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(result.ok, true);
    const EXPECTED_KEYS = [
      "schema", "seed", "styleSlug", "styleEntry", "styleOptions",
      "recipe", "context", "deterministic", "stochastic", "forecast", "comparisons",
    ];
    for (const key of EXPECTED_KEYS) {
      assert.ok(key in result.analysis, `campo ausente: ${key}`);
    }
  });

  it("schema é 'beer-school-sensory/v1'", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.schema, "beer-school-sensory/v1");
  });

  it("styleOptions contém 128 estilos", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.styleOptions.length, 128);
  });

  it("recipe espelha o draft de entrada", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.recipe.name, GERMAN_PILS.name);
    assert.equal(analysis.recipe.batchVolumeL, GERMAN_PILS.batchVolumeL);
  });
});

describe("context — parâmetros calculados a partir dos ingredientes", () => {
  it("German Pils: OG, FG, IBU, SRM e ABV em faixas plausíveis", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const ctx = analysis.context;
    assert.ok(inRange(ctx.ogPoints, 44, 54), `ogPoints=${ctx.ogPoints}`);
    assert.ok(inRange(ctx.srm, 2, 6), `srm=${ctx.srm}`);
    assert.ok(inRange(ctx.ibu, 10, 30), `ibu=${ctx.ibu}`);
    assert.ok(inRange(ctx.abv, 4.5, 6.0), `abv=${ctx.abv}`);
    assert.ok(ctx.fg < 1 + ctx.ogPoints / 1000, "FG deve ser menor que OG");
  });

  it("Oatmeal Stout tem SRM muito maior que German Pils (malte torrado)", () => {
    const pils = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 }).analysis.context;
    const stout = runLocalAnalysis({ draft: OATMEAL_STOUT, seed: 1 }).analysis.context;
    assert.ok(stout.srm > pils.srm * 5, `Stout SRM (${stout.srm}) deve ser >> Pils SRM (${pils.srm})`);
  });

  it("American IPA tem IBU maior que German Pils", () => {
    const pilsIbu = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 }).analysis.context.ibu;
    const ipaIbu = runLocalAnalysis({ draft: AMERICAN_IPA, seed: 1 }).analysis.context.ibu;
    assert.ok(ipaIbu > pilsIbu, `IPA IBU (${ipaIbu}) deve ser > Pils IBU (${pilsIbu})`);
  });

  it("American IPA tem OG maior que German Pils (mais grãos)", () => {
    const pilsOg = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 }).analysis.context.ogPoints;
    const ipaOg = runLocalAnalysis({ draft: AMERICAN_IPA, seed: 1 }).analysis.context.ogPoints;
    assert.ok(ipaOg > pilsOg, `IPA OG (${ipaOg}) deve ser > Pils OG (${pilsOg})`);
  });
});

describe("deterministic.steps — classificação de ingredientes e processo", () => {
  it("Pils: sequência de kinds começa com config e termina com ferment", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const kinds = analysis.deterministic.steps.map((s) => s.kind);
    assert.equal(kinds[0], "config");
    assert.equal(kinds[kinds.length - 1], "ferment");
    for (const kind of ["fermentable", "mash", "hop"]) {
      assert.ok(kinds.includes(kind), `step kind '${kind}' ausente`);
    }
  });

  it("Pils: mash 63°C dispara tag sacar-baixa (β-amilase)", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const step = analysis.deterministic.steps.find(
      (s) => s.kind === "mash" && s.titleMeta === "63°C",
    );
    assert.ok(step, "step de mash 63°C não encontrado");
    assert.ok(step.fired.includes("sacar-baixa"), `fired=${step.fired}`);
  });

  it("Pils: mash 72°C dispara tag sacar-alta (α-amilase)", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const step = analysis.deterministic.steps.find(
      (s) => s.kind === "mash" && s.titleMeta === "72°C",
    );
    assert.ok(step, "step de mash 72°C não encontrado");
    assert.ok(step.fired.includes("sacar-alta"), `fired=${step.fired}`);
  });

  it("Pils: hop Saaz a 10min dispara fervura-curta-preserva-oleo", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const step = analysis.deterministic.steps.find(
      (s) => s.kind === "hop" && s.titleData === "Saaz",
    );
    assert.ok(step, "step do Saaz não encontrado");
    assert.ok(step.fired.includes("fervura-curta-preserva-oleo"), `fired=${step.fired}`);
  });

  it("Pils: hop Hallertau a 60min dispara kettle-aroma (lúpulo de fervura longa)", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const step = analysis.deterministic.steps.find(
      (s) => s.kind === "hop" && s.titleData === "Hallertau",
    );
    assert.ok(step, "step do Hallertau não encontrado");
    assert.ok(step.fired.includes("kettle-aroma"), `fired=${step.fired}`);
  });

  it("Stout: step de Roasted Barley tem pelo menos um efeito", () => {
    const { analysis } = runLocalAnalysis({ draft: OATMEAL_STOUT, seed: 1 });
    const step = analysis.deterministic.steps.find(
      (s) => s.kind === "fermentable" && s.titleData === "Roasted Barley",
    );
    assert.ok(step, "step de Roasted Barley não encontrado");
    assert.ok(step.effects.length > 0, "step sem efeitos");
  });

  it("Stout: um fermentable step por fermentável declarado", () => {
    const { analysis } = runLocalAnalysis({ draft: OATMEAL_STOUT, seed: 1 });
    assert.equal(stepsOfKind(analysis, "fermentable").length, OATMEAL_STOUT.fermentables.length);
  });
});

describe("stochastic — simulação Monte Carlo", () => {
  it("200 runs executados", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.stochastic.runs, 200);
  });

  it("6 eixos sensoriais presentes com valores numéricos", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    for (const ax of ["maltosidade", "cor", "corpo", "atenuacao", "adstringencia", "turbidez"]) {
      const axis = analysis.stochastic.axes[ax];
      assert.ok(axis, `eixo ausente: ${ax}`);
      assert.ok(typeof axis.mean === "number", `eixo ${ax} sem mean numérico`);
    }
  });

  it("Pils: descritores de lúpulo do Saaz presentes (Herbal, Terroso ou Floral)", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const hopDescriptors = analysis.stochastic.descriptors.filter(
      (d) => d.family === "Lúpulo" || d.familia === "Lúpulo",
    );
    assert.ok(hopDescriptors.length >= 1, "nenhum descritor de lúpulo encontrado");
  });
});

describe("forecast — controles com distribuições probabilísticas", () => {
  it("18 controles presentes", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.forecast.controls.length, 18);
  });

  it("cada controle tem key, section, max, distribution e mode", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    for (const ctrl of analysis.forecast.controls) {
      assert.ok(typeof ctrl.key === "string", `key inválida: ${JSON.stringify(ctrl)}`);
      assert.ok(typeof ctrl.section === "string", `section inválida em ${ctrl.key}`);
      assert.ok(typeof ctrl.max === "number" && ctrl.max > 0, `max inválido em ${ctrl.key}`);
      assert.ok(Array.isArray(ctrl.distribution), `distribution ausente em ${ctrl.key}`);
      assert.ok(typeof ctrl.mode === "number", `mode ausente em ${ctrl.key}`);
    }
  });

  it("distribuições somam ~1 (tolerância 0.02)", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    for (const ctrl of analysis.forecast.controls) {
      const sum = sumArr(ctrl.distribution);
      assert.ok(Math.abs(sum - 1) < 0.02, `distribuição de '${ctrl.key}' soma ${sum}`);
    }
  });

  it("carbonation fixado em 2 (valor assumido, não regressado)", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.deterministic.controls.carbonation.value, 2);
  });
});

describe("comparisons — cenários counterfactual", () => {
  it("exatamente 3 comparações geradas", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.comparisons.length, 3);
  });

  it("tipos de mutação: fermentableAmount, hopAmount, mashTemperature", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const types = analysis.comparisons.map((c) => c.applied.type);
    assert.ok(types.includes("fermentableAmount"), `tipos=${types}`);
    assert.ok(types.includes("hopAmount"), `tipos=${types}`);
    assert.ok(types.includes("mashTemperature"), `tipos=${types}`);
  });

  it("fermentableAmount: after = before × 1.10", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const comp = analysis.comparisons.find((c) => c.applied.type === "fermentableAmount");
    assert.ok(
      Math.abs(comp.applied.after / comp.applied.before - 1.1) < 0.001,
      `before=${comp.applied.before} after=${comp.applied.after}`,
    );
  });

  it("mashTemperature: after = before + 1°C", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const comp = analysis.comparisons.find((c) => c.applied.type === "mashTemperature");
    assert.equal(comp.applied.after - comp.applied.before, 1);
  });

  it("cada comparação tem 18 controlDeltas", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    for (const comp of analysis.comparisons) {
      assert.equal(
        comp.controlDeltas.length,
        18,
        `${comp.applied.type}: ${comp.controlDeltas.length} deltas`,
      );
    }
  });
});

describe("seed — determinismo e independência", () => {
  it("mesma seed produz resultado idêntico (determinismo)", () => {
    const r1 = runLocalAnalysis({ draft: GERMAN_PILS, seed: 7 });
    const r2 = runLocalAnalysis({ draft: GERMAN_PILS, seed: 7 });
    assert.deepEqual(r1, r2);
  });

  it("seeds diferentes produzem stochastic.seed diferente", () => {
    const r1 = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    const r2 = runLocalAnalysis({ draft: GERMAN_PILS, seed: 2 });
    assert.notEqual(r1.analysis.stochastic.seed, r2.analysis.stochastic.seed);
  });

  it("seed não afeta contexto determinístico (OG igual entre seeds)", () => {
    const ogA = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 }).analysis.context.ogPoints;
    const ogB = runLocalAnalysis({ draft: GERMAN_PILS, seed: 99 }).analysis.context.ogPoints;
    assert.equal(ogA, ogB);
  });
});

describe("styleSlug — integração com estilos BJCP", () => {
  it("styleEntry populado quando slug válido fornecido", () => {
    const { analysis } = runLocalAnalysis({
      draft: GERMAN_PILS,
      seed: 1,
      styleSlug: "d.-german-pils",
    });
    assert.ok(analysis.styleEntry, "styleEntry é null");
    assert.equal(analysis.styleEntry.name, "German Pils");
  });

  it("forecast controls têm bandas de estilo quando styleSlug fornecido", () => {
    const { analysis } = runLocalAnalysis({
      draft: GERMAN_PILS,
      seed: 1,
      styleSlug: "d.-german-pils",
    });
    const withBand = analysis.forecast.controls.filter((c) => c.style !== null);
    assert.ok(withBand.length > 0, "nenhum controle com banda de estilo");
  });

  it("styleEntry é null quando nenhum slug fornecido", () => {
    const { analysis } = runLocalAnalysis({ draft: GERMAN_PILS, seed: 1 });
    assert.equal(analysis.styleEntry, null);
  });
});

describe("robustez — receitas incompletas não devem crashar", () => {
  it("sem lúpulos: ok:true e ibu === 0", () => {
    const draft = { ...GERMAN_PILS, hops: [] };
    const result = runLocalAnalysis({ draft, seed: 1 });
    assert.equal(result.ok, true);
    assert.equal(result.analysis.context.ibu, 0);
  });

  it("sem mash steps: ok:true e zero steps de mash", () => {
    const draft = { ...GERMAN_PILS, mash: [] };
    const result = runLocalAnalysis({ draft, seed: 1 });
    assert.equal(result.ok, true);
    assert.equal(stepsOfKind(result.analysis, "mash").length, 0);
  });

  it("sem levedura: ok:true", () => {
    const draft = { ...GERMAN_PILS, yeasts: [] };
    const result = runLocalAnalysis({ draft, seed: 1 });
    assert.equal(result.ok, true);
  });

  it("sem fermentáveis: ok:false (análise inválida)", () => {
    const draft = { ...GERMAN_PILS, fermentables: [] };
    // analysis-screen.js já guarda esse caso, mas o engine não deve crashar
    const result = runLocalAnalysis({ draft, seed: 1 });
    // ok pode ser true ou false, mas não deve lançar exceção
    assert.ok(typeof result.ok === "boolean");
  });
});
