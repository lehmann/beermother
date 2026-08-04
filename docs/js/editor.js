import {
  WATER_IONS as ma,
  DEFAULT_PROFILE as O,
  DEFAULT_BASE_WATER_PROFILE as He,
  sanitizeBaseWaterProfile as We,
  isPlainObject as we,
  parseUserNumber as Xa,
  toNumber as m,
  round as T,
  calculate as Te,
  createRecipeSession as pa,
  pickParameterValue as Ne,
  acidDoseForTarget,
  DEFAULT_MASH_PH_TARGET,
} from "./engine.js";
import {
  app as c,
  startRecipe as Me,
  restoreBrewSessionPayload as Qa,
  loadSavedProductionProfile as te,
  saveProductionProfile as fa,
  writeAutosaveNow as Be,
  clearAutosave as Ya,
  listBrews as Fe,
  getBrew as Za,
  upsertBrewFromPayload as upsertBrewEntry,
  setBrewStatus as ba,
  deleteBrew as et,
  appendBrewNote as at,
  isBrewExcluded as $e,
  setBrewExcluded as ha,
  brewStageLabel as Ke,
  buildSessionFromPayload as Je,
  concludeCurrentBrew as tt,
  brewSessionFileName as nt,
  loadSettings as ot,
  saveSettings as ga,
  loadAuthorName as rt,
  loadColorPalette as it,
  COLOR_PALETTES as st,
  saveTheme as lt,
  loadGuideLevel as ct,
  saveGuideLevel as dt,
  loadPhMode as ut,
  savePhMode as mt,
  loadPhAcidType,
  savePhAcidType,
  loadPhAcidConcentration as loadPhAcidConc,
  savePhAcidConcentration as savePhAcidConc,
  loadAnalysisBetaMode as va,
  saveAnalysisBetaMode as wa,
  APP_VERSION as bt,
  loadDriveEnabled as drvEnabled,
  saveDriveEnabled as drvSetEnabled,
  loadDriveFolderName as drvFolder,
  saveDriveFolderName as drvSetFolder,
  setBrewUpsertedCallback,
} from "./state.js";
import {
  saveRecipeToDrive as drvUpload,
  requestDriveAccess as drvAuth,
  syncRecipesFromDrive as drvSyncRecipes,
  hasDriveToken as drvHasToken,
  saveEquipmentToDrive as drvSaveEquipment,
  syncEquipmentsFromDrive as drvSyncEquipments,
  saveBatchToDrive as drvSaveBatch,
  syncBatchesFromDrive as drvSyncBatches,
} from "./gdrive.js";
import { PH_ACID_TYPES as ht } from "./ph.js";
import {
  generateBrewReportHtml as gt,
  buildBrewReport as vt,
} from "./report.js";
import {
  el as a,
  button as d,
  iconButton as D,
  icon as R,
  decimalInput as U,
  selectOnFocus as wt,
  toast as b,
  setButtonFeedback as Lt,
  downloadTextFile as Ie,
  focusTargetIndex as yt,
  moveFocusAfterRender as Et,
} from "./ui.js";
import {
  newDraft as Pt,
  draftFromRecipe,
  computeTargets,
  recipeFromDraft as Le,
  listMyRecipes,
  saveMyRecipe,
  deleteMyRecipe as ya,
  getMyRecipe as Ea,
  touchMyRecipe as At,
  medianBrewParameters as St,
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
  deleteProductionProfileEntry as Bt,
  getPrincipalProfileId as pe,
  setPrincipalProfileId as ye,
  getPrincipalProfile as xe,
  productionParamsFromImportedRecipe as Ft,
  loadUserLibrary as De,
  saveUserIngredient as Ye,
  MAX_FERMENTATION_PRESSURE_ATM as $t,
} from "./recipes.js";
import { parseBeerXml, sanitizeXmlText as It } from "./beerxml.js";
import {
  MALT_LIBRARY as xt,
  HOP_LIBRARY as Dt,
  YEAST_LIBRARY as Ot,
  MISC_LIBRARY as Gt,
  STYLE_LIBRARY as Vt,
  MASH_PRESETS as Ut,
  FERMENTATION_PRESETS as _t,
} from "./library.js";
import {
  openBrewSessionText as zt,
  ebcToHex as fe,
  addFermentationReading as jt,
  isExpectedUnlocked as Ht,
  setExpectedUnlocked as Wt,
  openShoppingListSheet as Kt,
} from "./screens.js";
import {
  LANGUAGES as Jt,
  getLanguage as Xt,
  setLanguage as Qt,
  t,
  tEngine as qa,
  fmt as P,
  formatInputValue as Ee,
  formatVolume as z,
  formatMaltMass as Ra,
  localeTag as ka,
} from "./i18n.js";
import { COURSE_RECIPES as ea } from "./course-recipes-data.js";
import {
  buildCalibrationDraft as Zt,
  calibrationSessionProperties as en,
  CALIBRATION_DEFAULT_VOLUME_L as Ca,
} from "./calibration.js";
import { requestRecipeAnalysis as an } from "./analysis-screen.js";
import {
  inventoryScreen as invScreen,
  inventoryMaltItems,
  inventoryHopItems,
  inventoryYeastItems,
  inventoryMiscItems,
} from "./inventory.js";
function j(e) {
  return 1 + Math.min(0.5, Math.max(0, m(e, O.trubLossPct)));
}
let recipeSearchQuery = "",
  recipeListLimit = 10,
  recipeSearchDebounceTimer = null,
  fermentablePercentEdit = null,
  showIbuPerAddition = !1;
let driveRows = [],
  driveLoadState = "idle",
  driveEquipmentsLoaded = false,
  driveBatchesLoaded = false;

// localStorage keys for Drive file caches
const DRIVE_RECIPE_CACHE_KEY = "beermother.drive.cache.recipes.v1";
const DRIVE_EQUIPMENT_CACHE_KEY = "beermother.drive.cache.equipments.v1";
const DRIVE_BATCH_CACHE_KEY = "beermother.drive.cache.batches.v1";

