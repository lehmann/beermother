import {
  toNumber as u,
  round as m,
  parseUserNumber as v,
  HECTOLITER_THRESHOLD_L as b,
} from "./engine.js";
import { t as f, fmt as h, formatInputValue as x } from "./i18n.js";
export const HOSTED_ASSET_BASE =
    "https://beermother.com.br/wp-content/uploads/2026/05/",
  ASSET_BASE = "assets/",
  BRAND_LOGO = `${HOSTED_ASSET_BASE}beermother-wordmark.png`,
  LOCAL_BRAND_LOGO = `${ASSET_BASE}brand/beermother-wordmark.png`,
  LOCAL_BRAND_MARK = `${ASSET_BASE}brand/beermother-mark.png`,
  BRAND_MARK = `${HOSTED_ASSET_BASE}beermother-mark.png`,
  FONT_CSS = `${ASSET_BASE}fonts/inter.css`;
export function assetUrl(t) {
  return new URL(t, location.href).href;
}
export function el(t, e, n = [], o = {}) {
  const r = document.createElement(t);
  return (
    e && (r.className = e),
    Object.entries(o || {}).forEach(([a, c]) => {
      c != null && r.setAttribute(a, c);
    }),
    [n]
      .flat(1 / 0)
      .filter((a) => a != null)
      .forEach((a) => {
        r.append(a instanceof Node ? a : document.createTextNode(String(a)));
      }),
    r
  );
}
export function button(t, e, n = "btn", o = {}) {
  const r = el("button", n, t, { type: "button", ...o });
  return (r.addEventListener("click", e), r);
}
export function iconButton(t, e, n, o = "icon-btn") {
  const r = el("button", o, [icon(t)], {
    type: "button",
    title: e,
    "aria-label": e,
  });
  return (r.addEventListener("click", n), r);
}
export function selectOnFocus(t) {
  t.addEventListener("focus", () => {
    try {
      t.select();
    } catch {}
    const e = (n) => {
      (n.preventDefault(), t.removeEventListener("mouseup", e));
    };
    t.addEventListener("mouseup", e);
  });
}
export function decimalInput(t, e, n = {}) {
  const o = document.createElement("input");
  ((o.type = "text"),
    (o.inputMode = "decimal"),
    (o.value = x(t)),
    Object.entries(n).forEach(([c, l]) => o.setAttribute(c, l)),
    selectOnFocus(o));
  let r = o.value;
  const a = () => {
    o.value !== r && ((r = o.value), e(o.value === "" ? "" : v(o.value)));
  };
  return (
    o.addEventListener("keydown", (c) => {
      if (c.key === "Enter") (c.preventDefault(), a(), o.blur());
      else if (c.key === "Tab") {
        const l = focusTargetIndex(o, c.shiftKey ? -1 : 1);
        (c.preventDefault(), a(), moveFocusAfterRender(l));
      }
    }),
    o.addEventListener("blur", a),
    o.addEventListener("change", a),
    o
  );
}
export function tabbableElements() {
  return Array.from(
    document.querySelectorAll(
      "input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((t) => {
    const e = window.getComputedStyle(t),
      n = t.getBoundingClientRect();
    return (
      e.display !== "none" &&
      e.visibility !== "hidden" &&
      n.width > 0 &&
      n.height > 0
    );
  });
}
export function dataFieldElements() {
  return tabbableElements().filter((t) => {
    const e = t.tagName;
    return e === "SELECT" || e === "TEXTAREA"
      ? !0
      : e !== "INPUT"
        ? !1
        : ![
            "button",
            "submit",
            "reset",
            "checkbox",
            "radio",
            "file",
            "image",
          ].includes((t.type || "text").toLowerCase());
  });
}
export function focusTargetIndex(t, e) {
  const o = dataFieldElements().indexOf(t);
  return o < 0 ? -1 : o + e;
}
export function moveFocusAfterRender(t) {
  window.setTimeout(() => {
    const e = dataFieldElements();
    if (t < 0 || !e.length) return;
    const n = e[Math.max(0, Math.min(e.length - 1, t))];
    n &&
      n !== document.activeElement &&
      (n.focus({ preventScroll: !0 }),
      n.select && n.tagName === "INPUT" && n.select());
  }, 0);
}
export function field(t, e, n, o, r = {}) {
  const a = decimalInput(e, o, r);
  return el("label", "field", [
    el("span", "field-label", t),
    el("div", "field-line", [a, el("b", "field-unit", n)]),
  ]);
}
export function cellInput(t, e, n = "", o = {}) {
  const r = decimalInput(t, e, o);
  return el("span", "cell-edit", [r, n ? el("b", "", n) : null]);
}
export function volumeCellInput(t, e, n = {}, o = t) {
  const r = t === "" || t === void 0 || t === null ? NaN : u(t),
    a = Number.isFinite(r) ? r : u(o),
    c = Math.abs(a) >= b,
    l = t === "" || t === void 0 || t === null ? "" : c ? m(u(t) / 100, 2) : t,
    d = { ...n };
  if (d.placeholderL !== void 0) {
    const i = u(d.placeholderL);
    ((d.placeholder = c ? h(i / 100, 1) : h(i, 2)), delete d.placeholderL);
  }
  return cellInput(
    l,
    (i) => {
      if (i === "") {
        e("");
        return;
      }
      e(c ? m(u(i) * 100, 2) : i);
    },
    c ? "hL" : "L",
    d,
  );
}
export function setButtonFeedback(t, e, n, o = !1) {
  ((t.textContent = n),
    t.classList.toggle("danger", !!o),
    window.setTimeout(() => {
      ((t.textContent = e), t.classList.remove("danger"));
    }, 1600));
}
export function toast(t, e = "") {
  let n = document.querySelector("#toast");
  (n ||
    ((n = document.createElement("div")),
    (n.id = "toast"),
    document.body.append(n)),
    (n.className = `toast ${e === "error" ? "error" : ""}`),
    (n.textContent = t),
    window.clearTimeout(toast.timer),
    (toast.timer = window.setTimeout(() => n.remove(), 2600)));
}
export async function writeClipboardText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(t);
    return;
  }
  const e = document.createElement("textarea");
  ((e.value = t),
    e.setAttribute("readonly", ""),
    (e.style.position = "fixed"),
    (e.style.opacity = "0"),
    document.body.append(e),
    e.select(),
    document.execCommand("copy"),
    e.remove());
}
export function isEditableElement(t) {
  const e = t instanceof Element ? t : null;
  return e
    ? !!e.closest("input, textarea, select, [contenteditable='true']")
    : !1;
}
let s = null,
  p = null;
