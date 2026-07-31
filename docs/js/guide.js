import {
  n as k,
  mashTimerItems as B,
  boilTimerItems as K,
  negligibleCorrection as N,
  effectiveHeatingRateCMin as D,
} from "./engine.js";
import {
  t as i,
  fmt as y,
  formatVolume as b,
  formatMaltMass as j,
  formatIngredientAmount as U,
} from "./i18n.js";
export const GUIDE_STEP_TYPES = ["check", "timer", "leitura", "correcao"];
function h(e = {}) {
  return `${e.kind || "misc"}:${e.id || e.name || ""}`;
}
function E(e, t) {
  return !!e?.guideChecks?.[t];
}
function T(e, t) {
  return !!e?.additionChecks?.[h(t)];
}
function F(e, t) {
  const a = e?.measurements?.[t] || {};
  return k(a.volumeL) > 0 && a.wri !== "" && a.wri !== void 0;
}
function O(e, t, a) {
  const r = a === "pre" ? t.preCorrection : t.postCorrection;
  return !r || r.status === "pending"
    ? "pending"
    : r.action === "Sem corre\xE7\xE3o" || N(r)
      ? "none"
      : e?.correctionAccepted?.[a]
        ? "done"
        : (e?.correctionRounds?.[a] || []).length > 0
          ? "verifying"
          : "actionable";
}
function V(e, t, a) {
  const r = e?.timerEvents || [],
    c = t === "mash" ? "mash-end" : t === "boil" ? "boil-end" : "";
  return c && r.some((n) => String(n.key || "").startsWith(c))
    ? !0
    : r.some((n) => String(n.key || "").includes(String(a)));
}
export function brewGuideSteps(e, t = {}, a = "guia", r = {}) {
  if (!e || !e.recipe) return [];
  const c = [],
    n = (o) => {
      c.push(o);
    },
    l = e.volumes || {};
  (n({
    id: "mash-water",
    phase: "mash",
    type: "check",
    title: i("\xC1gua da mostura \xB7 {vol}", { vol: b(l.mashWater, 1) }),
    detail: i("confira o usado (e os sais)"),
    ref: { tab: "mash", anchor: "water" },
    done: E(t, "mash-water"),
  }),
    n({
      id: "mash-doughin",
      phase: "mash",
      type: "check",
      title: i("Adicione os maltes (dough-in)"),
      detail: i("{mass} de gr\xE3os", { mass: j(l.grainKg) }),
      ref: { tab: "mash", anchor: "grist" },
      done: E(t, "mash-doughin"),
    }),
    (e.mashAdditions || []).forEach((o) =>
      n({
        id: `mash-add-${h(o)}`,
        phase: "mash",
        type: "check",
        title: i("Adicione {name} na mostura", { name: o.name }),
        detail: `${U(o.amount, o.unit)} \xB7 ${i(o.moment || o.use || "")}`,
        ref: { tab: "mash", anchor: h(o) },
        checks: [h(o)],
        done: T(t, o),
      }),
    ));
  const u = D(e.props, e.recipe),
    d = B(e.recipe.mash, u),
    S = t?.timerEvents || [],
    I = S.some((o) => String(o.key || "").startsWith("mash-end"));
  let p = -1;
  (d.forEach((o, s) => {
    S.some((g) => String(g.key || "").includes(String(o.id))) &&
      (p = Math.max(p, s));
  }),
    d.forEach((o, s) => {
      const g = o.label === "Aquecimento";
      n({
        id: `guide-${o.id}`,
        phase: "mash",
        type: "timer",
        title: g
          ? i("Aquecer para {step}", {
              step: o.eventTimeLabel || i("o pr\xF3ximo patamar"),
            }) + (o.eventTargetLabel ? ` \xB7 ${o.eventTargetLabel}` : "")
          : `${o.label} \xB7 ${o.detail}`,
        detail: g
          ? i("~{min} min (estimado)", { min: y(o.durationMin, 0) })
          : `${y(o.durationMin, 0)} min`,
        ref: { tab: "mash", anchor: "mash-steps" },
        context: "mash",
        itemId: o.id,
        done: I || s < p,
      });
    }));
  const v = k(t?.properties?.mashWaterUsedL, l.mashWater),
    m = Math.max(0, k(l.totalWater) - v);
  m > 0.05 &&
    n({
      id: "mash-sparge",
      phase: "mash",
      type: "check",
      title: i("Lave com {vol}", { vol: b(m, 1) }),
      detail: i("\xE1gua a ~76\u201378 \xB0C"),
      ref: { tab: "mash", anchor: "sparge" },
      done: E(t, "mash-sparge"),
    });
  const M = O(t, e, "pre");
  (n({
    id: "mash-preboil-reading",
    phase: "mash",
    type: "leitura",
    title: i("Leitura pr\xE9-fervura"),
    detail: z(M),
    ref: { tab: "mash", anchor: "reading-pre" },
    done: F(t, "preBoil"),
  }),
    ["actionable", "verifying", "done"].includes(M) &&
      n({
        id: "mash-pre-correction",
        phase: "mash",
        type: "correcao",
        title: i("Ajuste a pr\xE9-fervura"),
        detail: _(e.preCorrection, t, "pre"),
        ref: { tab: "mash", anchor: "correction-pre" },
        done: M === "done",
      }));
  const W = K(e),
    x = W.flatMap((o) =>
      (o.additions || []).filter((s) => s.use === "First wort"),
    );
  (x.length &&
    n({
      id: "boil-firstwort",
      phase: "boil",
      type: "check",
      title: i("Adicione {names}", { names: x.map((o) => o.name).join(", ") }),
      detail: i("first wort \u2014 antes de ferver"),
      ref: { tab: "boil", anchor: h(x[0]) },
      checks: x.map(h),
      done: x.every((o) => T(t, o)),
    }),
    n({
      id: "boil-start",
      phase: "boil",
      type: "timer",
      title: i("Leve o mosto \xE0 fervura"),
      detail: i("{min} min de fervura", { min: y(e.recipe.boilTimeMin, 0) }),
      ref: { tab: "boil", anchor: "boil-hops" },
      context: "boil",
      itemId: null,
      done: V(t, "boil", "boil-start"),
    }));
  const R = [];
  W.forEach((o) => {
    const s = (o.additions || []).filter((f) => f.use !== "First wort");
    if (!s.length) return;
    if (o.phase === "hopstand") {
      R.push({ item: o, additions: s });
      return;
    }
    n({
      id: `guide-${o.id}`,
      phase: "boil",
      type: "check",
      title: i("Adicione {names}", { names: s.map((f) => f.name).join(", ") }),
      detail: o.eventTimeLabel,
      ref: { tab: "boil", anchor: h(s[0]) },
      checks: s.map(h),
      done: s.every((f) => T(t, f)),
    });
  });
  const $ = O(t, e, "post");
  (n({
    id: "boil-postboil-reading",
    phase: "boil",
    type: "leitura",
    title: i("Leitura p\xF3s-fervura"),
    detail: z($) || i("no fim da fervura (flameout)"),
    ref: { tab: "boil", anchor: "reading-post" },
    done: F(t, "postBoil"),
  }),
    ["actionable", "verifying", "done"].includes($) &&
      n({
        id: "boil-post-correction",
        phase: "boil",
        type: "correcao",
        title: i("Ajuste a p\xF3s-fervura"),
        detail: _(e.postCorrection, t, "post"),
        ref: { tab: "boil", anchor: "correction-post" },
        done: $ === "done",
      }),
    R.forEach(({ item: o, additions: s }) => {
      const g = J(e, s);
      n({
        id: `guide-${o.id}`,
        phase: "boil",
        type: "check",
        title: i("Adicione {names}", {
          names: s.map((f) => f.name).join(", "),
        }),
        detail:
          i("hopstand {time}", { time: o.eventTimeLabel }) +
          (g ? i(" a {t}\xB0C", { t: y(g, 0) }) : ""),
        ref: { tab: "boil", anchor: h(s[0]) },
        checks: s.map(h),
        done: s.every((f) => T(t, f)),
      });
    }),
    n({
      id: "boil-chill",
      phase: "boil",
      type: "check",
      title: i("Resfrie o mosto"),
      detail: i("at\xE9 a temperatura de inocula\xE7\xE3o"),
      ref: { tab: "boil", anchor: "chill" },
      done: E(t, "boil-chill"),
    }),
    n({
      id: "boil-cold-reading",
      phase: "boil",
      type: "leitura",
      title: i("Leitura fria"),
      detail: i("volume no fermentador e trub"),
      ref: { tab: "boil", anchor: "cold-reading" },
      done: k(t?.measurements?.cold?.fermenterVolumeL) > 0,
    }),
    c.forEach((o) => {
      o.tier || (o.tier = Y(o));
    }));
  const G = X(c, t, { ...e, spargeEffectiveL: m, phMode: !!r.phMode }),
    w = { essencial: 0, guia: 1, copiloto: 2 },
    H = w[a] ?? w.guia,
    A = G.filter((o) => (w[o.tier] ?? w.guia) <= H);
  let q = -1;
  A.forEach((o, s) => {
    o.done && (q = s);
  });
  let L = A.findIndex((o, s) => !o.done && s > q);
  if (a === "copiloto") {
    const o = A.findIndex((s) => s.type === "leitura" && !s.done);
    o >= 0 && (L < 0 || o < L) && (L = o);
  }
  return (
    A.forEach((o, s) => {
      o.status = o.done
        ? "done"
        : s === L
          ? "current"
          : s < q
            ? "skipped"
            : "pending";
    }),
    A
  );
}
function Y(e) {
  return e.type === "leitura" ||
    e.type === "correcao" ||
    (Array.isArray(e.checks) && e.checks.length)
    ? "essencial"
    : "guia";
}
const P = [
    {
      at: "start",
      id: "op-review",
      phase: "prepare",
      icon: "note",
      title: "Revise a receita e o plano do dia",
    },
    {
      at: "start",
      id: "op-ingredients",
      phase: "prepare",
      icon: "book",
      title: "Confira se tem todos os ingredientes",
    },
    {
      at: "start",
      id: "op-mill",
      phase: "prepare",
      icon: "scale",
      title: (e) =>
        i("Moa {mass} de malte (se em gr\xE3o)", {
          mass: j(e.volumes.grainKg),
        }),
    },
    {
      at: "start",
      id: "op-clean",
      phase: "prepare",
      icon: "drop",
      title: "Limpe os equipamentos de brassagem",
    },
    {
      at: "start",
      id: "op-valves",
      phase: "prepare",
      icon: "settings",
      title: "Feche as v\xE1lvulas dos equipamentos",
    },
    {
      at: "start",
      id: "op-heat-mash-water",
      phase: "prepare",
      icon: "water",
      title: (e) => {
        const t = k(e.recipe?.mash?.[0]?.temperatureC);
        return t
          ? i("Aque\xE7a {vol} a ~{t} \xB0C para a mostura", {
              vol: b(e.volumes.mashWater, 1),
              t: y(t + 4, 0),
            })
          : i("Aque\xE7a {vol} para a mostura", {
              vol: b(e.volumes.mashWater, 1),
            });
      },
    },
    {
      after: "mash-doughin",
      id: "op-mash-stir",
      phase: "mash",
      kind: "companion",
      icon: "mash",
      title: "Com a chama ligada, mantenha agita\xE7\xE3o",
    },
    {
      before: "mash-sparge",
      id: "op-heat-sparge",
      phase: "mash",
      icon: "water",
      title: (e) =>
        i("Aque\xE7a {vol} a 76\u201378 \xB0C para a lavagem", {
          vol: b(e.spargeEffectiveL ?? e.volumes.sparge, 1),
        }),
      tip: (e) =>
        i(
          "Aproveite para aquecer a \xE1gua de lavagem enquanto faz a mostura \u2014 {vol} a 76\u201378 \xB0C",
          { vol: b(e.spargeEffectiveL ?? e.volumes.sparge, 1) },
        ),
    },
    {
      after: "mash-sparge",
      id: "op-recirculate",
      phase: "mash",
      icon: "swap",
      title: "Recircule o mosto at\xE9 clarificar",
    },
    {
      after: "mash-sparge",
      id: "op-transfer-kettle",
      phase: "mash",
      icon: "boil",
      title: (e) =>
        i("Transfira o mosto para a panela \u2014 alvo {vol}", {
          vol: b(e.volumes.preBoil, 1),
        }),
    },
    {
      after: "boil-start",
      id: "op-hotbreak",
      phase: "boil",
      kind: "companion",
      icon: "boil",
      title: "Hotbreak no in\xEDcio: controle o fogo e agite",
    },
    {
      before: "boil-postboil-reading",
      id: "op-chiller-in",
      phase: "boil",
      icon: "timer",
      title: "Aos ~5 min do fim, mergulhe o chiller",
      tip: "Aproveite para deixar o chiller \xE0 m\xE3o \u2014 ele entra na panela aos ~5 min do fim",
    },
    {
      before: "boil-chill",
      id: "op-whirlpool",
      phase: "boil",
      icon: "swap",
      title: "Fa\xE7a o whirlpool (redemoinho)",
    },
    {
      before: "boil-chill",
      id: "op-sanitize-cold",
      phase: "boil",
      icon: "drop",
      title: "Sanitize tudo que vai tocar o mosto frio",
    },
    {
      before: "boil-chill",
      id: "op-fermenter-ready",
      phase: "boil",
      icon: "ferment",
      title: "Fermentador, torneira, mangueiras e airlock sanitizados",
    },
    {
      after: "boil-cold-reading",
      id: "op-aerate",
      phase: "boil",
      icon: "swap",
      title: "Aere o mosto",
    },
    {
      after: "boil-cold-reading",
      id: "op-pitch",
      phase: "boil",
      icon: "flask",
      title: (e) => {
        const t = e.recipe?.yeasts?.[0]?.name;
        return t
          ? i("Adicione a levedura \u2014 {yeast}", { yeast: t })
          : i("Adicione a levedura");
      },
    },
    {
      after: "boil-cold-reading",
      id: "op-close-airlock",
      phase: "boil",
      icon: "ferment",
      title: "Feche o fermentador e ponha o airlock",
    },
    {
      after: "boil-cold-reading",
      id: "op-fridge",
      phase: "boil",
      icon: "thermo",
      title: (e) => {
        const t = k(e.recipe?.fermentation?.[0]?.temperatureC);
        return t
          ? i("Leve \xE0 geladeira \u2014 fermenta\xE7\xE3o a {t} \xB0C", {
              t: y(t, 0),
            })
          : i("Leve \xE0 geladeira na temperatura de fermenta\xE7\xE3o");
      },
    },
    {
      after: "boil-cold-reading",
      id: "op-cleanup",
      phase: "boil",
      icon: "drop",
      title: "Limpe os equipamentos da brassagem",
    },
  ],
  C = (e, t) => (typeof e == "function" ? e(t) : i(e || ""));
