import { el as e, button as h, card as x } from "./ui.js";
import { t, tEngine as E } from "./i18n.js";
import { toNumber as N } from "./engine.js";
import {
  CONTROLS as R,
  SECTIONS as z,
  SECTION_LABELS as L,
  CONTROL_LABELS as M,
  ASSUMED_CONTROLS as T,
  scaleParts as $,
} from "./analysis/controls.js";
import { perceptionView as C } from "./analysis/perception-view.js?v=server-analysis-v1";
import {
  constrainedBetaFromMeanSd as D,
  betaQuantile as g,
} from "./analysis/bounded-beta.js";
import { app as i } from "./state.js";
import { runLocalAnalysis } from "./analysis/local-engine.js";
const O = { bom: "good", alerta: "warn", neutro: "neutral" };
let f = 0;
export async function requestRecipeAnalysis(a = {}) {
  const n = i.editorDraft;
  if (!n || !(n.fermentables || []).length) return !1;
  const s = ++f;
  ((i.analysisLoading = !0), (i.analysisError = ""), i.requestRender());
  try {
    const l = runLocalAnalysis({
      draft: n,
      seed: a.seed ?? i.analysisSeed ?? 1,
      styleSlug: a.styleSlug ?? i.analysisStyleSlug,
    });
    if (!l?.ok || !l.analysis)
      throw new Error("N\xE3o foi poss\xEDvel analisar esta receita.");
    return s !== f
      ? !1
      : ((i.analysisData = l.analysis),
        (i.analysisSeed = l.analysis.seed),
        (i.analysisStyleSlug = l.analysis.styleSlug),
        !0);
  } catch (r) {
    return (
      s !== f ||
        (i.analysisError =
          r?.message || "N\xE3o foi poss\xEDvel analisar esta receita."),
      !1
    );
  } finally {
    s === f && ((i.analysisLoading = !1), i.requestRender());
  }
}
function q(a) {
  return e("li", `analysis-effect ${O[a.tone] || "neutral"}`, [
    e("span", "analysis-effect-text", t(a.text, a.data || {})),
    e("span", "analysis-conf", t(a.confidence)),
  ]);
}
function A(a) {
  return [
    a.titleKey ? t(a.titleKey) : null,
    a.titleData ? E(a.titleData) : null,
    a.titleUse ? "\xB7 " + t(a.titleUse) : null,
    a.titleMeta ? "\xB7 " + a.titleMeta : null,
  ]
    .filter(Boolean)
    .join(" ");
}
function B(a) {
  const n = (a.effects || []).filter((s) => s && s.text);
  return n.length
    ? e("div", `analysis-step kind-${a.kind}`, [
        e("div", "analysis-step-head", [
          e("b", "analysis-step-title", A(a)),
          a.gPerL
            ? e("span", "analysis-step-meta num", `${a.gPerL} g/L`)
            : null,
        ]),
        e("ul", "analysis-effect-list", n.map(q)),
      ])
    : null;
}
const k = {
  provável: "high",
  possível: "mid",
  "pouco prov\xE1vel": "low",
  improvável: "low",
};
function P(a) {
  const n = Math.round(a.freq * 100);
  return e("div", `analysis-note-row ${k[a.word] || "mid"}`, [
    e("span", "analysis-note-text", t(a.text)),
    e("span", "analysis-bar", [
      e("span", "analysis-bar-fill", "", { style: `width:${n}%` }),
    ]),
    e("span", "analysis-note-word", t(a.word)),
  ]);
}
const p = (a, n) => Math.max(0, Math.min(100, (a / n) * 100)),
  V = new Set(["color"]);
