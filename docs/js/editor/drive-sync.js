import {
  saveRecipeToDrive as drvUpload,
  syncRecipesFromDrive as drvSyncRecipes,
  hasDriveToken as drvHasToken,
  hasDriveCredential as drvHasCredential,
  saveEquipmentToDrive as drvSaveEquipment,
  syncEquipmentsFromDrive as drvSyncEquipments,
  saveBatchToDrive as drvSaveBatch,
  syncBatchesFromDrive as drvSyncBatches,
  overwriteDriveFile as drvOverwriteFile,
  moveFileToBin as drvMoveFileToBin,
  BIN_SUBFOLDER_RECIPES as drvBinRecipes,
  BIN_SUBFOLDER_EQUIPMENTS as drvBinEquipments,
  restorePersistedToken as drvRestoreToken,
} from "../gdrive.js";
import {
  app as c,
  loadDriveEnabled as drvEnabled,
  getBrew as Za,
  upsertBrewFromPayload as upsertBrewEntry,
  setBrewUpsertedCallback,
} from "../state.js";
import { el as a, button as d, toast as b } from "../ui.js";
import { t } from "../i18n.js";
import {
  draftFromRecipe,
  computeTargets,
  recipeFromDraft as Le,
  listProductionProfiles as X,
  saveProductionProfileEntry as ne,
} from "../recipes.js";
import { recipeToBeerXml as Pa } from "../recipes.js";
import { parseBeerXml } from "../beerxml.js";
import {
  equipmentProfileToXml,
  equipmentProfileFromXml,
  brewEntryToXml as batchBrewEntryToXml,
  brewEntryFromXml as batchBrewEntryFromXml,
} from "../batch-xml.js";
import {
  loadRecipeIndex, saveRecipeIndex, loadRecipeRow, saveRecipeRow, deleteRecipeRow,
  loadEquipmentIndex, saveEquipmentIndex, loadEquipmentItem, saveEquipmentItem, deleteEquipmentItem,
  loadBatchIndex, saveBatchIndex, loadBatchItem, saveBatchItem, deleteBatchItem,
} from "./drive-cache.js";

export {
  drvUpload, drvSyncRecipes, drvHasToken, drvHasCredential,
  drvSaveEquipment, drvSyncEquipments, drvSaveBatch, drvSyncBatches,
  drvOverwriteFile, drvMoveFileToBin, drvBinRecipes, drvBinEquipments,
  drvEnabled,
};

let driveRows = [];
let driveLoadState = "idle";
let driveRowsHydrated = false;
let driveEquipmentsHydrated = false;
let driveEquipmentsState = "idle";
let driveBatchesHydrated = false;
let driveBatchesState = "idle";
let _importingFromDrive = false;

export function getDriveRows() { return driveRows; }
export function getDriveLoadState() { return driveLoadState; }
export function getDriveEquipmentsState() { return driveEquipmentsState; }
export function getDriveBatchesState() { return driveBatchesState; }

export function driveKey(e) {
  return String(e || "").trim().toLowerCase();
}

export function brewEntryToXml(entry) {
  return batchBrewEntryToXml(entry, (recipe) => Pa(draftFromRecipe(recipe)));
}

export function brewEntryFromXml(xmlContent) {
  return batchBrewEntryFromXml(xmlContent, parseBeerXml);
}

export function normalizeLegacyBatchEntry(entry) {
  const p = entry.payload || {};
  let recipe = p.recipe || {};
  try {
    recipe = Le(draftFromRecipe(recipe));
  } catch {}
  const payload = {
    schema: "beermother-recipe-session",
    version: 1,
    savedAt: p.savedAt || new Date().toISOString(),
    brewId: entry.id,
    recipe,
    properties: p.properties || {},
    measurements: p.measurements || {},
    correctionChecks: {},
    hopLots: [],
    timerEvents: p.timerEvents || [],
    notes: p.notes || "",
    fermentationTracking: p.fermentationTracking || {},
    correctionRounds: [],
    additionChecks: {},
    phasesDone: {},
    guideEnabled: false,
    guideChecks: {},
    correctionAccepted: {},
    calibration: false,
    phLog: {},
  };
  return { ...entry, payload };
}

export function parseAndCacheRecipeRow(driveFileId, fileName, xmlContent) {
  try {
    const recipe = parseBeerXml(xmlContent);
    const draft = draftFromRecipe(recipe);
    draft.driveFileId = driveFileId;
    const targets = computeTargets(draft);
    const row = {
      id: `drive:${driveFileId}`,
      driveFileId,
      name: draft.name || fileName.replace(/\.xml$/i, ""),
      styleName: draft.styleName || "",
      abv: targets.abv,
      ebc: targets.ebc,
      ibu: targets.ibu,
      og: targets.og,
      isDraft: false,
      fromDrive: true,
      draft,
    };
    saveRecipeRow(driveFileId, row);
    return row;
  } catch {
    return null;
  }
}

