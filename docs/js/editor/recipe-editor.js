import {
  WATER_IONS as ma,
  DEFAULT_PROFILE as O,
  DEFAULT_BASE_WATER_PROFILE as He,
  sanitizeBaseWaterProfile as We,
  isPlainObject as we,
  toNumber as m,
  round as T,
  calculate as Te,
  createRecipeSession as pa,
  acidDoseForTarget,
  DEFAULT_MASH_PH_TARGET,
} from "../engine.js";
import {
  app as c,
  startRecipe as Me,
  loadSavedProductionProfile as te,
  writeAutosaveNow as Be,
  loadDriveEnabled as drvEnabled,
  loadPhAcidType,
  loadPhAcidConcentration as loadPhAcidConc,
  loadAnalysisBetaMode as va,
} from "../state.js";
import { PH_ACID_TYPES as ht } from "../ph.js";
import {
  el as a,
  button as d,
  iconButton as D,
  icon as R,
  decimalInput as U,
  toast as b,
  setButtonFeedback as Lt,
  downloadTextFile as Ie,
} from "../ui.js";
import {
  t,
  tEngine as qa,
  fmt as P,
  formatInputValue as Ee,
  formatVolume as z,
  formatMaltMass as Ra,
} from "../i18n.js";
import {
  newDraft as Pt,
  computeTargets,
  recipeFromDraft as Le,
  saveMyRecipe,
  getMyRecipe as Ea,
  recipeToBeerXml as Pa,
  beerXmlFileName as Aa,
  FERMENTABLE_TYPES as qt,
  scaleFermentablesToOg as Rt,
  scaleHopsToIbu as kt,
  rescaleDraftForEquipment as Ct,
  BASE_EQUIPMENT_PROFILE as J,
  setFermentablePercentWithBase as Tt,
  normalizeFermentablePercents as Sa,
  applyFermentablePercentsWithOg as Nt,
  applyHopAlphaToAll as Mt,
  listProductionProfiles as X,
  saveProductionProfileEntry as ne,
  loadUserLibrary as De,
  saveUserIngredient as Ye,
  MAX_FERMENTATION_PRESSURE_ATM as $t,
} from "../recipes.js";
import {
  MALT_LIBRARY as xt,
  HOP_LIBRARY as Dt,
  YEAST_LIBRARY as Ot,
  MISC_LIBRARY as Gt,
  STYLE_LIBRARY as Vt,
  MASH_PRESETS as Ut,
  FERMENTATION_PRESETS as _t,
} from "../library.js";
import {
  ebcToHex as fe,
  openShoppingListSheet as Kt,
} from "../screens.js";
import { requestRecipeAnalysis as an } from "../analysis-screen.js";
import {
  inventoryWaterProfiles,
} from "../inventory.js";
import {
  openSheet as I,
  closeSheet as h,
  confirmDialog,
  pushUndoSnapshot,
  canUndo,
  canRedo,
  editorUndo,
  editorRedo,
} from "./sheets.js";
import { animateMarker } from "./animations.js";
import { drvUpload, drvOverwriteFile } from "./drive-sync.js";
import {
  A,
  H,
  _,
  rn,
  F,
  qe,
  Ge,
  S,
  xa,
  W,
  le,
  ee,
  Da,
  ce,
  ge,
  de,
  Qn as QnSheet,
  ln,
  cn,
  dn,
  un,
} from "./shared-ui.js";

// workspaceScreen is imported as homeScreen to match the existing call in editorScreen
import { workspaceScreen as homeScreen } from "./workspace.js";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let showIbuPerAddition = false;