export function copilotoCompanions(e, t, a = "copiloto") {
  return a !== "copiloto"
    ? []
    : P.filter((r) => r.kind === "companion" && r.phase === t).map((r) => ({
        id: r.id,
        phase: r.phase,
        icon: r.icon || "check",
        title: C(r.title, e),
        detail: C(r.detail, e),
      }));
}
function X(e, t, a) {
  const r = (l) => ({
      id: l.id,
      phase: l.phase,
      type: "check",
      tier: "copiloto",
      icon: l.icon || "check",
      title: C(l.title, a),
      detail: C(l.detail, a),
      tip: C(l.tip, a),
      ref: { tab: l.phase, anchor: l.id },
      done: E(t, l.id),
    }),
    c = (l, u) => P.filter((d) => d[l] === u && d.kind !== "companion").map(r),
    n = [...c("at", "start")];
  return (
    e.forEach((l) => {
      (c("before", l.id).forEach((u) => n.push(u)),
        n.push(l),
        c("after", l.id).forEach((u) => n.push(u)));
    }),
    n
  );
}
function _(e, t, a) {
  return t?.correctionAccepted?.[a]
    ? i("desvio aceito \u2014 seguindo como est\xE1")
    : (t?.correctionRounds?.[a] || []).length > 0
      ? i("aplicada \u2014 confira ou conclua")
      : !e || e.status === "pending"
        ? i("aguardando a leitura")
        : e.action === "Sem corre\xE7\xE3o"
          ? i("sem corre\xE7\xE3o necess\xE1ria")
          : `${i(e.action)} \xB7 ${b(e.targetVolumeL, 2)}`;
}
function z(e) {
  return e === "none"
    ? i("no alvo \u2014 sem corre\xE7\xE3o \u2713")
    : e === "actionable" || e === "verifying" || e === "done"
      ? i("fora do alvo \u2014 veja o ajuste")
      : "";
}
function J(e, t) {
  const a = new Set(t.map((c) => c.id)),
    r = (e.boilAdditions || []).find(
      (c) => a.has(c.id) && Number.isFinite(Number(c.temperatureC)),
    );
  return r ? k(r.temperatureC) : null;
}
export function mashStepStates(e, t = {}) {
  const a = e?.recipe?.mash || [],
    r = D(e?.props, e?.recipe),
    c = B(a, r),
    n = t?.timerEvents || [],
    l = n.some((p) => String(p.key || "").startsWith("mash-start")),
    u = n.some((p) => String(p.key || "").startsWith("mash-end"));
  let d = l ? 0 : -1;
  c.forEach((p, v) => {
    n.some((m) => String(m.key || "").includes(String(p.id))) &&
      (d = Math.max(d, v));
  });
  let S = -1;
  const I = new Map();
  return (
    c.forEach((p, v) => {
      p.label !== "Aquecimento" && ((S += 1), I.set(S, v));
    }),
    a.map((p, v) => {
      if (u) return "done";
      const m = I.get(v);
      return m === void 0 || d < 0
        ? "pending"
        : m < d
          ? "done"
          : m === d || (m === d + 1 && c[d]?.label === "Aquecimento")
            ? "current"
            : "pending";
    })
  );
}
export function currentGuideStep(e = []) {
  return e.find((t) => t.status === "current") || null;
}
const Q = { mash: "op-heat-sparge", boil: "op-chiller-in" };
export function copilotoTimerTip(e = [], t = "") {
  const a = Q[t];
  if (!a) return null;
  const r = e.find((c) => c.id === a);
  return r && !r.done ? r : null;
}
export function nextGuideStep(e = []) {
  const t = e.findIndex((a) => a.status === "current");
  return t < 0 ? null : e[t + 1] || null;
}
export function guideProgress(e = []) {
  const t = e.filter((a) => a.done).length;
  return { done: t, total: e.length, allDone: e.length > 0 && t === e.length };
}
