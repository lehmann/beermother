import {
  app as c,
  listBrews as Fe,
  getBrew as Za,
  setBrewStatus as ba,
  deleteBrew as et,
  appendBrewNote as at,
  isBrewExcluded as $e,
  setBrewExcluded as ha,
  brewStageLabel as Ke,
  buildSessionFromPayload as Je,
  concludeCurrentBrew as tt,
  brewSessionFileName as nt,
  loadDriveEnabled as drvEnabled,
  startRecipe as Me,
  writeAutosaveNow as Be,
  clearAutosave as Ya,
  restoreBrewSessionPayload as Qa,
  loadSavedProductionProfile as te,
  saveProductionProfile as fa,
  loadAuthorName as rt,
} from "../state.js";
import {
  DEFAULT_PROFILE as O,
  calculate as Te,
  pickParameterValue as Ne,
  isPlainObject as we,
  toNumber as m,
  round as T,
  DEFAULT_BASE_WATER_PROFILE as He,
  sanitizeBaseWaterProfile as We,
  evaporationLhFromPct as evapLhFromPct,
  evaporationPctFromLh as evapPctFromLh,
} from "../engine.js";
import {
  el as a,
  button as d,
  iconButton as D,
  icon as R,
  decimalInput as U,
  toast as b,
  downloadTextFile as Ie,
  setButtonFeedback as Lt,
} from "../ui.js";
import { t, fmt as P, formatVolume as z, formatInputValue as Ee, localeTag as ka } from "../i18n.js";
import {
  listMyRecipes,
  saveMyRecipe,
  deleteMyRecipe as ya,
  getMyRecipe as Ea,
  touchMyRecipe as At,
  medianBrewParameters as St,
  draftFromRecipe,
  recipeFromDraft as Le,
  recipeToBeerXml as Pa,
  beerXmlFileName as Aa,
  listProductionProfiles as X,
  saveProductionProfileEntry as ne,
  deleteProductionProfileEntry as Bt,
  getPrincipalProfileId as pe,
  setPrincipalProfileId as ye,
  getPrincipalProfile as xe,
  BASE_EQUIPMENT_PROFILE as J,
  newDraft as Pt,
  computeTargets,
} from "../recipes.js";
import { equipmentProfileToXml } from "../batch-xml.js";
import {
  openBrewSessionText as zt,
  ebcToHex as fe,
  addFermentationReading as jt,
  isExpectedUnlocked as Ht,
  setExpectedUnlocked as Wt,
  openShoppingListSheet as Kt,
} from "../screens.js";
import { generateBrewReportHtml as gt, buildBrewReport as vt } from "../report.js";
import { inventoryScreen as invScreen } from "../inventory.js";
import {
  buildCalibrationDraft as Zt,
  calibrationSessionProperties as en,
  CALIBRATION_DEFAULT_VOLUME_L as Ca,
} from "../calibration.js";
import { openSheet as I, closeSheet as h, confirmDialog, resetUndoStack as ta, editorUndo, editorRedo } from "./sheets.js";
import { cancelAnimations as ia } from "./animations.js";
import {
  getDriveRows, getDriveLoadState, getDriveBatchesState, getDriveEquipmentsState,
  hydrateRecipeRowsFromCache, hydrateBatchesFromCache, hydrateEquipmentsFromCache,
  loadDriveRecipes, loadDriveBatches, loadDriveEquipments,
  mergeDriveRecipes, driveStatusRow, driveBatchesStatusRow, driveEquipmentsStatusRow,
  syncBrewToDrive, syncEquipmentToDrive, moveRecipeToBin, moveEquipmentToBin,
  drvHasToken, drvOverwriteFile, drvUpload, brewEntryToXml, parseAndCacheRecipeRow, driveKey,
} from "./drive-sync.js";
import {
  loadRecipeIndex, saveRecipeIndex, loadRecipeRow,
  loadEquipmentIndex, loadEquipmentItem,
} from "./drive-cache.js";
import { openImportPicker } from "./settings-backup.js";
import {
  A, H, _, rn, F, S, xa, W, le, ee, Da, ce, ge, de, pageHead, Qn, na,
} from "./shared-ui.js";

// ── Small helpers ─────────────────────────────────────────────────────────────

function j(e) {
  return 1 + Math.min(0.5, Math.max(0, m(e, O.trubLossPct)));
}

// Module-level state for search/pagination
let recipeSearchQuery = "",
  recipeListLimit = 10,
  recipeSearchDebounceTimer = null;

// ── Navigation helpers ────────────────────────────────────────────────────────

