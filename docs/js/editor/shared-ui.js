import { app as c, loadDriveEnabled as drvEnabled } from "../state.js";
import {
  parseUserNumber as Xa,
  toNumber as m,
  round as T,
} from "../engine.js";
import {
  el as a,
  button as d,
  iconButton as D,
  icon as R,
  decimalInput as U,
  selectOnFocus as wt,
  toast as b,
  focusTargetIndex as yt,
  moveFocusAfterRender as Et,
} from "../ui.js";
import { t, fmt as P, formatInputValue as Ee, localeTag as ka } from "../i18n.js";
import {
  computeTargets,
  saveMyRecipe,
  loadUserLibrary as De,
  saveUserIngredient as Ye,
  scaleFermentablesToOg as Rt,
} from "../recipes.js";
import {
  MALT_LIBRARY as xt,
  HOP_LIBRARY as Dt,
  YEAST_LIBRARY as Ot,
  MISC_LIBRARY as Gt,
} from "../library.js";
import {
  inventoryMaltItems,
  inventoryHopItems,
  inventoryYeastItems,
  inventoryMiscItems,
} from "../inventory.js";
import { openSheet as I, closeSheet as h } from "./sheets.js";

export function A(e, o, n, r) {
  const i = m(e, o);
  if (i < o || i > n) {
    const s = Math.min(n, Math.max(o, i));
    return (
      b(
        t("{label}: ajustado para {value} (faixa {min}–{max}).", {
          label: t(r),
          value: Ee(s),
          min: Ee(o),
          max: Ee(n),
        }),
      ),
      s
    );
  }
  return i;
}

export function qe({
  title: e,
  placeholder: o,
  items: n,
  itemLabel: r,
  onPick: i,
  onPickMany: s,
  customLabel: l,
  multi: u = !1,
}) {
  let p = "",
    f = null;
  const E = new Set(),
    y = a("div", "picker-list"),
    g = document.createElement("input");
  ((g.type = "text"),
    (g.placeholder = o || "Buscar…"),
    g.setAttribute("aria-label", o || "Buscar"),
    g.addEventListener("input", () => {
      ((p = g.value), v());
    }),
    g.addEventListener("keydown", ($) => {
      $.key === "Enter" && f && ($.preventDefault(), f());
    }));
  const q = u
    ? d(
        t("Adicionar"),
        () => {
          if (!E.size) return;
          const $ = [...E].map((M) => n[M]);
          (h(), s($));
        },
        "btn primary",
      )
    : null;
  function N() {
    q &&
      ((q.textContent = E.size ? `Adicionar (${E.size})` : "Adicionar"),
      q.classList.toggle("disabled-look", !E.size));
  }
  function v() {
    ((y.innerHTML = ""), (f = null));
    const $ = p.trim().toLowerCase();
    if (
      (n.forEach((M, V) => {
        if (!($ && !r(M).toLowerCase().includes($)))
          if (u) {
            const w = E.has(V),
              L = d(
                [
                  a("span", "picker-check", w ? "☑" : "☐"),
                  a("span", "", r(M)),
                ],
                () => {
                  (E.has(V) ? E.delete(V) : E.add(V), v(), N());
                },
                `picker-row multi ${w ? "on" : ""}`,
              );
            (f || (f = () => L.click()), y.append(L));
          } else {
            const w = () => {
              (h(), i(M));
            };
            (f || (f = w), y.append(d(r(M), w, "picker-row")));
          }
      }),
      $)
    ) {
      const M = () => {
        (h(), i({ custom: p.trim() }));
      };
      (f || (f = M),
        y.append(
          d(`${l || "Criar"} “${p.trim()}”`, M, "picker-row custom"),
        ));
    }
  }
  (I(
    [
      a("b", "sheet-title", e),
      g,
      y,
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost"), q]),
    ],
    "picker",
  ),
    v(),
    N(),
    g.focus());
}