function loadDriveCache(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDriveCache(key, entries) {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {}
}

// Fire-and-forget Drive sync helpers — never throw into the calling flow.
async function syncBrewToDrive(brewId) {
  if (!drvEnabled() || !drvHasToken()) return;
  const entry = Za(brewId);
  if (!entry) return;
  try {
    await drvSaveBatch(entry);
  } catch {}
}

async function syncEquipmentToDrive(profile) {
  if (!drvEnabled() || !drvHasToken() || !profile) return;
  try {
    const cacheEntry = await drvSaveEquipment(profile);
    const cache = loadDriveCache(DRIVE_EQUIPMENT_CACHE_KEY);
    const updated = cache.filter((e) => e.driveFileId !== cacheEntry.driveFileId);
    updated.push(cacheEntry);
    saveDriveCache(DRIVE_EQUIPMENT_CACHE_KEY, updated);
  } catch {}
}

// Register Drive sync on every brew upsert (autosave, conclude, reopen, etc.)
setBrewUpsertedCallback((entry) => {
  if (!drvEnabled() || !drvHasToken()) return;
  drvSaveBatch(entry).then((cacheEntry) => {
    const cache = loadDriveCache(DRIVE_BATCH_CACHE_KEY);
    const updated = cache.filter((e) => e.driveFileId !== cacheEntry.driveFileId);
    updated.push(cacheEntry);
    saveDriveCache(DRIVE_BATCH_CACHE_KEY, updated);
  }).catch(() => {});
});

function driveKey(e) {
  return String(e || "")
    .trim()
    .toLowerCase();
}
function driveFileToRow(e) {
  try {
    const o = parseBeerXml(e.content),
      n = draftFromRecipe(o),
      r = computeTargets(n);
    return {
      id: `drive:${e.id}`,
      driveFileId: e.id,
      name: n.name || e.name.replace(/\.xml$/i, ""),
      styleName: n.styleName || "",
      abv: r.abv,
      ebc: r.ebc,
      ibu: r.ibu,
      og: r.og,
      isDraft: !1,
      fromDrive: !0,
      draft: n,
    };
  } catch {
    return null;
  }
}
async function loadDriveRecipes(forceRefresh) {
  // Step 1: hydrate from localStorage cache immediately
  const cache = loadDriveCache(DRIVE_RECIPE_CACHE_KEY);
  if (cache.length && driveLoadState === "idle") {
    driveRows = cache.map(driveFileToRow).filter(Boolean);
    c.requestRender();
  }

  driveLoadState = "loading";
  if (forceRefresh) c.requestRender();

  try {
    const { entries, changed } = await drvSyncRecipes(cache);
    if (changed) {
      saveDriveCache(DRIVE_RECIPE_CACHE_KEY, entries);
      driveRows = entries.map(driveFileToRow).filter(Boolean);
    }
    driveLoadState = "done";
  } catch (err) {
    driveLoadState = "error";
    if (forceRefresh) b(err.message || t("Erro ao carregar receitas do Drive."), "error");
  }
  c.requestRender();
}
// Merge a brew entry loaded from Drive: only import if remote is newer than local.
function mergeBatchFromDrive(remoteEntry) {
  if (!remoteEntry?.id || !remoteEntry?.payload) return;
  const local = Za(remoteEntry.id);
  const remoteNewer = !local || new Date(remoteEntry.updatedAt) > new Date(local.updatedAt);
  if (remoteNewer) {
    // payload must carry brewId — ensure it does
    const payload = { ...remoteEntry.payload, brewId: remoteEntry.id };
    upsertBrewEntry(payload, { status: remoteEntry.status });
  }
}

async function loadDriveEquipments() {
  if (!drvEnabled() || !drvHasToken() || driveEquipmentsLoaded) return;
  driveEquipmentsLoaded = true;

  // Hydrate from cache immediately
  const cache = loadDriveCache(DRIVE_EQUIPMENT_CACHE_KEY);
  if (cache.length) {
    for (const entry of cache) {
      try {
        const profile = JSON.parse(entry.content);
        if (profile?.id && !X().find((p) => p.id === profile.id)) ne(profile);
      } catch {}
    }
    if (cache.length) c.requestRender();
  }

  try {
    const { entries, changed } = await drvSyncEquipments(cache);
    if (changed) {
      saveDriveCache(DRIVE_EQUIPMENT_CACHE_KEY, entries);
      for (const entry of entries) {
        try {
          const profile = JSON.parse(entry.content);
          if (profile?.id) ne(profile);
        } catch {}
      }
      c.requestRender();
    }
  } catch {
    driveEquipmentsLoaded = false;
  }
}

async function loadDriveBatches() {
  if (!drvEnabled() || !drvHasToken() || driveBatchesLoaded) return;
  driveBatchesLoaded = true;

  // Hydrate from cache immediately
  const cache = loadDriveCache(DRIVE_BATCH_CACHE_KEY);
  if (cache.length) {
    for (const entry of cache) {
      try {
        const brewEntry = JSON.parse(entry.content);
        if (brewEntry?.id && brewEntry?.payload) mergeBatchFromDrive(brewEntry);
      } catch {}
    }
    if (cache.length) c.requestRender();
  }

  try {
    const { entries, changed } = await drvSyncBatches(cache);
    if (changed) {
      saveDriveCache(DRIVE_BATCH_CACHE_KEY, entries);
      for (const entry of entries) {
        try {
          const brewEntry = JSON.parse(entry.content);
          if (brewEntry?.id && brewEntry?.payload) mergeBatchFromDrive(brewEntry);
        } catch {}
      }
      c.requestRender();
    }
  } catch {
    driveBatchesLoaded = false;
  }
}

function maybeAutoLoadDrive() {
  if (!drvEnabled() || !drvHasToken()) return;
  if (driveLoadState === "idle") loadDriveRecipes(!1);
  loadDriveEquipments();
  loadDriveBatches();
}
function mergeDriveRecipes(e) {
  if (!driveRows.length) return e;
  const o = new Set(e.map((n) => driveKey(n.name)));
  return e.concat(driveRows.filter((n) => !o.has(driveKey(n.name))));
}
function driveStatusRow() {
  if (!drvEnabled()) return null;
  if (driveLoadState === "loading")
    return a(
      "p",
      "muted drive-sync-status",
      t("Carregando receitas do Drive…"),
    );
  const e =
    driveLoadState === "done"
      ? t("Atualizar do Drive")
      : t("Carregar do Drive");
  return a("div", "drive-sync-row", [
    d(e, () => loadDriveRecipes(!0), "btn ghost small"),
    driveLoadState === "error"
      ? a("span", "muted drive-sync-status", t("Falha ao carregar do Drive."))
      : null,
  ]);
}
function openDraftInEditor(e) {
  ((c.editorDraft = JSON.parse(JSON.stringify(e))),
    (fermentablePercentEdit = null),
    ta(c.editorDraft),
    ia(),
    (c.view = "editor"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}
typeof document < "u" &&
  document.addEventListener &&
  document.addEventListener("keydown", (e) => {
    if ((c.view || "brew") !== "editor" || !e.ctrlKey) return;
    const o = e.target?.tagName;
    o === "INPUT" ||
      o === "TEXTAREA" ||
      o === "SELECT" ||
      (e.key.toLowerCase() === "z" &&
        !e.shiftKey &&
        (e.preventDefault(), editorUndo()),
      (e.key.toLowerCase() === "y" ||
        (e.key.toLowerCase() === "z" && e.shiftKey)) &&
        (e.preventDefault(), editorRedo()));
  });
export function openHome(e) {
  ((c.view = "home"),
    e && (c.workspaceSection = e),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
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
    (fermentablePercentEdit = null),
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
    (fermentablePercentEdit = null),
    ta(c.editorDraft),
    ia(),
    (c.view = "editor"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}
export function backToBrew() {
  ((c.view = "brew"), c.requestRender());
}
function A(e, o, n, r) {
  const i = m(e, o);
  if (i < o || i > n) {
    const s = Math.min(n, Math.max(o, i));
    return (
      b(
        t("{label}: ajustado para {value} (faixa {min}\u2013{max}).", {
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
let Oe = null,
  Se = null;
function h() {
  (Oe && (Oe.remove(), (Oe = null)),
    Se && (document.removeEventListener("keydown", Se), (Se = null)));
}
function I(e, o = "") {
  h();
  const n = a("div", "fable-overlay", []),
    r = a("div", `fable-sheet ${o}`, e);
  let i = !1;
  return (
    n.addEventListener("pointerdown", (s) => {
      i = s.target === n;
    }),
    n.addEventListener("click", (s) => {
      (s.target === n && i && h(), (i = !1));
    }),
    n.append(r),
    document.body.append(n),
    (Oe = n),
    (Se = (s) => {
      if (s.key === "Escape") {
        (s.preventDefault(), h());
        return;
      }
      if (s.key !== "Enter") return;
      const l = s.target?.tagName;
      if (
        l === "TEXTAREA" ||
        l === "SELECT" ||
        l === "BUTTON" ||
        o.includes("picker")
      )
        return;
      const u = r.querySelector(".sheet-actions .btn.primary");
      u && (s.preventDefault(), u.click());
    }),
    document.addEventListener("keydown", Se),
    r
  );
}
const tn = 60;
let Q = [],
  be = [],
  Y = null;
function ta(e) {
  ((Q = []), (be = []), (Y = e ? JSON.stringify(e) : null));
}
function nn(e) {
  const o = JSON.stringify(e);
  if (Y === null) {
    Y = o;
    return;
  }
  o !== Y && (Q.push(Y), Q.length > tn && Q.shift(), (be = []), (Y = o));
}
export function editorUndo() {
  if (!Q.length || !c.editorDraft) return !1;
  be.push(JSON.stringify(c.editorDraft));
  const e = Q.pop();
  return (
    (c.editorDraft = JSON.parse(e)),
    (Y = e),
    (fermentablePercentEdit = null),
    c.requestRender(),
    !0
  );
}
export function editorRedo() {
  if (!be.length || !c.editorDraft) return !1;
  Q.push(JSON.stringify(c.editorDraft));
  const e = be.pop();
  return (
    (c.editorDraft = JSON.parse(e)),
    (Y = e),
    (fermentablePercentEdit = null),
    c.requestRender(),
    !0
  );
}
export function canUndo() {
  return Q.length > 0;
}
export function canRedo() {
  return be.length > 0;
}
export function confirmDialog({
  title: e,
  message: o,
  confirmLabel: n = "Confirmar",
  cancelLabel: r = "Cancelar",
  danger: i = !1,
}) {
  return new Promise((s) => {
    I(
      [
        a("b", "sheet-title", e),
        o ? a("p", "sheet-message", o) : null,
        a("div", "sheet-actions", [
          d(
            r,
            () => {
              (h(), s(!1));
            },
            "btn ghost",
          ),
          d(
            n,
            () => {
              (h(), s(!0));
            },
            `btn ${i ? "danger-solid" : "primary"}`,
          ),
        ]),
      ],
      "dialog",
    );
  });
}
function qe({
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
    (g.placeholder = o || "Buscar\u2026"),
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
                  a("span", "picker-check", w ? "\u2611" : "\u2610"),
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
          d(`${l || "Criar"} \u201C${p.trim()}\u201D`, M, "picker-row custom"),
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
function Ge(e, o, n) {
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
function Ta(e, o, n = {}) {
  return W(e, o, n);
}
const on = 0.1;
function H(e, o) {
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
        title: `Aumentar ${r} (\u2191)`,
        "aria-label": `Aumentar ${r}`,
        tabindex: "-1",
      }),
      d([R("chevron", "icon")], () => n(-o), "stepper-btn", {
        title: `Diminuir ${r} (\u2193)`,
        "aria-label": `Diminuir ${r}`,
        tabindex: "-1",
      }),
    ]),
  ]);
}
function _(e, o, n, r = {}) {
  return H(U(e, o, r), n);
}
function rn(e, o, n = {}) {
  return _(e, o, on, n);
}
const sn = {
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
function F(e, o, n, r = sn[n]) {
  const i = U(e, o, {});
  return a("div", "field-line", [r ? H(i, r) : i, a("b", "field-unit", n)]);
}
function ln() {
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
function cn() {
  const inv = inventoryHopItems().map((e) => ({
    ...e,
    mine: !0,
    inStock: !0,
  }));
  return [...inv, ...De().hops.map((e) => ({ ...e, mine: !0 })), ...Dt];
}
function dn() {
  const inv = inventoryYeastItems().map((e) => ({
    ...e,
    mine: !0,
    inStock: !0,
  }));
  return [...inv, ...De().yeasts.map((e) => ({ ...e, mine: !0 })), ...Ot];
}
function un() {
  const inv = inventoryMiscItems().map((e) => ({
    ...e,
    mine: !0,
    inStock: !0,
  }));
  return [...inv, ...De().miscs.map((e) => ({ ...e, mine: !0 })), ...Gt];
}
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
function pageHead(e, o, n = []) {
  return a("div", "page-head", [
    a("div", "page-head-text", [
      a("h1", "page-title", e),
      o ? a("span", "page-meta", o) : null,
    ]),
    n.length ? a("div", "page-actions", n) : null,
  ]);
}
function recipesScreen() {
  maybeAutoLoadDrive();
  const e = mergeDriveRecipes(listMyRecipes());
  return [
    pageHead(
      t("Receitas"),
      e.length ? t("{n} na prateleira", { n: e.length }) : "",
    ),
    driveStatusRow(),
    e.length ? myRecipesCard(e) : emptyRecipesState(),
    courseRecipesCard(),
  ];
}
function courseRecipesCard() {
  if (!ea.length) return null;
  const e = ea.map((o) => {
    const n = d("", () => openCommunityRecipe(o), "recipe-row", {
      title: t("Abrir receita do curso"),
    });
    return (
      n.append(
        R("hop", "icon brew-row-icon"),
        a("div", "recipe-row-main", [
          a("b", "recipe-row-name", o.name),
          a("span", "recipe-row-meta", o.styleName),
        ]),
        R("chevron", "icon recipe-row-chevron"),
      ),
      a("div", "recipe-row-wrap", [n])
    );
  });
  return a("section", "card home-card", [
    a("header", "card-head", [
      R("hop", "icon card-icon"),
      a("h2", "card-title", t("Receitas do curso")),
      a("span", "card-count", String(ea.length)),
    ]),
    a("div", "recipe-list", e),
  ]);
}
function openCommunityRecipe(e) {
  ((c.editorDraft = draftFromRecipe(parseBeerXml(e.xml))),
    (fermentablePercentEdit = null),
    ta(c.editorDraft),
    ia(),
    (c.view = "editor"),
    c.requestRender(),
    window.scrollTo({ top: 0, behavior: "instant" }));
}
function brewsScreen() {
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
                "Escolha uma receita na prateleira e comece \u2014 a leva fica aqui enquanto brassa e fermenta. Ao concluir, ela vai para o Caderno.",
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
  return [pageHead(t("Brassagens"), o), n, Ln()];
}
function equipmentScreen() {
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
                "Fa\xE7a a brassagem de calibra\xE7\xE3o \u2014 uma Cream Ale simples que revela sua efici\xEAncia, evapora\xE7\xE3o e perdas reais.",
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
          "Crie do zero ou traga do Brewfather \u2014 receita e equipamento v\xEAm no mesmo arquivo BeerXML.",
        ),
      ),
      a("div", "home-actions", [
        d(t("Criar receita"), () => openEditorNew(), "btn primary"),
        d(t("Importar BeerXML"), () => openImportPicker(), "btn"),
      ]),
    ]),
  ]);
}
function na(e) {
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
                  "Sess\xE3o exportada \u2014 d\xE1 para abrir em qualquer dispositivo.",
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
                ? t("Receita salva \u2014 d\xE1 para editar e adaptar.")
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
                  b(t("Brassagem conclu\xEDda \u2014 ela mora no Caderno.")),
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
      d(t("\u2039 Caderno"), o, "btn ghost small brewlog-back"),
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
              "N\xE3o foi poss\xEDvel ler esta leva \u2014 o arquivo pode estar corrompido. A vers\xE3o para imprimir e o backup ainda podem ajudar.",
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
              : t("Fora dos n\xFAmeros \u2014 n\xE3o calibra o equipamento."),
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
            "Sem leituras neste dia \u2014 os valores acima s\xE3o os planejados, e a leva n\xE3o entra nos n\xFAmeros.",
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
              "Sem anota\xE7\xF5es ainda \u2014 d\xE1 para acrescentar quando quiser, mesmo agora.",
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
            l.placeholder = t("Buscar receita\u2026");
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
                      (ya(e.id),
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
function re(e) {
  const o = { ...te(), ...e };
  (we(e.baseWaterProfile) || delete o.baseWaterProfile, fa(o));
}
function Rn(e) {
  const o = parseBeerXml(e);
  let n = "",
    r = null,
    i = !1;
  try {
    const l = new DOMParser()
      .parseFromString(It(e), "text/xml")
      .getElementsByTagName("EQUIPMENT")[0];
    if (l) {
      ((i = !0),
        (n = l.getElementsByTagName("NAME")[0]?.textContent?.trim() || ""));
      for (const u of [
        "LAUTER_DEADSPACE",
        "TUN_DEADSPACE",
        "MASH_TUN_DEADSPACE",
      ]) {
        const p = l.getElementsByTagName(u)[0],
          f = p ? Number(String(p.textContent).trim().replace(",", ".")) : NaN;
        if (Number.isFinite(f) && f >= 0) {
          r = f;
          break;
        }
      }
    }
  } catch {}
  return {
    name: n || `Equipamento \xB7 ${o.name || "importado"}`,
    recipeName: o.name || t("Receita importada"),
    hasEquipmentBlock: i,
    params: Ft(o, { deadSpaceL: r }),
  };
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
            "Por enquanto vale {current}. Crie um perfil \u2014 ou traga um BeerXML do Brewfather pelo Importar da sidebar. Receitas novas e o Preparo passam a usar o seu.",
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
export function openBackupSheet() {
  I(
    [
      a("b", "sheet-title", t("Backup")),
      a(
        "p",
        "sheet-message",
        t(
          "Seus dados ficam neste navegador. O backup gera um arquivo .json com tudo (receitas, brassagens, perfis) \u2014 restaure aqui ou em outro dispositivo.",
        ),
      ),
      a("div", "sheet-stack", [
        d(
          t("Fazer backup"),
          () => {
            (h(), On());
          },
          "btn primary",
        ),
        d(
          t("Restaurar backup"),
          () => {
            (h(), openImportPicker());
          },
          "btn",
        ),
      ]),
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
    ],
    "details",
  );
}
const Cn = {
    ambar: { label: "Cor padr\xE3o", swatch: "#c9701a" },
    beermother: { label: "Beermother Academy", swatch: "#ed6823" },
  },
  Tn = [
    { id: "auto", label: "Autom\xE1tico" },
    { id: "light", label: "Claro" },
    { id: "dark", label: "Escuro" },
  ],
  Nn = [
    { id: "essencial", label: "Essencial" },
    { id: "guia", label: "Guia" },
    { id: "copiloto", label: "Copiloto" },
  ],
  Mn = {
    essencial:
      "S\xF3 as leituras e corre\xE7\xF5es \u2014 o app aparece onde \xE9 mais esperto que voc\xEA.",
    guia: "Acompanha o dia da brassagem pela receita (o padr\xE3o).",
    copiloto:
      "Passo a passo, do preparo ao envase \u2014 com o porqu\xEA de cada passo.",
  };
function Bn(e) {
  lt(e);
  const o =
    c.theme === "light" || c.theme === "dark"
      ? c.theme
      : window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = o;
}
function ie(e, o, n) {
  return a("section", "settings-section", [
    a("div", "settings-head", [
      a("b", "settings-title", e),
      a("span", "settings-hint", o),
    ]),
    n,
  ]);
}
function driveSettingsBlock() {
  const e = drvEnabled(),
    o = drvFolder();
  let r = o;
  const n = d(
    e ? t("Ativado") : t("Desativado"),
    async () => {
      if (e) {
        (drvSetEnabled(!1), c.requestRender());
        return;
      }
      try {
        await drvAuth();
      } catch (s) {
        b(
          s.message || t("N\xE3o foi poss\xEDvel conectar ao Google Drive."),
          "error",
        );
        return;
      }
      (drvSetEnabled(!0), c.requestRender());
    },
    `btn small ${e ? "primary" : "ghost"}`,
    { "aria-pressed": e ? "true" : "false" },
  );
  if (!e) return a("div", "settings-toggle-row", [n]);
  const i = document.createElement("input");
  ((i.type = "text"),
    (i.value = r),
    (i.placeholder = "Beer Mother"),
    (i.className = "settings-input"),
    i.setAttribute("aria-label", t("Nome da pasta no Google Drive")),
    i.addEventListener("blur", () => {
      const s = i.value.trim();
      s && s !== r && ((r = s), drvSetFolder(s));
    }),
    i.addEventListener("keydown", (s) => {
      s.key === "Enter" && i.blur();
    }));
  return a("div", "settings-drive-block", [
    a("div", "settings-toggle-row", [n]),
    a("div", "settings-drive-folder", [
      a("span", "field-label", t("Pasta no Drive")),
      i,
    ]),
  ]);
}
export function openSettingsSheet() {
  const e = () => {
    const r = ot(),
      i = it(),
      s = Ht(),
      l = va(),
      u = a(
        "div",
        "seg-switch settings-seg",
        Tn.map((k) => {
          const B = (c.theme || "auto") === k.id;
          return d(
            t(k.label),
            () => {
              B || (Bn(k.id), n());
            },
            "seg-btn",
            { "aria-pressed": B ? "true" : "false" },
          );
        }),
      ),
      p = ct(),
      f = a(
        "div",
        "seg-switch settings-seg",
        Nn.map((k) => {
          const B = p === k.id;
          return d(
            t(k.label),
            () => {
              B || (dt(k.id), c.requestRender(), n());
            },
            "seg-btn",
            { "aria-pressed": B ? "true" : "false" },
          );
        }),
      ),
      E = a("div", "settings-guide", [
        f,
        a("p", "settings-hint settings-guide-desc", t(Mn[p] || "")),
      ]),
      y = { pt: "Portugu\xEAs", en: "English", es: "Espa\xF1ol" },
      g = a(
        "div",
        "seg-switch settings-seg",
        Jt.map((k) => {
          const B = Xt() === k;
          return d(
            y[k] || k,
            () => {
              B || (Qt(k), c.requestRender(), n());
            },
            "seg-btn",
            { "aria-pressed": B ? "true" : "false" },
          );
        }),
      ),
      q = W(
        r.authorName || "",
        (k) => {
          ga({ authorName: k.trim() });
        },
        {
          placeholder: t("Ex.: Jamal"),
          "aria-label": t("Seu nome"),
          class: "settings-input",
        },
      ),
      N = st.map((k) => {
        const B = Cn[k] || { label: k, swatch: "#888888" },
          K = k === i,
          ue = a("span", "palette-dot");
        return (
          (ue.style.background = B.swatch),
          d(
            [
              ue,
              a("span", "palette-name", t(B.label)),
              K
                ? R("check", "icon palette-check")
                : a("span", "palette-check-slot"),
            ],
            () => {
              K ||
                (ga({ colorPalette: k }),
                (document.documentElement.dataset.palette = k),
                n());
            },
            `palette-btn ${K ? "active" : ""}`,
            { "aria-pressed": K ? "true" : "false" },
          )
        );
      }),
      v = d(
        s ? t("Ativada") : t("Desativada"),
        () => {
          (Wt(!s), c.requestRender(), n());
        },
        `btn small ${s ? "primary" : "ghost"}`,
        { "aria-pressed": s ? "true" : "false" },
      ),
      $ = d(
        l ? t("Ativada") : t("Desativada"),
        async () => {
          if (l) {
            (wa(!1),
              (c.analysisLoading = !1),
              c.view === "analysis" && (c.view = "editor"),
              c.requestRender(),
              n());
            return;
          }
          ((await confirmDialog({
            title: t("Ativar an\xE1lise da receita em modo beta?"),
            message: t(
              "Este recurso est\xE1 em fase de testes e pode errar. Ingredientes ainda n\xE3o cadastrados, diferen\xE7as entre lotes, t\xE9cnicas e condi\xE7\xF5es de cada produ\xE7\xE3o podem alterar bastante o resultado.",
            ),
            confirmLabel: t("Ativar mesmo assim"),
          })) && wa(!0),
            c.requestRender(),
            openSettingsSheet());
        },
        `btn small ${l ? "primary" : "ghost"}`,
        { "aria-pressed": l ? "true" : "false" },
      ),
      M = ut(),
      V = d(
        M ? t("Ativada") : t("Desativada"),
        () => {
          (mt(!M), c.requestRender(), n());
        },
        `btn small ${M ? "primary" : "ghost"}`,
        { "aria-pressed": M ? "true" : "false" },
      ),
      w = loadPhAcidType(),
      L = M
        ? a(
            "div",
            "seg-switch settings-seg",
            ht.map((k) => {
              const B = w === k.type;
              return d(
                t(k.short),
                () => {
                  B || (savePhAcidType(k.type), c.requestRender(), n());
                },
                "seg-btn",
                { "aria-pressed": B ? "true" : "false" },
              );
            }),
          )
        : null,
      acidTypeDef = ht.find((k) => k.type === w) || ht[0],
      acidConcBlock = M
        ? a("div", "settings-acid-conc", [
            a("span", "field-label", t("Concentra\xE7\xE3o")),
            U(
              loadPhAcidConc(w),
              (B) => {
                (savePhAcidConc(
                  w,
                  B === "" ? acidTypeDef.defaultConcentration : B,
                ),
                  c.requestRender());
              },
              {
                "aria-label": t("Concentra\xE7\xE3o do {acid}", {
                  acid: t(acidTypeDef.label),
                }),
                class: "settings-input settings-acid-input",
              },
            ),
            a("span", "settings-acid-unit", "%"),
          ])
        : null,
      x = a("div", "settings-guide", [
        a("div", "settings-toggle-row", [V]),
        L,
        acidConcBlock,
        M
          ? a(
              "p",
              "settings-hint settings-guide-desc",
              t(
                "Cards opcionais no dia: trate as \xE1guas, confira a mostura, registre a fervura. O app aprende quanto \xE1cido a SUA \xE1gua pede \u2014 sem f\xF3rmula.",
              ),
            )
          : null,
      ]),
      ae = a("div", "settings-appearance", [u, a("div", "palette-row", N)]);
    return [
      a("b", "sheet-title", t("Configura\xE7\xF5es")),
      a("div", "sheet-fields settings-scroll", [
        ie(
          t("Seu nome"),
          t("Entra autom\xE1tico como autor nas receitas novas."),
          q,
        ),
        ie(
          t("Idioma"),
          t(
            "Portugu\xEAs \xE9 o idioma de refer\xEAncia; English e Espa\xF1ol em tradu\xE7\xE3o.",
          ),
          g,
        ),
        ie(
          t("Apar\xEAncia"),
          t("Tema e cor do app \u2014 valem no claro e no escuro."),
          ae,
        ),
        a("p", "settings-group-title", t("Ferramentas em desenvolvimento")),
        ie(t("Guia"), t("Quanta companhia durante a brassagem."), E),
        ie(
          t("\xC1gua e pH"),
          t(
            "Medi\xE7\xE3o de pH no dia de brassagem, com dose de \xE1cido sugerida.",
          ),
          x,
        ),
        ie(
          t("Previs\xE3o de fermenta\xE7\xE3o"),
          t("A curva esperada e as faixas durante a fermenta\xE7\xE3o."),
          a("div", "settings-toggle-row", [v]),
        ),
        ie(
          t("An\xE1lise da receita (beta)"),
          t(
            "Simula tend\xEAncias de aroma e sabor. O bot\xE3o s\xF3 aparece no editor quando este modo est\xE1 ativo.",
          ),
          a("div", "settings-toggle-row", [$]),
        ),
        ie(
          t("Google Drive"),
          t(
            "Salva cada receita individualmente como um .xml em uma pasta no seu Google Drive.",
          ),
          driveSettingsBlock(),
        ),
        a(
          "p",
          "settings-version",
          t("Beermother \xB7 Fable \u2014 v{v}", { v: bt }),
        ),
      ]),
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
    ];
  };
  let o = I(e(), "details settings-sheet");
  function n() {
    const r = o.querySelector(".settings-scroll")?.scrollTop || 0;
    ((o.innerHTML = ""),
      e()
        .flat()
        .filter(Boolean)
        .forEach((s) => o.append(s)));
    const i = o.querySelector(".settings-scroll");
    i && (i.scrollTop = r);
  }
}
function Z(e, o = null) {
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
          Ta(
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
    i === "complete" &&
      y.push(
        a("label", "field", [
          a("span", "field-label", t("Evapora\xE7\xE3o")),
          F(
            r.evaporationPct,
            (v) => {
              ((r.evaporationPct = A(v, 0, 40, t("Evapora\xE7\xE3o"))), u());
            },
            "%/h",
          ),
        ]),
        a("label", "field", [
          a("span", "field-label", t("Perda Trub")),
          F(
            T(m(r.trubLossPct, 0.15) * 100, 1),
            (v) => {
              ((r.trubLossPct = A(v, 0, 50, "Trub") / 100), u());
            },
            "%",
          ),
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
            "Quanto tempo o mosto fica quente ap\xF3s o flameout \u2014 as adi\xE7\xF5es tardias de fervura seguem isomerizando nesse per\xEDodo.",
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
            "Velocidade de subida entre patamares \u2014 o rel\xF3gio da mostura conta uma etapa estimada de aquecimento. 0 desliga.",
          ),
        ),
        a("div", "water-block-title sheet-water-title", [
          a("b", "", t("\xC1gua base")),
          a("span", "muted", "ppm"),
        ]),
        a(
          "div",
          "editor-water-grid sheet-water-grid",
          ma.map((v) =>
            a("label", "editor-water-field", [
              a("span", "", v.label),
              U(
                r.baseWaterProfile[v.key],
                ($) => {
                  r.baseWaterProfile[v.key] = A($, 0, 1e3, v.plainLabel);
                },
                {
                  "aria-label": t("{ion} da \xE1gua base", {
                    ion: v.plainLabel,
                  }),
                },
              ),
            ]),
          ),
        ),
        a(
          "p",
          "muted percent-hint",
          t(
            "A \xE1gua da SUA fonte. Nos valores padr\xE3o, vale a \xE1gua de cada receita; mudou, receitas novas e o Preparo usam a sua.",
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
            t('Importado de "{name}" \u2014 confira os valores e salve.', {
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
                    (Bt(e.id), b(t("Perfil exclu\xEDdo.")), c.requestRender()));
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
              "Cada brassagem conclu\xEDda entra aqui com o log completo \u2014 e as que voc\xEA mediu calibram seu equipamento sozinhas.",
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
          "Uma leva s\xF3 \u2014 pode ter sido um dia at\xEDpico. Com mais levas medidas a mediana ignora o dia fora da curva e fica robusta.",
        )
      : t(
          "A mediana ignora um dia fora da curva (lavagem travada, transbordo) \u2014 por isso ela calibra o perfil, n\xE3o a m\xE9dia.",
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
      f = u >= 0 ? "+" : "\u2212";
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
                "efic. {pct}% \xB7 sem fermenta\xE7\xE3o \u2014 vale para o equipamento",
                { pct: P(n.mashEfficiencyPct, 1) },
              ))
        : (s = t("efic. {pct}% \xB7 fora dos n\xFAmeros (voc\xEA excluiu)", {
            pct: P(n.mashEfficiencyPct, 1),
          }))
      : (s = t("sem leituras \u2014 fora dos n\xFAmeros")),
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
                  ? t("Entra nos n\xFAmeros \u2014 tocar para excluir")
                  : t("Fora dos n\xFAmeros \u2014 tocar para incluir"),
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
const $a = "beermother-backup",
  Ia = "beermother";
function On() {
  const e = {};
  for (let n = 0; n < localStorage.length; n += 1) {
    const r = localStorage.key(n);
    r && r.startsWith(Ia) && (e[r] = localStorage.getItem(r));
  }
  const o = new Date().toISOString().slice(0, 10);
  (Ie(
    JSON.stringify(
      { kind: $a, version: 1, savedAt: new Date().toISOString(), data: e },
      null,
      2,
    ),
    `receitas-dinamicas-backup-${o}.json`,
    "application/json;charset=utf-8",
  ),
    b(t("Backup exportado \u2014 guarde o arquivo em lugar seguro.")));
}
async function Gn(e) {
  const o = Object.entries(e.data || {}).filter(
    ([r, i]) => r.startsWith(Ia) && typeof i == "string",
  );
  if (!o.length) {
    b(t("Backup vazio ou inv\xE1lido."), "error");
    return;
  }
  (await confirmDialog({
    title: t("Restaurar backup?"),
    message: t(
      "Receitas, perfis, hist\xF3rico e biblioteca atuais ser\xE3o substitu\xEDdos pelos do arquivo.",
    ),
    confirmLabel: "Restaurar",
    danger: !0,
  })) &&
    (o.forEach(([r, i]) => {
      try {
        localStorage.setItem(r, i);
      } catch {}
    }),
    b(t("Backup restaurado.")),
    c.requestRender());
}
let G = null;
export function openImportPicker() {
  (G ||
    ((G = document.createElement("input")),
    (G.type = "file"),
    (G.accept =
      ".xml,.beerxml,.json,text/xml,application/xml,application/json"),
    (G.hidden = !0),
    G.setAttribute("data-purpose", "home-import"),
    G.addEventListener("change", async () => {
      const e = G.files && G.files[0];
      if (e)
        try {
          await Vn(await e.text(), e.name);
        } catch (o) {
          b(o.message || t("N\xE3o foi poss\xEDvel ler o arquivo."), "error");
        } finally {
          G.value = "";
        }
    }),
    document.body.append(G)),
    (G.value = ""),
    G.click());
}
async function Vn(e, o) {
  const n = String(e || "").trim();
  if (n.startsWith("{")) {
    let s = null;
    try {
      s = JSON.parse(n);
    } catch {}
    if (s && s.kind === $a) {
      await Gn(s);
      return;
    }
    await zt(n);
    return;
  }
  const r = parseBeerXml(e),
    i = Rn(e);
  _n(r, i, o);
}
function Un(e) {
  const o = (n, r, i) => Math.abs(m(n) - m(r)) <= i;
  return (
    X().find(
      (n) =>
        o(n.params.targetVolumeL, e.targetVolumeL, 0.05) &&
        o(n.params.mashEfficiencyPct, e.mashEfficiencyPct, 0.15) &&
        o(n.params.evaporationPct, e.evaporationPct, 0.15) &&
        o(n.params.trubLossPct, e.trubLossPct, 0.002),
    ) || null
  );
}
function _n(e, o, n) {
  const r = { recipeSaved: !1, profileSaved: "" },
    i = [e.styleName || t("Estilo pr\xF3prio"), z(m(e.batchVolumeL, 20), 0)];
  (m(e.og) > 1 && i.push(`OG ${Number(m(e.og)).toFixed(3)}`),
    m(e.ibu) > 0 && i.push(`${P(m(e.ibu), 0)} IBU`));
  const s = () => {
      const p = o.hasEquipmentBlock ? Un(o.params) : null,
        f = a("div", "import-section", [
          a("span", "import-section-title", t("Receita")),
          a("b", "import-item-name", e.name || t("Receita importada")),
          a("p", "sheet-message", i.join(" \xB7 ")),
          a("div", "sheet-stack", [
            r.recipeSaved
              ? d(t("Salva em Minhas receitas \u2713"), () => {}, "btn", {
                  disabled: "disabled",
                })
              : d(
                  t("Salvar em Minhas receitas"),
                  () => {
                    saveMyRecipe(draftFromRecipe(e))
                      ? ((r.recipeSaved = !0),
                        b(
                          t(
                            "Receita salva \u2014 d\xE1 para editar e brassar quando quiser.",
                          ),
                        ),
                        u(),
                        c.requestRender())
                      : b(
                          t("N\xE3o foi poss\xEDvel salvar a receita."),
                          "error",
                        );
                  },
                  "btn primary",
                ),
            d(
              t("Brassar agora"),
              () => {
                (h(),
                  Be(),
                  Me(e, n || "BeerXML"),
                  (c.view = "brew"),
                  (c.phase = "prepare"),
                  c.requestRender(),
                  b(t('Brassagem de "{name}" iniciada.', { name: e.name })),
                  window.scrollTo({ top: 0, behavior: "instant" }));
              },
              "btn",
            ),
          ]),
        ]),
        E = o.hasEquipmentBlock
          ? a("div", "import-section", [
              a("span", "import-section-title", t("Equipamento")),
              a("b", "import-item-name", o.name),
              p
                ? a(
                    "p",
                    "muted import-note",
                    t('Igual ao perfil "{name}" \u2014 nada novo a importar.', {
                      name: p.name,
                    }),
                  )
                : r.profileSaved
                  ? d(
                      t('Perfil "{name}" salvo \u2713', {
                        name: r.profileSaved,
                      }),
                      () => {},
                      "btn",
                      { disabled: "disabled" },
                    )
                  : d(
                      t("Importar como perfil de equipamento"),
                      () => {
                        const y = ne({ name: o.name, params: o.params });
                        y
                          ? ((r.profileSaved = y.name),
                            b(
                              t('Perfil "{name}" salvo em Equipamentos.', {
                                name: y.name,
                              }),
                            ),
                            u(),
                            c.requestRender())
                          : b(
                              t("N\xE3o foi poss\xEDvel salvar o perfil."),
                              "error",
                            );
                      },
                      "btn",
                    ),
            ])
          : null;
      return [
        a("b", "sheet-title", t("Importar do BeerXML")),
        n ? a("p", "sheet-message import-file", n) : null,
        f,
        E,
        a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
      ];
    },
    l = I(s().flat().filter(Boolean), "details");
  function u() {
    ((l.innerHTML = ""),
      s()
        .flat()
        .filter(Boolean)
        .forEach((p) => l.append(p)));
  }
}
function Ue(e) {
  const o = new Date(e || "");
  return Number.isFinite(o.getTime())
    ? o.toLocaleDateString(ka(), { day: "2-digit", month: "2-digit" })
    : "-";
}
export function editorScreen() {
  const e = c.editorDraft;
  if (!e) return homeScreen();
  nn(e);
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
function zn(e) {
  return a("div", "editor-topbar", [
    d(
      t("\u2190 Voltar"),
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
const jn = [
    { key: "og", label: "OG", format: (e) => e.toFixed(3) },
    { key: "fg", label: "FG", format: (e) => e.toFixed(3) },
    { key: "abv", label: "ABV", format: (e) => `${P(e, 1)}%` },
    { key: "ibu", label: "IBU", format: (e) => String(Math.round(m(e))) },
    { key: "ebc", label: "Cor", format: (e) => `${P(e, 0)}` },
  ],
  Hn = {
    og: [1, 1.12],
    fg: [1, 1.04],
    abv: [0, 20],
    ibu: [0, 120],
    ebc: [0, 80],
  },
  Wn = 2e3,
  he = new Map(),
  se = new Map();
function ia() {
  (se.forEach((e) => {
    try {
      cancelAnimationFrame(e);
    } catch {}
  }),
    se.clear(),
    he.clear());
}
function Kn(e) {
  if (e <= 0.15) return (e * e) / 0.15;
  const n = e - 0.15;
  return 0.15 + 2 * n - (n * n) / (1 - 0.15);
}
function Jn(e, o, n) {
  const r =
      typeof requestAnimationFrame == "function" && typeof performance < "u",
    i = he.has(o) ? he.get(o) : n;
  if (!r || Math.abs(i - n) < 5e-4) {
    (he.set(o, n), (e.style.left = `${n * 100}%`));
    return;
  }
  (se.has(o) && cancelAnimationFrame(se.get(o)),
    (e.style.left = `${i * 100}%`));
  const s = performance.now(),
    l = (u) => {
      const p = Math.min(1, (u - s) / Wn),
        f = i + (n - i) * Kn(p);
      (he.set(o, f),
        (e.style.left = `${f * 100}%`),
        p < 1
          ? se.set(o, requestAnimationFrame(l))
          : (se.delete(o), he.set(o, n)));
    };
  se.set(o, requestAnimationFrame(l));
}
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
      p && e.fgManual && (M = [l(u), a("span", "fg-mark", "\u26A0")]);
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
          Jn(ze, i, ue),
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
              "FG muito baixa \u2014 confira a toler\xE2ncia alco\xF3lica da sua levedura; ela pode travar antes de fermentar tudo.",
            ))
          : p && e.fgManual
            ? (w.title = t(
                "FG fixada \xE0 m\xE3o \u2014 sobrescreve a calculada.",
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
function Qn(e, o) {
  if (!e.fermentables.length) {
    b(t("Adicione maltes antes de definir a OG."), "error");
    return;
  }
  if (!e.fermentables.some((r) => m(r.amountKg) > 0)) {
    b(
      t("Defina as quantidades primeiro \u2014 os maltes est\xE3o em 0 kg."),
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
function S(e) {
  (e(), drvEnabled(), c.requestRender());
}
function xa() {
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
function W(e, o, n = {}) {
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
function le(e, o, n, r = {}) {
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
function ee(e) {
  return a("span", "row-unit", e);
}
function Da(e, o) {
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
function ce(e, o, n) {
  return a("div", "row-name-wrap grow", [
    d(e || t("sem nome"), o, "row-name-btn", { title: n }),
  ]);
}
function Yn(e) {
  const o = d(
    e.styleName || t("Escolher estilo\u2026"),
    () => {
      qe({
        title: t("Estilo"),
        placeholder: t("Buscar estilo\u2026"),
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
function Zn(e) {
  const o = T(m(e.mashEfficiencyPct, 65) / j(e.trubLossPct), 1),
    n = e.equipmentProfileName || t("Equipamento padr\xE3o"),
    r = d(
      [
        R("scale", "icon"),
        a("span", "equip-chip-name", n),
        R("chevron", "icon"),
      ],
      () => eo(e),
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
        'Malte, l\xFApulo, levedura, sais e insumos escalam para manter a OG e o IBU de antes no volume novo \u2014 a cor pode variar com a efici\xEAncia. "Manter" s\xF3 troca o equipamento e deixa as quantidades como est\xE3o.',
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
            (h(), Z(s));
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
          t("Novo perfil\u2026"),
          () => {
            (h(), Z(null));
          },
          "btn",
        ),
        d(t("Fechar"), () => h(), "btn ghost"),
      ]),
    ],
    "details",
  );
}
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
    fa(r),
    (e.properties = r),
    (e.equipmentProfileName = n));
}
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
            (h(), Z(s));
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
          "Escolha um perfil salvo \u2014 volume, efici\xEAncia e os par\xE2metros de produ\xE7\xE3o entram nesta brassagem.",
        ),
      ),
      a("div", "equip-list", [i, ...n]),
      a("div", "sheet-actions", [
        d(
          t("Novo perfil\u2026"),
          () => {
            (h(), Z(null));
          },
          "btn",
        ),
        d(t("Fechar"), () => h(), "btn ghost"),
      ]),
    ],
    "details",
  );
}
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
            "Use o volume do seu dia t\xEDpico \u2014 a calibra\xE7\xE3o vale para o padr\xE3o. Evapora\xE7\xE3o e volume morto s\xE3o absolutos, n\xE3o escalam com o lote.",
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
              "Durante o dia voc\xEA mede e corrige com \xC1GUA \u2014 e a brassagem termina certa.",
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
            "Me\xE7a o volume e a densidade no pr\xE9-fervura e no p\xF3s-fervura. Sem essas leituras, os n\xFAmeros acima ainda s\xE3o a partida conservadora \u2014 n\xE3o o seu sistema.",
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
            'Salvo como "{name}" e definido como principal. Suas pr\xF3ximas receitas j\xE1 nascem calibradas pelo seu sistema \u2014 siga para a fermenta\xE7\xE3o; ao concluir, a leva fica no Caderno.',
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
          t("Calibra\xE7\xE3o conclu\xEDda \u2014 seu equipamento real"),
        ),
      ]),
      a("div", "card-body", [
        a(
          "p",
          "muted",
          t(
            "Medimos o seu sistema nesta brassagem. Salve como seu equipamento e as pr\xF3ximas receitas j\xE1 nascem no ponto \u2014 a partida conservadora era s\xF3 para o dia terminar certo.",
          ),
        ),
        f,
        a("div", "log-actions", y),
      ]),
    ])
  );
}
function no(e, o) {
  const n = (e.fermentables || []).reduce((w, L) => w + m(L.amountKg), 0),
    r = !(n > 0),
    i = e.fermentables.length > 1,
    s = !!fermentablePercentEdit && i,
    l =
      s &&
      fermentablePercentEdit.baseIndex !== null &&
      !!e.fermentables[fermentablePercentEdit.baseIndex],
    u = l && !r,
    p = l && r,
    f = () => {
      if (!r) return e.fermentables.map((L) => T((m(L.amountKg) / n) * 100, 1));
      const w = e.fermentables.length || 1;
      return e.fermentables.map(() => T(100 / w, 1));
    },
    E = p
      ? fermentablePercentEdit.values.reduce(
          (w, L, x) =>
            x === fermentablePercentEdit.baseIndex ? w : w + Math.max(0, m(L)),
          0,
        )
      : 0,
    y = p ? Math.max(0, T(100 - E, 1)) : 0,
    g = (w) => {
      if (!r && !u && Array.isArray(fermentablePercentEdit.values)) {
        const L = f();
        JSON.stringify(fermentablePercentEdit.values) !== JSON.stringify(L) &&
          Sa(e, fermentablePercentEdit.values);
      }
      ((fermentablePercentEdit = r
        ? {
            baseIndex: w,
            values: fermentablePercentEdit.values || f(),
            ogAnchor: fermentablePercentEdit.ogAnchor,
          }
        : { baseIndex: w, values: null }),
        c.requestRender());
    },
    q = (e.fermentables || []).map((w, L) => {
      const x = n ? (m(w.amountKg) / n) * 100 : 0,
        ae = !(m(w.amountKg) > 0);
      if (s) {
        const k = l && L === fermentablePercentEdit.baseIndex;
        return a("div", "editor-row", [
          ce(
            w.name,
            () => Ua(e, L),
            t("Toque para editar tipo, rendimento e cor."),
          ),
          k
            ? a("b", "base-tag", "base")
            : rn(
                u ? T(x, 1) : fermentablePercentEdit.values[L],
                (B) => {
                  u
                    ? S(() => {
                        Tt(e, L, B, fermentablePercentEdit.baseIndex);
                      })
                    : ((fermentablePercentEdit.values[L] = Math.max(0, m(B))),
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
          : a("b", "row-share num", n ? `${P(x, 0)}%` : "\u2013"),
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
        ? fermentablePercentEdit.values.reduce(
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
          "O malte-base absorve a diferen\xE7a \u2014 a soma \xE9 sempre 100% e a OG n\xE3o muda.",
        ),
      ),
      a("div", "percent-actions", [
        d(
          t("Aplicar"),
          () => {
            ((fermentablePercentEdit = null),
              b(t("Percentuais aplicados \u2014 a OG n\xE3o muda.")),
              c.requestRender());
          },
          "btn primary small",
        ),
      ]),
    ]);
  else if (s && r) {
    Number.isFinite(Number(fermentablePercentEdit.ogAnchor)) ||
      (fermentablePercentEdit.ogAnchor = 1.05);
    const w = () =>
      fermentablePercentEdit.values.map((L, x) =>
        p && x === fermentablePercentEdit.baseIndex ? y : Math.max(0, m(L)),
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
              fermentablePercentEdit.ogAnchor.toFixed(3),
              (L) => {
                fermentablePercentEdit.ogAnchor = m(L, 1.05);
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
            const L = A(fermentablePercentEdit.ogAnchor, 1.02, 1.15, "OG");
            (Nt(e, w(), L)
              ? ((fermentablePercentEdit = null),
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
              (Sa(e, fermentablePercentEdit.values)
                ? ((fermentablePercentEdit = null),
                  b(t("Percentuais aplicados \u2014 a OG n\xE3o muda.")))
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
        ((fermentablePercentEdit = s ? null : { baseIndex: null, values: f() }),
          c.requestRender());
      },
      `icon-btn small-btn ${s ? "active" : ""}`,
    ),
    M = d("OG", () => Qn(e, o), "btn ghost small head-mode-btn", {
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
                placeholder: t("Buscar malte\u2026"),
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
const _a = ["Mostura", "First wort", "Fervura", "Hopstand", "Dry hop"];
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
            placeholder: t("Buscar l\xFApulo\u2026"),
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
          "S\xF3 os l\xFApulos de amargor (fervura com 30+ min) s\xE3o escalados \u2014 aroma tardio, hopstand e dry hop ficam como est\xE3o.",
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
                        "As adi\xE7\xF5es tardias sozinhas j\xE1 passam do alvo ({ibu} IBU) \u2014 amargor zerado. Ctrl+Z desfaz.",
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
                      "Nenhum l\xFApulo de amargor (fervura com 30+ min) para escalar \u2014 as adi\xE7\xF5es tardias somam {ibu} IBU.",
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
            t("In\xF3culo estimado ~{rate} M c\xE9ls/mL/\xB0P \u2014 ", {
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
          placeholder: t("Buscar levedura\u2026"),
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
    o.fgManual ? [n, a("span", "fg-mark", "\u26A0")] : n,
    () => po(e),
    `head-meta fg-kicker ${o.fgManual ? "manual" : ""}`,
    {
      title: o.fgManual
        ? t("FG manual \u2014 calculada seria {fg}. Toque para editar.", {
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
          "Calculada: {fg} \u2014 da OG e da atenua\xE7\xE3o da levedura. Fixe uma FG \xE0 m\xE3o para sobrescrever: ela entra no ABV e no BeerXML.",
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
  return de(t("\xC1gua e sais"), "water", [
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
          t("Whirlfloc, especiarias, clarificantes \u2014 opcional."),
        ),
    d(
      t("Adicionar insumo"),
      () => {
        qe({
          title: t("Adicionar insumo"),
          placeholder: t("Buscar insumo\u2026"),
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
        (Ie(Pa(e), Aa(e), "application/xml;charset=utf-8"),
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
              const cacheEntry = await drvUpload(Pa(e), Aa(e));
              const recipeCache = loadDriveCache(DRIVE_RECIPE_CACHE_KEY);
              const updatedCache = recipeCache.filter((ce) => ce.driveFileId !== cacheEntry.driveFileId);
              updatedCache.push(cacheEntry);
              saveDriveCache(DRIVE_RECIPE_CACHE_KEY, updatedCache);
              b(t('"{name}" salvo no Google Drive.', { name: e.name || t("Receita") }));
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
      t("Brassar esta receita \u2192"),
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
function ge(e) {
  return D("close", t("Remover linha"), e, "icon-btn subtle small-btn");
}
function de(e, o, n, r = null, i = null) {
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