// j() helper: trub-adjusted efficiency factor
function j(e) {
  return 1 + Math.min(0.5, Math.max(0, m(e, O.trubLossPct)));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const jn = [
  { key: "og", label: "OG", format: (e) => e.toFixed(3) },
  { key: "fg", label: "FG", format: (e) => e.toFixed(3) },
  { key: "abv", label: "ABV", format: (e) => `${P(e, 1)}%` },
  { key: "ibu", label: "IBU", format: (e) => String(Math.round(m(e))) },
  { key: "ebc", label: "Cor", format: (e) => `${P(e, 0)}` },
];
const Hn = {
  og: [1, 1.12],
  fg: [1, 1.04],
  abv: [0, 20],
  ibu: [0, 120],
  ebc: [0, 80],
};

const _a = ["Mostura", "First wort", "Fervura", "Hopstand", "Dry hop"];

// ---------------------------------------------------------------------------
// editorScreen — main exported entry point
// ---------------------------------------------------------------------------

export function editorScreen() {
  const e = c.editorDraft;
  if (!e) return homeScreen();
  pushUndoSnapshot(e);
  const o = computeTargets(e);
  return [
    zn(e),
    a("div", "editor-sticky", [Xn(o)]),
    Yn(e),
    no(e, o),
    oo(e, o),
    io(e, o),
    uo(e, o),
    fo(e),
    bo(e, o),
    ho(e),
    vo(e),
  ];
}

// ---------------------------------------------------------------------------
// Top-bar
// ---------------------------------------------------------------------------

function zn(e) {
  return a("div", "editor-topbar", [
    d(
      t("← Voltar"),
      () => {
        (drvEnabled(),
          Ea(e.id)?.isDraft && b(t("Rascunho guardado em Receitas.")),
          openHome("recipes"));
      },
      "btn ghost small",
    ),
    a("b", "editor-title", e.name || t("Nova receita")),
  ]);
}

// openHome is used by zn but lives in workspace.js — import it via a late binding
// to avoid circular deps. We resolve at call time from c._openHome if set, otherwise
// fall back to a no-op.
function openHome(section) {
  if (typeof c._openHome === "function") {
    c._openHome(section);
  }
}

// ---------------------------------------------------------------------------
// Targets bar (floating stats strip)
// ---------------------------------------------------------------------------

function Xn(e) {
  const o = e.style,
    n = jn.map(({ key: i, label: s, format: l }) => {
      const u = m(e[i]),
        p = i === "fg",
        f = i === "ebc",
        E = o ? o.ranges[i] : null,
        y = Array.isArray(E) && m(E[0]) === 0 && m(E[1]) === 0,
        g = y ? Hn[i] : E,
        q = y ? !0 : g ? u >= g[0] && u <= g[1] : !0,
        N = p && e.fg < 0.99,
        v = p ? (e.fgAssumed ? "FG*" : "FG") : t(s),
        $ = N || (g && !q);
      let M;
      if (f)
        if (e.ebc > 0) {
          const L = a("span", "ebc-swatch");
          ((L.style.background = fe(e.ebc)), (M = [L, `${P(e.ebc, 0)}`]));
        } else M = "-";
      else M = l(u);
      p && e.fgManual && (M = [l(u), a("span", "fg-mark", "⚠")]);
      const V = [
        a("div", "utarget-head", [
          a("span", "utarget-label", v),
          a("b", `utarget-value num ${$ ? "off" : ""}`, M),
        ]),
      ];
      if (g) {
        const [L, x] = g,
          ae = Math.max(x - L, 1e-4),
          k = ae * 0.6,
          B = L - k,
          K = x + k,
          ue = Math.min(1, Math.max(0, (u - B) / (K - B))),
          ve = (L - B) / (K - B),
          _e = ae / (K - B),
          ke = a("div", "style-bar-track"),
          Ce = a(
            "div",
            f ? "style-bar-band ebc" : `style-bar-band${y ? " neutral" : ""}`,
          );
        if (
          ((Ce.style.left = `${ve * 100}%`),
          (Ce.style.width = `${_e * 100}%`),
          f &&
            (Ce.style.background = `linear-gradient(90deg, ${fe(L)}, ${fe(x)})`),
          ke.append(Ce),
          !q)
        ) {
          const ua = u < L ? ve : ve + _e,
            je = a("div", "style-bar-gap");
          ((je.style.left = `${Math.min(ue, ua) * 100}%`),
            (je.style.width = `${Math.abs(ua - ue) * 100}%`),
            ke.append(je));
        }
        const ze = a(
          "div",
          `style-bar-marker ${y ? "neutral" : q ? "in" : "out"}`,
        );
        (f && e.ebc > 0 && (ze.style.background = fe(e.ebc)),
          animateMarker(ze, i, ue),
          ke.append(ze));
        const la = a("div", "style-bar-range num"),
          ca = a("span", "style-bar-tick", l(L));
        ca.style.left = `${ve * 100}%`;
        const da = a("span", "style-bar-tick", l(x));
        ((da.style.left = `${(ve + _e) * 100}%`),
          la.append(ca, da),
          V.push(ke, la));
      }
      const w = a("div", `utarget ${g ? "has-range" : ""}`, V);
      return (
        N
          ? (w.title = t(
              "FG muito baixa — confira a toler\xE2ncia alco\xF3lica da sua levedura; ela pode travar antes de fermentar tudo.",
            ))
          : p && e.fgManual
            ? (w.title = t(
                "FG fixada \xE0 m\xE3o — sobrescreve a calculada.",
              ))
            : p &&
              e.fgAssumed &&
              (w.title = t("Sem levedura: atenua\xE7\xE3o assumida de 78%.")),
        w
      );
    }),
    r = a("div", "utarget-actions", [
      D(
        "undo",
        t("Desfazer (Ctrl+Z)"),
        () => {
          editorUndo() || b(t("Nada para desfazer."));
        },
        `icon-btn tiny-btn ${canUndo() ? "" : "disabled-look"}`,
      ),
      D(
        "redo",
        t("Refazer (Ctrl+Y)"),
        () => {
          editorRedo() || b(t("Nada para refazer."));
        },
        `icon-btn tiny-btn ${canRedo() ? "" : "disabled-look"}`,
      ),
    ]);
  return a("div", `editor-targets ${o ? "with-style" : ""}`, [
    r,
    o
      ? a("div", "utarget-style", [
          a("b", "", o.name),
          o.ranges.code ? a("span", "muted", ` ${o.ranges.code}`) : null,
        ])
      : null,
    a("div", "utarget-grid", n),
  ]);
}

// ---------------------------------------------------------------------------
// Identity card (name, brewer, style, equipment)
// ---------------------------------------------------------------------------

function Yn(e) {
  const o = d(
    e.styleName || t("Escolher estilo…"),
    () => {
      qe({
        title: t("Estilo"),
        placeholder: t("Buscar estilo…"),
        items: Vt,
        itemLabel: (n) => `${n.code ? `${n.code} \xB7 ` : ""}${n.name}`,
        customLabel: t("Usar estilo livre"),
        onPick: (n) =>
          S(() => {
            e.styleName = n.custom ?? n.name;
          }),
      });
    },
    "btn field-like",
    { title: t("Estilos BJCP mostram as faixas abaixo dos alvos.") },
  );
  return a("section", "card", [
    a("div", "card-body", [
      a("div", "identity-grid", [
        a("label", "field span-full", [
          a("span", "field-label", t("Nome da receita")),
          W(
            e.name,
            (n) =>
              S(() => {
                e.name = n;
              }),
            { placeholder: t("APA da casa"), "data-fkey": "recipe-name" },
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Cervejeiro")),
          W(
            e.brewer,
            (n) =>
              S(() => {
                e.brewer = n;
              }),
            { placeholder: t("Autor"), "data-fkey": "recipe-brewer" },
          ),
        ]),
        a("div", "field", [a("span", "field-label", t("Estilo")), o]),
      ]),
      Zn(e),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// Equipment chip
// ---------------------------------------------------------------------------

function Zn(e) {
  const o = T(m(e.mashEfficiencyPct, 65) / j(e.trubLossPct), 1),
    n = e.equipmentProfileName || t("Equipamento padr\xE3o"),
    r = d(
      [
        R("scale", "icon"),
        a("span", "equip-chip-name", n),
        R("chevron", "icon"),
      ],
      () => {
        eo(e);
      },
      "equip-chip",
      { title: t("Escolher ou editar o perfil de equipamento.") },
    );
  return a("div", "equip-line", [
    r,
    a("label", "field equip-field", [
      a("span", "field-label", t("Volume no fermentador")),
      a("div", "field-line", [
        H(
          U(
            e.batchVolumeL,
            (i) =>
              S(() => {
                e.batchVolumeL = A(i, 1, 1e4, "Volume");
              }),
            { "data-fkey": "recipe-vol" },
          ),
          1,
        ),
        a("b", "field-unit", "L"),
      ]),
    ]),
    a("label", "field equip-field", [
      a("span", "field-label", t("Efici\xEAncia do equipamento")),
      a("div", "field-line", [
        H(
          U(
            o,
            (i) =>
              S(() => {
                e.mashEfficiencyPct = T(
                  A(i, 20, 95, t("Efici\xEAncia do equipamento")) *
                    j(e.trubLossPct),
                  1,
                );
              }),
            { "data-fkey": "recipe-eff" },
          ),
          0.5,
        ),
        a("b", "field-unit", "%"),
      ]),
    ]),
    a("label", "field equip-field", [
      a("span", "field-label", t("Fervura")),
      a("div", "field-line", [
        H(
          U(
            e.boilTimeMin,
            (i) =>
              S(() => {
                e.boilTimeMin = A(i, 10, 240, "Fervura");
              }),
            { "data-fkey": "recipe-boil" },
          ),
          1,
        ),
        a("b", "field-unit", "min"),
      ]),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// sa — apply equipment params to draft
// ---------------------------------------------------------------------------

export function sa(e, o = {}, n) {
  (Number.isFinite(Number(o.mashEfficiencyPct)) &&
    (e.mashEfficiencyPct = m(o.mashEfficiencyPct)),
    Number.isFinite(Number(o.targetVolumeL)) &&
      (e.batchVolumeL = m(o.targetVolumeL)),
    Number.isFinite(Number(o.trubLossPct)) &&
      (e.trubLossPct = Math.min(0.5, Math.max(0, m(o.trubLossPct)))),
    Number.isFinite(Number(o.evaporationPct)) &&
      (e.evaporationPct = Math.min(40, Math.max(0, m(o.evaporationPct)))),
    Number.isFinite(Number(o.whirlpoolNoChillMin)) &&
      (e.whirlpoolNoChillMin = Math.min(
        120,
        Math.max(0, m(o.whirlpoolNoChillMin)),
      )),
    Number.isFinite(Number(o.whirlpoolTemperatureC)) &&
      (e.whirlpoolTemperatureC = Math.min(
        100,
        Math.max(40, m(o.whirlpoolTemperatureC)),
      )),
    Number.isFinite(Number(o.heatingRateCMin)) &&
      (e.heatingRateCMin = Math.min(10, Math.max(0, m(o.heatingRateCMin)))),
    we(o.baseWaterProfile) && (e.baseWaterProfile = We(o.baseWaterProfile, He)),
    n !== void 0 && (e.equipmentProfileName = n));
}

// ---------------------------------------------------------------------------
// Oa — async confirm + apply equipment
// ---------------------------------------------------------------------------

async function Oa(e, o, n) {
  const r = computeTargets(e),
    i = m(e.batchVolumeL, 20),
    s =
      (e.fermentables || []).some((f) => m(f.amountKg) > 0) ||
      (e.hops || []).some((f) => m(f.amountG) > 0) ||
      (e.yeasts || []).some((f) => m(f.amount) > 0),
    l = Math.abs(m(o.targetVolumeL, i) - i) > i * 0.01,
    u =
      Math.abs(
        m(o.mashEfficiencyPct, e.mashEfficiencyPct) - m(e.mashEfficiencyPct),
      ) > 0.5;
  S(() => sa(e, o, n));
  const p = n || t("Equipamento padr\xE3o");
  if (
    s &&
    (l || u) &&
    (await confirmDialog({
      title: t("Escalar a receita para o novo equipamento?"),
      message: t(
        'Malte, l\xFApulo, levedura, sais e insumos escalam para manter a OG e o IBU de antes no volume novo — a cor pode variar com a efici\xEAncia. "Manter" s\xF3 troca o equipamento e deixa as quantidades como est\xE3o.',
      ),
      confirmLabel: t("Escalar receita"),
      cancelLabel: t("Manter como est\xE1"),
    }))
  ) {
    (S(() => Ct(e, r, i)),
      b(
        t(
          "Receita escalada para {vol}: OG {og} e {ibu} IBU preservados. Ctrl+Z desfaz.",
          { vol: z(e.batchVolumeL, 0), og: r.og.toFixed(3), ibu: P(r.ibu, 0) },
        ),
      ));
    return;
  }
  b(t('Equipamento "{name}" aplicado.', { name: p }));
}

// ---------------------------------------------------------------------------
// eo — equipment picker sheet
// ---------------------------------------------------------------------------

function eo(e) {
  const o = X(),
    n = T(m(J.params.mashEfficiencyPct, 65) / j(J.params.trubLossPct), 1),
    r = a("div", "equip-row", [
      d(
        [
          a("b", "", t("Equipamento padr\xE3o")),
          a(
            "span",
            "muted",
            ` ${z(J.params.targetVolumeL, 0)} \xB7 ${P(n, 1)}%`,
          ),
        ],
        () => {
          (h(), Oa(e, J.params, ""));
        },
        `equip-apply ${e.equipmentProfileName ? "" : "active"}`,
      ),
    ]),
    i = o.map((s) => {
      const l = T(
          m(s.params.mashEfficiencyPct, 65) / j(s.params.trubLossPct),
          1,
        ),
        u = s.name === e.equipmentProfileName;
      return a("div", "equip-row", [
        d(
          [
            a("b", "", s.name),
            a(
              "span",
              "muted",
              ` ${z(s.params.targetVolumeL, 0)} \xB7 ${P(l, 1)}%`,
            ),
          ],
          () => {
            (h(), Oa(e, s.params, s.name));
          },
          `equip-apply ${u ? "active" : ""}`,
        ),
        D(
          "scale",
          t("Editar este perfil"),
          () => {
            (h(), c._equipmentProfileSheet && c._equipmentProfileSheet(s));
          },
          "icon-btn small-btn",
        ),
      ]);
    });
  I(
    [
      a("b", "sheet-title", t("Equipamento")),
      a(
        "p",
        "sheet-message",
        t(
          "Escolha um perfil (volume, efici\xEAncia e fervura entram na receita) ou crie um novo. Se a receita j\xE1 tem ingredientes, o app pergunta se escala as quantidades.",
        ),
      ),
      a("div", "equip-list", [r, ...i]),
      a("div", "sheet-actions", [
        d(
          t("Novo perfil…"),
          () => {
            (h(), c._equipmentProfileSheet && c._equipmentProfileSheet(null));
          },
          "btn",
        ),
        d(t("Fechar"), () => h(), "btn ghost"),
      ]),
    ],
    "details",
  );
}

// ---------------------------------------------------------------------------
// Ga — apply equipment to session
// ---------------------------------------------------------------------------

function Ga(e, o = {}, n) {
  const r = { ...e.properties };
  (Number.isFinite(Number(o.targetVolumeL)) &&
    (r.targetVolumeL = m(o.targetVolumeL)),
    Number.isFinite(Number(o.mashEfficiencyPct)) &&
      (r.mashEfficiencyPct = m(o.mashEfficiencyPct)),
    Number.isFinite(Number(o.evaporationPct)) &&
      (r.evaporationPct = Math.min(40, Math.max(0, m(o.evaporationPct)))),
    Number.isFinite(Number(o.grainAbsorptionLkg)) &&
      (r.grainAbsorptionLkg = m(o.grainAbsorptionLkg)),
    Number.isFinite(Number(o.waterToGrainRatioLkg)) &&
      (r.waterToGrainRatioLkg = m(o.waterToGrainRatioLkg)),
    Number.isFinite(Number(o.mashTunDeadSpaceL)) &&
      (r.mashTunDeadSpaceL = m(o.mashTunDeadSpaceL)),
    Number.isFinite(Number(o.whirlpoolNoChillMin)) &&
      (r.whirlpoolNoChillMin = m(o.whirlpoolNoChillMin)),
    Number.isFinite(Number(o.whirlpoolTemperatureC)) &&
      (r.whirlpoolTemperatureC = m(o.whirlpoolTemperatureC)),
    Number.isFinite(Number(o.heatingRateCMin)) &&
      ((r.heatingRateCMin = Math.min(10, Math.max(0, m(o.heatingRateCMin)))),
      (e.recipe.heatingRateCMin = r.heatingRateCMin)),
    Number.isFinite(Number(o.trubLossPct)) &&
      ((r.trubLossPct = Math.min(0.5, Math.max(0, m(o.trubLossPct)))),
      (r.trubLossL = T(m(r.targetVolumeL, 20) * r.trubLossPct, 2)),
      (r.trubLossEdited = !1)),
    we(o.baseWaterProfile) && (r.baseWaterProfile = We(o.baseWaterProfile, He)),
    (e.properties = r),
    (e.equipmentProfileName = n));
  if (typeof c._saveProductionProfile === "function") {
    c._saveProductionProfile(r);
  }
}

// ---------------------------------------------------------------------------
// openSessionEquipmentSheet — exported, called from screens.js
// ---------------------------------------------------------------------------

export function openSessionEquipmentSheet() {
  const e = c.session;
  if (!e || !e.recipe) return;
  const n = X().map((s) => {
      const l = T(
          m(s.params.mashEfficiencyPct, 65) / j(s.params.trubLossPct),
          1,
        ),
        u = s.name === e.equipmentProfileName;
      return a("div", "equip-row", [
        d(
          [
            a("b", "", s.name),
            a(
              "span",
              "muted",
              ` ${z(s.params.targetVolumeL, 0)} \xB7 ${P(l, 1)}%`,
            ),
          ],
          () => {
            (Ga(e, s.params, s.name),
              h(),
              b(
                t('Equipamento "{name}" aplicado a esta brassagem.', {
                  name: s.name,
                }),
              ),
              c.requestRender());
          },
          `equip-apply ${u ? "active" : ""}`,
        ),
        D(
          "scale",
          t("Editar este perfil"),
          () => {
            (h(), c._equipmentProfileSheet && c._equipmentProfileSheet(s));
          },
          "icon-btn small-btn",
        ),
      ]);
    }),
    r = T(m(J.params.mashEfficiencyPct, 65) / j(J.params.trubLossPct), 1),
    i = a("div", "equip-row", [
      d(
        [
          a("b", "", t("Equipamento padr\xE3o")),
          a(
            "span",
            "muted",
            ` ${z(J.params.targetVolumeL, 0)} \xB7 ${P(r, 1)}%`,
          ),
        ],
        () => {
          (Ga(e, J.params, ""),
            h(),
            b(
              t('Equipamento "{name}" aplicado a esta brassagem.', {
                name: t("Equipamento padr\xE3o"),
              }),
            ),
            c.requestRender());
        },
        `equip-apply ${e.equipmentProfileName ? "" : "active"}`,
      ),
    ]);
  I(
    [
      a("b", "sheet-title", t("Equipamento")),
      a(
        "p",
        "sheet-message",
        t(
          "Escolha um perfil salvo — volume, efici\xEAncia e os par\xE2metros de produ\xE7\xE3o entram nesta brassagem.",
        ),
      ),
      a("div", "equip-list", [i, ...n]),
      a("div", "sheet-actions", [
        d(
          t("Novo perfil…"),
          () => {
            (h(), c._equipmentProfileSheet && c._equipmentProfileSheet(null));
          },
          "btn",
        ),
        d(t("Fechar"), () => h(), "btn ghost"),
      ]),
    ],
    "details",
  );
}

// ---------------------------------------------------------------------------
// Fermentables section
// ---------------------------------------------------------------------------

function no(e, o) {
  const n = (e.fermentables || []).reduce((w, L) => w + m(L.amountKg), 0),
    r = !(n > 0),
    i = e.fermentables.length > 1,
    s = !!c._fermentablePercentEdit && i,
    l =
      s &&
      c._fermentablePercentEdit.baseIndex !== null &&
      !!e.fermentables[c._fermentablePercentEdit.baseIndex],
    u = l && !r,
    p = l && r,
    f = () => {
      if (!r) return e.fermentables.map((L) => T((m(L.amountKg) / n) * 100, 1));
      const w = e.fermentables.length || 1;
      return e.fermentables.map(() => T(100 / w, 1));
    },
    E = p
      ? c._fermentablePercentEdit.values.reduce(
          (w, L, x) =>
            x === c._fermentablePercentEdit.baseIndex
              ? w
              : w + Math.max(0, m(L)),
          0,
        )
      : 0,
    y = p ? Math.max(0, T(100 - E, 1)) : 0,
    g = (w) => {
      if (!r && !u && Array.isArray(c._fermentablePercentEdit.values)) {
        const L = f();
        JSON.stringify(c._fermentablePercentEdit.values) !==
          JSON.stringify(L) &&
          Sa(e, c._fermentablePercentEdit.values);
      }
      ((c._fermentablePercentEdit = r
        ? {
            baseIndex: w,
            values: c._fermentablePercentEdit.values || f(),
            ogAnchor: c._fermentablePercentEdit.ogAnchor,
          }
        : { baseIndex: w, values: null }),
        c.requestRender());
    },
    q = (e.fermentables || []).map((w, L) => {
      const x = n ? (m(w.amountKg) / n) * 100 : 0,
        ae = !(m(w.amountKg) > 0);
      if (s) {
        const k = l && L === c._fermentablePercentEdit.baseIndex;
        return a("div", "editor-row", [
          ce(
            w.name,
            () => Ua(e, L),
            t("Toque para editar tipo, rendimento e cor."),
          ),
          k
            ? a("b", "base-tag", "base")
            : rn(
                u ? T(x, 1) : c._fermentablePercentEdit.values[L],
                (B) => {
                  u
                    ? S(() => {
                        Tt(e, L, B, c._fermentablePercentEdit.baseIndex);
                      })
                    : ((c._fermentablePercentEdit.values[L] = Math.max(
                        0,
                        m(B),
                      )),
                      c.requestRender());
                },
                {
                  class: "w-md",
                  "aria-label": `Percentual de ${w.name}`,
                  "data-fkey": `pct-${L}`,
                },
              ),
          k ? a("span", "row-share num", `${P(u ? x : y, 0)}%`) : ee("%"),
          k
            ? null
            : d(t("base"), () => g(L), "btn ghost small set-base-btn", {
                title: t(
                  "Tornar {name} o malte-base (absorve a diferen\xE7a).",
                  { name: w.name },
                ),
              }),
          a("span", "row-share num muted row-mass", Ra(w.amountKg)),
        ]);
      }
      return a("div", "editor-row", [
        ce(
          w.name,
          () => Ua(e, L),
          t("Toque para editar tipo, rendimento e cor."),
        ),
        ae
          ? a("b", "row-share num zero-tag", t("0 kg"))
          : a("b", "row-share num", n ? `${P(x, 0)}%` : "–"),
        _(
          w.amountKg,
          (k) =>
            S(() => {
              w.amountKg = A(k, 0, 1e3, "Quantidade");
            }),
          0.1,
          {
            class: `w-md${ae ? " input-zero" : ""}`,
            "aria-label": "Quantidade em kg",
            "data-fkey": `malt-${L}-kg`,
          },
        ),
        ee("kg"),
        ge(() =>
          S(() => {
            e.fermentables.splice(L, 1);
          }),
        ),
      ]);
    }),
    N =
      s && !u
        ? c._fermentablePercentEdit.values.reduce(
            (w, L) => w + Math.max(0, m(L)),
            0,
          )
        : 0;
  let v = null;
  if (s && u)
    v = a("div", "percent-footer", [
      a(
        "span",
        "muted percent-hint",
        t(
          "O malte-base absorve a diferen\xE7a — a soma \xE9 sempre 100% e a OG n\xE3o muda.",
        ),
      ),
      a("div", "percent-actions", [
        d(
          t("Aplicar"),
          () => {
            ((c._fermentablePercentEdit = null),
              b(t("Percentuais aplicados — a OG n\xE3o muda.")),
              c.requestRender());
          },
          "btn primary small",
        ),
      ]),
    ]);
  else if (s && r) {
    Number.isFinite(Number(c._fermentablePercentEdit.ogAnchor)) ||
      (c._fermentablePercentEdit.ogAnchor = 1.05);
    const w = () =>
      c._fermentablePercentEdit.values.map((L, x) =>
        p && x === c._fermentablePercentEdit.baseIndex ? y : Math.max(0, m(L)),
      );
    v = a("div", "percent-footer", [
      a(
        "span",
        "muted percent-hint",
        p
          ? t(
              "O malte-base completa o grist ({pct}%) \xB7 defina a OG e o app calcula as quantidades.",
              { pct: P(y, 0) },
            )
          : t("Soma {pct}% \xB7 defina a OG e o app calcula as quantidades.", {
              pct: P(N, 0),
            }),
      ),
      a("div", "percent-actions og-anchor", [
        a("div", "field-line", [
          H(
            U(
              c._fermentablePercentEdit.ogAnchor.toFixed(3),
              (L) => {
                c._fermentablePercentEdit.ogAnchor = m(L, 1.05);
              },
              { "aria-label": "OG desejada" },
            ),
            0.001,
          ),
          a("b", "field-unit", "OG"),
        ]),
        d(
          t("Aplicar"),
          () => {
            const L = A(c._fermentablePercentEdit.ogAnchor, 1.02, 1.15, "OG");
            (Nt(e, w(), L)
              ? ((c._fermentablePercentEdit = null),
                b(
                  t("Quantidades calculadas para OG {og}.", {
                    og: L.toFixed(3),
                  }),
                ))
              : b(t("Defina os percentuais primeiro."), "error"),
              c.requestRender());
          },
          "btn primary small",
        ),
      ]),
    ]);
  } else
    s &&
      (v = a("div", "percent-footer", [
        a(
          "b",
          `num ${Math.abs(N - 100) <= 0.5 ? "" : "off"}`,
          `Soma: ${P(N, 0)}%`,
        ),
        a("div", "percent-actions", [
          d(
            Math.abs(N - 100) <= 0.5 ? "Aplicar" : t("Normalizar e aplicar"),
            () => {
              (Sa(e, c._fermentablePercentEdit.values)
                ? ((c._fermentablePercentEdit = null),
                  b(t("Percentuais aplicados — a OG n\xE3o muda.")))
                : b(
                    t(
                      "N\xE3o deu para aplicar: os percentuais est\xE3o todos zerados.",
                    ),
                    "error",
                  ),
                c.requestRender());
            },
            "btn primary small",
          ),
        ]),
      ]));
  const $ = D(
      "percent",
      s ? t("Sair do modo percentual") : t("Editar percentuais do grist"),
      () => {
        if (!i) {
          b(
            t("Adicione ao menos dois maltes para editar percentuais."),
            "error",
          );
          return;
        }
        ((c._fermentablePercentEdit = s
          ? null
          : { baseIndex: null, values: f() }),
          c.requestRender());
      },
      `icon-btn small-btn ${s ? "active" : ""}`,
    ),
    M = d("OG", () => QnSheet(e, o), "btn ghost small head-mode-btn", {
      title: t("Definir a OG desejada e escalar os maltes proporcionalmente."),
    }),
    V =
      e.fermentables.length > 1 && !s
        ? D(
            "swap",
            t("Ordenar por quantidade"),
            () => {
              (e.fermentables.sort((w, L) => m(L.amountKg) - m(w.amountKg)),
                c.requestRender());
            },
            "icon-btn small-btn",
          )
        : null;
  return de(
    t("Maltes e ferment\xE1veis"),
    "scale",
    [
      q.length
        ? a("div", "editor-rows", q)
        : a("p", "muted", t("Adicione o primeiro malte.")),
      v,
      s
        ? null
        : d(
            t("Adicionar malte"),
            () => {
              qe({
                title: t("Adicionar malte"),
                placeholder: t("Buscar malte…"),
                items: ln(),
                itemLabel: (w) =>
                  `${w.name} \xB7 ${P(w.ebc, 0)} EBC${w.inStock ? ` \xB7 ✓ ${w.inventoryKg} kg` : w.mine ? " \xB7 meu" : ""}`,
                customLabel: "Criar",
                multi: !0,
                onPickMany: (w) => {
                  (w.forEach((L, x) => Va(e, L, x === w.length - 1)),
                    b(
                      w.length > 1
                        ? `${w.length} maltes adicionados.`
                        : t("Malte adicionado."),
                    ));
                },
                onPick: (w) => {
                  w.custom !== void 0 &&
                    Ge("malts", w.custom, (L) => {
                      Va(e, L);
                    });
                },
              });
            },
            "btn small",
          ),
    ],
    n ? Ra(n) : null,
    [V, M, $],
  );
}

function Va(e, o, n = !0) {
  (e.fermentables.push({
    name: o.name,
    type: o.type || "Gr\xE3o",
    yieldPct: m(o.yieldPct, 78),
    colorEbc: m(o.ebc, 5),
    amountKg: 0,
  }),
    n && (c.pendingFocusKey = `malt-${e.fermentables.length - 1}-kg`),
    c.requestRender());
}

function Ua(e, o) {
  const n = e.fermentables[o];
  if (!n) return;
  const r = () => c.requestRender();
  I(
    [
      a("b", "sheet-title", n.name || "Ferment\xE1vel"),
      a("div", "sheet-fields", [
        a("label", "field", [
          a("span", "field-label", t("Nome")),
          W(n.name, (i) => {
            ((n.name = i), r());
          }),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Tipo")),
          le(
            qt.map((i) => ({ value: i, label: t(i) })),
            n.type || "Gr\xE3o",
            (i) => {
              ((n.type = i), r());
            },
            { "aria-label": t("Tipo do ferment\xE1vel") },
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Rendimento")),
          F(
            n.yieldPct,
            (i) => {
              ((n.yieldPct = A(i, 1, 100, "Rendimento")), r());
            },
            "%",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Cor")),
          F(
            n.colorEbc,
            (i) => {
              ((n.colorEbc = A(i, 0, 2e3, "Cor")), r());
            },
            "EBC",
          ),
        ]),
        ["Gr\xE3o", "Adjunto"].includes(n.type || "Gr\xE3o")
          ? null
          : a("label", "field", [
              a("span", "field-label", t("Momento")),
              le(
                [
                  { value: "Fervura", label: t("Fervura") },
                  { value: "Fermenta\xE7\xE3o", label: t("Fermenta\xE7\xE3o") },
                ],
                n.when || "Fervura",
                (i) => {
                  ((n.when = i), r());
                },
                { "aria-label": t("Momento do ferment\xE1vel") },
              ),
            ]),
        n.when === "Fermenta\xE7\xE3o" &&
        !["Gr\xE3o", "Adjunto"].includes(n.type || "Gr\xE3o")
          ? a(
              "p",
              "sheet-hint",
              t(
                "Entra na fermenta\xE7\xE3o: conta no OG e no ABV, mas n\xE3o entra na leitura p\xF3s-fervura.",
              ),
            )
          : null,
      ]),
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn primary")]),
    ],
    "details",
  );
}

// ---------------------------------------------------------------------------
// Hops section
// ---------------------------------------------------------------------------

function oo(e, o) {
  const n = (e.hops || []).map((l, u) => {
      const p = l.use === "Dry hop",
        f = !(m(l.amountG) > 0),
        E = ["Hopstand", "Whirlpool"].includes(l.use),
        y = m(o.hopIbu?.[u]),
        g = t(l.use === "Whirlpool" ? "Hopstand" : l.use || "Fervura");
      return a("div", "editor-row hop-row", [
        ce(
          l.name,
          () => ja(e, u),
          t("Toque para editar alfa \xE1cido, momento e temperatura."),
        ),
        le(
          _a.map((q) => ({ value: q, label: t(q) })),
          l.use === "Whirlpool" ? "Hopstand" : l.use || "Fervura",
          (q) =>
            S(() => {
              l.use = q;
            }),
          { "aria-label": t("Momento do l\xFApulo") },
        ),
        a("span", "row-when muted", g),
        a(
          "span",
          "row-share num muted hop-alpha-tag",
          `${P(l.alphaAcidPct, 1)}%`,
        ),
        showIbuPerAddition && !p
          ? a("span", "row-share num muted hop-ibu-tag", `${P(y, 1)} IBU`, {
              title: t("Contribui\xE7\xE3o desta adi\xE7\xE3o no IBU total."),
            })
          : null,
        _(
          l.amountG,
          (q) =>
            S(() => {
              l.amountG = A(q, 0, 5e3, "Gramas");
            }),
          1,
          {
            class: `w-sm hop-g${f ? " input-zero" : ""}`,
            "aria-label": "Gramas",
            "data-fkey": `hop-${u}-g`,
          },
        ),
        ee("g"),
        p
          ? null
          : _(
              l.timeMin,
              (q) =>
                S(() => {
                  l.timeMin = A(q, 0, 240, "Tempo");
                }),
              1,
              {
                class: "w-sm hop-min",
                "aria-label": t("Tempo em minutos"),
                "data-fkey": `hop-${u}-min`,
              },
            ),
        p
          ? null
          : a(
              "span",
              "row-unit",
              E
                ? [
                    "min",
                    a(
                      "span",
                      "hop-temp",
                      ` \xB7 ${P(m(l.temperatureC, 90), 0)}\xB0C`,
                    ),
                  ]
                : "min",
            ),
        D(
          "copy",
          t("Duplicar (mesmo l\xFApulo, outro momento)"),
          () =>
            S(() => {
              e.hops.splice(u + 1, 0, { ...l });
            }),
          "icon-btn subtle small-btn",
        ),
        ge(() =>
          S(() => {
            e.hops.splice(u, 1);
          }),
        ),
      ]);
    }),
    r = D(
      "summary",
      showIbuPerAddition
        ? t("Ocultar IBU por adi\xE7\xE3o")
        : t("Mostrar IBU por adi\xE7\xE3o"),
      () => {
        ((showIbuPerAddition = !showIbuPerAddition), c.requestRender());
      },
      `icon-btn small-btn ${showIbuPerAddition ? "active" : ""}`,
    ),
    i =
      (e.hops || []).length > 1
        ? D(
            "swap",
            t("Ordenar por tempo de adi\xE7\xE3o"),
            () => {
              const l = (u) => (u.use === "Dry hop" ? -1 : m(u.timeMin));
              (e.hops.sort((u, p) => l(p) - l(u)), c.requestRender());
            },
            "icon-btn small-btn",
          )
        : null,
    s = d(
      "IBU",
      () => {
        if (!(o.ibu > 0)) {
          b(
            t("Adicione um l\xFApulo de amargor antes de definir o IBU."),
            "error",
          );
          return;
        }
        ro(e, o);
      },
      "btn ghost small head-mode-btn",
      {
        title: t(
          "Definir o IBU desejado e escalar os l\xFApulos proporcionalmente.",
        ),
      },
    );
  return de(
    t("L\xFApulos"),
    "hop",
    [
      n.length
        ? a("div", "editor-rows", n)
        : a("p", "muted", t("Adicione o primeiro l\xFApulo.")),
      d(
        t("Adicionar l\xFApulo"),
        () => {
          qe({
            title: t("Adicionar l\xFApulo"),
            placeholder: t("Buscar l\xFApulo…"),
            items: cn(),
            itemLabel: (l) =>
              `${l.name} \xB7 ${P(l.alpha, 1)}%aa${l.inStock ? ` \xB7 ✓ ${l.inventoryG} g` : l.mine ? " \xB7 meu" : ""}`,
            customLabel: "Criar",
            multi: !0,
            onPickMany: (l) => {
              (l.forEach((u, p) => za(e, u, p === l.length - 1)),
                b(
                  l.length > 1
                    ? t("{n} l\xFApulos adicionados.", { n: l.length })
                    : t("L\xFApulo adicionado."),
                ));
            },
            onPick: (l) => {
              l.custom !== void 0 && Ge("hops", l.custom, (u) => za(e, u));
            },
          });
        },
        "btn small",
      ),
    ],
    null,
    [i, r, s],
  );
}

function ro(e, o) {
  let n = o.ibu;
  I(
    [
      a("b", "sheet-title", t("Definir IBU")),
      a(
        "p",
        "sheet-message",
        t(
          "S\xF3 os l\xFApulos de amargor (fervura com 30+ min) s\xE3o escalados — aroma tardio, hopstand e dry hop ficam como est\xE3o.",
        ),
      ),
      a("label", "field", [
        a("span", "field-label", t("IBU desejado")),
        a("div", "field-line", [
          H(
            U(
              n,
              (r) => {
                n = m(r, o.ibu);
              },
              {},
            ),
            1,
          ),
          a("b", "field-unit", "IBU"),
        ]),
      ]),
      a("div", "sheet-actions", [
        d(t("Cancelar"), () => h(), "btn ghost"),
        d(
          t("Escalar l\xFApulos"),
          () => {
            const r = A(n, 1, 120, "IBU"),
              i = kt(e, r);
            (h(),
              i.ok
                ? i.factor === 0
                  ? b(
                      t(
                        "As adi\xE7\xF5es tardias sozinhas j\xE1 passam do alvo ({ibu} IBU) — amargor zerado. Ctrl+Z desfaz.",
                        { ibu: i.fixedIbu },
                      ),
                    )
                  : b(
                      t("L\xFApulos de amargor escalados para {ibu} IBU.", {
                        ibu: P(r, 0),
                      }),
                    )
                : b(
                    t(
                      "Nenhum l\xFApulo de amargor (fervura com 30+ min) para escalar — as adi\xE7\xF5es tardias somam {ibu} IBU.",
                      { ibu: i.fixedIbu },
                    ),
                    "error",
                  ),
              c.requestRender());
          },
          "btn primary",
        ),
      ]),
    ],
    "details",
  );
}

function za(e, o, n = !0) {
  (e.hops.push({
    name: o.name,
    alphaAcidPct: m(o.alpha, 0),
    amountG: 0,
    use: "Fervura",
    timeMin: 60,
    temperatureC: 90,
  }),
    n && (c.pendingFocusKey = `hop-${e.hops.length - 1}-g`),
    c.requestRender());
}

function ja(e, o) {
  const n = e.hops[o];
  if (!n) return;
  const r = () => c.requestRender(),
    i = e.hops.filter(
      (l) =>
        String(l.name).trim().toLowerCase() ===
        String(n.name).trim().toLowerCase(),
    ).length,
    s = ["Hopstand", "Whirlpool"].includes(n.use);
  I(
    [
      a("b", "sheet-title", n.name || t("L\xFApulo")),
      a("div", "sheet-fields", [
        a("label", "field", [
          a("span", "field-label", t("Nome")),
          W(n.name, (l) => {
            ((n.name = l), r());
          }),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Momento")),
          le(
            _a.map((l) => ({ value: l, label: t(l) })),
            n.use === "Whirlpool" ? "Hopstand" : n.use || "Fervura",
            (l) => {
              (S(() => {
                n.use = l;
              }),
                h(),
                ja(e, o));
            },
            { "aria-label": t("Momento do l\xFApulo") },
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Alfa \xE1cido do lote")),
          F(
            n.alphaAcidPct,
            (l) => {
              ((n.alphaAcidPct = A(l, 0, 25, t("Alfa \xE1cido"))), r());
            },
            "%",
          ),
        ]),
        s
          ? a("label", "field", [
              a("span", "field-label", t("Temperatura do hopstand")),
              F(
                m(n.temperatureC, 90),
                (l) => {
                  ((n.temperatureC = A(l, 40, 100, "Temperatura")), r());
                },
                "\xB0C",
              ),
            ])
          : null,
      ]),
      a("div", "sheet-tools", [
        d(
          [R("copy", "icon"), "Duplicar"],
          () => {
            (S(() => {
              e.hops.splice(o + 1, 0, { ...n });
            }),
              h());
          },
          "btn ghost small",
        ),
        d(
          [R("close", "icon"), "Remover"],
          () => {
            (S(() => {
              e.hops.splice(o, 1);
            }),
              h());
          },
          "btn ghost small danger",
        ),
      ]),
      a("div", "sheet-actions hop-alpha-actions", [
        d(t("S\xF3 esta adi\xE7\xE3o"), () => h(), "btn"),
        n.name
          ? d(
              t("Todas de {name} + lembrar", { name: n.name }),
              () => {
                const l = Mt(e, n.name, n.alphaAcidPct);
                (Ye("hops", { name: n.name, alpha: m(n.alphaAcidPct) }),
                  h(),
                  b(
                    t(
                      "Alfa de {pct}% aplicado a {count} adi\xE7\xE3o(\xF5es) e salvo para as pr\xF3ximas.",
                      { pct: P(n.alphaAcidPct, 1), count: l },
                    ),
                  ),
                  r());
              },
              "btn primary",
            )
          : null,
      ]),
    ],
    "details",
  );
}

// ---------------------------------------------------------------------------
// Yeast section
// ---------------------------------------------------------------------------

function io(e, o) {
  const n = (e.yeasts || []).map((s, l) =>
      a("div", "editor-row", [
        ce(s.name, () => co(e, l), t("Toque para editar a atenua\xE7\xE3o.")),
        a("span", "row-share num muted", `${P(s.attenuationPct, 0)}%`),
        _(
          s.amount,
          (u) =>
            S(() => {
              s.amount = A(u, 0, 100, "Quantidade");
            }),
          0.5,
          {
            class: "w-sm",
            "aria-label": "Quantidade",
            "data-fkey": `yeast-${l}-qtd`,
          },
        ),
        le(
          ["pacote", "sach\xEA", "g", "mL", "un."].map((u) => ({
            value: u,
            label: t(u),
          })),
          s.unit || "pacote",
          (u) =>
            S(() => {
              s.unit = u;
            }),
          { "aria-label": "Unidade" },
        ),
        ge(() =>
          S(() => {
            e.yeasts.splice(l, 1);
          }),
        ),
      ]),
    ),
    r = o.yeastPitch,
    i =
      r && r.rate > 0
        ? a("p", "muted pitch-line", [
            t("In\xF3culo estimado ~{rate} M c\xE9ls/mL/\xB0P — ", {
              rate: P(r.rate, 2),
            }),
            a("b", `pitch-band ${lo(r.rate)}`, so(r.rate)),
            a(
              "span",
              "",
              t(" \xB7 {cells} bi c\xE9lulas (estimativa)", {
                cells: P(r.cellsBi, 0),
              }),
            ),
          ])
        : null;
  return de(t("Levedura"), "ferment", [
    n.length
      ? a("div", "editor-rows", n)
      : a(
          "p",
          "muted",
          o.fgAssumed
            ? t("Sem levedura: a FG* assume atenua\xE7\xE3o de 78%.")
            : t("A atenua\xE7\xE3o da levedura define a FG."),
        ),
    i,
    d(
      t("Adicionar levedura"),
      () => {
        qe({
          title: t("Adicionar levedura"),
          placeholder: t("Buscar levedura…"),
          items: dn(),
          itemLabel: (s) =>
            `${s.name} \xB7 ${s.attenuation}%${s.inStock ? ` \xB7 ✓ ${s.amount} ${s.unit || "pkg"}` : s.mine ? " \xB7 meu" : ""}`,
          customLabel: "Criar",
          onPick: (s) => {
            if (s.custom !== void 0) {
              Ge("yeasts", s.custom, (l) => Ha(e, l));
              return;
            }
            Ha(e, s);
          },
        });
      },
      "btn small",
    ),
  ]);
}

function so(e) {
  return e < 0.5
    ? t("pouco (sub-in\xF3culo)")
    : e < 1
      ? t("adequado p/ ale")
      : e < 1.25
        ? t("ale de alta densidade")
        : e < 1.75
          ? "lager"
          : t("lager de alta densidade / muito");
}

function lo(e) {
  return e < 0.5 ? "low" : e > 2 ? "high" : "ok";
}

function Ha(e, o) {
  (e.yeasts.push({
    name: o.name,
    attenuationPct: m(o.attenuation, 78),
    amount: 1,
    unit: "pacote",
  }),
    Number.isFinite(Number(o.tempC)) &&
      e.fermentation.length &&
      e.fermentation[0].name === "Prim\xE1ria" &&
      (e.fermentation[0].temperatureC = m(o.tempC)),
    c.requestRender());
}

function co(e, o) {
  const n = e.yeasts[o];
  if (!n) return;
  const r = () => c.requestRender();
  I(
    [
      a("b", "sheet-title", n.name || t("Levedura")),
      a("div", "sheet-fields", [
        a("label", "field", [
          a("span", "field-label", t("Nome")),
          W(n.name, (i) => {
            ((n.name = i), r());
          }),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Atenua\xE7\xE3o")),
          F(
            n.attenuationPct,
            (i) => {
              ((n.attenuationPct = A(i, 30, 100, t("Atenua\xE7\xE3o"))), r());
            },
            "%",
          ),
        ]),
      ]),
      n.name
        ? d(
            t("Lembrar esta atenua\xE7\xE3o para novas adi\xE7\xF5es"),
            () => {
              (Ye("yeasts", {
                name: n.name,
                attenuation: m(n.attenuationPct, 78),
              }),
                h(),
                b(
                  t("Atenua\xE7\xE3o de {name} salva na sua biblioteca.", {
                    name: n.name,
                  }),
                ));
            },
            "btn small",
          )
        : null,
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn primary")]),
    ],
    "details",
  );
}

// ---------------------------------------------------------------------------
// Mash ramps section
// ---------------------------------------------------------------------------

function Wa(e, o, n) {
  const r = JSON.stringify(o);
  return a("div", "preset-row", [
    a("span", "muted preset-label", t("presets:")),
    ...e.map((i) => {
      const s = JSON.stringify(i.steps) === r;
      return d(
        t(i.label),
        () => {
          s || n(i);
        },
        `btn ghost small preset-btn ${s ? "active" : ""}`,
        s ? { "aria-pressed": "true" } : {},
      );
    }),
  ]);
}

function Ka(e, o, n, r = {}) {
  const i = () =>
    e.pressurized
      ? a("label", "field", [
          a("span", "field-label", t("Press\xE3o (atm)")),
          _(
            e.pressureAtm,
            (s) => {
              ((e.pressureAtm = A(s, 0, $t, "Press\xE3o")), c.requestRender());
            },
            0.1,
            { class: "w-sm", "aria-label": t("Press\xE3o (atm)") },
          ),
        ])
      : null;
  I(
    [
      a("b", "sheet-title", e.name || o),
      a(
        "div",
        "sheet-fields",
        [
          a("label", "field", [
            a("span", "field-label", t("Nome da etapa")),
            W(
              e.name,
              (s) => {
                ((e.name = s), c.requestRender());
              },
              { placeholder: o },
            ),
          ]),
          r.pressure
            ? a("div", "field", [
                a("span", "field-label", t("Pressurizada")),
                d(
                  e.pressurized ? t("Sim") : t("N\xE3o"),
                  () => {
                    ((e.pressurized = !e.pressurized),
                      e.pressurized &&
                        !m(e.pressureAtm, 0) &&
                        (e.pressureAtm = 0.5),
                      c.requestRender());
                  },
                  `btn small ${e.pressurized ? "primary" : "ghost"}`,
                  { "aria-pressed": e.pressurized ? "true" : "false" },
                ),
              ])
            : null,
          r.pressure ? i() : null,
        ].filter(Boolean),
      ),
      n
        ? a("div", "sheet-tools", [
            d(
              [R("close", "icon"), t("Remover etapa")],
              () => {
                (n(), h());
              },
              "btn ghost small danger",
            ),
          ])
        : null,
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn primary")]),
    ],
    "details",
  );
}

function uo(e, o) {
  const n = (e.mash || []).map((r, i) =>
    a("div", "editor-row step-row", [
      Da(e.mash, i),
      ce(
        qa(r.name || "Rampa"),
        () =>
          Ka(r, t("Rampa"), () =>
            S(() => {
              e.mash.splice(i, 1);
            }),
          ),
        t("Toque para renomear a rampa."),
      ),
      _(
        r.temperatureC,
        (s) =>
          S(() => {
            r.temperatureC = A(s, 20, 80, "Temperatura");
          }),
        0.5,
        {
          class: "w-sm",
          "aria-label": "Temperatura",
          "data-fkey": `mash-${i}-temp`,
        },
      ),
      ee("\xB0C"),
      _(
        r.timeMin,
        (s) =>
          S(() => {
            r.timeMin = A(s, 0, 240, "Tempo");
          }),
        1,
        {
          class: "w-sm",
          "aria-label": "Minutos",
          "data-fkey": `mash-${i}-min`,
        },
      ),
      ee("min"),
      ge(() =>
        S(() => {
          e.mash.splice(i, 1);
        }),
      ),
    ]),
  );
  return de(
    t("Rampas de mostura"),
    "thermo",
    [
      Wa(Ut, e.mash, (r) =>
        S(() => {
          e.mash = r.steps.map((i) => ({ ...i }));
        }),
      ),
      n.length
        ? a("div", "editor-rows", n)
        : a("p", "muted", t("Adicione a primeira rampa.")),
      d(
        t("Adicionar rampa"),
        () =>
          S(() => {
            e.mash.push({ name: "Rampa", temperatureC: 66, timeMin: 15 });
          }),
        "btn small",
      ),
    ],
    mo(e, o),
  );
}

function mo(e, o) {
  const n = `FG ${o.fg.toFixed(3)}`;
  return d(
    o.fgManual ? [n, a("span", "fg-mark", "⚠")] : n,
    () => po(e),
    `head-meta fg-kicker ${o.fgManual ? "manual" : ""}`,
    {
      title: o.fgManual
        ? t("FG manual — calculada seria {fg}. Toque para editar.", {
            fg: o.fgCalculated.toFixed(3),
          })
        : t("Toque para fixar a FG \xE0 m\xE3o."),
    },
  );
}

function po(e) {
  const o = computeTargets(e);
  I(
    [
      a("b", "sheet-title", t("FG (densidade final)")),
      a(
        "p",
        "sheet-message",
        t(
          "Calculada: {fg} — da OG e da atenua\xE7\xE3o da levedura. Fixe uma FG \xE0 m\xE3o para sobrescrever: ela entra no ABV e no BeerXML.",
          { fg: o.fgCalculated.toFixed(3) },
        ),
      ),
      a("label", "field", [
        a("span", "field-label", t("FG manual")),
        F(
          e.manualFg,
          (n) =>
            S(() => {
              e.manualFg = n === "" ? "" : A(n, 0.98, 1.2, "FG");
            }),
          "",
        ),
      ]),
      a("div", "sheet-actions", [
        d(
          t("Usar calculada"),
          () =>
            S(() => {
              ((e.manualFg = ""), h());
            }),
          "btn ghost",
        ),
        d(t("Fechar"), () => h(), "btn primary"),
      ]),
    ],
    "details",
  );
}

// ---------------------------------------------------------------------------
// Fermentation section
// ---------------------------------------------------------------------------

function fo(e) {
  const o = (e.fermentation || []).map((n, r) =>
    a("div", "editor-row step-row", [
      Da(e.fermentation, r),
      ce(
        qa(n.name || "Etapa"),
        () =>
          Ka(
            n,
            t("Etapa"),
            () =>
              S(() => {
                e.fermentation.splice(r, 1);
              }),
            { pressure: !0 },
          ),
        t("Toque para renomear a etapa ou definir a press\xE3o."),
      ),
      n.pressurized
        ? a(
            "span",
            "step-pressure",
            t("{atm} atm", { atm: Ee(m(n.pressureAtm, 0)) }),
          )
        : null,
      _(
        n.temperatureC,
        (i) =>
          S(() => {
            n.temperatureC = A(i, 0, 40, "Temperatura");
          }),
        0.5,
        {
          class: "w-sm",
          "aria-label": "Temperatura",
          "data-fkey": `ferm-${r}-temp`,
        },
      ),
      ee("\xB0C"),
      _(
        n.days,
        (i) =>
          S(() => {
            n.days = A(i, 0, 120, "Dias");
          }),
        1,
        { class: "w-sm", "aria-label": "Dias", "data-fkey": `ferm-${r}-days` },
      ),
      ee(t("dias")),
      ge(() =>
        S(() => {
          e.fermentation.splice(r, 1);
        }),
      ),
    ]),
  );
  return de(t("Fermenta\xE7\xE3o"), "ferment", [
    Wa(_t, e.fermentation, (n) =>
      S(() => {
        e.fermentation = n.steps.map((r) => ({ ...r }));
      }),
    ),
    o.length
      ? a("div", "editor-rows", o)
      : a("p", "muted", t("Adicione a primeira etapa.")),
    d(
      t("Adicionar etapa"),
      () =>
        S(() => {
          e.fermentation.push({ name: "Etapa", temperatureC: 19, days: 3 });
        }),
      "btn small",
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Water section
// ---------------------------------------------------------------------------

function bo(e, o) {
  const n = X().find((u) => u.name && u.name === e.equipmentProfileName),
    r = n ? n.params : te(),
    i = {
      ...r,
      targetVolumeL: m(e.batchVolumeL, r.targetVolumeL),
      trubLossPct: m(e.trubLossPct, r.trubLossPct),
      evaporationPct: m(e.evaporationPct, r.evaporationPct),
      mashEfficiencyPct: m(e.mashEfficiencyPct, r.mashEfficiencyPct),
    },
    s = Te(pa(Le(e), "", i)).volumes,
    l = (u, p) =>
      a("div", "editor-water-field readonly", [
        a("span", "", u),
        a("b", "num", z(p, 1)),
      ]);
  const waterProfiles = inventoryWaterProfiles();
  const profileSelect = document.createElement("select");
  profileSelect.className = "field-input water-profile-select";
  const noProfileOpt = document.createElement("option");
  noProfileOpt.value = "";
  noProfileOpt.textContent = `— ${t("personalizado")} —`;
  profileSelect.append(noProfileOpt);
  waterProfiles.forEach((wp) => {
    const opt = document.createElement("option");
    opt.value = wp.id;
    opt.textContent = wp.name;
    if (wp.id === (e.waterProfileId || "")) opt.selected = true;
    profileSelect.append(opt);
  });
  profileSelect.addEventListener("change", () => {
    S(() => {
      const sel = waterProfiles.find((wp) => wp.id === profileSelect.value);
      e.waterProfileId = profileSelect.value || null;
      if (sel) {
        e.baseWaterProfile = We(
          {
            calciumPpm: sel.calciumPpm ?? 0,
            magnesiumPpm: sel.magnesiumPpm ?? 0,
            sodiumPpm: sel.sodiumPpm ?? 0,
            chloridePpm: sel.chloridePpm ?? 0,
            sulfatePpm: sel.sulfatePpm ?? 0,
            bicarbonatePpm: sel.bicarbonatePpm ?? 0,
          },
          He,
        );
      } else {
        e.waterProfileId = null;
      }
    });
  });
  const waterProfileRow = a("div", "water-profile-row", [
    a("label", "field", [
      a("span", "field-label", t("Perfil de \xE1gua")),
      profileSelect,
    ]),
  ]);
  return de(t("\xC1gua e sais"), "water", [
    waterProfileRow,
    a("div", "water-block-title", [
      a("b", "", t("\xC1gua")),
      a("span", "muted", t("refer\xEAncia \xB7 L")),
    ]),
    a("div", "editor-water-grid result", [
      l(t("Mostura"), s.mashWater),
      l(t("Lavagem"), s.sparge),
      l(t("Total"), s.totalWater),
    ]),
    a("div", "water-block-title", [
      a("b", "", t("Sais")),
      a("span", "muted", "g"),
    ]),
    a(
      "div",
      "editor-water-grid salts",
      (e.salts || []).map((u) =>
        a("label", "editor-water-field", [
          a("span", "", u.formula),
          H(
            U(
              u.amountG,
              (p) =>
                S(() => {
                  u.amountG = A(p, 0, 100, u.formula);
                }),
              {
                "aria-label": `${u.formula} em gramas`,
                "data-fkey": `salt-${u.formula}`,
              },
            ),
            0.1,
          ),
        ]),
      ),
    ),
    a("div", "water-block-title", [
      a("b", "", t("\xC1gua ajustada")),
      a("span", "muted", "ppm"),
    ]),
    a(
      "div",
      "editor-water-grid result",
      ma.map((u) =>
        a("div", "editor-water-field readonly", [
          a("span", "", u.label),
          a("b", "num", String(o.ions[u.key])),
        ]),
      ),
    ),
    ...Do(o),
  ]);
}

function Do(o) {
  const p = o.mashPh;
  if (!p) return [];
  const acidType = loadPhAcidType(),
    acidConc = loadPhAcidConc(acidType),
    acidDef = ht.find((k) => k.type === acidType),
    dose = acidDoseForTarget({
      predictedPh: p.predictedPh,
      targetPh: DEFAULT_MASH_PH_TARGET,
      bufferTotal: p.bufferTotal,
      acidType,
      concentrationPct: acidConc,
    }),
    acidLabel = `${t(acidDef ? acidDef.short : "\xC1cido")} ${Math.round(acidConc * 10) / 10}%`,
    doseText =
      dose.doseMl > 0
        ? t("{acid} \xB7 {ml} mL", { acid: acidLabel, ml: P(dose.doseMl, 1) })
        : t("sem ajuste necess\xE1rio");
  return [
    a("div", "water-block-title", [
      a("b", "", t("Previs\xE3o de pH")),
      a("span", "muted", t("estimativa \xB7 a leitura refina")),
    ]),
    a("div", "editor-water-grid result", [
      a("div", "editor-water-field readonly", [
        a("span", "", t("pH de mostura")),
        a("b", "num", P(p.predictedPh, 2)),
      ]),
      a("div", "editor-water-field readonly", [
        a("span", "", t("alvo")),
        a("b", "num", P(DEFAULT_MASH_PH_TARGET, 1)),
      ]),
    ]),
    a("div", "editor-water-field readonly wide", [
      a("span", "", t("Dose de \xE1cido estimada")),
      a("b", "num", doseText),
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Miscs section
// ---------------------------------------------------------------------------

function ho(e) {
  const o = (e.miscs || []).map((n, r) =>
    a("div", "editor-row", [
      ce(n.name, () => go(e, r), t("Toque para editar uso e momento.")),
      _(
        n.amount,
        (i) =>
          S(() => {
            n.amount = A(i, 0, 5e3, "Quantidade");
          }),
        0.5,
        {
          class: "w-md",
          "aria-label": "Quantidade",
          "data-fkey": `misc-${r}-qtd`,
        },
      ),
      ee(n.unit || "g"),
      a(
        "span",
        "row-share muted misc-when",
        n.use === "Fervura" ? `${P(n.timeMin, 0)} min` : n.use,
      ),
      ge(() =>
        S(() => {
          e.miscs.splice(r, 1);
        }),
      ),
    ]),
  );
  return de(t("Outros insumos"), "salt", [
    o.length
      ? a("div", "editor-rows", o)
      : a(
          "p",
          "muted",
          t("Whirlfloc, especiarias, clarificantes — opcional."),
        ),
    d(
      t("Adicionar insumo"),
      () => {
        qe({
          title: t("Adicionar insumo"),
          placeholder: t("Buscar insumo…"),
          items: un(),
          itemLabel: (n) =>
            `${n.name}${n.inStock ? ` \xB7 ✓ ${n.amount} ${n.unit || "g"}` : n.mine ? " \xB7 meu" : ""}`,
          customLabel: "Criar",
          onPick: (n) => {
            if (n.custom !== void 0) {
              Ge("miscs", n.custom, (r) => Ja(e, r));
              return;
            }
            Ja(e, n);
          },
        });
      },
      "btn small",
    ),
  ]);
}

function Ja(e, o) {
  (e.miscs.push({
    name: o.name,
    amount: m(o.amount, 1),
    unit: o.unit || "g",
    use: o.use || "Fervura",
    timeMin: m(o.timeMin, 10),
  }),
    (c.pendingFocusKey = `misc-${e.miscs.length - 1}-qtd`),
    c.requestRender());
}

function go(e, o) {
  const n = e.miscs[o];
  if (!n) return;
  const r = () => c.requestRender();
  I(
    [
      a("b", "sheet-title", n.name || "Insumo"),
      a("div", "sheet-fields", [
        a("label", "field", [
          a("span", "field-label", t("Nome")),
          W(n.name, (i) => {
            ((n.name = i), r());
          }),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Unidade")),
          le(
            ["g", "mL", "un."].map((i) => ({ value: i, label: t(i) })),
            n.unit || "g",
            (i) => {
              ((n.unit = i), r());
            },
            { "aria-label": "Unidade" },
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Uso")),
          le(
            ["Fervura", "Mostura", "Fermenta\xE7\xE3o"].map((i) => ({
              value: i,
              label: t(i),
            })),
            n.use || "Fervura",
            (i) => {
              ((n.use = i), r());
            },
            { "aria-label": t("Uso") },
          ),
        ]),
        n.use === "Fervura"
          ? a("label", "field", [
              a("span", "field-label", t("Tempo")),
              F(
                n.timeMin,
                (i) => {
                  ((n.timeMin = A(i, 0, 120, "Tempo")), r());
                },
                "min",
              ),
            ])
          : null,
      ]),
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn primary")]),
    ],
    "details",
  );
}

// ---------------------------------------------------------------------------
// Actions bar
// ---------------------------------------------------------------------------

function vo(e) {
  return a("div", "editor-actions", [
    d(
      t("Salvar"),
      (o) => {
        const n = saveMyRecipe(e);
        (Lt(o.currentTarget, "Salvar", n ? "Salva" : "Falhou", !n),
          n && b(t("Receita salva em Minhas receitas.")));
      },
      "btn",
    ),
    d(
      t("Exportar .xml"),
      () => {
        const wpName = e.waterProfileId
          ? (inventoryWaterProfiles().find((p) => p.id === e.waterProfileId)
              ?.name || null)
          : null;
        (Ie(Pa(e, wpName), Aa(e), "application/xml;charset=utf-8"),
          b(t("BeerXML exportado.")));
      },
      "btn",
    ),
    drvEnabled()
      ? d(
          t("Salvar no Drive"),
          async (o) => {
            const n = o.currentTarget;
            n.disabled = !0;
            try {
              const wpName = e.waterProfileId
                ? (inventoryWaterProfiles().find(
                    (p) => p.id === e.waterProfileId,
                  )?.name || null)
                : null;
              const xmlContent = Pa(e, wpName);
              const fileName = `${e.name || "receita"}.xml`;
              let result;
              if (e.driveFileId) {
                result = await drvOverwriteFile(e.driveFileId, xmlContent, fileName, true);
              } else {
                result = await drvUpload(xmlContent, fileName, true);
                e.driveFileId = result.driveFileId;
              }
              b(
                t('"{name}" salvo no Google Drive.', {
                  name: e.name || t("Receita"),
                }),
              );
            } catch (r) {
              b(r.message || t("Erro ao salvar no Google Drive."), "error");
            } finally {
              n.disabled = !1;
            }
          },
          "btn drive-btn",
        )
      : null,
    d(
      t("Lista de compras"),
      () => {
        if (!e.fermentables.length) {
          b(t("Adicione ao menos um ingrediente para a lista."), "error");
          return;
        }
        const o = pa(Le(e), "", te());
        Kt("list", o);
      },
      "btn",
    ),
    va()
      ? d(
          t("Analisar receita \xB7 Beta"),
          () => {
            if (!e.fermentables.length) {
              b(
                t("Adicione ao menos um malte para analisar a receita."),
                "error",
              );
              return;
            }
            ((c.analysisView = "perception"),
              (c.analysisStyleSlug = void 0),
              (c.analysisData = null),
              (c.analysisError = ""),
              (c.view = "analysis"),
              c.requestRender(),
              window.scrollTo({ top: 0, behavior: "instant" }),
              an());
          },
          "btn beta-feature-btn",
        )
      : null,
    d(
      t("Brassar esta receita →"),
      () => {
        if (!e.fermentables.length) {
          b(t("Adicione ao menos um malte antes de brassar."), "error");
          return;
        }
        (Be(), saveMyRecipe(e));
        const o = Le(e);
        (Me(o, "Minhas receitas"),
          (c.view = "brew"),
          (c.phase = "prepare"),
          c.requestRender(),
          b(t('Brassagem de "{name}" iniciada.', { name: o.name })),
          window.scrollTo({ top: 0, behavior: "instant" }));
      },
      "btn primary editor-brew-btn",
    ),
  ]);
}