function ensureRowDriveFileId(row) {
  if (row?.draft && !row.draft.driveFileId) {
    row.draft.driveFileId = row.driveFileId;
    saveRecipeRow(row.driveFileId, row);
  }
  return row;
}

export function hydrateRecipeRowsFromCache() {
  if (driveRowsHydrated) return;
  driveRowsHydrated = true;
  const index = loadRecipeIndex();
  if (!index.length) return;
  const rows = index
    .map((meta) => ensureRowDriveFileId(loadRecipeRow(meta.driveFileId)))
    .filter(Boolean);
  if (rows.length) driveRows = rows;
}

export async function loadDriveRecipes(forceRefresh) {
  if (!drvEnabled() || !(drvHasToken() || (forceRefresh && drvHasCredential()))) return;
  hydrateRecipeRowsFromCache();
  driveLoadState = "loading";
  if (forceRefresh) c.requestRender();
  try {
    const index = loadRecipeIndex();
    const effectiveIndex = index.filter((m) => loadRecipeRow(m.driveFileId) !== null);
    const { entries, changed } = await drvSyncRecipes(effectiveIndex, forceRefresh);
    if (changed) {
      const newIndex = entries.map((e) => ({
        driveFileId: e.driveFileId,
        name: e.name,
        md5Checksum: e.md5Checksum,
      }));
      const newRows = [];
      for (const entry of entries) {
        if (entry.fresh) {
          const row = parseAndCacheRecipeRow(entry.driveFileId, entry.name, entry.content);
          if (row) newRows.push(row);
        } else {
          const row = ensureRowDriveFileId(loadRecipeRow(entry.driveFileId));
          if (row) newRows.push(row);
        }
      }
      const activeIds = new Set(entries.map((e) => e.driveFileId));
      for (const meta of index) {
        if (!activeIds.has(meta.driveFileId)) deleteRecipeRow(meta.driveFileId);
      }
      saveRecipeIndex(newIndex);
      driveRows = newRows;
    }
    driveLoadState = "done";
  } catch {
    driveLoadState = "error";
    if (forceRefresh) b(t("Erro ao carregar receitas do Drive."), "error");
  }
  c.requestRender();
}

function mergeBatchFromDrive(remoteEntry) {
  if (!remoteEntry?.id || !remoteEntry?.payload) return;
  const local = Za(remoteEntry.id);
  const remoteNewer = !local || new Date(remoteEntry.updatedAt) > new Date(local.updatedAt);
  if (remoteNewer) {
    const payload = { ...remoteEntry.payload, brewId: remoteEntry.id };
    _importingFromDrive = true;
    try {
      upsertBrewEntry(payload, { status: remoteEntry.status });
    } finally {
      _importingFromDrive = false;
    }
  }
}

export function hydrateEquipmentsFromCache() {
  if (driveEquipmentsHydrated) return;
  driveEquipmentsHydrated = true;
  const index = loadEquipmentIndex();
  if (!index.length) return;
  let hasLegacy = false;
  for (const meta of index) {
    const profile = loadEquipmentItem(meta.driveFileId);
    const expectedNewId = `profile-${meta.driveFileId.slice(-8)}`;
    if (profile?.id && profile.id !== expectedNewId) {
      hasLegacy = true;
    } else if (profile?.id && !X().find((p) => p.id === profile.id)) {
      ne(profile);
    }
  }
  if (hasLegacy) {
    saveEquipmentIndex(index.map((m) => ({ ...m, md5Checksum: "" })));
  }
}

