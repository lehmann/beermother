import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PH_STAGES,
  PH_TARGETS,
  PH_ACID_TYPES,
  DEFAULT_PH_ACID,
  phAcidId,
  phAcidLabel,
  phSlopeFromReadings,
  phPriorFor,
  phDoseSuggestion,
  spargeDoseFromWaterSlope,
  updatePhMemory,
  isPhLogSane,
  sanitizePhLog,
  phLogSummary,
} from "./ph.js";

// ─── phAcidId ─────────────────────────────────────────────────────────────────

describe("phAcidId", () => {
  it("formata corretamente tipo e concentração inteira", () => {
    assert.equal(phAcidId("latico", 80), "latico-80");
  });

  it("arredonda concentração fracionária", () => {
    assert.equal(phAcidId("fosforico", 9.7), "fosforico-10");
  });

  it("trata concentração inválida como 0", () => {
    assert.equal(phAcidId("latico", null), "latico-0");
  });
});

// ─── phAcidLabel ──────────────────────────────────────────────────────────────

describe("phAcidLabel", () => {
  it("retorna rótulo completo para tipo conhecido", () => {
    assert.equal(phAcidLabel("latico", 80), "Ácido lático 80%");
  });

  it("retorna rótulo com uma casa decimal quando necessário", () => {
    assert.equal(phAcidLabel("fosforico", 10.5), "Ácido fosfórico 10.5%");
  });

  it("usa 'Ácido' genérico para tipo desconhecido", () => {
    const label = phAcidLabel("desconhecido", 5);
    assert.ok(label.startsWith("Ácido"), `label="${label}"`);
  });
});

// ─── DEFAULT_PH_ACID ──────────────────────────────────────────────────────────

describe("DEFAULT_PH_ACID", () => {
  it("é latico-80 (tipo e concentração padrão do ácido lático)", () => {
    assert.equal(DEFAULT_PH_ACID, "latico-80");
  });
});

// ─── phSlopeFromReadings ──────────────────────────────────────────────────────

describe("phSlopeFromReadings", () => {
  it("retorna null para volume zero", () => {
    assert.equal(phSlopeFromReadings([{ ph: 5.8, doseMl: 2 }], 0), null);
  });

  it("retorna null para lista vazia", () => {
    assert.equal(phSlopeFromReadings([], 20), null);
  });

  it("retorna null para lista com apenas um elemento", () => {
    assert.equal(phSlopeFromReadings([{ ph: 5.8, doseMl: 2 }], 20), null);
  });

  it("calcula slope corretamente com duas leituras", () => {
    // doseMl=2, phDrop=5.8-5.5=0.3, volume=20 → slope=2/(0.3*20)=0.333
    const readings = [
      { ph: 5.8, doseMl: 2 },
      { ph: 5.5, doseMl: 0 },
    ];
    const slope = phSlopeFromReadings(readings, 20);
    assert.ok(slope !== null);
    assert.ok(Math.abs(slope - 2 / (0.3 * 20)) < 0.001, `slope=${slope}`);
  });

  it("ignora pares com queda de pH ≤ 0.02", () => {
    const readings = [
      { ph: 5.8, doseMl: 2 },
      { ph: 5.79, doseMl: 0 },
    ];
    assert.equal(phSlopeFromReadings(readings, 20), null);
  });

  it("ignora pares com doseMl zero ou negativo", () => {
    const readings = [
      { ph: 5.8, doseMl: 0 },
      { ph: 5.5, doseMl: 0 },
    ];
    assert.equal(phSlopeFromReadings(readings, 20), null);
  });

  it("pondera amostras mais recentes com peso exponencial (2^i)", () => {
    // Par 0 (i=0): peso 1; Par 1 (i=1): peso 2
    // Ambos com slope idêntico → resultado deve ser igual ao slope individual
    const readings = [
      { ph: 6.0, doseMl: 3 },
      { ph: 5.7, doseMl: 3 },
      { ph: 5.4, doseMl: 0 },
    ];
    const slopeAll = phSlopeFromReadings(readings, 10);
    // slope par 0: 3/(0.3*10)=1, slope par 1: 3/(0.3*10)=1 → média=1
    assert.ok(slopeAll !== null);
    assert.ok(Math.abs(slopeAll - 1) < 0.001, `slopeAll=${slopeAll}`);
  });

  it("aceita array não-array sem explodir", () => {
    assert.equal(phSlopeFromReadings(null, 20), null);
  });
});

