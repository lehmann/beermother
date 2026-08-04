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
  syncInventoryFromDrive,
  restorePersistedToken,
} from "./gdrive.js";
import { MALT_LIBRARY, HOP_LIBRARY, YEAST_LIBRARY } from "./library.js";

const INVENTORY_DRIVE_MD5_KEY = "beermother.drive.inventory.md5";

const CATEGORIES = [
  { id: "fermentables", label: "Fermentáveis", icon: "scale" },
  { id: "hops", label: "Lúpulos", icon: "hop" },
  { id: "yeasts", label: "Leveduras", icon: "ferment" },
  { id: "others", label: "Outros", icon: "flask" },
];

let activeCategory = "fermentables";
let currentOverlay = null;
let currentKeyHandler = null;
let driveLoadState = "idle"; // "idle" | "loading" | "done" | "error"
let driveHydrated = false;

function loadCachedMd5() {
  try { return localStorage.getItem(INVENTORY_DRIVE_MD5_KEY) || null; } catch { return null; }
}
function saveCachedMd5(md5) {
  try { if (md5) localStorage.setItem(INVENTORY_DRIVE_MD5_KEY, md5); } catch {}
}

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
        `<MISC>${tag("ID", it.id)}${tag("NAME", it.name)}${tag("AMOUNT", it.amount ?? 0)}${tag("AMOUNT_IS_WEIGHT", "FALSE")}${tag("DISPLAY_AMOUNT", `${it.amount ?? 0} ${it.unit || "g"}`)}${it.use ? tag("USE", it.use) : ""}${it.miscType ? tag("MISC_TYPE", it.miscType) : ""}${it.qtyPerL != null ? tag("QTY_PER_L", it.qtyPerL) : ""}</MISC>`,
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
        miscType: getText(n, "MISC_TYPE"),
        qtyPerL: getNum(n, "QTY_PER_L", 0),
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
    const result = await saveInventoryToDrive(inventoryToXml(inv));
    if (result?.md5Checksum) saveCachedMd5(result.md5Checksum);
  } catch {}
}

// Hydrate: restores inventory from localStorage (no token required).
// Called unconditionally on every render of the inventory screen.
function hydrateInventoryFromCache() {
  if (driveHydrated) return;
  driveHydrated = true;
  // The inventory is already loaded via loadInventory() from state.js on each
  // render — nothing extra needed here.  The flag just prevents re-entry and
  // mirrors the pattern used by the other screens.
}

// Background sync: fetches Drive metadata, downloads only when md5 changed.
async function loadDriveInventory(forceRefresh) {
  if (!loadDriveEnabled() || !hasDriveToken()) return;
  if (!forceRefresh && driveLoadState !== "idle") return;
  driveLoadState = "loading";
  app.requestRender();
  try {
    restorePersistedToken();
    const cachedMd5 = forceRefresh ? null : loadCachedMd5();
    const { content, md5Checksum, changed } = await syncInventoryFromDrive(cachedMd5);
    if (changed && content) {
      const parsed = parseInventoryXml(content);
      if (parsed) {
        saveInventory(parsed);
        saveCachedMd5(md5Checksum);
      }
    }
    driveLoadState = "done";
  } catch {
    driveLoadState = "error";
  }
  app.requestRender();
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
  return { name: "", amount: 0, unit: "g", use: "", miscType: "", qtyPerL: 0 };
}