export function showSheetBackdrop(t, e = null) {
  (hideSheetBackdrop(),
    (s = el("div", "sheet-backdrop")),
    s.addEventListener("click", () => {
      typeof t == "function" && t();
    }),
    document.body.append(s),
    document.body.classList.add("sheet-open"));
  const n = () => {
      typeof t == "function" && t();
    },
    o = (a) => {
      a.key === "Escape" && (a.preventDefault(), n());
    },
    r = (a) => {
      !e || !document.contains(e) || e.contains(a.target) || n();
    };
  (document.addEventListener("keydown", o),
    e && document.addEventListener("pointerdown", r),
    (p = { onKey: o, onPointer: r }));
}
export function hideSheetBackdrop() {
  (s && (s.remove(), (s = null)),
    p &&
      (document.removeEventListener("keydown", p.onKey),
      document.removeEventListener("pointerdown", p.onPointer),
      (p = null)),
    document.body.classList.remove("sheet-open"));
}
export function downloadTextFile(t, e, n) {
  const o = new Blob([t], { type: n }),
    r = document.createElement("a");
  ((r.href = URL.createObjectURL(o)),
    (r.download = e),
    document.body.append(r),
    r.click(),
    r.remove(),
    window.setTimeout(() => URL.revokeObjectURL(r.href), 1e3));
}
const M = {
  prepare:
    "M9 3h6M10 3v5.2L5.2 16a4 4 0 0 0 3.4 6h6.8a4 4 0 0 0 3.4-6L14 8.2V3M7.5 14h9",
  mash: "M6 3h12v4a6 6 0 0 1-12 0V3zM6 5H4a2 2 0 0 0 0 4h2M12 13v4M8 21h8M12 17c-1.5 0-2.5.8-2.8 2M12 17c1.5 0 2.5.8 2.8 2",
  boil: "M5 11a7 7 0 0 1 14 0v1a7 7 0 0 1-14 0v-1zM8 6.5c0-1.5 1-2 1-3.5M12 6c0-1.5 1-2 1-3.5M5 21h14",
  ferment:
    "M12 2v4M8 6h8M8.5 6v4.8L5 18a3 3 0 0 0 2.7 4h8.6A3 3 0 0 0 19 18l-3.5-7.2V6M9 15h6",
  summary:
    "M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 8h8M8 12h8M8 16h5",
  timer:
    "M9 2h6M12 4v2M12 8v4.5l3 2.5M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM5 5l1.5 1.5M19 5l-1.5 1.5",
  play: "M8 5.5v13l11-6.5-11-6.5z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  check: "M4.5 12.5l5 5L19.5 7",
  next: "M6 5v14l8-7-8-7zM16 5h2.5v14H16z",
  previous: "M18 5v14l-8-7 8-7zM5.5 5H8v14H5.5z",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  settings:
    "M4 7h7M17 7h3M12 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 12h3M11 12h9M7 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 17h9M17 17h3M13 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  water:
    "M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3zM9 14.5a3.2 3.2 0 0 0 3 3",
  salt: "M9 3h6v3H9zM10 6h4v3l3.6 8.4A2.5 2.5 0 0 1 15.3 21H8.7a2.5 2.5 0 0 1-2.3-3.6L10 9V6z",
  drop: "M12 3s6 6.5 6 10.7A6 6 0 0 1 6 13.7C6 9.5 12 3 12 3z",
  save: "M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 3v5h7V3M7 14h10v7H7z",
  upload:
    "M12 3v11M7.5 7.5L12 3l4.5 4.5M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2",
  open: "M4 6a2 2 0 0 1 2-2h4l2 2h7a1 1 0 0 1 1 1v2H4zM3.5 9h18l-1.8 9.3a2 2 0 0 1-2 1.7H7.3a2 2 0 0 1-2-1.7L3.5 9z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  download:
    "M12 3v11M7.5 10.5L12 15l4.5-4.5M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2",
  pdf: "M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 13h7M8.5 17h7",
  review: "M11 4a7 7 0 1 0 4.9 12L21 21M11 8v3.5l2.5 1.5",
  swap: "M7 8h11l-3-3M17 16H6l3 3",
  theme: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z",
  note: "M5 4a1 1 0 0 1 1-1h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4zM14 3v6h6M8 13h8M8 17h5",
  book: "M12 6c-1.5-1.6-3.6-2.5-6-2.5h-2v15h2.5c2.2 0 4.2.8 5.5 2.2 1.3-1.4 3.3-2.2 5.5-2.2H20v-15h-2c-2.4 0-4.5.9-6 2.5zM12 6v14.5",
  drag: "M5 8h14M5 12h14M5 16h14",
  percent:
    "M5.5 18.5l13-13M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  undo: "M8.5 5L4 9.5 8.5 14M4 9.5h10a5.5 5.5 0 0 1 0 11h-3",
  redo: "M15.5 5L20 9.5 15.5 14M20 9.5H10a5.5 5.5 0 0 0 0 11h3",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  chevron: "M8 10l4 4 4-4",
  flask:
    "M9 3h6M10 3v5.2L5.2 16a4 4 0 0 0 3.4 6h6.8a4 4 0 0 0 3.4-6L14 8.2V3M7.5 15.5h9",
  thermo: "M10 4a2 2 0 0 1 4 0v9.3a4.5 4.5 0 1 1-4 0V4zM12 12v6",
  scale:
    "M4 7h16M7 7l-2.8 6a3 3 0 0 0 5.6 0L7 7zM17 7l-2.8 6a3 3 0 0 0 5.6 0L17 7zM12 4v13M9 21h6",
  hop: "M12 3c-4 2-6.5 5.5-6.5 9.5S8 20 12 21c4-1 6.5-4.5 6.5-8.5S16 5 12 3zM12 3v18M8 9c1.3 1 2.6 1.5 4 1.5S14.7 10 16 9M8 14c1.3 1 2.6 1.5 4 1.5s2.7-.5 4-1.5",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v9",
  trash:
    "M5 7h14M9 7V4h6v3M10 11v6M14 11v6M6 7l1 13h10l1-13",
};
export function icon(t, e = "icon") {
  const n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  (n.setAttribute("viewBox", "0 0 24 24"),
    n.setAttribute("aria-hidden", "true"),
    n.setAttribute("focusable", "false"),
    n.setAttribute("class", e));
  const o = document.createElementNS("http://www.w3.org/2000/svg", "path");
  return (
    o.setAttribute("d", M[t] || M.summary),
    o.setAttribute("fill", "none"),
    o.setAttribute("stroke", "currentColor"),
    o.setAttribute("stroke-width", "1.8"),
    o.setAttribute("stroke-linecap", "round"),
    o.setAttribute("stroke-linejoin", "round"),
    n.append(o),
    n
  );
}
export function fallbackImage(t, e, n = {}, o = null) {
  const r = document.createElement("img");
  return (
    Object.entries(n).forEach(([a, c]) => {
      if (c != null) {
        if (a === "className") {
          r.className = c;
          return;
        }
        if (a in r) {
          r[a] = c;
          return;
        }
        r.setAttribute(a, c);
      }
    }),
    (r.src = t),
    (r.onerror = () => {
      ((r.onerror = typeof o == "function" ? () => o(r) : null), (r.src = e));
    }),
    r
  );
}
export function card(t, e, n, o = null, r = "") {
  return el("section", `card ${r}`, [
    t
      ? el("header", "card-head", [
          e ? icon(e, "icon card-icon") : null,
          el("h2", "card-title", t),
          o ? el("div", "card-actions", o) : null,
        ])
      : null,
    el("div", "card-body", n),
  ]);
}
export function stat(t, e, n = "") {
  return el("div", `stat ${n}`, [
    el("span", "stat-label", t),
    el("b", "stat-value", e),
  ]);
}
export function listRow(t, e = "") {
  return el(
    "div",
    `list-row ${e}`,
    t.map((n) => (n instanceof Node ? n : el("span", "", n))),
  );
}
export function copyCodeLine(t) {
  const e = document.createElement("input");
  ((e.className = "code-input"),
    (e.readOnly = !0),
    (e.value = t),
    e.addEventListener("focus", () => e.select()),
    e.addEventListener("click", () => e.select()));
  const n = el("button", "btn small", f("Copiar"), { type: "button" });
  return (
    n.addEventListener("click", async () => {
      e.select();
      try {
        await navigator.clipboard.writeText(t);
      } catch {
        document.execCommand("copy");
      }
      ((n.textContent = f("Copiado")),
        window.setTimeout(() => {
          n.textContent = f("Copiar");
        }, 1400));
    }),
    el("div", "code-line", [e, n])
  );
}
