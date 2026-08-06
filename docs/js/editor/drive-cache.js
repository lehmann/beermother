export const DRIVE_RECIPE_INDEX_KEY = "beermother.drive.cache.recipes.v1";
export const DRIVE_RECIPE_ROW_PREFIX = "beermother.drive.recipe.";
export const DRIVE_EQUIPMENT_INDEX_KEY = "beermother.drive.cache.equipments.v1";
export const DRIVE_EQUIPMENT_ITEM_PREFIX = "beermother.drive.equipment.";
export const DRIVE_BATCH_INDEX_KEY = "beermother.drive.cache.batches.v1";
export const DRIVE_BATCH_ITEM_PREFIX = "beermother.drive.batch.";

export function loadJsonFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJsonToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function loadRecipeIndex() { return loadJsonFromStorage(DRIVE_RECIPE_INDEX_KEY, []); }
export function saveRecipeIndex(index) { saveJsonToStorage(DRIVE_RECIPE_INDEX_KEY, index); }
export function loadRecipeRow(driveFileId) { return loadJsonFromStorage(DRIVE_RECIPE_ROW_PREFIX + driveFileId, null); }
export function saveRecipeRow(driveFileId, row) { saveJsonToStorage(DRIVE_RECIPE_ROW_PREFIX + driveFileId, row); }
export function deleteRecipeRow(driveFileId) { try { localStorage.removeItem(DRIVE_RECIPE_ROW_PREFIX + driveFileId); } catch {} }

export function loadEquipmentIndex() { return loadJsonFromStorage(DRIVE_EQUIPMENT_INDEX_KEY, []); }
export function saveEquipmentIndex(index) { saveJsonToStorage(DRIVE_EQUIPMENT_INDEX_KEY, index); }
export function loadEquipmentItem(driveFileId) { return loadJsonFromStorage(DRIVE_EQUIPMENT_ITEM_PREFIX + driveFileId, null); }
export function saveEquipmentItem(driveFileId, profile) { saveJsonToStorage(DRIVE_EQUIPMENT_ITEM_PREFIX + driveFileId, profile); }
export function deleteEquipmentItem(driveFileId) { try { localStorage.removeItem(DRIVE_EQUIPMENT_ITEM_PREFIX + driveFileId); } catch {} }

export function loadBatchIndex() { return loadJsonFromStorage(DRIVE_BATCH_INDEX_KEY, []); }
export function saveBatchIndex(index) { saveJsonToStorage(DRIVE_BATCH_INDEX_KEY, index); }
export function loadBatchItem(driveFileId) { return loadJsonFromStorage(DRIVE_BATCH_ITEM_PREFIX + driveFileId, null); }
export function saveBatchItem(driveFileId, brewEntry) { saveJsonToStorage(DRIVE_BATCH_ITEM_PREFIX + driveFileId, brewEntry); }
export function deleteBatchItem(driveFileId) { try { localStorage.removeItem(DRIVE_BATCH_ITEM_PREFIX + driveFileId); } catch {} }