export function openHome(e) {
  ((c.view = "home"),
    e && (c.workspaceSection = e),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}

// Apply equipment params to a draft (pure mutation helper)
function sa(e, o = {}, n) {
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

export function openEditorNew() {
  const e = Pt();
  e.brewer || (e.brewer = rt());
  const o = xe();
  if (o) sa(e, o.params, o.name);
  else {
    const n = te();
    Object.keys(n).length && sa(e, n, "");
  }
  ((c.editorDraft = e),
    (c._fermentablePercentEdit = null),
    ta(e),
    ia(),
    (c.view = "editor"),
    (c.pendingFocusKey = "recipe-name"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}

export function openEditorEntry(e) {
  const o = Ea(e);
  o &&
    ((c.editorDraft = JSON.parse(JSON.stringify(o.draft))),
    (c._fermentablePercentEdit = null),
    ta(c.editorDraft),
    ia(),
    (c.view = "editor"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}

export function backToBrew() {
  ((c.view = "brew"), c.requestRender());
}

export function openDraftInEditor(e) {
  ((c.editorDraft = JSON.parse(JSON.stringify(e))),
    (c._fermentablePercentEdit = null),
    ta(c.editorDraft),
    ia(),
    (c.view = "editor"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}

// ── re: save last production profile ─────────────────────────────────────────

function re(e) {
  const o = { ...te(), ...e };
  (we(e.baseWaterProfile) || delete o.baseWaterProfile, fa(o));
}

// ── Workspace (home) screen ───────────────────────────────────────────────────

export function workspaceScreen() {
  const e = c.workspaceSection || "recipes";
  return e === "brews"
    ? brewsScreen()
    : e === "notebook"
      ? notebookScreen()
      : e === "equipment"
        ? equipmentScreen()
        : e === "inventory"
          ? invScreen()
          : recipesScreen();
}

function recipesScreen() {
  if (drvEnabled()) {
    hydrateRecipeRowsFromCache();
    if (drvHasToken() && getDriveLoadState() === "idle") loadDriveRecipes(false);
  }
  const e = mergeDriveRecipes(listMyRecipes());
  return [
    pageHead(
      t("Receitas"),
      e.length ? t("{n} na prateleira", { n: e.length }) : "",
    ),
    driveStatusRow(),
    e.length ? myRecipesCard(e) : emptyRecipesState(),
  ];
}

function brewsScreen() {
  if (drvEnabled()) {
    hydrateBatchesFromCache();
    if (drvHasToken() && getDriveBatchesState() === "idle") loadDriveBatches(false);
  }
  const e = Fe().filter((r) => r.status === "active"),
    o = e.length ? t("{n} em andamento", { n: e.length }) : "",
    n = e.length
      ? null
      : a("section", "card home-card welcome-card", [
          a("div", "card-body", [
            a("h2", "welcome-title", t("Nenhuma brassagem em andamento")),
            a(
              "p",
              "welcome-text",
              t(
                "Escolha uma receita na prateleira e comece — a leva fica aqui enquanto brassa e fermenta. Ao concluir, ela vai para o Caderno.",
              ),
            ),
            a("div", "home-actions", [
              d(
                t("Ver receitas"),
                () => {
                  ((c.workspaceSection = "recipes"), c.requestRender());
                },
                "btn primary",
              ),
            ]),
          ]),
        ]);
  return [pageHead(t("Brassagens"), o), driveBatchesStatusRow(), n, Ln(), brewsDoneSection()];
}

function brewsDoneSection() {
  const e = Fe()
    .filter((n) => n.status === "done")
    .sort(
      (s, l) =>
        new Date(l.concludedAt || l.updatedAt).getTime() -
        new Date(s.concludedAt || s.updatedAt).getTime(),
    );
  if (!e.length) return null;
  const o = e.map((n) => {
    const r = d("", () => Fa(n), "recipe-row", {
      title: t("Abrir a ficha da leva"),
    });
    r.append(
      R("summary", "icon brew-row-icon"),
      a("div", "recipe-row-main", [
        a("b", "recipe-row-name", [
          n.recipeName,
          a("span", "recipe-row-when", ` \xB7 ${Ue(n.concludedAt || n.updatedAt)}`),
        ]),
        a(
          "span",
          "recipe-row-meta",
          n.styleName || t("conclu\xEDda"),
        ),
      ]),
      R("chevron", "icon recipe-row-chevron"),
    );
    const u = D(
      "drag",
      t("A\xE7\xF5es da leva"),
      (p) => {
        (p.stopPropagation(), oa(n));
      },
      "icon-btn subtle small-btn recipe-discard",
    );
    return a("div", "recipe-row-wrap", [r, u]);
  });
  return a("section", "card home-card", [
    a("header", "card-head", [
      R("summary", "icon card-icon"),
      a("h2", "card-title", t("Conclu\xEDdas")),
      e.length > 1 ? a("span", "card-count num", String(e.length)) : null,
    ]),
    a("div", "card-body", o),
  ]);
}

function equipmentScreen() {
  if (drvEnabled()) {
    hydrateEquipmentsFromCache();
    if (drvHasToken() && getDriveEquipmentsState() === "idle") loadDriveEquipments(false);
  }
  const e = X();
  return [
    pageHead(
      t("Equipamentos"),
      e.length
        ? e.length === 1
          ? t("{n} perfil", { n: e.length })
          : t("{n} perfis", { n: e.length })
        : "",
    ),
    driveEquipmentsStatusRow(),
    gn(),
    vn(),
    kn(e),
  ];
}

function gn() {
  return Ma() > 0
    ? null
    : a("section", "card home-card calib-door", [
        a("div", "calib-door-body", [
          R("boil", "icon card-icon"),
          a("div", "calib-door-text", [
            a("b", "", t("Nunca mediu seu equipamento?")),
            a(
              "span",
              "",
              t(
                "Fa\xE7a a brassagem de calibra\xE7\xE3o — uma Cream Ale simples que revela sua efici\xEAncia, evapora\xE7\xE3o e perdas reais.",
              ),
            ),
          ]),
          d(
            t("Come\xE7ar calibra\xE7\xE3o"),
            () => to(),
            "btn small calib-door-btn",
          ),
        ]),
      ]);
}

function Ma() {
  return Fe().filter(
    (e) =>
      e.status === "done" &&
      !$e(e.id) &&
      (m(e.payload?.measurements?.preBoil?.volumeL) ||
        m(e.payload?.measurements?.postBoil?.volumeL)),
  ).length;
}

function vn() {
  const e = Ma();
  return e < 1
    ? null
    : a("section", "card home-card calib-door", [
        a("div", "calib-door-body", [
          R("summary", "icon card-icon"),
          a("div", "calib-door-text", [
            a("b", "", t("Calibrar com minhas levas")),
            a(
              "span",
              "",
              e === 1
                ? t(
                    "1 leva medida pronta para ajustar seu equipamento pelos n\xFAmeros reais.",
                  )
                : t(
                    "{count} levas medidas prontas para ajustar seu equipamento pela mediana real.",
                    { count: e },
                  ),
            ),
          ]),
          d(
            t("Abrir no Caderno"),
            () => {
              ((c.workspaceSection = "notebook"),
                c.requestRender(),
                window.scrollTo({ top: 0, behavior: "instant" }));
            },
            "btn small calib-door-btn",
          ),
        ]),
      ]);
}

function emptyRecipesState() {
  return a("section", "card home-card welcome-card", [
    a("div", "card-body", [
      a("h2", "welcome-title", t("Sua primeira receita")),
      a(
        "p",
        "welcome-text",
        t(
          "Crie do zero ou traga do Brewfather — receita e equipamento v\xEAm no mesmo arquivo BeerXML.",
        ),
      ),
      a("div", "home-actions", [
        d(t("Criar receita"), () => openEditorNew(), "btn primary"),
        d(t("Importar BeerXML"), () => openImportPicker(), "btn"),
      ]),
    ]),
  ]);
}

function Ba(e, o = {}) {
  if (!(c.session?.brewId === e.id)) {
    if ((Be(), !Qa(e.payload, { confirmReplace: !1 }))) return;
    b(`"${e.recipeName}" retomada.`);
  }
  if (((c.view = "brew"), o.toFermentReading)) {
    ((c.phase = "ferment"), c.requestRender(), jt());
    return;
  }
  (c.requestRender(), window.scrollTo({ top: 0, behavior: "instant" }));
}

function Ln() {
  const e = Fe().filter((n) => n.status === "active");
  if (!e.length) return null;
  const o = e.map((n) => {
    const r = c.session?.brewId === n.id,
      i = Ke(n).startsWith("Fermentando"),
      s = d("", () => Ba(n), "recipe-row", {
        title: r ? t("Voltar \xE0 brassagem") : "Retomar",
      });
    s.append(
      R(i ? "ferment" : "boil", "icon brew-row-icon"),
      a("div", "recipe-row-main", [
        a("b", "recipe-row-name", n.recipeName),
        a(
          "span",
          "recipe-row-meta",
          `${Ke(n)} \xB7 ${na(n.updatedAt)}${r ? " \xB7 aberta agora" : ""}`,
        ),
      ]),
      R("chevron", "icon recipe-row-chevron"),
    );
    const l = i
        ? d(
            t("Lan\xE7ar leitura"),
            (p) => {
              (p.stopPropagation(), Ba(n, { toFermentReading: !0 }));
            },
            "btn ghost small brew-reading-btn",
          )
        : null,
      u = D(
        "drag",
        t("A\xE7\xF5es da leva"),
        (p) => {
          (p.stopPropagation(), oa(n));
        },
        "icon-btn subtle small-btn recipe-discard",
      );
    return a("div", `recipe-row-wrap${l ? " has-reading" : ""}`, [s, l, u]);
  });
  return a("section", "card home-card", [
    a("header", "card-head", [
      R("boil", "icon card-icon"),
      a("h2", "card-title", t("Em andamento")),
      e.length > 1 ? a("span", "card-count num", String(e.length)) : null,
    ]),
    a("div", "card-body", o),
  ]);
}

function oa(e) {
  const o = c.session?.brewId === e.id,
    n = e.status === "done";
  I(
    [
      a("b", "sheet-title", e.recipeName),
      a(
        "p",
        "sheet-message",
        `${n ? `Conclu\xEDda em ${na(e.concludedAt)}` : Ke(e)} \xB7 atualizada ${na(e.updatedAt)}`,
      ),
      a("div", "sheet-stack", [
        n && c.view !== "brewlog"
          ? d(
              t("Abrir a ficha"),
              () => {
                (h(), Fa(e));
              },
              "btn primary",
            )
          : null,
        d(
          t("Exportar arquivo"),
          () => {
            (Ie(
              JSON.stringify(e.payload, null, 2),
              nt(e.payload),
              "application/json;charset=utf-8",
            ),
              b(
                t(
                  "Sess\xE3o exportada — d\xE1 para abrir em qualquer dispositivo.",
                ),
              ));
          },
          "btn",
        ),
        d(
          t("Salvar receita em Minhas receitas"),
          () => {
            const r = saveMyRecipe(draftFromRecipe(e.payload.recipe));
            (b(
              r
                ? t("Receita salva — d\xE1 para editar e adaptar.")
                : t("N\xE3o foi poss\xEDvel salvar a receita."),
              r ? void 0 : "error",
            ),
              r && (h(), c.requestRender()));
          },
          "btn",
        ),
        n
          ? d(
              t("Reabrir leva"),
              () => {
                (ba(e.id, "active"),
                  syncBrewToDrive(e.id),
                  h(),
                  c.view === "brewlog" &&
                    ((c.view = "home"),
                    (c.workspaceSection = "brews"),
                    (c.brewLogEntry = null)),
                  b(
                    t('"{name}" voltou para Em andamento.', {
                      name: e.recipeName,
                    }),
                  ),
                  c.requestRender());
              },
              "btn",
            )
          : d(
              t("Concluir brassagem"),
              () => {
                (o ? tt() : ba(e.id, "done"),
                  syncBrewToDrive(e.id),
                  h(),
                  (c.workspaceSection = "notebook"),
                  b(t("Brassagem conclu\xEDda — ela mora no Caderno.")),
                  c.requestRender());
              },
              "btn",
            ),
        d(
          t("Excluir"),
          async () => {
            (h(),
              (await confirmDialog({
                title: t('Excluir a leva de "{name}"?', { name: e.recipeName }),
                message: t(
                  "O registro e o log desta leva ser\xE3o apagados. Essa a\xE7\xE3o n\xE3o pode ser desfeita.",
                ),
                confirmLabel: t("Excluir"),
                danger: !0,
              })) &&
                (et(e.id),
                o && (Ya(), (c.session = null), (c.view = "home")),
                c.view === "brewlog" &&
                  ((c.view = "home"),
                  (c.workspaceSection = "notebook"),
                  (c.brewLogEntry = null)),
                b(t("Leva exclu\xEDda.")),
                c.requestRender()));
          },
          "btn ghost sheet-danger",
        ),
      ]),
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
    ],
    "details",
  );
}

function Fa(e) {
  ((c.brewLogEntry = e),
    (c.view = "brewlog"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}

function yn(e) {
  try {
    const o = Je(e.payload),
      n = window.open("", "_blank");
    if (!n) throw new Error("popup bloqueado");
    (n.document.open(), n.document.write(gt(o, Te(o))), n.document.close());
  } catch (o) {
    b(
      o.message || t("N\xE3o foi poss\xEDvel abrir a vers\xE3o para imprimir."),
      "error",
    );
  }
}

function oe(e, o) {
  return a("div", "metric", [
    a("span", "metric-label", e),
    a("b", "metric-value num", o),
  ]);
}

export function brewLogScreen(e) {
  const o = () => {
      ((c.view = "home"),
        (c.workspaceSection = "notebook"),
        (c.brewLogEntry = null),
        c.requestRender(),
        window.scrollTo({ top: 0, behavior: "instant" }));
    },
    n = a("div", "brewlog-head", [
      d(t("‹ Caderno"), o, "btn ghost small brewlog-back"),
      a("div", "page-head-text", [
        a("h1", "page-title", e.recipeName),
        a(
          "span",
          "page-meta",
          `${e.styleName ? `${e.styleName} \xB7 ` : ""}${t("conclu\xEDda {date}", { date: Ue(e.concludedAt || e.updatedAt) })}`,
        ),
      ]),
    ]);
  let r, i, s;
  try {
    ((r = Je(e.payload)), (i = Te(r)), (s = vt(r, i)));
  } catch {
    return [
      n,
      a("section", "card home-card", [
        a("div", "card-body", [
          a(
            "p",
            "muted",
            t(
              "N\xE3o foi poss\xEDvel ler esta leva — o arquivo pode estar corrompido. A vers\xE3o para imprimir e o backup ainda podem ajudar.",
            ),
          ),
        ]),
      ]),
    ];
  }
  const l = Object.fromEntries(s.summaryRows.map(([N, v]) => [N, v])),
    u = a("section", "card home-card", [
      a("header", "card-head", [
        R("summary", "icon card-icon"),
        a("h2", "card-title", t("Como foi")),
      ]),
      a("div", "card-body", [
        a("div", "metric-grid", [
          oe(
            t("OG / FG"),
            l[t("OG / FG")] || `${i.og.toFixed(3)} / ${i.fg.toFixed(3)}`,
          ),
          oe(t("ABV / IBU"), l[t("ABV / IBU")] || ""),
          oe("Volume alvo", l["Volume alvo"] || ""),
        ]),
        a("div", "brewlog-lines", [
          ra(t("Corre\xE7\xE3o pr\xE9-fervura"), l[t("Pr\xE9-fervura")]),
          ra(t("Corre\xE7\xE3o p\xF3s-fervura"), l[t("P\xF3s-fervura")]),
        ]),
      ]),
    ]),
    p = !!(
      m(r.measurements?.preBoil?.volumeL) ||
      m(r.measurements?.postBoil?.volumeL)
    ),
    f = p && !$e(e.id),
    E = [
      a(
        "div",
        "brewlog-lines",
        s.analysisRows
          .filter(([N]) => N !== t("Par\xE2metros pr\xF3xima brassagem"))
          .map(([N, v]) => ra(N, v)),
      ),
    ];
  p
    ? E.push(
        a("div", "brewlog-include", [
          a(
            "span",
            "brewlog-include-label",
            f
              ? t("Entra nos n\xFAmeros do equipamento.")
              : t("Fora dos n\xFAmeros — n\xE3o calibra o equipamento."),
          ),
          d(
            f ? t("Excluir dos n\xFAmeros") : t("Incluir nos n\xFAmeros"),
            () => {
              (ha(e.id, f),
                b(
                  f
                    ? t("Leva fora dos n\xFAmeros.")
                    : t("Leva de volta aos n\xFAmeros."),
                ),
                c.requestRender());
            },
            "btn ghost small",
          ),
        ]),
      )
    : E.push(
        a(
          "p",
          "muted",
          t(
            "Sem leituras neste dia — os valores acima s\xE3o os planejados, e a leva n\xE3o entra nos n\xFAmeros.",
          ),
        ),
      );
  const y = a("section", "card home-card", [
      a("header", "card-head", [
        R("scale", "icon card-icon"),
        a("h2", "card-title", t("O equipamento no dia")),
      ]),
      a("div", "card-body", E),
    ]),
    g = (e.payload?.fermentationTracking?.readings || []).filter(we).length > 0;
  let q = null;
  if (g && s.fermentationChartHtml) {
    const N = a("div", "brewlog-chart");
    ((N.innerHTML = s.fermentationChartHtml),
      (q = a("section", "card home-card", [
        a("header", "card-head", [
          R("ferment", "icon card-icon"),
          a("h2", "card-title", t("Fermenta\xE7\xE3o")),
        ]),
        a("div", "card-body", [N]),
      ])));
  }
  return [n, u, y, q, En(e), Pn(e)];
}

function ra(e, o) {
  return a("div", "brewlog-line", [
    a("span", "brewlog-line-label", e),
    a("b", "brewlog-line-val num", o || "-"),
  ]);
}

function En(e) {
  const o = String(e.payload?.notes || "").trim(),
    n = document.createElement("textarea");
  ((n.rows = 2),
    (n.placeholder = t("Ex.: carbonatou perfeito, amargor limpo")));
  const r = d(
    t("Adicionar nota com hora"),
    () => {
      if (!at(e.id, n.value)) {
        n.focus();
        return;
      }
      const s = Za(e.id);
      (s && (c.brewLogEntry = s),
        syncBrewToDrive(e.id),
        b(t("Nota adicionada com data e hora.")),
        c.requestRender());
    },
    "btn primary small",
  );
  return a("section", "card home-card", [
    a("header", "card-head", [
      R("note", "icon card-icon"),
      a("h2", "card-title", t("Anota\xE7\xF5es")),
    ]),
    a("div", "card-body", [
      o
        ? a("pre", "brewlog-notes", o)
        : a(
            "p",
            "muted",
            t(
              "Sem anota\xE7\xF5es ainda — d\xE1 para acrescentar quando quiser, mesmo agora.",
            ),
          ),
      a("div", "brewlog-note-compose", [n, a("div", "log-actions", [r])]),
    ]),
  ]);
}

function Pn(e) {
  return a("section", "card home-card", [
    a("div", "card-body", [
      a("div", "brewlog-actions", [
        d(t("Vers\xE3o para imprimir"), () => yn(e), "btn"),
        d(t("A\xE7\xF5es da leva"), () => oa(e), "btn ghost"),
      ]),
    ]),
  ]);
}

function myRecipesCard(e = listMyRecipes()) {
  const o = recipeSearchQuery.trim().toLowerCase(),
    n = o
      ? e.filter((l) => `${l.name} ${l.styleName}`.toLowerCase().includes(o))
      : e,
    r = n.slice(0, recipeListLimit),
    i =
      e.length >= 5
        ? (() => {
            const l = document.createElement("input");
            l.type = "text";
            l.placeholder = t("Buscar receita…");
            l.value = recipeSearchQuery;
            l.setAttribute("aria-label", t("Buscar receita"));
            l.setAttribute("data-fkey", "home-search");
            l.addEventListener("input", () => {
              clearTimeout(recipeSearchDebounceTimer);
              recipeSearchDebounceTimer = setTimeout(() => {
                recipeSearchQuery = l.value;
                recipeListLimit = 10;
                // Save caret position so render restores it without selecting all
                const caretPos = l.selectionStart ?? l.value.length;
                const prevFocused = document.activeElement === l;
                c.requestRender();
                if (prevFocused) {
                  const restored = document.querySelector('[data-fkey="home-search"]');
                  if (restored) {
                    restored.focus({ preventScroll: true });
                    try { restored.setSelectionRange(caretPos, caretPos); } catch {}
                  }
                }
              }, 250);
            });
            return l;
          })()
        : null,
    s = r.map((l) => {
      const u = a("span", "ebc-swatch");
      u.style.background = fe(l.ebc);
      const p = d(
        "",
        () => (l.isDraft ? openEditorEntry(l.id) : recipeActionsSheet(l)),
        "recipe-row",
        { title: l.isDraft ? t("Continuar editando") : "" },
      );
      if (
        (p.append(
          u,
          a("div", "recipe-row-main", [
            a("b", "recipe-row-name", [
              l.name,
              l.isDraft ? a("span", "recipe-badge", "rascunho") : null,
            ]),
            a(
              "span",
              "recipe-row-meta",
              l.isDraft
                ? t("Toque para continuar editando")
                : [
                    l.styleName || t("Estilo pr\xF3prio"),
                    ` \xB7 ${P(l.abv, 1)}% \xB7 ${l.ibu} IBU \xB7 OG ${Number(l.og).toFixed(3)}`,
                  ],
            ),
          ]),
          R("chevron", "icon recipe-row-chevron"),
        ),
        !l.isDraft)
      )
        return p;
      const f = D(
        "close",
        t("Descartar rascunho"),
        async (E) => {
          (E.stopPropagation(),
            (await confirmDialog({
              title: t('Descartar o rascunho "{name}"?', { name: l.name }),
              message: t("Essa a\xE7\xE3o n\xE3o pode ser desfeita."),
              confirmLabel: t("Descartar"),
              danger: !0,
            })) && (ya(l.id), b(t("Rascunho descartado.")), c.requestRender()));
        },
        "icon-btn subtle small-btn recipe-discard",
      );
      return a("div", "recipe-row-wrap", [p, f]);
    });
  return a("section", "card home-card", [
    a("header", "card-head", [
      R("note", "icon card-icon"),
      a("h2", "card-title", t("Minhas receitas")),
      e.length >= 5 ? a("span", "card-count num", String(e.length)) : null,
    ]),
    a("div", "card-body", [
      i,
      ...(s.length
        ? s
        : [a("p", "muted", t("Nenhuma receita bate com a busca."))]),
      n.length > recipeListLimit
        ? d(
            `Ver mais (${n.length - recipeListLimit})`,
            () => {
              ((recipeListLimit += 20), c.requestRender());
            },
            "btn ghost small",
          )
        : null,
    ]),
  ]);
}

function recipeActionsSheet(e) {
  const o = a("span", "ebc-swatch");
  ((o.style.background = fe(e.ebc)),
    I(
      [
        a("div", "sheet-recipe-head", [
          o,
          a("div", "", [
            a("b", "sheet-title", e.name),
            a(
              "p",
              "sheet-message",
              `${e.styleName || t("Estilo pr\xF3prio")} \xB7 ${P(e.abv, 1)}% \xB7 ${e.ibu} IBU \xB7 OG ${Number(e.og).toFixed(3)}`,
            ),
          ]),
        ]),
        a("div", "sheet-stack", [
          d(
            t("Brassar esta receita"),
            () => {
              (h(), startBrewFromRecipe(e));
            },
            "btn primary",
          ),
          d(
            t("Editar"),
            () => {
              (h(),
                e.fromDrive
                  ? openDraftInEditor(e.draft)
                  : openEditorEntry(e.id));
            },
            "btn",
          ),
          d(
            t("Duplicar"),
            () => {
              const n = JSON.parse(JSON.stringify(e.draft));
              ((n.id = `recipe-copy-${Date.now().toString(36)}`),
                (n.name = t("{name} (c\xF3pia)", { name: e.name })),
                saveMyRecipe(n) &&
                  (h(), b(t("Receita duplicada.")), c.requestRender()));
            },
            "btn",
          ),
          d(
            t("Exportar BeerXML"),
            () => {
              (Ie(Pa(e.draft), Aa(e.draft), "application/xml;charset=utf-8"),
                b(t("BeerXML exportado.")));
            },
            "btn",
          ),
          e.fromDrive
            ? d(
                t("Salvar em Minhas receitas"),
                () => {
                  const n = JSON.parse(JSON.stringify(e.draft));
                  ((n.id = `recipe-drive-${Date.now().toString(36)}`),
                    saveMyRecipe(n) &&
                      (h(),
                      b(t("Receita salva em Minhas receitas.")),
                      c.requestRender()));
                },
                "btn",
              )
            : d(
                t("Excluir"),
                async () => {
                  (h(),
                    (await confirmDialog({
                      title: `Excluir "${e.name}"?`,
                      message: t("Essa a\xE7\xE3o n\xE3o pode ser desfeita."),
                      confirmLabel: "Excluir",
                      danger: !0,
                    })) &&
                      (moveRecipeToBin(e.id),
                      ya(e.id),
                      b(t("Receita exclu\xEDda.")),
                      c.requestRender()));
                },
                "btn ghost sheet-danger",
              ),
        ]),
        a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
      ],
      "recipe-sheet",
    ));
}

async function startBrewFromRecipe(e) {
  Be();
  const o = Le(e.draft);
  (At(e.id),
    Me(o, "Minhas receitas"),
    (c.view = "brew"),
    (c.phase = "prepare"),
    c.requestRender(),
    b(t('Brassagem de "{name}" iniciada.', { name: o.name })),
    window.scrollTo({ top: 0, behavior: "instant" }));
}

function kn(e = X()) {
  if (!e.length) {
    const i = Object.keys(te()).length
      ? t("os \xFAltimos par\xE2metros usados")
      : t(
          "o Equipamento padr\xE3o (20 L \xB7 efici\xEAncia 65% \xB7 absor\xE7\xE3o 1,0 L/kg)",
        );
    return a("section", "card home-card welcome-card", [
      a("div", "card-body", [
        a("h2", "welcome-title", t("Seu equipamento")),
        a(
          "p",
          "welcome-text",
          t(
            "Por enquanto vale {current}. Crie um perfil — ou traga um BeerXML do Brewfather pelo Importar da sidebar. Receitas novas e o Preparo passam a usar o seu.",
            { current: i },
          ),
        ),
        a("div", "home-actions", [
          d(t("Novo perfil"), () => Z(null), "btn primary"),
        ]),
      ]),
    ]);
  }
  const o = pe(),
    r = [...e]
      .sort((i, s) => (i.id === o ? -1 : s.id === o ? 1 : 0))
      .map((i) => {
        const s = i.id === o,
          l = T(m(i.params.mashEfficiencyPct, 65) / j(i.params.trubLossPct), 1),
          u = d("", () => Z(i), "recipe-row", { title: t("Editar perfil") });
        u.append(
          a("div", "recipe-row-main", [
            a("b", "recipe-row-name", i.name),
            a(
              "span",
              "recipe-row-meta",
              t("{vol} \xB7 efic. {pct}%", {
                vol: z(i.params.targetVolumeL, 0),
                pct: P(l, 1),
              }) + (s ? t(" \xB7 principal") : ""),
            ),
          ]),
          R("chevron", "icon recipe-row-chevron"),
        );
        const p = D(
          "star",
          s ? t("Perfil principal") : t("Tornar principal"),
          () => {
            s ||
              (ye(i.id),
              re(i.params),
              b(t('"{name}" agora \xE9 o principal.', { name: i.name })),
              c.requestRender());
          },
          `icon-btn small-btn star-btn ${s ? "active" : ""}`,
        );
        return a("div", "recipe-row-wrap", [p, u]);
      });
  return a("section", "card home-card", [
    a("header", "card-head", [
      R("scale", "icon card-icon"),
      a("h2", "card-title", t("Meus equipamentos")),
      a("div", "card-actions", [
        d(t("Novo perfil"), () => Z(null), "btn ghost small"),
      ]),
    ]),
    a("div", "card-body", [
      ...r,
      a(
        "p",
        "muted equip-base-note",
        t(
          "Sem um perfil principal, vale o Equipamento padr\xE3o: 20 L \xB7 efici\xEAncia 65% \xB7 absor\xE7\xE3o 1,0 L/kg.",
        ),
      ),
    ]),
  ]);
}

// ── Equipment profile sheet ───────────────────────────────────────────────────

export function Z(e, o = null) {
  const n = { ...O, ...te() },
    r = e
      ? { name: e.name, ...e.params }
      : o
        ? { name: o.name || "", ...n, ...o.params }
        : { name: "", ...n };
  r.baseWaterProfile = We(r.baseWaterProfile, He);
  let i = "essential";
  const s = () => {
    const f = T(m(r.mashEfficiencyPct, 65) / j(r.trubLossPct), 1),
      E = T(m(r.targetVolumeL) * m(r.trubLossPct, 0.15), 2),
      y = [
        a("label", "field", [
          a("span", "field-label", t("Nome do perfil")),
          W(
            r.name,
            (v) => {
              r.name = v;
            },
            { placeholder: t("Panela 30 L") },
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Volume no fermentador")),
          F(
            r.targetVolumeL,
            (v) => {
              ((r.targetVolumeL = A(v, 1, 1e4, "Volume")), u());
            },
            "L",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Efici\xEAncia do equipamento")),
          F(
            f,
            (v) => {
              ((r.mashEfficiencyPct = T(
                A(v, 20, 95, t("Efici\xEAncia")) * j(r.trubLossPct),
                1,
              )),
                u());
            },
            "%",
          ),
        ]),
      ];
    if (!r._evapUnit) r._evapUnit = "L/h";
    if (!r._trubUnit) r._trubUnit = "%";
    const unitToggle = (label, units, current, onSwitch) => {
      const btns = units.map((un) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = un;
        btn.className = "unit-toggle-btn" + (un === current ? " active" : "");
        btn.addEventListener("click", () => { onSwitch(un); u(); });
        return btn;
      });
      return a("span", "unit-toggle", btns);
    };
    i === "complete" &&
      y.push(
        a("label", "field", [
          a("span", "field-label", t("Evapora\xE7\xE3o")),
          a("div", "field-line", [
            r._evapUnit === "L/h"
              ? U(T(evapLhFromPct(r.evaporationPct, r.targetVolumeL), 2), (v) => {
                  r.evaporationPct = T(evapPctFromLh(A(v, 0, 50, t("Evapora\xE7\xE3o")), r.targetVolumeL), 1);
                }, {})
              : U(m(r.evaporationPct, O.evaporationPct), (v) => {
                  r.evaporationPct = A(v, 0, 40, t("Evapora\xE7\xE3o"));
                }, {}),
            unitToggle(t("Evapora\xE7\xE3o"), ["L/h", "%/h"], r._evapUnit, (un) => { r._evapUnit = un; }),
          ]),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Perda Trub")),
          a("div", "field-line", [
            r._trubUnit === "%"
              ? U(T(m(r.trubLossPct, 0.15) * 100, 1), (v) => {
                  r.trubLossPct = A(v, 0, 50, "Trub") / 100;
                }, {})
              : U(E, (v) => {
                  r.trubLossPct = m(r.targetVolumeL) > 0 ? A(v, 0, 50, "Trub") / m(r.targetVolumeL) : 0.15;
                }, {}),
            unitToggle("Trub", ["%", "L"], r._trubUnit, (un) => { r._trubUnit = un; }),
          ]),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Absor\xE7\xE3o dos gr\xE3os")),
          F(
            r.grainAbsorptionLkg,
            (v) => {
              ((r.grainAbsorptionLkg = A(v, 0, 3, t("Absor\xE7\xE3o"))), u());
            },
            "L/kg",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Rela\xE7\xE3o \xC1gua/Malte")),
          F(
            r.waterToGrainRatioLkg,
            (v) => {
              ((r.waterToGrainRatioLkg = A(v, 1, 8, t("\xC1gua/malte"))), u());
            },
            "L/kg",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Volume morto recuper\xE1vel")),
          F(
            m(r.mashTunDeadSpaceL, 0),
            (v) => {
              ((r.mashTunDeadSpaceL = A(v, 0, 50, "Volume morto")), u());
            },
            "L",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Tempo de whirlpool")),
          F(
            m(r.whirlpoolNoChillMin, 5),
            (v) => {
              ((r.whirlpoolNoChillMin = A(v, 0, 120, "Tempo de whirlpool")),
                u());
            },
            "min",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Temperatura do whirlpool")),
          F(
            m(r.whirlpoolTemperatureC, 90),
            (v) => {
              ((r.whirlpoolTemperatureC = A(
                v,
                40,
                100,
                "Temperatura do whirlpool",
              )),
                u());
            },
            "\xB0C",
          ),
        ]),
        a(
          "p",
          "muted percent-hint",
          t(
            "Quanto tempo o mosto fica quente ap\xF3s o flameout — as adi\xE7\xF5es tardias de fervura seguem isomerizando nesse per\xEDodo.",
          ),
        ),
        a("label", "field", [
          a("span", "field-label", t("Taxa de aquecimento")),
          F(
            m(r.heatingRateCMin, 1.5),
            (v) => {
              ((r.heatingRateCMin = A(v, 0, 10, "Taxa de aquecimento")), u());
            },
            "\xB0C/min",
          ),
        ]),
        a(
          "p",
          "muted percent-hint",
          t(
            "Velocidade de subida entre patamares — o rel\xF3gio da mostura conta uma etapa estimada de aquecimento. 0 desliga.",
          ),
        ),
      );
    const g =
        i === "complete"
          ? a("div", "derived-row", [
              a("span", "derived-chip", [
                a("span", "", t("Efic. mostura")),
                a("b", "", `${P(r.mashEfficiencyPct, 1)}%`),
              ]),
              a("span", "derived-chip", [
                a("span", "", t("Trub")),
                a("b", "", z(E, 2)),
              ]),
            ])
          : null,
      q = d(
        t("Essencial"),
        () => {
          ((i = "essential"), u());
        },
        "seg-btn",
        { "aria-pressed": i === "essential" ? "true" : "false" },
      ),
      N = d(
        t("Completo"),
        () => {
          ((i = "complete"), u());
        },
        "seg-btn",
        { "aria-pressed": i === "complete" ? "true" : "false" },
      );
    return [
      a(
        "b",
        "sheet-title",
        e
          ? t("Editar: {name}", { name: e.name })
          : t("Novo perfil de equipamento"),
      ),
      o
        ? a(
            "p",
            "sheet-message",
            t('Importado de "{name}" — confira os valores e salve.', {
              name: o.recipeName,
            }),
          )
        : null,
      a("div", "seg-switch", [q, N]),
      a("div", "sheet-fields", y),
      g,
      a("div", "sheet-actions", [
        e
          ? d(
              t("Excluir"),
              async () => {
                (h(),
                  (await confirmDialog({
                    title: `Excluir perfil "${e.name}"?`,
                    confirmLabel: "Excluir",
                    danger: !0,
                  })) &&
                    (moveEquipmentToBin(e.id),
                    Bt(e.id),
                    b(t("Perfil exclu\xEDdo.")),
                    c.requestRender()));
              },
              "btn ghost sheet-danger",
            )
          : null,
        d(
          t("Salvar"),
          () => {
            const v = ne({
              id: e?.id,
              name: r.name || t("Meu equipamento"),
              params: r,
            });
            if (v) {
              const $ = X();
              ((!pe() || $.length === 1 || pe() === v.id) &&
                (ye(v.id), re(v.params)),
                syncEquipmentToDrive(v),
                c.requestRender(),
                p(v, pe() === v.id));
            }
          },
          "btn primary",
        ),
      ]),
    ];
  };
  let l = I(s(), "details profile-sheet");
  function u() {
    ((l.innerHTML = ""),
      s()
        .flat()
        .filter(Boolean)
        .forEach((f) => l.append(f)));
  }
  function p(f, E) {
    const y = !e;
    ((l.innerHTML = ""),
      [
        a("div", "sheet-saved", [
          R("check", "icon sheet-saved-icon"),
          a(
            "b",
            "sheet-title",
            y
              ? t('Perfil "{name}" criado', { name: f.name })
              : t('Perfil "{name}" salvo', { name: f.name }),
          ),
          a(
            "p",
            "sheet-message",
            `${y ? t("Criado") : t("Atualizado")}${E ? t(" e definido como seu equipamento principal") : ""}${t(". J\xE1 vale para receitas novas e para o Preparo.")}`,
          ),
        ]),
        a("div", "sheet-actions", [
          d(
            t("Concluir"),
            () => {
              (h(), c.requestRender());
            },
            "btn primary",
          ),
        ]),
      ].forEach((g) => l.append(g)));
  }
}

// ── Notebook screen ───────────────────────────────────────────────────────────

function Fn(e) {
  try {
    const o = Je(e.payload),
      n = Te(o),
      r = n.props || {},
      i = n.analysis || {},
      s = (e.payload?.fermentationTracking?.readings || []).filter(we),
      l = !!(
        m(o.measurements?.preBoil?.volumeL) ||
        m(o.measurements?.postBoil?.volumeL)
      );
    return {
      entry: e,
      id: e.id,
      recipeName: e.recipeName,
      concludedAt: e.concludedAt || e.updatedAt,
      hasReadings: l,
      hasFermentation: s.length > 0,
      targetVolumeL: m(r.targetVolumeL, 20),
      mashEfficiencyPct: T(Ne(i.mashEfficiencyPct, r.mashEfficiencyPct), 1),
      evaporationPct: T(Ne(i.evaporationPct, r.evaporationPct), 1),
      grainAbsorptionLkg: T(Ne(i.grainAbsorptionLkg, r.grainAbsorptionLkg), 2),
      trubLossL: T(Ne(i.trubLossL, r.trubLossL), 2),
      waterToGrainRatioLkg: T(m(r.waterToGrainRatioLkg, 3), 2),
    };
  } catch {
    return null;
  }
}

function notebookScreen() {
  const e = Fe()
    .filter((s) => s.status === "done")
    .map(Fn)
    .filter(Boolean)
    .sort(
      (s, l) =>
        new Date(l.concludedAt).getTime() - new Date(s.concludedAt).getTime(),
    );
  if (!e.length)
    return [
      pageHead(t("Caderno"), ""),
      a("section", "card home-card welcome-card", [
        a("div", "card-body", [
          a("h2", "welcome-title", t("Seu caderno est\xE1 em branco")),
          a(
            "p",
            "welcome-text",
            t(
              "Cada brassagem conclu\xEDda entra aqui com o log completo — e as que voc\xEA mediu calibram seu equipamento sozinhas.",
            ),
          ),
          a("div", "home-actions", [
            d(
              t("Ver brassagens"),
              () => {
                ((c.workspaceSection = "brews"), c.requestRender());
              },
              "btn primary",
            ),
          ]),
        ]),
      ]),
    ];
  const o = e.filter((s) => s.hasReadings),
    n = o.filter((s) => !$e(s.id)),
    r = o.length - n.length,
    i = [
      e.length === 1
        ? t("{n} leva", { n: e.length })
        : t("{n} levas", { n: e.length }),
      n.length
        ? n.length === 1
          ? t("{n} entra nos n\xFAmeros", { n: n.length })
          : t("{n} entram nos n\xFAmeros", { n: n.length })
        : o.length
          ? t("nenhuma inclu\xEDda")
          : t("nenhuma medida ainda"),
      r ? t("{n} de fora", { n: r }) : null,
    ]
      .filter(Boolean)
      .join(" \xB7 ");
  return [pageHead(t("Caderno"), i), In(n), Dn(e)];
}

function In(e) {
  const o = xn(e);
  if (!o) return null;
  const n = xe(),
    r = o.single ? t("a leva medida") : t("a mediana"),
    i = n
      ? T(m(n.params.targetVolumeL, 20) * m(n.params.trubLossPct, 0.15), 2)
      : null,
    s = [
      Ve(
        t("Efici\xEAncia de mostura"),
        o.mashEfficiencyPct,
        n ? m(n.params.mashEfficiencyPct) : null,
        "%",
        1,
        1.5,
      ),
      Ve(
        t("Evapora\xE7\xE3o"),
        o.evaporationPct,
        n ? m(n.params.evaporationPct) : null,
        "%/h",
        1,
        1,
      ),
      Ve(
        t("Absor\xE7\xE3o do gr\xE3o"),
        o.grainAbsorptionLkg,
        n ? m(n.params.grainAbsorptionLkg) : null,
        " L/kg",
        2,
        0.1,
      ),
      Ve(t("Perda no trub"), o.trubLossL, i, " L", 1, 0.5),
    ].filter(Boolean),
    l = n ? m(n.params.targetVolumeL, 20) : o.targetVolumeL || O.targetVolumeL,
    u = () => ({
      mashEfficiencyPct: o.mashEfficiencyPct || O.mashEfficiencyPct,
      evaporationPct: o.evaporationPct || O.evaporationPct,
      grainAbsorptionLkg: o.grainAbsorptionLkg || O.grainAbsorptionLkg,
      waterToGrainRatioLkg: o.waterToGrainRatioLkg || O.waterToGrainRatioLkg,
      trubLossPct: o.trubLossL && l ? T(o.trubLossL / l, 4) : O.trubLossPct,
    }),
    p = [];
  (n &&
    p.push(
      d(
        t('Atualizar "{name}"', { name: n.name }),
        async () => {
          if (
            !(await confirmDialog({
              title: t('Calibrar "{name}" com {source}?', {
                name: n.name,
                source: r,
              }),
              message: o.single
                ? t(
                    "Efici\xEAncia, evapora\xE7\xE3o, absor\xE7\xE3o, trub e \xE1gua/malte passam a valer os n\xFAmeros da sua leva medida. O volume e o resto do perfil ficam como est\xE3o.",
                  )
                : t(
                    "Efici\xEAncia, evapora\xE7\xE3o, absor\xE7\xE3o, trub e \xE1gua/malte passam a valer a mediana das suas levas medidas. O volume e o resto do perfil ficam como est\xE3o.",
                  ),
              confirmLabel: "Atualizar",
            }))
          )
            return;
          const g = ne({
            id: n.id,
            name: n.name,
            params: { ...n.params, ...u() },
          });
          g &&
            (pe() === g.id && re(g.params),
            syncEquipmentToDrive(g),
            b(
              t('"{name}" calibrado com {source}.', {
                name: g.name,
                source: r,
              }),
            ),
            c.requestRender());
        },
        "btn primary small",
      ),
    ),
    p.push(
      d(
        t("Criar novo perfil"),
        () => {
          const y = ne({
            name: t("Calibra\xE7\xE3o \xB7 {date}", {
              date: Ue(new Date().toISOString()),
            }),
            params: { targetVolumeL: l, ...u() },
          });
          y &&
            (ye(y.id),
            re(y.params),
            syncEquipmentToDrive(y),
            b(
              t('Perfil "{name}" criado e definido como principal.', {
                name: y.name,
              }),
            ),
            c.requestRender());
        },
        "btn small",
      ),
    ));
  const f =
      (o.single
        ? t("1 leva medida (leitura \xFAnica)")
        : o.count === 1
          ? t("mediana de {n} leva no c\xE1lculo", { n: o.count })
          : t("mediana de {n} levas no c\xE1lculo", { n: o.count })) +
      (n
        ? t(" \xB7 perfil: {name}", { name: n.name })
        : t(" \xB7 sem perfil principal")),
    E = o.single
      ? t(
          "Uma leva s\xF3 — pode ter sido um dia at\xEDpico. Com mais levas medidas a mediana ignora o dia fora da curva e fica robusta.",
        )
      : t(
          "A mediana ignora um dia fora da curva (lavagem travada, transbordo) — por isso ela calibra o perfil, n\xE3o a m\xE9dia.",
        );
  return a("section", "card home-card", [
    a("header", "card-head", [
      R("scale", "icon card-icon"),
      a("h2", "card-title", t("Seu equipamento em n\xFAmeros")),
    ]),
    a("div", "card-body", [
      a("p", "calib-sub", f),
      a("div", "calib-body", s),
      a("p", "calib-note", E),
      a("div", "calib-actions", p),
    ]),
  ]);
}

function xn(e) {
  if (!e.length) return null;
  if (e.length === 1) {
    const n = e[0];
    return {
      count: 1,
      single: !0,
      mashEfficiencyPct: n.mashEfficiencyPct,
      evaporationPct: n.evaporationPct,
      grainAbsorptionLkg: n.grainAbsorptionLkg,
      trubLossL: n.trubLossL,
      waterToGrainRatioLkg: n.waterToGrainRatioLkg,
      targetVolumeL: n.targetVolumeL,
    };
  }
  const o = St(e, 5);
  return o ? { ...o, single: !1 } : null;
}

function Ve(e, o, n, r, i, s) {
  if (!Number.isFinite(o) || o <= 0) return null;
  let l;
  if (Number.isFinite(n) && n > 0) {
    const u = o - n,
      p = Math.abs(u) >= s,
      f = u >= 0 ? "+" : "−";
    l = a(
      "span",
      `calib-delta ${p ? "warn" : ""}`,
      p
        ? `perfil ${P(n, i)} \xB7 ${f}${P(Math.abs(u), i)}`
        : `perfil ${P(n, i)} \xB7 ok`,
    );
  } else l = a("span", "calib-delta", t("sem perfil"));
  return a("div", "calib-row", [
    a("span", "calib-row-label", e),
    a("span", "calib-row-val", [a("b", "num", `${P(o, i)}${r}`), l]),
  ]);
}

function Dn(e) {
  const o = e.map((n) => {
    const r = n.hasReadings && !$e(n.id),
      i = d("", () => Fa(n.entry), "recipe-row", {
        title: t("Abrir a ficha da leva"),
      });
    let s;
    (n.hasReadings
      ? r
        ? (s = n.hasFermentation
            ? t("efic. {pct}% \xB7 fermenta\xE7\xE3o acompanhada", {
                pct: P(n.mashEfficiencyPct, 1),
              })
            : t(
                "efic. {pct}% \xB7 sem fermenta\xE7\xE3o — vale para o equipamento",
                { pct: P(n.mashEfficiencyPct, 1) },
              ))
        : (s = t("efic. {pct}% \xB7 fora dos n\xFAmeros (voc\xEA excluiu)", {
            pct: P(n.mashEfficiencyPct, 1),
          }))
      : (s = t("sem leituras — fora dos n\xFAmeros")),
      i.append(
        R("summary", "icon brew-row-icon"),
        a("div", "recipe-row-main", [
          a("b", "recipe-row-name", [
            n.recipeName,
            a("span", "recipe-row-when", ` \xB7 ${Ue(n.concludedAt)}`),
          ]),
          a("span", "recipe-row-meta", s),
        ]),
        R("chevron", "icon recipe-row-chevron"),
      ));
    const l = n.hasReadings
        ? (() => {
            const p = d(
              "",
              (f) => {
                (f.stopPropagation(),
                  ha(n.id, r),
                  b(
                    r
                      ? t("Leva fora dos n\xFAmeros.")
                      : t("Leva de volta aos n\xFAmeros."),
                  ),
                  c.requestRender());
              },
              `calib-check ${r ? "on" : "off"}`,
              {
                title: r
                  ? t("Entra nos n\xFAmeros — tocar para excluir")
                  : t("Fora dos n\xFAmeros — tocar para incluir"),
                "aria-pressed": r ? "true" : "false",
              },
            );
            return (r && p.append(R("check", "icon")), p);
          })()
        : a("span", "calib-check ghost"),
      u = D(
        "drag",
        t("A\xE7\xF5es da leva"),
        (p) => {
          (p.stopPropagation(), oa(n.entry));
        },
        "icon-btn subtle small-btn recipe-discard",
      );
    return a("div", `recipe-row-wrap has-check${r ? "" : " brew-row-muted"}`, [
      l,
      i,
      u,
    ]);
  });
  return a("section", "card home-card", [
    a(
      "header",
      "card-head",
      [
        R("summary", "icon card-icon"),
        a("h2", "card-title", t("Levas conclu\xEDdas")),
        e.length > 1 ? a("span", "card-count num", String(e.length)) : null,
      ].filter(Boolean),
    ),
    a("div", "card-body", o),
  ]);
}

// ── Date formatter ────────────────────────────────────────────────────────────

function Ue(e) {
  const o = new Date(e || "");
  return Number.isFinite(o.getTime())
    ? o.toLocaleDateString(ka(), { day: "2-digit", month: "2-digit" })
    : "-";
}

// ── Calibration sheet helpers ─────────────────────────────────────────────────

function ao(e) {
  const o = Math.min(200, Math.max(1, m(e, Ca))),
    n = Zt(o),
    r = Le(n);
  Me(r, "Calibra\xE7\xE3o");
  const i = c.session;
  i &&
    ((i.properties = { ...i.properties, ...en(o, r.boilTimeMin) }),
    (i.calibration = !0),
    (c.view = "brew"),
    (c.phase = "prepare"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}

function to() {
  const e = xe(),
    o = te(),
    n = Math.round(m(e?.params?.targetVolumeL, m(o.targetVolumeL, Ca)));
  let r = n;
  const i = U(
    n,
    (s) => {
      r = s === "" ? n : m(s);
    },
    { "aria-label": "Volume no fermentador em litros" },
  );
  I(
    [
      a("b", "sheet-title", t("Brassagem de calibra\xE7\xE3o")),
      a(
        "p",
        "sheet-message",
        t(
          "Uma Cream Ale simples e barata para medir o SEU equipamento. No fim, ela vira o seu perfil real.",
        ),
      ),
      a("div", "calib-ask", [
        a(
          "label",
          "calib-ask-label",
          t("Quanto voc\xEA costuma produzir? (volume no fermentador)"),
        ),
        a("div", "calib-ask-field", [i, a("span", "muted", "L")]),
        a(
          "p",
          "muted calib-ask-hint",
          t(
            "Use o volume do seu dia t\xEDpico — a calibra\xE7\xE3o vale para o padr\xE3o. Evapora\xE7\xE3o e volume morto s\xE3o absolutos, n\xE3o escalam com o lote.",
          ),
        ),
      ]),
      a("div", "calib-contract", [
        a("b", "", t("Como funciona")),
        a("ul", "calib-contract-list", [
          a(
            "li",
            "",
            t(
              "Alguns par\xE2metros v\xE3o ser conservadores de prop\xF3sito (efici\xEAncia e evapora\xE7\xE3o).",
            ),
          ),
          a(
            "li",
            "",
            t(
              "Durante o dia voc\xEA mede e corrige com \xC1GUA — e a brassagem termina certa.",
            ),
          ),
          a(
            "li",
            "",
            t(
              "Pe\xE7a alguns insumos a mais por garantia: haver\xE1 corre\xE7\xF5es, ent\xE3o a lista j\xE1 vem refor\xE7ada.",
            ),
          ),
        ]),
      ]),
      a("div", "sheet-actions", [
        d(
          t("Come\xE7ar calibra\xE7\xE3o"),
          () => {
            (h(), ao(r));
          },
          "btn primary",
        ),
        d(t("Fechar"), () => h(), "btn ghost"),
      ]),
    ],
    "details calib-sheet",
  );
}

export function calibrationPayoffCard(e) {
  if (!c.session?.calibration) return null;
  const o = c.session.measurements || {};
  if (!!!(m(o.preBoil?.volumeL) && m(o.postBoil?.volumeL)))
    return a("section", "card home-card calib-payoff", [
      a("header", "card-head", [
        R("scale", "icon card-icon"),
        a("h2", "card-title", t("Falta medir para revelar seu equipamento")),
      ]),
      a("div", "card-body", [
        a(
          "p",
          "muted",
          t(
            "Me\xE7a o volume e a densidade no pr\xE9-fervura e no p\xF3s-fervura. Sem essas leituras, os n\xFAmeros acima ainda s\xE3o a partida conservadora — n\xE3o o seu sistema.",
          ),
        ),
      ]),
    ]);
  if (c.session.calibrationEquipmentSaved) {
    const g = c.session.calibrationSavedProfile?.name || t("seu equipamento"),
      q = c.session.calibrationSavedProfile?.id,
      N = q
        ? d(
            t("Renomear ou editar"),
            () => {
              const v = X().find(($) => $.id === q);
              v && Z(v);
            },
            "btn small",
          )
        : null;
    return a("section", "card home-card calib-payoff calib-payoff-done", [
      a("header", "card-head", [
        R("check", "icon card-icon"),
        a("h2", "card-title", t("Equipamento salvo")),
      ]),
      a("div", "card-body", [
        a(
          "p",
          "muted",
          t(
            'Salvo como "{name}" e definido como principal. Suas pr\xF3ximas receitas j\xE1 nascem calibradas pelo seu sistema — siga para a fermenta\xE7\xE3o; ao concluir, a leva fica no Caderno.',
            { name: g },
          ),
        ),
        N ? a("div", "log-actions", [N]) : null,
      ]),
    ]);
  }
  const r = xe(),
    i = T(m(e.props.targetVolumeL, 20), 1),
    s = T(m(e.analysis.trubLossL), 2),
    l = i + Math.max(0, s),
    u = l
      ? (m(e.analysis.mashEfficiencyPct) * i) / l
      : m(e.analysis.mashEfficiencyPct),
    p = () => ({
      mashEfficiencyPct:
        T(m(e.analysis.mashEfficiencyPct), 1) || O.mashEfficiencyPct,
      evaporationPct: T(m(e.analysis.evaporationPct), 1) || O.evaporationPct,
      grainAbsorptionLkg:
        T(m(e.analysis.grainAbsorptionLkg), 2) || O.grainAbsorptionLkg,
      waterToGrainRatioLkg:
        T(m(e.props.waterToGrainRatioLkg, 3), 2) || O.waterToGrainRatioLkg,
      trubLossPct: s && i ? T(s / i, 4) : O.trubLossPct,
    }),
    f = a("div", "metric-grid", [
      oe(t("Efici\xEAncia equipamento"), `${P(u, 1)}%`),
      oe(
        t("Absor\xE7\xE3o gr\xE3os"),
        `${P(m(e.analysis.grainAbsorptionLkg), 2)} L/kg`,
      ),
      oe(t("Evapora\xE7\xE3o"), `${P(m(e.analysis.evaporationPct), 1)}%/h`),
      oe(t("Perda trub"), z(s, 2)),
    ]),
    E = (g, q) => {
      g &&
        ((c.session.calibrationEquipmentSaved = !0),
        (c.session.calibrationSavedProfile = { id: g.id, name: g.name }),
        b(q),
        c.requestRender(),
        window.scrollTo({ top: 0, behavior: "instant" }));
    },
    y = [];
  return (
    r
      ? (y.push(
          d(
            t('Atualizar "{name}"', { name: r.name }),
            () => {
              const g = ne({
                id: r.id,
                name: r.name,
                params: { ...r.params, ...p() },
              });
              (g && pe() === g.id && re(g.params),
                syncEquipmentToDrive(g),
                E(
                  g,
                  t('"{name}" calibrado com esta brassagem.', { name: r.name }),
                ));
            },
            "btn primary",
          ),
        ),
        y.push(
          d(
            t("Criar novo perfil"),
            () => {
              const g = ne({
                name: t("Calibra\xE7\xE3o \xB7 {date}", {
                  date: Ue(new Date().toISOString()),
                }),
                params: { targetVolumeL: i, ...p() },
              });
              (g && (ye(g.id), re(g.params)),
                syncEquipmentToDrive(g),
                E(g, t("Perfil criado e definido como principal.")));
            },
            "btn small",
          ),
        ))
      : y.push(
          d(
            t("Salvar como meu equipamento"),
            () => {
              const g = ne({
                name: t("Meu equipamento"),
                params: { targetVolumeL: i, ...p() },
              });
              (g && (ye(g.id), re(g.params)),
                syncEquipmentToDrive(g),
                E(g, t("Equipamento salvo e definido como principal.")));
            },
            "btn primary",
          ),
        ),
    a("section", "card home-card calib-payoff", [
      a("header", "card-head", [
        R("scale", "icon card-icon"),
        a(
          "h2",
          "card-title",
          t("Calibra\xE7\xE3o conclu\xEDda — seu equipamento real"),
        ),
      ]),
      a("div", "card-body", [
        a(
          "p",
          "muted",
          t(
            "Medimos o seu sistema nesta brassagem. Salve como seu equipamento e as pr\xF3ximas receitas j\xE1 nascem no ponto — a partida conservadora era s\xF3 para o dia terminar certo.",
          ),
        ),
        f,
        a("div", "log-actions", y),
      ]),
    ])
  );
}

