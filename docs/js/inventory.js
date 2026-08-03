import {
  app,
  loadInventory,
  saveInventory,
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
  loadDriveEnabled,
} from "./state.js";
import { el, button, iconButton, icon, toast, decimalInput } from "./ui.js";
import { t } from "./i18n.js";
import {
  hasDriveToken,
  saveInventoryToDrive,
  loadInventoryFromDrive,
  requestDriveAccess,
} from "./gdrive.js";

const INVENTORY_FILE = "inventory.xml";

const CATEGORIES = [
  { id: "fermentables", label: "Fermentáveis", icon: "scale" },
  { id: "hops", label: "Lúpulos", icon: "hop" },
  { id: "yeasts", label: "Leveduras", icon: "ferment" },
  { id: "others", label: "Outros", icon: "flask" },
];

let activeCategory = "fermentables";
let currentOverlay = null;
let currentKeyHandler = null;
let driveLoadState = "idle";

// ── XML serialization ─────────────────────────────────────────────────────────

function xmlEsc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tag(name, value) {
  return `<${name}>${xmlEsc(value)}</${name}>`;
}

export function inventoryToXml(inv) {
  const ferms = (inv.fermentables || [])
    .map(
      (it) =>
        `<FERMENTABLE>${tag("ID", it.id)}${tag("NAME", it.name)}${tag("TYPE", it.type || "Grão")}${tag("AMOUNT", it.amountKg ?? 0)}${tag("YIELD", it.yieldPct ?? 78)}${tag("COLOR", it.ebc ?? 0)}</FERMENTABLE>`,
    )
    .join("\n");

  const hops = (inv.hops || [])
    .map(
      (it) =>
        `<HOP>${tag("ID", it.id)}${tag("NAME", it.name)}${tag("ALPHA", it.alpha ?? 10)}${tag("AMOUNT", it.amount ?? 0)}${tag("FORM", it.form || "Pellet")}</HOP>`,
    )
    .join("\n");

  const yeasts = (inv.yeasts || [])
    .map(
      (it) =>
        `<YEAST>${tag("ID", it.id)}${tag("NAME", it.name)}${tag("ATTENUATION", it.attenuation ?? 75)}${tag("AMOUNT", it.amount ?? 0)}${tag("DISPLAY_AMOUNT", `${it.amount ?? 0} ${it.unit || "pkg"}`)}</YEAST>`,
    )
    .join("\n");

  const others = (inv.others || [])
    .map(
      (it) =>
        `<MISC>${tag("ID", it.id)}${tag("NAME", it.name)}${tag("AMOUNT", it.amount ?? 0)}${tag("AMOUNT_IS_WEIGHT", "FALSE")}${tag("DISPLAY_AMOUNT", `${it.amount ?? 0} ${it.unit || "g"}`)}${it.use ? tag("USE", it.use) : ""}</MISC>`,
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<BEERMOTHER_INVENTORY>",
    `<FERMENTABLES>\n${ferms}\n</FERMENTABLES>`,
    `<HOPS>\n${hops}\n</HOPS>`,
    `<YEASTS>\n${yeasts}\n</YEASTS>`,
    `<MISCS>\n${others}\n</MISCS>`,
    "</BEERMOTHER_INVENTORY>",
  ].join("\n");
}

function getText(node, tagName, fallback = "") {
  const el = node?.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || fallback;
}

function getNum(node, tagName, fallback = 0) {
  const v = parseFloat(getText(node, tagName, ""));
  return Number.isFinite(v) ? v : fallback;
}

export function parseInventoryXml(xml) {
  if (!xml || !xml.trim()) return null;
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) return null;

    const fermentables = Array.from(
      doc.getElementsByTagName("FERMENTABLE"),
    ).map((n) => ({
      id: getText(n, "ID") || `inv-${Date.now()}-${Math.random()}`,
      name: getText(n, "NAME"),
      type: getText(n, "TYPE", "Grão"),
      amountKg: getNum(n, "AMOUNT"),
      yieldPct: getNum(n, "YIELD", 78),
      ebc: getNum(n, "COLOR"),
    }));

    const hops = Array.from(doc.getElementsByTagName("HOP")).map((n) => ({
      id: getText(n, "ID") || `inv-${Date.now()}-${Math.random()}`,
      name: getText(n, "NAME"),
      alpha: getNum(n, "ALPHA", 10),
      amount: getNum(n, "AMOUNT"),
      form: getText(n, "FORM", "Pellet"),
      unit: "g",
    }));

    const yeasts = Array.from(doc.getElementsByTagName("YEAST")).map((n) => {
      const display = getText(n, "DISPLAY_AMOUNT", "");
      const unitMatch = display.match(/\d+\s*(\S+)$/);
      return {
        id: getText(n, "ID") || `inv-${Date.now()}-${Math.random()}`,
        name: getText(n, "NAME"),
        attenuation: getNum(n, "ATTENUATION", 75),
        amount: getNum(n, "AMOUNT"),
        unit: unitMatch ? unitMatch[1] : "pkg",
      };
    });

    const others = Array.from(doc.getElementsByTagName("MISC")).map((n) => {
      const display = getText(n, "DISPLAY_AMOUNT", "");
      const unitMatch = display.match(/\d+\s*(\S+)$/);
      return {
        id: getText(n, "ID") || `inv-${Date.now()}-${Math.random()}`,
        name: getText(n, "NAME"),
        amount: getNum(n, "AMOUNT"),
        unit: unitMatch ? unitMatch[1] : "g",
        use: getText(n, "USE"),
      };
    });

    return { fermentables, hops, yeasts, others };
  } catch {
    return null;
  }
}