export async function loadDriveEquipments(forceRefresh) {
  if (!drvEnabled() || !(drvHasToken() || (forceRefresh && drvHasCredential()))) return;
  if (!forceRefresh && driveEquipmentsState !== "idle") return;
  driveEquipmentsState = "loading";
  if (forceRefresh) c.requestRender();
  try {
    const index = loadEquipmentIndex();
    const effectiveIndex = index.filter((m) => loadEquipmentItem(m.driveFileId) !== null);
    const { entries, changed } = await drvSyncEquipments(effectiveIndex, forceRefresh);
    if (changed) {
      const newIndex = entries.map((e) => ({
        driveFileId: e.driveFileId,
        name: e.name,
        md5Checksum: e.md5Checksum,
      }));
      for (const entry of entries) {
        if (entry.fresh) {
          const profile = equipmentProfileFromXml(entry.content);
          if (profile?.id) {
            const isLegacy = !entry.content.includes("<BM_ID>");
            if (isLegacy) {
              profile.id = `profile-${entry.driveFileId.slice(-8)}`;
              const xml = equipmentProfileToXml(profile);
              drvOverwriteFile(entry.driveFileId, xml, entry.name, true)
                .then((cacheEntry) => {
                  const idx = loadEquipmentIndex();
                  saveEquipmentIndex(idx.map((m) =>
                    m.driveFileId === entry.driveFileId
                      ? { ...m, name: cacheEntry.name, md5Checksum: cacheEntry.md5Checksum }
                      : m,
                  ));
                  saveEquipmentItem(entry.driveFileId, profile);
                })
                .catch(() => {});
            }
            saveEquipmentItem(entry.driveFileId, profile);
            ne(profile);
          }
        }
      }
      const activeIds = new Set(entries.map((e) => e.driveFileId));
      for (const meta of index) {
        if (!activeIds.has(meta.driveFileId)) deleteEquipmentItem(meta.driveFileId);
      }
      saveEquipmentIndex(newIndex);
    }
    driveEquipmentsState = "done";
  } catch {
    driveEquipmentsState = "error";
    if (forceRefresh) b(t("Erro ao carregar equipamentos do Drive."), "error");
  }
  c.requestRender();
}

export function hydrateBatchesFromCache() {
  if (driveBatchesHydrated) return;
  driveBatchesHydrated = true;
  const index = loadBatchIndex();
  if (!index.length) return;
  for (const meta of index) {
    const brewEntry = loadBatchItem(meta.driveFileId);
    if (brewEntry?.id && brewEntry?.payload) mergeBatchFromDrive(brewEntry);
  }
}

export async function loadDriveBatches(forceRefresh) {
  if (!drvEnabled() || !(drvHasToken() || (forceRefresh && drvHasCredential()))) return;
  if (!forceRefresh && driveBatchesState !== "idle") return;
  driveBatchesState = "loading";
  if (forceRefresh) c.requestRender();
  try {
    const index = loadBatchIndex();
    const effectiveIndex = index.filter((m) => loadBatchItem(m.driveFileId) !== null);
    const { entries, changed } = await drvSyncBatches(effectiveIndex, forceRefresh);
    if (changed) {
      const newIndex = entries.map((e) => ({
        driveFileId: e.driveFileId,
        name: e.name,
        md5Checksum: e.md5Checksum,
      }));
      for (const entry of entries) {
        if (entry.fresh) {
          let brewEntry = brewEntryFromXml(entry.content);
          if (brewEntry?.id && brewEntry?.payload) {
            if (!brewEntry.payload.schema) {
              brewEntry = normalizeLegacyBatchEntry(brewEntry);
              const xml = brewEntryToXml(brewEntry);
              drvOverwriteFile(entry.driveFileId, xml, entry.name, true)
                .then((cacheEntry) => {
                  const idx = loadBatchIndex();
                  saveBatchIndex(idx.map((m) =>
                    m.driveFileId === entry.driveFileId
                      ? { ...m, name: cacheEntry.name, md5Checksum: cacheEntry.md5Checksum }
                      : m,
                  ));
                  saveBatchItem(entry.driveFileId, brewEntry);
                })
                .catch(() => {});
            }
            saveBatchItem(entry.driveFileId, brewEntry);
            mergeBatchFromDrive(brewEntry);
          }
        }
      }
      const activeIds = new Set(entries.map((e) => e.driveFileId));
      for (const meta of index) {
        if (!activeIds.has(meta.driveFileId)) deleteBatchItem(meta.driveFileId);
      }
      saveBatchIndex(newIndex);
    }
    driveBatchesState = "done";
  } catch {
    driveBatchesState = "error";
    if (forceRefresh) b(t("Erro ao carregar brassagens do Drive."), "error");
  }
  c.requestRender();
}

export function moveRecipeToBin(recipeId) {
  if (!drvEnabled()) return;
  const index = loadRecipeIndex();
  let driveFileId;
  if (recipeId.startsWith("drive:")) {
    driveFileId = recipeId.slice("drive:".length);
  } else {
    driveFileId = index.find((m) => m.localId === recipeId)?.driveFileId || null;
  }
  if (!driveFileId) return;
  saveRecipeIndex(index.filter((m) => m.driveFileId !== driveFileId));
  deleteRecipeRow(driveFileId);
  driveRows = driveRows.filter((r) => r.driveFileId !== driveFileId);
  drvMoveFileToBin(driveFileId, drvBinRecipes, true).catch(() => {});
}

