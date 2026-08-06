// Barrel — re-exports all public editor symbols.
// The implementation lives in editor/ sub-modules.

export {
  workspaceScreen,
  brewLogScreen,
  openHome,
  openEditorNew,
  openEditorEntry,
  backToBrew,
  openDraftInEditor,
  calibrationPayoffCard,
} from "./editor/workspace.js";

export { editorScreen, openSessionEquipmentSheet } from "./editor/recipe-editor.js";

export {
  openBackupSheet,
  openImportPicker,
  openSettingsSheet,
} from "./editor/settings-backup.js";

export {
  editorUndo,
  editorRedo,
  canUndo,
  canRedo,
  confirmDialog,
} from "./editor/sheets.js";

import { initDriveSync } from "./editor/drive-sync.js";
import { setEquipmentPickerFn } from "./editor/recipe-editor.js";
import { Z } from "./editor/workspace.js";

initDriveSync();

// Wire the equipment profile sheet callback so recipe-editor.js can open it
// without a circular import dependency.
setEquipmentPickerFn(Z);
