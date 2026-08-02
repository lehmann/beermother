import { toNumber as s, chartTicks as y, dayTicks as j } from "./engine.js";
import { t as T, fmt as d } from "./i18n.js";
export function svgNumber(t) {
  return Number(t)
    .toFixed(2)
    .replace(/\.?0+$/, "");
}
export function polylinePath(t) {
  return t.length
    ? t
        .map((n, c) => `${c ? "L" : "M"} ${svgNumber(n.x)} ${svgNumber(n.y)}`)
        .join(" ")
    : "";
}
export function smoothPath(t) {
  if (!t.length) return "";
  if (t.length === 1) return `M ${svgNumber(t[0].x)} ${svgNumber(t[0].y)}`;
  const n = [`M ${svgNumber(t[0].x)} ${svgNumber(t[0].y)}`];
  for (let c = 1; c < t.length; c += 1) {
    const e = t[c - 1],
      r = t[c],
      $ = (e.x + r.x) / 2;
    n.push(
      `C ${svgNumber($)} ${svgNumber(e.y)} ${svgNumber($)} ${svgNumber(r.y)} ${svgNumber(r.x)} ${svgNumber(r.y)}`,
    );
  }
  return n.join(" ");
}
function R(t) {
  return String(Math.floor(Math.max(0, s(t))));
}
function f(t, n) {
  if (!t.length || !n.length) return "";
  const c = t
      .map((r, $) => `${$ ? "L" : "M"} ${svgNumber(r.x)} ${svgNumber(r.y)}`)
      .join(" "),
    e = [...n]
      .reverse()
      .map((r) => `L ${svgNumber(r.x)} ${svgNumber(r.y)}`)
      .join(" ");
  return `${c} ${e} Z`;
}
function F(t, n, c) {
  if (!t || t.length < 2) return "";
  const e = (o) =>
      t
        .filter((h) => Number.isFinite(Number(h[o])))
        .map((h) => ({ x: n(h.day), y: c(s(h[o])) })),
    r = f(e("extractP95"), e("extractP05")),
    $ = f(e("extractP84"), e("extractP16")),
    x = smoothPath(e("extractP50"));
  return `
    ${r ? `<path class="chart-expected-extract-band wide" d="${r}" />` : ""}
    ${$ ? `<path class="chart-expected-extract-band" d="${$}" />` : ""}
    ${x ? `<path class="chart-expected-median" d="${x}" />` : ""}`;
}
export function fermentationChartSvg(t) {
  const e = { left: 70, right: 78, top: 34, bottom: 46 },
    r = 720 - e.left - e.right,
    $ = 300 - e.top - e.bottom,
    x = (a) => e.left + (Math.max(0, s(a)) / Math.max(1, t.maxDay)) * r,
    o = (a) => (w) =>
      e.top + (1 - (s(w) - a.min) / Math.max(1, a.max - a.min)) * $,
    h = o(t.tempRange),
    i = o(t.extractRange),
    g = t.tempPoints.map((a) => ({ x: x(a.day), y: h(a.value) })),
    l = t.realTempPoints.map((a) => ({ x: x(a.day), y: h(a.value) })),
    m = t.extractPoints.map((a) => ({ x: x(a.day), y: i(a.value) })),
    p = i(t.expectedFgPlato),
    u = j(t.maxDay)
      .map(
        (a) => `
    <line x1="${svgNumber(x(a))}" y1="${e.top}" x2="${svgNumber(x(a))}" y2="${300 - e.bottom}" />
    <text x="${svgNumber(x(a))}" y="284" text-anchor="middle">${R(a)}</text>`,
      )
      .join(""),
    b = y(t.tempRange.min, t.tempRange.max, 4)
      .map(
        (a) => `
    <line x1="${e.left}" y1="${svgNumber(h(a))}" x2="${720 - e.right}" y2="${svgNumber(h(a))}" />
    <text x="${e.left - 10}" y="${svgNumber(h(a) + 4)}" text-anchor="end">${d(a, 1)}</text>`,
      )
      .join(""),
    P = y(t.extractRange.min, t.extractRange.max, 4)
      .map(
        (a) => `
    <text x="${720 - e.right + 10}" y="${svgNumber(i(a) + 4)}" text-anchor="start">${d(a, 1)}</text>`,
      )
      .join(""),
    M = m
      .map(
        (a) =>
          `<circle class="chart-extract-point" cx="${svgNumber(a.x)}" cy="${svgNumber(a.y)}" r="4" />`,
      )
      .join(""),
    v = l
      .map(
        (a) =>
          `<circle class="chart-temp-real-point" cx="${svgNumber(a.x)}" cy="${svgNumber(a.y)}" r="4" />`,
      )
      .join("");
  return `<svg viewBox="0 0 720 300" role="img" aria-label="${T("Gr\xE1fico de fermenta\xE7\xE3o com temperatura e extrato")}">
    <g class="chart-grid">${u}${b}</g>
    <g class="chart-axis">
      <path d="M ${e.left} ${e.top} V ${300 - e.bottom} H ${720 - e.right}" />
      <path d="M ${720 - e.right} ${e.top} V ${300 - e.bottom}" />
      <text x="${e.left}" y="298" text-anchor="start">dias</text>
      ${P}
    </g>
    ${F(t.expected, x, i)}
    ${Number.isFinite(p) ? `<line class="chart-fg-line" x1="${e.left}" y1="${svgNumber(p)}" x2="${720 - e.right}" y2="${svgNumber(p)}" />` : ""}
    ${g.length ? `<path class="chart-temp-line" d="${polylinePath(g)}" />` : ""}
    ${l.length > 1 ? `<path class="chart-temp-real-line" d="${smoothPath(l)}" />` : ""}
    ${v}
    ${m.length > 1 ? `<path class="chart-extract-line" d="${smoothPath(m)}" />` : ""}
    ${M}
  </svg>`;
}