export function moveEquipmentToBin(profileId) {
  if (!drvEnabled()) return;
  const index = loadEquipmentIndex();
  const entry = index.find((m) => {
    const profile = loadEquipmentItem(m.driveFileId);
    return profile && profile.id === profileId;
  });
  if (!entry) return;
  saveEquipmentIndex(index.filter((m) => m.driveFileId !== entry.driveFileId));
  deleteEquipmentItem(entry.driveFileId);
  drvMoveFileToBin(entry.driveFileId, drvBinEquipments, true).catch(() => {});
}

export async function syncBrewToDrive(brewId) {
  if (!drvEnabled() || !drvHasToken()) return;
  const entry = Za(brewId);
  if (!entry) return;
  try {
    const xmlContent = brewEntryToXml(entry);
    await drvSaveBatch(xmlContent, entry.id);
  } catch {}
}

export async function syncEquipmentToDrive(profile) {
  if (!drvEnabled() || !drvHasToken() || !profile) return;
  try {
    const xmlContent = equipmentProfileToXml(profile);
    const cacheEntry = await drvSaveEquipment(xmlContent, profile.id);
    const index = loadEquipmentIndex();
    const newIndex = index.filter((e) => e.driveFileId !== cacheEntry.driveFileId);
    newIndex.push({ driveFileId: cacheEntry.driveFileId, name: cacheEntry.name, md5Checksum: cacheEntry.md5Checksum });
    saveEquipmentIndex(newIndex);
    saveEquipmentItem(cacheEntry.driveFileId, profile);
  } catch {}
}

export function mergeDriveRecipes(recipes) {
  if (!driveRows.length) return recipes;
  const names = new Set(recipes.map((r) => driveKey(r.name)));
  return recipes.concat(driveRows.filter((r) => !names.has(driveKey(r.name))));
}

export function driveStatusRow() {
  if (!drvEnabled()) return null;
  if (driveLoadState === "loading")
    return a("p", "muted drive-sync-status", t("Carregando receitas do Drive…"));
  const label = driveLoadState === "done" ? t("Atualizar do Drive") : t("Carregar do Drive");
  return a("div", "drive-sync-row", [
    d(label, () => loadDriveRecipes(true), "btn ghost small"),
    driveLoadState === "error"
      ? a("span", "muted drive-sync-status", t("Falha ao carregar do Drive."))
      : null,
  ]);
}

export function driveEquipmentsStatusRow() {
  if (!drvEnabled()) return null;
  if (driveEquipmentsState === "loading")
    return a("p", "muted drive-sync-status", t("Carregando equipamentos do Drive…"));
  const label = driveEquipmentsState === "done" ? t("Atualizar do Drive") : t("Carregar do Drive");
  return a("div", "drive-sync-row", [
    d(label, () => loadDriveEquipments(true), "btn ghost small"),
    driveEquipmentsState === "error"
      ? a("span", "muted drive-sync-status", t("Falha ao carregar do Drive."))
      : null,
  ]);
}

export function driveBatchesStatusRow() {
  if (!drvEnabled()) return null;
  if (driveBatchesState === "loading")
    return a("p", "muted drive-sync-status", t("Carregando brassagens do Drive…"));
  const label = driveBatchesState === "done" ? t("Atualizar do Drive") : t("Carregar do Drive");
  return a("div", "drive-sync-row", [
    d(label, () => loadDriveBatches(true), "btn ghost small"),
    driveBatchesState === "error"
      ? a("span", "muted drive-sync-status", t("Falha ao carregar do Drive."))
      : null,
  ]);
}

export function initDriveSync() {
  if (drvEnabled()) drvRestoreToken();
  setBrewUpsertedCallback((entry) => {
    if (_importingFromDrive || !drvEnabled() || !drvHasToken()) return;
    const xmlContent = brewEntryToXml(entry);
    drvSaveBatch(xmlContent, entry.id).then((cacheEntry) => {
      const index = loadBatchIndex();
      const newIndex = index.filter((m) => m.driveFileId !== cacheEntry.driveFileId);
      newIndex.push({ driveFileId: cacheEntry.driveFileId, name: cacheEntry.name, md5Checksum: cacheEntry.md5Checksum });
      saveBatchIndex(newIndex);
      saveBatchItem(cacheEntry.driveFileId, entry);
    }).catch(() => {});
  });
}