// ── Drive sync ────────────────────────────────────────────────────────────────

export async function syncInventoryToDrive(inv) {
  if (!loadDriveEnabled() || !hasDriveToken()) return;
  try {
    await saveInventoryToDrive(inventoryToXml(inv));
  } catch {}
}

export async function loadInventoryFromDriveAndSync() {
  if (!loadDriveEnabled()) return false;
  driveLoadState = "loading";
  app.requestRender();
  try {
    await requestDriveAccess();
    const xml = await loadInventoryFromDrive();
    if (xml) {
      const parsed = parseInventoryXml(xml);
      if (parsed) {
        saveInventory(parsed);
        driveLoadState = "done";
        app.requestRender();
        return true;
      }
    }
    driveLoadState = "done";
    app.requestRender();
    return false;
  } catch {
    driveLoadState = "error";
    app.requestRender();
    return false;
  }
}

function closeSheet() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
  if (currentKeyHandler) {
    document.removeEventListener("keydown", currentKeyHandler);
    currentKeyHandler = null;
  }
}

function openSheet(children, extraClass = "") {
  closeSheet();
  const overlay = el("div", "fable-overlay", []);
  const sheet = el("div", `fable-sheet ${extraClass}`, children);
  let pointerOnOverlay = false;
  overlay.addEventListener("pointerdown", (e) => {
    pointerOnOverlay = e.target === overlay;
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay && pointerOnOverlay) closeSheet();
    pointerOnOverlay = false;
  });
  overlay.append(sheet);
  document.body.append(overlay);
  currentOverlay = overlay;
  currentKeyHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSheet();
    }
  };
  document.addEventListener("keydown", currentKeyHandler);
}

function numInput(value, onChange, attrs = {}) {
  const inp = decimalInput(value, onChange, attrs);
  inp.className = "field-input";
  return inp;
}

function fieldRow(label, input) {
  return el("label", "field", [el("span", "field-label", label), input]);
}

function defaultForCategory(cat) {
  if (cat === "fermentables")
    return { name: "", amountKg: 0, yieldPct: 78, ebc: 5, type: "Grão" };
  if (cat === "hops") return { name: "", amount: 0, unit: "g", alpha: 10, form: "Pellet" };
  if (cat === "yeasts") return { name: "", amount: 0, unit: "pkg", attenuation: 75 };
  return { name: "", amount: 0, unit: "g", use: "" };
}

function nameInput(val, onChange) {
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "field-input";
  inp.value = val || "";
  inp.addEventListener("input", () => onChange(inp.value));
  return inp;
}

