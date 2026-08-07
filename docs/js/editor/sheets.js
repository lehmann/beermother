import { app as c } from "../state.js";
import { el as a, button as d } from "../ui.js";
import { t } from "../i18n.js";

let _overlay = null, _keydown = null;

export function closeSheet() {
  _overlay && (_overlay.remove(), (_overlay = null));
  _keydown && (document.removeEventListener("keydown", _keydown), (_keydown = null));
}

export function openSheet(content, cls = "") {
  closeSheet();
  const overlay = a("div", "fable-overlay", []);
  const sheet = a("div", `fable-sheet ${cls}`, content);
  let hitOverlay = false;
  overlay.addEventListener("pointerdown", (e) => { hitOverlay = e.target === overlay; });
  overlay.addEventListener("click", (e) => { e.target === overlay && hitOverlay && closeSheet(); hitOverlay = false; });
  overlay.append(sheet);
  document.body.append(overlay);
  _overlay = overlay;
  _keydown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
    if (e.key !== "Enter") return;
    const tag = e.target?.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || cls.includes("picker")) return;
    const btn = sheet.querySelector(".sheet-actions .btn.primary");
    btn && (e.preventDefault(), btn.click());
  };
  document.addEventListener("keydown", _keydown);
  return sheet;
}

const MAX_UNDO = 60;
let _undoStack = [], _redoStack = [], _lastSnapshot = null, _skipRedoClear = false;

export function resetUndoStack(draft) {
  _undoStack = []; _redoStack = []; _lastSnapshot = draft ? JSON.stringify(draft) : null;
}

export function pushUndoSnapshot(draft) {
  const s = JSON.stringify(draft);
  if (_lastSnapshot === null) { _lastSnapshot = s; _skipRedoClear = false; return; }
  if (s !== _lastSnapshot) {
    if (!_skipRedoClear) {
      _undoStack.push(_lastSnapshot);
      if (_undoStack.length > MAX_UNDO) _undoStack.shift();
      _redoStack = [];
    }
    _lastSnapshot = s;
  }
  _skipRedoClear = false;
}

export function editorUndo() {
  if (!_undoStack.length || !c.editorDraft) return false;
  _redoStack.push(JSON.stringify(c.editorDraft));
  const snap = _undoStack.pop();
  c.editorDraft = JSON.parse(snap);
  _lastSnapshot = snap;
  _skipRedoClear = true;
  c.editorDraft._fermentablePercentEdit = null;
  c.requestRender();
  return true;
}

export function editorRedo() {
  if (!_redoStack.length || !c.editorDraft) return false;
  _undoStack.push(JSON.stringify(c.editorDraft));
  const snap = _redoStack.pop();
  c.editorDraft = JSON.parse(snap);
  _lastSnapshot = snap;
  _skipRedoClear = true;
  c.editorDraft._fermentablePercentEdit = null;
  c.requestRender();
  return true;
}

export function canUndo() { return _undoStack.length > 0; }
export function canRedo() { return _redoStack.length > 0; }

export function confirmDialog({
  title: e,
  message: o,
  confirmLabel: n = "Confirmar",
  cancelLabel: r = "Cancelar",
  danger: i = false,
}) {
  return new Promise((resolve) => {
    openSheet(
      [
        a("b", "sheet-title", e),
        o ? a("p", "sheet-message", o) : null,
        a("div", "sheet-actions", [
          d(r, () => { closeSheet(); resolve(false); }, "btn ghost"),
          d(n, () => { closeSheet(); resolve(true); }, `btn ${i ? "danger-solid" : "primary"}`),
        ]),
      ],
      "dialog",
    );
  });
}