export function betaBandForControl(a, n = {}) {
  const s = Math.max(1, Number(n.max) || 5);
  if (V.has(a))
    return {
      p10: n.p10,
      center: n.p50,
      p90: n.p90,
      standardDeviation: n.standardDeviation || 0,
      adjusted: !1,
    };
  const r = Math.max(0, Number(n.standardDeviation) || 0),
    l = s * 0.1,
    o = D({
      mean: Number.isFinite(Number(n.mean))
        ? Number(n.mean)
        : Number(n.p50) || 0,
      standardDeviation: Math.max(r, l),
      max: s,
      minShape: 1,
    });
  return {
    p10: g(o, 0.1),
    center: o.mean,
    p90: g(o, 0.9),
    standardDeviation: o.standardDeviation,
    adjusted: !0,
    constrained: o.constrained,
  };
}
function _(a, n) {
  const s = $(a, n);
  return s.length
    ? s.length === 1
      ? t(s[0])
      : t("{a} a {b}", { a: t(s[0]), b: t(s[1]) })
    : "";
}
function j(a, n, s) {
  const r = n.max,
    l = betaBandForControl(a, n),
    o = p(l.p10, r),
    v = p(l.center, r),
    d = p(l.p90, r),
    c = [e("span", "viz-base", "")];
  let m = "";
  if (s) {
    const [y, u, b] = s;
    (c.push(
      e("span", "viz-band", "", {
        style: `left:${p(y, r)}%;width:${Math.max(1.5, p(u, r) - p(y, r))}%`,
      }),
    ),
      c.push(e("span", "viz-ideal", "", { style: `left:${p(b, r)}%` })),
      (m = l.center >= y - 0.5 && l.center <= u + 0.5 ? "in" : "out"));
  }
  return (
    c.push(
      e("span", "viz-whisker", "", {
        style: `left:${o}%;width:${Math.max(0, d - o)}%`,
      }),
    ),
    c.push(e("span", "viz-p50", "", { style: `left:${v}%` })),
    n.saturado && (m += " saturado"),
    e("div", `viz-row ${m}`, [
      e("span", "viz-label", t(M[a] || a)),
      e("span", "viz-track", c),
      e("span", "viz-readout", [
        e("b", "viz-word", _(a, l.center)),
        e(
          "span",
          "viz-num num",
          String(Math.round(l.center * 100) / 100),
          n.saturado
            ? {
                title: t(
                  "O modelo bruto atingiu o limite; a faixa inclui a incerteza m\xEDnima.",
                ),
              }
            : {},
        ),
      ]),
    ])
  );
}
function I(a, n, s, r) {
  const l = z.map((o) => {
    const v = R.filter(
      (d) => d.section === o && a.controls[d.key] && !T.has(d.key),
    ).map((d) => j(d.key, a.controls[d.key], n && n[d.key]));
    return e("div", "viz-section", [
      e("b", "viz-section-title", t(L[o])),
      ...v,
    ]);
  });
  return x(t("Perfil previsto"), "summary", [
    e(
      "p",
      "analysis-mc-note muted",
      n
        ? t(
            "Barra escura = faixa prov\xE1vel de {n} simula\xE7\xF5es com margem m\xEDnima; ponto = centro. \xC1rea clara = o que {s} espera; risco = ideal.",
            { n: a.runs, s },
          )
        : t(
            "Barra = faixa prov\xE1vel de {n} simula\xE7\xF5es com margem m\xEDnima. Escolha um estilo para ver a faixa esperada ao lado.",
            { n: a.runs },
          ),
    ),
    U(r),
    ...l,
  ]);
}
function F(a) {
  return a < 0.4
    ? "neutro"
    : a < 1.2
      ? "leve"
      : a < 2.5
        ? "m\xE9dio"
        : "acentuado";
}
function U(a) {
  const n = N(a, 0),
    s = Math.max(0, Math.min(3, Math.ceil(n / 1.2))),
    r = [];
  for (let l = 1; l <= 3; l += 1)
    r.push(e("span", `red-sq ${l <= s ? "on" : ""}`, ""));
  return e("div", "analysis-redtone", [
    e("span", "analysis-redtone-label", t("Tom vermelho")),
    e("span", "analysis-redtone-dots", r),
    e("b", "analysis-redtone-word", t(F(n))),
  ]);
}
function S(a) {
  const n = document.createElement("select");
  n.className = "analysis-style-select";
  const s = document.createElement("option");
  ((s.value = ""),
    (s.textContent = t("Sem estilo de refer\xEAncia")),
    a || (s.selected = !0),
    n.append(s));
  for (const r of i.analysisData?.styleOptions || []) {
    const l = r.slug,
      o = document.createElement("option");
    ((o.value = l),
      (o.textContent = `${r.code} \xB7 ${r.name}`),
      l === a && (o.selected = !0),
      n.append(o));
  }
  return (
    n.addEventListener("change", () => {
      ((i.analysisStyleSlug = n.value),
        requestRecipeAnalysis({ styleSlug: n.value }));
    }),
    e("label", "analysis-style", [
      e("span", "muted", t("Comparar com o estilo:")),
      n,
    ])
  );
}
function K(a, n) {
  const s = (a.notes || []).filter(
      (o) => o.categoria === "aroma" || o.categoria === "sabor",
    ),
    r = n || [];
  if (!s.length && !r.length) return null;
  const l = [e("b", "viz-section-title", t("Notas marcantes"))];
  return (
    r.length &&
      l.push(
        e(
          "div",
          "analysis-malt-notes",
          r.map((o) =>
            e("span", `analysis-malt-note f${Math.ceil(o.forca * 3)}`, t(o.d)),
          ),
        ),
      ),
    s.length && l.push(e("div", "analysis-notes", s.map(P))),
    e("div", "analysis-marks", l)
  );
}
function W() {
  const a = i.analysisSeed || 1;
  return e("div", "analysis-seed", [
    e("span", "muted", t("Semente: {seed}", { seed: a })),
    h(
      t("Re-simular"),
      () => {
        ((i.analysisSeed = (i.analysisSeed || 1) + 1),
          requestRecipeAnalysis({ seed: i.analysisSeed }));
      },
      "btn ghost small",
    ),
  ]);
}
const J = [
  { id: "perception", label: "Cen\xE1rios sensoriais" },
  { id: "bands", label: "Perfil e bandas" },
];
function Q(a) {
  return e(
    "div",
    "analysis-viewswitch",
    J.map((n) =>
      h(
        t(n.label),
        () => {
          ((i.analysisView = n.id), i.requestRender());
        },
        `btn small${n.id === a ? " primary" : " ghost"}`,
        { "aria-pressed": String(n.id === a) },
      ),
    ),
  );
}
export function analysisScreen() {
  const a = i.editorDraft,
    n = h(
      "\u2190 " + t("Voltar \xE0 receita"),
      () => {
        ((f += 1),
          (i.analysisLoading = !1),
          (i.view = "editor"),
          i.requestRender(),
          window.scrollTo({ top: 0, behavior: "instant" }));
      },
      "btn ghost small analysis-back",
    );
  if (i.analysisLoading)
    return e("div", "screen analysis-screen analysis-loading-screen", [
      n,
      e(
        "div",
        "analysis-loading-card",
        [
          e("span", "analysis-loading-spinner", "", { "aria-hidden": "true" }),
          e("span", "analysis-beta-badge", t("Modo beta")),
          e("h1", "page-title", t("Realizando simula\xE7\xF5es\u2026")),
          e(
            "p",
            "analysis-sub",
            t("Estimando a faixa sensorial prov\xE1vel desta receita."),
          ),
        ],
        { role: "status", "aria-live": "polite" },
      ),
    ]);
  if (!a || !(a.fermentables || []).length)
    return e("div", "screen analysis-screen", [
      n,
      e("h1", "page-title", t("An\xE1lise da receita")),
      e("p", "muted", t("Adicione ao menos um malte para analisar a receita.")),
    ]);
  if (i.analysisError)
    return e("div", "screen analysis-screen", [
      n,
      e("h1", "page-title", t("An\xE1lise da receita")),
      e("p", "muted", t(i.analysisError)),
      h(
        t("Tentar novamente"),
        () => void requestRecipeAnalysis(),
        "btn primary",
      ),
    ]);
  const s = i.analysisData;
  if (!s)
    return e("div", "screen analysis-screen", [
      n,
      e("p", "muted", t("A an\xE1lise ainda n\xE3o foi executada.")),
    ]);
  const r = s.recipe,
    l = s.recipe,
    o = s.context,
    d = i.analysisView === "bands" ? "bands" : "perception",
    c = s.deterministic,
    m = s.stochastic,
    y = s.styleSlug || "",
    u = s.styleEntry,
    b = c.steps.map(B).filter(Boolean),
    w = s.forecast;
  return e("div", "screen analysis-screen", [
    n,
    d === "perception"
      ? null
      : e("div", "analysis-head", [
          e("h1", "page-title", t("An\xE1lise da receita")),
          e(
            "p",
            "analysis-sub",
            t(
              "Simula\xE7\xE3o do efeito de cada adi\xE7\xE3o, na ordem da brassagem \u2014 tend\xEAncias, n\xE3o veredito. N\xE3o conclua por uma leitura s\xF3.",
            ),
          ),
          e("b", "analysis-recipe-name", r.name || t("Receita")),
        ]),
    d === "perception" ? null : Q(d),
    d === "bands" ? S(y) : null,
    d === "bands"
      ? I(m, u && u.bands, u && u.name, c.redTone)
      : C(w, {
          recipe: l,
          context: o,
          styleEntry: u,
          seed: i.analysisSeed || 1,
          comparisons: s.comparisons,
          styleSelector: S(y),
          openTechnical: () => {
            ((i.analysisView = "bands"), i.requestRender());
          },
        }),
    d === "bands" ? K(m, c.maltPerception) : null,
    d === "perception" ? null : W(),
    d === "perception"
      ? null
      : e("div", "analysis-diary", [
          e("b", "analysis-diary-title", t("Di\xE1rio da an\xE1lise")),
          ...b,
        ]),
  ]);
}