function buildFields(cat, item) {
  const rows = [];

  rows.push(
    fieldRow(
      t("Nome"),
      nameInput(item.name, (v) => {
        item.name = v;
      }),
    ),
  );

  if (cat === "fermentables") {
    rows.push(
      fieldRow(
        t("Quantidade (kg)"),
        numInput(
          item.amountKg,
          (v) => {
            item.amountKg = Math.max(0, Number(v) || 0);
          },
          { step: "0.1", min: "0" },
        ),
      ),
      fieldRow(
        t("Rendimento (%)"),
        numInput(
          item.yieldPct,
          (v) => {
            item.yieldPct = Math.max(1, Math.min(100, Number(v) || 78));
          },
          { step: "1", min: "1", max: "100" },
        ),
      ),
      fieldRow(
        t("Cor (EBC)"),
        numInput(
          item.ebc,
          (v) => {
            item.ebc = Math.max(0, Number(v) || 0);
          },
          { step: "1", min: "0" },
        ),
      ),
    );
  } else if (cat === "hops") {
    rows.push(
      fieldRow(
        t("Quantidade (g)"),
        numInput(
          item.amount,
          (v) => {
            item.amount = Math.max(0, Number(v) || 0);
          },
          { step: "1", min: "0" },
        ),
      ),
      fieldRow(
        t("Alfa ácido (%)"),
        numInput(
          item.alpha,
          (v) => {
            item.alpha = Math.max(0, Math.min(25, Number(v) || 10));
          },
          { step: "0.1", min: "0", max: "25" },
        ),
      ),
    );
  } else if (cat === "yeasts") {
    rows.push(
      fieldRow(
        t("Quantidade"),
        numInput(
          item.amount,
          (v) => {
            item.amount = Math.max(0, Number(v) || 0);
          },
          { step: "1", min: "0" },
        ),
      ),
      fieldRow(
        t("Unidade"),
        (() => {
          const sel = document.createElement("select");
          sel.className = "field-input";
          ["pkg", "g", "ml"].forEach((u) => {
            const opt = document.createElement("option");
            opt.value = u;
            opt.textContent = u;
            if (u === (item.unit || "pkg")) opt.selected = true;
            sel.append(opt);
          });
          sel.addEventListener("change", () => {
            item.unit = sel.value;
          });
          return sel;
        })(),
      ),
      fieldRow(
        t("Atenuação (%)"),
        numInput(
          item.attenuation,
          (v) => {
            item.attenuation = Math.max(30, Math.min(100, Number(v) || 75));
          },
          { step: "1", min: "30", max: "100" },
        ),
      ),
    );
  } else {
    rows.push(
      fieldRow(
        t("Quantidade"),
        numInput(
          item.amount,
          (v) => {
            item.amount = Math.max(0, Number(v) || 0);
          },
          { step: "1", min: "0" },
        ),
      ),
      fieldRow(
        t("Unidade"),
        (() => {
          const sel = document.createElement("select");
          sel.className = "field-input";
          ["g", "kg", "ml", "L", "un"].forEach((u) => {
            const opt = document.createElement("option");
            opt.value = u;
            opt.textContent = u;
            if (u === (item.unit || "g")) opt.selected = true;
            sel.append(opt);
          });
          sel.addEventListener("change", () => {
            item.unit = sel.value;
          });
          return sel;
        })(),
      ),
      fieldRow(
        t("Uso"),
        nameInput(item.use || "", (v) => {
          item.use = v;
        }),
      ),
    );
  }

  return rows;
}

function afterMutation() {
  const inv = loadInventory();
  syncInventoryToDrive(inv);
}

function openAddSheet(cat) {
  const item = defaultForCategory(cat);
  const catLabel = t(CATEGORIES.find((c) => c.id === cat)?.label || cat);

  const save = button(
    t("Salvar"),
    () => {
      if (!String(item.name || "").trim()) {
        toast(t("Informe um nome."), "warn");
        return;
      }
      addInventoryItem(cat, item);
      afterMutation();
      closeSheet();
      app.requestRender();
      toast(t("Item adicionado ao inventário."));
    },
    "btn primary",
  );

  openSheet([
    el("b", "sheet-title", t("Novo: {cat}", { cat: catLabel })),
    el("div", "sheet-fields", buildFields(cat, item)),
    el("div", "sheet-actions", [
      button(t("Cancelar"), closeSheet, "btn ghost"),
      save,
    ]),
  ]);
}

function openEditSheet(cat, itemId) {
  const inv = loadInventory();
  const original = (inv[cat] || []).find((it) => it.id === itemId);
  if (!original) return;

  const item = { ...original };
  const catLabel = t(CATEGORIES.find((c) => c.id === cat)?.label || cat);

  const save = button(
    t("Salvar"),
    () => {
      if (!String(item.name || "").trim()) {
        toast(t("Informe um nome."), "warn");
        return;
      }
      updateInventoryItem(cat, itemId, item);
      afterMutation();
      closeSheet();
      app.requestRender();
      toast(t("Item atualizado."));
    },
    "btn primary",
  );

  const del = button(
    t("Remover"),
    () => {
      removeInventoryItem(cat, itemId);
      afterMutation();
      closeSheet();
      app.requestRender();
      toast(t("Item removido."));
    },
    "btn ghost danger",
  );

  openSheet([
    el("b", "sheet-title", catLabel),
    el("div", "sheet-fields", buildFields(cat, item)),
    el("div", "sheet-actions sheet-actions-split", [
      del,
      el("div", "sheet-actions-right", [
        button(t("Cancelar"), closeSheet, "btn ghost"),
        save,
      ]),
    ]),
  ]);
}