// ─── phPriorFor ───────────────────────────────────────────────────────────────

describe("phPriorFor", () => {
  it("retorna prior genérico quando memory é null", () => {
    const p = phPriorFor("mash", null);
    assert.equal(p.source, "prior");
    assert.equal(p.slope, 0.5);
  });

  it("retorna prior genérico de água para stage de água", () => {
    const p = phPriorFor("mash-water", null);
    assert.equal(p.source, "prior");
    assert.equal(p.slope, 0.08);
  });

  it("usa entrada de memória quando acidId bate e slope > 0", () => {
    const memory = {
      acidId: "latico-80",
      mash: { slope: 0.42, spreadPct: 5, samples: 3 },
    };
    const p = phPriorFor("mash", memory, "latico-80");
    assert.equal(p.source, "memoria");
    assert.equal(p.slope, 0.42);
    assert.equal(p.samples, 3);
  });

  it("ignora memória quando acidId é diferente", () => {
    const memory = {
      acidId: "fosforico-10",
      mash: { slope: 0.42, spreadPct: 5, samples: 3 },
    };
    const p = phPriorFor("mash", memory, "latico-80");
    assert.equal(p.source, "prior");
  });

  it("ignora memória quando slope é zero", () => {
    const memory = { acidId: "latico-80", mash: { slope: 0, samples: 1 } };
    const p = phPriorFor("mash", memory, "latico-80");
    assert.equal(p.source, "prior");
  });
});

// ─── phDoseSuggestion ─────────────────────────────────────────────────────────

describe("phDoseSuggestion", () => {
  it("retorna doseMl=0 para pH já dentro da tolerância de mostura", () => {
    // target mash=5.4, tolerance=0.05 → qualquer pH ≤ 5.45 ok
    const r = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 5.42, targetPh: 5.4 });
    assert.equal(r.doseMl, 0);
  });

  it("retorna doseMl=0 para pH dentro da tolerância de água", () => {
    // water tolerance=0.1 → pH 5.55 vs target 5.5 ok
    const r = phDoseSuggestion({ stage: "mash-water", volumeL: 20, currentPh: 5.55, targetPh: 5.5 });
    assert.equal(r.doseMl, 0);
  });

  it("retorna doseMl=0 quando volume é zero", () => {
    const r = phDoseSuggestion({ stage: "mash", volumeL: 0, currentPh: 5.8, targetPh: 5.4 });
    assert.equal(r.doseMl, 0);
  });

  it("retorna doseMl=0 quando currentPh é zero", () => {
    const r = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 0, targetPh: 5.4 });
    assert.equal(r.doseMl, 0);
  });

  it("sugere dose positiva quando pH está acima da tolerância", () => {
    // pH 5.9 vs target 5.4 (gap=0.5 > 0.05)
    const r = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 5.9, targetPh: 5.4 });
    assert.ok(r.doseMl > 0, `doseMl=${r.doseMl}`);
  });

  it("dose maior para volume maior (mesma receita, dobro do volume)", () => {
    const r10 = phDoseSuggestion({ stage: "mash", volumeL: 10, currentPh: 5.9, targetPh: 5.4 });
    const r20 = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 5.9, targetPh: 5.4 });
    assert.ok(r20.doseMl > r10.doseMl, `r10=${r10.doseMl}, r20=${r20.doseMl}`);
  });

  it("usa prior quando não há leituras anteriores (source='prior')", () => {
    const r = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 5.9, targetPh: 5.4 });
    assert.equal(r.source, "prior");
  });

  it("usa leitura quando há readings anteriores (source='leitura')", () => {
    const readings = [{ ph: 6.1, doseMl: 5 }];
    const r = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 5.8, targetPh: 5.4, readings });
    assert.equal(r.source, "leitura");
  });

  it("usa target padrão da stage quando targetPh não é fornecido", () => {
    // mash target = 5.4; pH 6.0 deve gerar dose > 0
    const r = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 6.0 });
    assert.ok(r.doseMl > 0);
  });

  it("retorna doseMl arredondado a uma casa decimal", () => {
    const r = phDoseSuggestion({ stage: "mash", volumeL: 20, currentPh: 5.9, targetPh: 5.4 });
    const rounded = Math.round(r.doseMl * 10) / 10;
    assert.equal(r.doseMl, rounded);
  });
});

// ─── spargeDoseFromWaterSlope ─────────────────────────────────────────────────