export function Ge(e, o, n) {
  const r = { name: o };
  (e === "malts" && Object.assign(r, { yieldPct: 78, ebc: 5, type: "Gr\xE3o" }),
    e === "hops" && Object.assign(r, { alpha: 10 }),
    e === "yeasts" && Object.assign(r, { attenuation: 78, tempC: 19 }),
    e === "miscs" &&
      Object.assign(r, { amount: 1, unit: "g", use: "Fervura", timeMin: 10 }));
  const i = [];
  (i.push(
    a("label", "field", [
      a("span", "field-label", t("Nome")),
      Ta(r.name, (s) => {
        r.name = s;
      }),
    ]),
  ),
    e === "malts" &&
      i.push(
        a("label", "field", [
          a("span", "field-label", t("Rendimento")),
          F(
            r.yieldPct,
            (s) => {
              r.yieldPct = A(s, 1, 100, "Rendimento");
            },
            "%",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Cor")),
          F(
            r.ebc,
            (s) => {
              r.ebc = A(s, 0, 2e3, "Cor");
            },
            "EBC",
          ),
        ]),
      ),
    e === "hops" &&
      i.push(
        a("label", "field", [
          a("span", "field-label", t("Alfa \xE1cido")),
          F(
            r.alpha,
            (s) => {
              r.alpha = A(s, 0, 25, t("Alfa \xE1cido"));
            },
            "%",
          ),
        ]),
      ),
    e === "yeasts" &&
      i.push(
        a("label", "field", [
          a("span", "field-label", t("Atenua\xE7\xE3o")),
          F(
            r.attenuation,
            (s) => {
              r.attenuation = A(s, 30, 100, t("Atenua\xE7\xE3o"));
            },
            "%",
          ),
        ]),
      ),
    I(
      [
        a("b", "sheet-title", `Novo: ${o}`),
        a("div", "sheet-fields", i),
        a("div", "sheet-actions", [
          d(
            t("S\xF3 nesta receita"),
            () => {
              (h(), n(r, !1));
            },
            "btn",
          ),
          d(
            t("Salvar na biblioteca"),
            () => {
              (h(),
                Ye(e, { ...r }),
                b(t('"{name}" salvo na sua biblioteca.', { name: r.name })),
                n(r, !0));
            },
            "btn primary",
          ),
        ]),
      ],
      "details",
    ));
}

export function Ta(e, o, n = {}) {
  return W(e, o, n);
}

export const on = 0.1;

export function H(e, o) {
  const n = (i) => {
    const s = m(Xa(e.value), 0),
      l = Math.max(0, T(s + i, 3));
    ((e.value = Ee(l)),
      typeof e.dispatchEvent == "function" && typeof Event < "u"
        ? e.dispatchEvent(new Event("change"))
        : typeof e.dispatch == "function" && e.dispatch("change"));
  };
  e.addEventListener("keydown", (i) => {
    (i.key === "ArrowUp" && (i.preventDefault(), n(o)),
      i.key === "ArrowDown" && (i.preventDefault(), n(-o)));
  });
  const r = P(o, o < 1 ? (o < 0.01 ? 3 : 1) : 0);
  return a("span", "step-wrap", [
    e,
    a("span", "stepper-arrows", [
      d([R("chevron", "icon flip")], () => n(o), "stepper-btn", {
        title: `Aumentar ${r} (↑)`,
        "aria-label": `Aumentar ${r}`,
        tabindex: "-1",
      }),
      d([R("chevron", "icon")], () => n(-o), "stepper-btn", {
        title: `Diminuir ${r} (↓)`,
        "aria-label": `Diminuir ${r}`,
        tabindex: "-1",
      }),
    ]),
  ]);
}

export function _(e, o, n, r = {}) {
  return H(U(e, o, r), n);
}

export function rn(e, o, n = {}) {
  return _(e, o, on, n);
}

export const sn = {
  "%": 0.5,
  L: 1,
  min: 1,
  "\xB0C": 0.5,
  EBC: 1,
  g: 0.5,
  "L/kg": 0.1,
  "%/h": 0.5,
  dias: 1,
  SG: 0.001,
  IBU: 1,
  kg: 0.1,
  "\xB0C/min": 0.1,
};

export function F(e, o, n, r = sn[n]) {
  const i = U(e, o, {});
  return a("div", "field-line", [r ? H(i, r) : i, a("b", "field-unit", n)]);
}

export function ln() {
  const inv = inventoryMaltItems().map((e) => ({
    ...e,
    mine: !0,
    inStock: !0,
  }));
  return [
    ...inv,
    ...De().malts.map((e) => ({ ...e, mine: !0 })),
    ...xt,
  ];
}

export function cn() {
  const inv = inventoryHopItems().map((e) => ({
    ...e,
    mine: !0,
    inStock: !0,
  }));
  return [...inv, ...De().hops.map((e) => ({ ...e, mine: !0 })), ...Dt];
}

export function dn() {
  const inv = inventoryYeastItems().map((e) => ({
    ...e,
    mine: !0,
    inStock: !0,
  }));
  return [...inv, ...De().yeasts.map((e) => ({ ...e, mine: !0 })), ...Ot];
}

export function un() {
  const inv = inventoryMiscItems().map((e) => ({
    ...e,
    mine: !0,
    inStock: !0,
  }));
  return [...inv, ...De().miscs.map((e) => ({ ...e, mine: !0 })), ...Gt];
}

export function pageHead(e, o, n = []) {
  return a("div", "page-head", [
    a("div", "page-head-text", [
      a("h1", "page-title", e),
      o ? a("span", "page-meta", o) : null,
    ]),
    n.length ? a("div", "page-actions", n) : null,
  ]);
}

export function na(e) {
  const o = new Date(e || "");
  return Number.isFinite(o.getTime())
    ? o.toLocaleString(ka(), {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

export function Qn(e, o) {
  if (!e.fermentables.length) {
    b(t("Adicione maltes antes de definir a OG."), "error");
    return;
  }
  if (!e.fermentables.some((r) => m(r.amountKg) > 0)) {
    b(
      t("Defina as quantidades primeiro — os maltes est\xE3o em 0 kg."),
      "error",
    );
    return;
  }
  let n = o.og;
  I(
    [
      a("b", "sheet-title", t("Definir OG")),
      a(
        "p",
        "sheet-message",
        t(
          "Os maltes ser\xE3o escalados proporcionalmente para atingir a densidade.",
        ),
      ),
      a("label", "field", [
        a("span", "field-label", t("OG desejada")),
        a("div", "field-line", [
          H(
            U(
              n.toFixed(3),
              (r) => {
                n = m(r, o.og);
              },
              {},
            ),
            0.001,
          ),
          a("b", "field-unit", "SG"),
        ]),
      ]),
      a("div", "sheet-actions", [
        d(t("Cancelar"), () => h(), "btn ghost"),
        d(
          t("Escalar maltes"),
          () => {
            const r = A(n, 1.02, 1.15, "OG");
            (Rt(e, r),
              h(),
              b(t("Maltes escalados para OG {og}.", { og: r.toFixed(3) })),
              c.requestRender());
          },
          "btn primary",
        ),
      ]),
    ],
    "details",
  );
}

export function S(e) {
  (e(), drvEnabled(), c.requestRender());
}

export function xa() {
  const e = c.editorDraft;
  !e ||
    !(
      String(e.name || "").trim() ||
      (e.fermentables || []).length > 0 ||
      (e.hops || []).length > 0 ||
      (e.yeasts || []).length > 0 ||
      (e.miscs || []).length > 0
    ) ||
    saveMyRecipe(e, { isDraft: !0 });
}

export function W(e, o, n = {}) {
  const r = document.createElement("input");
  ((r.type = "text"),
    (r.value = e ?? ""),
    Object.entries(n).forEach(([l, u]) => r.setAttribute(l, u)),
    wt(r));
  let i = r.value;
  const s = () => {
    r.value !== i && ((i = r.value), o(r.value));
  };
  return (
    r.addEventListener("blur", s),
    r.addEventListener("change", s),
    r.addEventListener("keydown", (l) => {
      if (l.key === "Enter") (l.preventDefault(), s(), r.blur());
      else if (l.key === "Tab") {
        const u = yt(r, l.shiftKey ? -1 : 1);
        (l.preventDefault(), s(), Et(u));
      }
    }),
    r
  );
}

export function le(e, o, n, r = {}) {
  const i = document.createElement("select");
  return (
    Object.entries(r).forEach(([l, u]) => i.setAttribute(l, u)),
    (o != null && o !== "" && !e.some((l) => l.value === o)
      ? [{ value: o, label: o }, ...e]
      : e
    ).forEach((l) => {
      const u = document.createElement("option");
      ((u.value = l.value),
        (u.textContent = l.label),
        l.value === o && (u.selected = !0),
        i.append(u));
    }),
    (i.value = o),
    i.addEventListener("change", () => n(i.value)),
    i
  );
}

export function ee(e) {
  return a("span", "row-unit", e);
}

export function Da(e, o) {
  const n = a("span", "drag-handle", [R("drag", "icon")], {
    title: t("Arrastar para reordenar"),
  });
  return (
    n.addEventListener("pointerdown", (r) => {
      r.preventDefault();
      const i = n.closest(".editor-rows");
      if (!i) return;
      const s = Array.from(i.querySelectorAll(".editor-row"));
      s[o]?.classList.add("dragging");
      let l = o;
      const u = (f) => {
          const E = f.clientY;
          ((l = o),
            s.forEach((y, g) => {
              const q = y.getBoundingClientRect();
              (y.classList.toggle(
                "drag-over",
                E >= q.top && E <= q.bottom && g !== o,
              ),
                E >= q.top && E <= q.bottom && (l = g));
            }));
        },
        p = () => {
          if (
            (document.removeEventListener("pointermove", u),
            document.removeEventListener("pointerup", p),
            s.forEach((f) => f.classList.remove("dragging", "drag-over")),
            l !== o)
          ) {
            const [f] = e.splice(o, 1);
            (e.splice(l, 0, f), c.requestRender());
          }
        };
      (document.addEventListener("pointermove", u),
        document.addEventListener("pointerup", p));
    }),
    n
  );
}

export function ce(e, o, n) {
  return a("div", "row-name-wrap grow", [
    d(e || t("sem nome"), o, "row-name-btn", { title: n }),
  ]);
}

export function ge(e) {
  return D("close", t("Remover linha"), e, "icon-btn subtle small-btn");
}

export function de(e, o, n, r = null, i = null) {
  return a("section", "card", [
    a("header", "card-head", [
      R(o, "icon card-icon"),
      a("h2", "card-title", e),
      r || i
        ? a("div", "card-actions", [
            ...(i || []),
            r ? (r instanceof Node ? r : a("span", "head-meta", r)) : null,
          ])
        : null,
    ]),
    a("div", "card-body", n),
  ]);
}