function nameInput(initialValue, onChange, suggestions = []) {
  const wrapper = el("div", "inv-suggest-wrap", []);
  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.className = "field-input";
  textInput.value = initialValue || "";

  let dropdownList = null;
  let activeIndex = -1;

  function hideSuggestions() {
    if (dropdownList) {
      dropdownList.remove();
      dropdownList = null;
    }
    activeIndex = -1;
  }

  function showSuggestions(matches) {
    hideSuggestions();
    if (!matches.length) return;
    dropdownList = el(
      "ul",
      "inv-suggest-list",
      matches.map((suggestion) => {
        const listItem = document.createElement("li");
        listItem.className = "inv-suggest-item";
        listItem.textContent = suggestion.name;
        listItem.addEventListener("mousedown", (event) => {
          event.preventDefault();
          textInput.value = suggestion.name;
          onChange(suggestion.name);
          if (suggestion._autofill) suggestion._autofill();
          hideSuggestions();
        });
        return listItem;
      }),
    );
    wrapper.appendChild(dropdownList);
  }

  function setActiveItem(index) {
    if (!dropdownList) return;
    const items = dropdownList.querySelectorAll(".inv-suggest-item");
    items.forEach((item, i) => item.classList.toggle("active", i === index));
    activeIndex = index;
  }

  textInput.addEventListener("input", () => {
    const query = textInput.value.trim().toLowerCase();
    onChange(textInput.value);
    if (!query) {
      hideSuggestions();
      return;
    }
    const matches = suggestions
      .filter((suggestion) => suggestion.name.toLowerCase().includes(query))
      .slice(0, 8);
    showSuggestions(matches);
  });

  textInput.addEventListener("keydown", (event) => {
    if (!dropdownList) return;
    const items = dropdownList.querySelectorAll(".inv-suggest-item");
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveItem(Math.min(activeIndex + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveItem(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      items[activeIndex].dispatchEvent(new MouseEvent("mousedown"));
    } else if (event.key === "Escape") {
      hideSuggestions();
    }
  });

  textInput.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

  wrapper.appendChild(textInput);
  return wrapper;
}

function setInputVal(inputEl, newValue) {
  const targetInput = inputEl.querySelector("input") || inputEl;
  targetInput.value = newValue;
  targetInput.dispatchEvent(new Event("input"));
}

function buildFields(cat, item) {
  const rows = [];

  // Build category-specific numeric fields first so autofill can reference them
  const numRefs = {};

  if (cat === "fermentables") {
    numRefs.yieldEl = numInput(item.yieldPct, (value) => { item.yieldPct = Math.max(1, Math.min(100, Number(value) || 78)); }, { step: "1", min: "1", max: "100" });
    numRefs.ebcEl   = numInput(item.ebc,      (value) => { item.ebc      = Math.max(0, Number(value) || 0); },                { step: "1", min: "0" });
  } else if (cat === "hops") {
    numRefs.alphaEl = numInput(item.alpha, (value) => { item.alpha = Math.max(0, Math.min(25, Number(value) || 10)); }, { step: "0.1", min: "0", max: "25" });
  } else if (cat === "yeasts") {
    numRefs.attenEl = numInput(item.attenuation, (value) => { item.attenuation = Math.max(30, Math.min(100, Number(value) || 75)); }, { step: "1", min: "30", max: "100" });
  }

  // Suggestions per category with autofill callbacks
  const suggestions =
    cat === "fermentables"
      ? MALT_LIBRARY.map((entry) => ({
          name: entry.name,
          _autofill: () => {
            if (entry.yieldPct != null) { item.yieldPct = entry.yieldPct; setInputVal(numRefs.yieldEl, entry.yieldPct); }
            if (entry.ebc     != null) { item.ebc      = entry.ebc;      setInputVal(numRefs.ebcEl,   entry.ebc); }
          },
        }))
      : cat === "hops"
      ? HOP_LIBRARY.map((entry) => ({
          name: entry.name,
          _autofill: () => {
            const alpha = entry.alpha?.avg ?? entry.alpha;
            if (alpha != null) { item.alpha = alpha; setInputVal(numRefs.alphaEl, alpha); }
          },
        }))
      : cat === "yeasts"
      ? YEAST_LIBRARY.map((entry) => ({
          name: entry.name,
          _autofill: () => {
            if (entry.attenuation != null) { item.attenuation = entry.attenuation; setInputVal(numRefs.attenEl, entry.attenuation); }
          },
        }))
      : [];

  rows.push(
    fieldRow(
      t("Nome"),
      nameInput(item.name, (v) => { item.name = v; }, suggestions),
    ),
  );

  if (cat === "fermentables") {
    rows.push(
      fieldRow(t("Quantidade (kg)"), numInput(item.amountKg, (value) => { item.amountKg = Math.max(0, Number(value) || 0); }, { step: "0.1", min: "0" })),
      fieldRow(t("Rendimento (%)"), numRefs.yieldEl),
      fieldRow(t("Cor (EBC)"),      numRefs.ebcEl),
    );
  } else if (cat === "hops") {
    rows.push(
      fieldRow(t("Quantidade (g)"), numInput(item.amount, (value) => { item.amount = Math.max(0, Number(value) || 0); }, { step: "1", min: "0" })),
      fieldRow(t("Alfa ácido (%)"), numRefs.alphaEl),
    );
  } else if (cat === "yeasts") {
    const yeastUnitSelect = document.createElement("select");
    yeastUnitSelect.className = "field-input";
    ["pkg", "g", "ml"].forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = unit;
      if (unit === (item.unit || "pkg")) option.selected = true;
      yeastUnitSelect.append(option);
    });
    yeastUnitSelect.addEventListener("change", () => {
      item.unit = yeastUnitSelect.value;
    });

    rows.push(
      fieldRow(t("Quantidade"), numInput(item.amount, (value) => { item.amount = Math.max(0, Number(value) || 0); }, { step: "1", min: "0" })),
      fieldRow(t("Unidade"), yeastUnitSelect),
      fieldRow(t("Atenuação (%)"), numRefs.attenEl),
    );
  } else {
    const miscUnitSelect = document.createElement("select");
    miscUnitSelect.className = "field-input";
    ["g", "kg", "ml", "L", "un"].forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = unit;
      if (unit === (item.unit || "g")) option.selected = true;
      miscUnitSelect.append(option);
    });
    miscUnitSelect.addEventListener("change", () => {
      item.unit = miscUnitSelect.value;
    });

    const miscTypeSelect = document.createElement("select");
    miscTypeSelect.className = "field-input";
    const miscTypeOptions = ["", "Sabor", "Erva", "Sais", "Clarificante", "Especiaria"];
    miscTypeOptions.forEach((typeName) => {
      const option = document.createElement("option");
      option.value = typeName;
      option.textContent = typeName ? t(typeName) : `— ${t("selecione")} —`;
      if (typeName === (item.miscType || "")) option.selected = true;
      miscTypeSelect.append(option);
    });
    miscTypeSelect.addEventListener("change", () => {
      item.miscType = miscTypeSelect.value;
    });

    const miscUseSelect = document.createElement("select");
    miscUseSelect.className = "field-input";
    const miscUseOptions = [
      "",
      "Mostura",
      "Sparge",
      "Fervura",
      "Flameout",
      "Fermentação Primária",
      "Fermentação Secundária",
      "Envase",
    ];
    miscUseOptions.forEach((useValue) => {
      const option = document.createElement("option");
      option.value = useValue;
      option.textContent = useValue ? t(useValue) : `— ${t("selecione")} —`;
      if (useValue === (item.use || "")) option.selected = true;
      miscUseSelect.append(option);
    });
    miscUseSelect.addEventListener("change", () => {
      item.use = miscUseSelect.value;
    });

    rows.push(
      fieldRow(
        t("Quantidade"),
        numInput(item.amount, (value) => { item.amount = Math.max(0, Number(value) || 0); }, { step: "1", min: "0" }),
      ),
      fieldRow(t("Unidade"), miscUnitSelect),
      fieldRow(t("Tipo"), miscTypeSelect),
      fieldRow(
        t("Quantidade por litro (g/L)"),
        numInput(item.qtyPerL, (value) => { item.qtyPerL = Math.max(0, Number(value) || 0); }, { step: "0.1", min: "0" }),
      ),
      fieldRow(t("Uso"), miscUseSelect),
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
  const parts = [];
  if (item.miscType) parts.push(t(item.miscType));
  if (item.qtyPerL) parts.push(`${item.qtyPerL} g/L`);
  if (item.use) parts.push(t(item.use));
  return parts.join(" · ");
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

  if (driveActive) {
    hydrateInventoryFromCache();
    if (hasDriveToken() && driveLoadState === "idle") loadDriveInventory(false);
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
              () => loadDriveInventory(true),
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