describe("spargeDoseFromWaterSlope", () => {
  it("retorna doseMl=0 quando slope é zero", () => {
    const r = spargeDoseFromWaterSlope({ slope: 0, volumeL: 20, currentPh: 7.0 });
    assert.equal(r.doseMl, 0);
  });

  it("retorna doseMl=0 quando volume é zero", () => {
    const r = spargeDoseFromWaterSlope({ slope: 0.08, volumeL: 0, currentPh: 7.0 });
    assert.equal(r.doseMl, 0);
  });

  it("retorna doseMl=0 quando pH está dentro da tolerância de água (≤0.1)", () => {
    const r = spargeDoseFromWaterSlope({ slope: 0.08, volumeL: 20, currentPh: 5.55, targetPh: 5.5 });
    assert.equal(r.doseMl, 0);
  });

  it("calcula dose corretamente: 0.85 * gap * slope * volume", () => {
    // gap=7.0-5.5=1.5, slope=0.1, volume=10 → 0.85*1.5*0.1*10=1.275 → arredonda para 1.3
    const r = spargeDoseFromWaterSlope({ slope: 0.1, volumeL: 10, currentPh: 7.0, targetPh: 5.5 });
    assert.equal(r.doseMl, 1.3);
  });

  it("usa targetPh=5.5 como padrão quando não informado", () => {
    const rExplicit = spargeDoseFromWaterSlope({ slope: 0.1, volumeL: 10, currentPh: 7.0, targetPh: 5.5 });
    const rDefault  = spargeDoseFromWaterSlope({ slope: 0.1, volumeL: 10, currentPh: 7.0 });
    assert.equal(rDefault.doseMl, rExplicit.doseMl);
  });
});

// ─── updatePhMemory ───────────────────────────────────────────────────────────

describe("updatePhMemory", () => {
  it("retorna null quando memory é null e args são inválidos", () => {
    assert.equal(updatePhMemory(null, {}), null);
  });

  it("cria entrada nova quando memory é null e slope > 0", () => {
    const m = updatePhMemory(null, { kind: "mash", slope: 0.42, acidId: "latico-80", at: "2026-01-01" });
    assert.ok(m !== null);
    assert.equal(m.acidId, "latico-80");
    assert.equal(m.mash.slope, 0.42);
    assert.equal(m.mash.samples, 1);
    assert.equal(m.mash.spreadPct, 0);
  });

  it("faz blend exponencial em update subsequente (0.65*novo + 0.35*antigo)", () => {
    const m1 = updatePhMemory(null, { kind: "mash", slope: 0.40, acidId: "latico-80", at: "t1" });
    const m2 = updatePhMemory(m1, { kind: "mash", slope: 0.50, acidId: "latico-80", at: "t2" });
    const expected = 0.65 * 0.50 + 0.35 * 0.40;
    assert.ok(Math.abs(m2.mash.slope - expected) < 0.0001, `slope=${m2.mash.slope}`);
    assert.equal(m2.mash.samples, 2);
  });

  it("reseta memória quando acidId muda", () => {
    const m1 = updatePhMemory(null, { kind: "water", slope: 0.08, acidId: "latico-80", at: "t1" });
    const m2 = updatePhMemory(m1, { kind: "water", slope: 0.12, acidId: "fosforico-10", at: "t2" });
    assert.equal(m2.acidId, "fosforico-10");
    assert.equal(m2.water.samples, 1);
  });

  it("ignora update quando slope é zero", () => {
    const m1 = updatePhMemory(null, { kind: "mash", slope: 0.42, acidId: "latico-80", at: "t1" });
    const m2 = updatePhMemory(m1, { kind: "mash", slope: 0, acidId: "latico-80", at: "t2" });
    assert.equal(m2.mash.slope, 0.42);
    assert.equal(m2.mash.samples, 1);
  });

  it("não mistura buckets mash e water", () => {
    const m = updatePhMemory(null, { kind: "mash", slope: 0.5, acidId: "latico-80", at: "t1" });
    assert.equal(m.water, undefined);
  });
});

// ─── isPhLogSane ──────────────────────────────────────────────────────────────