function itemAmountLabel(cat, item) {
  if (cat === "fermentables") {
    const kg = Number(item.amountKg) || 0;
    return kg >= 1 ? `${kg.toFixed(2).replace(/\.?0+$/, "")} kg` : `${(kg * 1000).toFixed(0)} g`;
  }
  if (cat === "hops") {
    const g = Number(item.amount) || 0;
    return g >= 1000
      ? `${(g / 1000).toFixed(2).replace(/\.?0+$/, "")} kg`
      : `${g.toFixed(0)} g`;
  }
  if (cat === "yeasts") {
    return `${Number(item.amount) || 0} ${item.unit || "pkg"}`;
  }
  return `${Number(item.amount) || 0} ${item.unit || "g"}`;
}

function itemSubLabel(cat, item) {
  if (cat === "fermentables")
    return `${item.yieldPct || 78}% rend. · ${item.ebc || 0} EBC`;
  if (cat === "hops") return `${item.alpha || 10}% AA`;
  if (cat === "yeasts") return `${item.attenuation || 75}% aten.`;
  return item.use || "";
}

function categorySection(cat, items) {
  const catMeta = CATEGORIES.find((c) => c.id === cat);

  if (!items.length) {
    return el("div", "inv-empty-cat", [
      el("span", "muted", t("Nenhum item em {cat}.", { cat: t(catMeta.label) })),
    ]);
  }

  return el(
    "div",
    "inv-item-list",
    items.map((item) => {
      const row = el("div", "inv-item-row", [
        el("div", "inv-item-main", [
          el("b", "inv-item-name", item.name || "—"),
          el("span", "inv-item-sub", itemSubLabel(cat, item)),
        ]),
        el("div", "inv-item-amount", itemAmountLabel(cat, item)),
        iconButton("edit", t("Editar"), () => openEditSheet(cat, item.id), "icon-btn small-btn"),
      ]);
      return row;
    }),
  );
}

export function inventoryScreen() {
  const driveActive = loadDriveEnabled();

  if (driveActive && driveLoadState === "idle" && hasDriveToken()) {
    loadInventoryFromDriveAndSync();
  }

  const inv = loadInventory();
  const cat = activeCategory;
  const items = inv[cat] || [];

  const tabs = el(
    "div",
    "inv-tabs",
    CATEGORIES.map((c) =>
      button(
        [icon(c.icon, "icon inv-tab-icon"), el("span", "inv-tab-label", t(c.label))],
        () => {
          activeCategory = c.id;
          app.requestRender();
        },
        `btn inv-tab ${c.id === cat ? "active" : ""}`,
      ),
    ),
  );

  const addBtn = button(
    [icon("plus", "icon"), t("Adicionar")],
    () => openAddSheet(cat),
    "btn primary",
  );

  const totalItems = items.length;
  const metaText = totalItems
    ? t("{n} item", { n: totalItems }) + (totalItems > 1 ? "s" : "")
    : "";

  const driveRow = driveActive
    ? el("div", "drive-sync-row inv-drive-row", [
        driveLoadState === "loading"
          ? el("span", "muted drive-sync-status", t("Sincronizando com o Drive…"))
          : button(
              t(driveLoadState === "done" ? "Atualizar do Drive" : "Carregar do Drive"),
              () => {
                driveLoadState = "idle";
                loadInventoryFromDriveAndSync();
              },
              "btn ghost small",
            ),
        driveLoadState === "error"
          ? el("span", "muted drive-sync-status", t("Falha ao sincronizar com o Drive."))
          : null,
      ])
    : null;

  return [
    el("div", "page-head", [
      el("div", "page-head-text", [
        el("h1", "page-title", t("Inventário")),
        metaText ? el("span", "page-meta", metaText) : null,
      ]),
      el("div", "page-actions", [addBtn]),
    ]),
    driveRow,
    el("section", "card inv-card", [
      tabs,
      el("div", "inv-body", [categorySection(cat, items)]),
    ]),
  ];
}

export function inventoryItemsForCategory(cat) {
  return loadInventory()[cat] || [];
}

export function inventoryMaltItems() {
  return inventoryItemsForCategory("fermentables").map((it) => ({
    ...it,
    yieldPct: it.yieldPct ?? 78,
    ebc: it.ebc ?? 5,
    type: it.type ?? "Grão",
    fromInventory: true,
    inventoryKg: Number(it.amountKg) || 0,
  }));
}

export function inventoryHopItems() {
  return inventoryItemsForCategory("hops").map((it) => ({
    ...it,
    alpha: it.alpha ?? 10,
    fromInventory: true,
    inventoryG: Number(it.amount) || 0,
  }));
}

export function inventoryYeastItems() {
  return inventoryItemsForCategory("yeasts").map((it) => ({
    ...it,
    attenuation: it.attenuation ?? 75,
    tempC: 19,
    fromInventory: true,
  }));
}

export function inventoryMiscItems() {
  return inventoryItemsForCategory("others").map((it) => ({
    ...it,
    fromInventory: true,
  }));
}