describe("isPhLogSane", () => {
  it("retorna false para null", () => {
    assert.equal(isPhLogSane(null), false);
  });

  it("retorna false para array", () => {
    assert.equal(isPhLogSane([]), false);
  });

  it("retorna false quando falta uma stage", () => {
    const log = Object.fromEntries(
      PH_STAGES.slice(0, -1).map((s) => [s, { readings: [] }]),
    );
    assert.equal(isPhLogSane(log), false);
  });

  it("retorna false quando readings não é array", () => {
    const log = Object.fromEntries(
      PH_STAGES.map((s) => [s, { readings: s === "mash" ? null : [] }]),
    );
    assert.equal(isPhLogSane(log), false);
  });

  it("retorna true para log completo com arrays vazios", () => {
    const log = Object.fromEntries(PH_STAGES.map((s) => [s, { readings: [] }]));
    assert.equal(isPhLogSane(log), true);
  });
});

// ─── sanitizePhLog ────────────────────────────────────────────────────────────

describe("sanitizePhLog", () => {
  it("cria estrutura completa para log vazio", () => {
    const log = sanitizePhLog({});
    for (const stage of PH_STAGES) {
      assert.ok(stage in log, `stage ausente: ${stage}`);
      assert.ok(Array.isArray(log[stage].readings));
      assert.equal(typeof log[stage].skipped, "boolean");
    }
  });

  it("filtra leituras com pH fora de [0, 14]", () => {
    const log = sanitizePhLog({
      mash: { readings: [{ ph: -1, doseMl: 1 }, { ph: 14.5, doseMl: 1 }, { ph: 5.4, doseMl: 2 }] },
    });
    assert.equal(log.mash.readings.length, 1);
    assert.equal(log.mash.readings[0].ph, 5.4);
  });

  it("normaliza doseMl negativo para zero", () => {
    const log = sanitizePhLog({
      mash: { readings: [{ ph: 5.4, doseMl: -3 }] },
    });
    assert.equal(log.mash.readings[0].doseMl, 0);
  });

  it("preserva flag skipped", () => {
    const log = sanitizePhLog({ mash: { readings: [], skipped: true } });
    assert.equal(log.mash.skipped, true);
  });

  it("trata input nulo como objeto vazio", () => {
    const log = sanitizePhLog(null);
    for (const stage of PH_STAGES) {
      assert.ok(stage in log);
    }
  });
});

// ─── phLogSummary ─────────────────────────────────────────────────────────────

describe("phLogSummary", () => {
  it("retorna array vazio para log sem leituras nem skipped", () => {
    const log = Object.fromEntries(PH_STAGES.map((s) => [s, { readings: [] }]));
    assert.equal(phLogSummary(log).length, 0);
  });

  it("inclui stage com readings > 0", () => {
    const log = Object.fromEntries(PH_STAGES.map((s) => [s, { readings: [] }]));
    log.mash.readings = [{ ph: 5.8, doseMl: 3 }, { ph: 5.4, doseMl: 0 }];
    const summary = phLogSummary(log);
    assert.equal(summary.length, 1);
    assert.equal(summary[0].stage, "mash");
    assert.equal(summary[0].readings, 2);
    assert.equal(summary[0].finalPh, 5.4);
    assert.equal(summary[0].totalMl, 3);
  });

  it("inclui stage marcado como skipped mesmo sem readings", () => {
    const log = Object.fromEntries(PH_STAGES.map((s) => [s, { readings: [] }]));
    log["sparge-water"].skipped = true;
    const summary = phLogSummary(log);
    assert.equal(summary.length, 1);
    assert.equal(summary[0].stage, "sparge-water");
    assert.equal(summary[0].skipped, true);
    assert.equal(summary[0].finalPh, null);
  });

  it("soma totalMl corretamente de múltiplas leituras", () => {
    const log = Object.fromEntries(PH_STAGES.map((s) => [s, { readings: [] }]));
    log.mash.readings = [
      { ph: 6.2, doseMl: 4.2 },
      { ph: 5.9, doseMl: 2.3 },
      { ph: 5.5, doseMl: 0 },
    ];
    const summary = phLogSummary(log);
    assert.equal(summary[0].totalMl, 6.5);
  });

  it("sanitiza log insano antes de resumir (não explode)", () => {
    const summary = phLogSummary(null);
    assert.ok(Array.isArray(summary));
  });

  it("title corresponde ao PH_STAGE_TITLES de cada stage", () => {
    const log = Object.fromEntries(PH_STAGES.map((s) => [s, { readings: [] }]));
    log.mash.readings = [{ ph: 5.4, doseMl: 1 }];
    const summary = phLogSummary(log);
    assert.equal(summary[0].title, "Mostura");
  });
});
