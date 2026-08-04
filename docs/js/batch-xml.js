// Serialization and parsing of brew entries and equipment profiles to/from XML.
// DOMParser is taken from globalThis so it can be shimmed in test environments.

import { toNumber as m, round as T } from "./engine.js";

// ── shared helpers ────────────────────────────────────────────────────────────

export function xmlTag(name, value) {
  return `<${name}>${String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</${name}>`;
}

export function xmlText(el, tag) {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

export function xmlNum(el, tag, fallback = 0) {
  const v = parseFloat(xmlText(el, tag));
  return Number.isFinite(v) ? v : fallback;
}

// ── equipment ─────────────────────────────────────────────────────────────────

export function equipmentProfileToXml(profile) {
  const p = profile.params || {};
  const targetVolumeL = m(p.targetVolumeL, 20);
  const trubLossL = m(m(p.trubLossPct, 0.15) * targetVolumeL, 3);
  const boilSizeL = T(targetVolumeL / (1 - m(p.evaporationPct, 13) / 100) + trubLossL, 2);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<EQUIPMENTS><EQUIPMENT>",
    xmlTag("NAME", profile.name || "Equipamento"),
    xmlTag("VERSION", 1),
    xmlTag("BM_ID", profile.id || ""),
    xmlTag("BATCH_SIZE", T(targetVolumeL, 2)),
    xmlTag("BOIL_SIZE", boilSizeL),
    xmlTag("BOIL_TIME", 60),
    xmlTag("EFFICIENCY", T(m(p.mashEfficiencyPct, 65), 1)),
    xmlTag("EVAP_RATE", T(m(p.evaporationPct, 13), 2)),
    xmlTag("TRUB_CHILLER_LOSS", T(trubLossL, 3)),
    xmlTag("GRAIN_ABSORPTION_RATE", T(m(p.grainAbsorptionLkg, 1.2), 4)),
    xmlTag("MASH_TUN_DEADSPACE", T(m(p.mashTunDeadSpaceL, 0), 2)),
    xmlTag("WHIRLPOOL_TIME", Math.round(m(p.whirlpoolNoChillMin, 0))),
    xmlTag("WATER_TO_GRAIN_RATIO", T(m(p.waterToGrainRatioLkg, 3), 2)),
    xmlTag("HEATING_RATE_C_MIN", T(m(p.heatingRateCMin, 1), 2)),
    xmlTag("BM_UPDATED_AT", profile.updatedAt || ""),
    "</EQUIPMENT></EQUIPMENTS>",
  ].join("\n");
}

export function equipmentProfileFromXml(xmlContent) {
  const doc = new globalThis.DOMParser().parseFromString(xmlContent, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  const eq = doc.getElementsByTagName("EQUIPMENT")[0];
  if (!eq) return null;
  const targetVolumeL = xmlNum(eq, "BATCH_SIZE", 20);
  const trubLossL = xmlNum(eq, "TRUB_CHILLER_LOSS", targetVolumeL * 0.15);
  return {
    id: xmlText(eq, "BM_ID") || `profile-${Date.now().toString(36)}`,
    name: xmlText(eq, "NAME") || "Equipamento",
    updatedAt: xmlText(eq, "BM_UPDATED_AT") || new Date().toISOString(),
    params: {
      targetVolumeL,
      mashEfficiencyPct: xmlNum(eq, "EFFICIENCY", 65),
      evaporationPct: xmlNum(eq, "EVAP_RATE", 13),
      trubLossPct: targetVolumeL > 0 ? T(trubLossL / targetVolumeL, 4) : 0.15,
      grainAbsorptionLkg: xmlNum(eq, "GRAIN_ABSORPTION_RATE", 1.2),
      mashTunDeadSpaceL: xmlNum(eq, "MASH_TUN_DEADSPACE", 0),
      whirlpoolNoChillMin: xmlNum(eq, "WHIRLPOOL_TIME", 0),
      waterToGrainRatioLkg: xmlNum(eq, "WATER_TO_GRAIN_RATIO", 3),
      heatingRateCMin: xmlNum(eq, "HEATING_RATE_C_MIN", 1),
    },
  };
}

// ── batch ─────────────────────────────────────────────────────────────────────

// Serialize a brew entry to XML.
// recipeToXml is injected so this module has no dependency on recipes.js.
export function brewEntryToXml(entry, recipeToXml) {
  const p = entry.payload || {};
  const recipe = p.recipe || {};
  const meas = p.measurements || {};
  const postBoil = meas.postBoil || {};
  const cold = meas.cold || {};
  const fermt = p.fermentationTracking || {};
  const readings = fermt.readings || [];

  let recipeXml = "";
  try {
    recipeXml = recipeToXml(recipe);
  } catch {
    recipeXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<RECIPES><RECIPE>",
      xmlTag("NAME", recipe.name || entry.recipeName || ""),
      xmlTag("VERSION", 1),
      xmlTag("TYPE", "All Grain"),
      "</RECIPE></RECIPES>",
    ].join("\n");
  }

  const measuredOg = m(postBoil.wri) || m(cold.wri) || "";
  const lastReading = readings.length ? readings[readings.length - 1] : null;
  const measuredFg = lastReading ? m(lastReading.sg || lastReading.gravity) || "" : "";

  const batchFields = [
    measuredOg !== "" ? xmlTag("MEASURED_OG", measuredOg) : "",
    measuredFg !== "" ? xmlTag("MEASURED_FG", measuredFg) : "",
    m(postBoil.volumeL) ? xmlTag("MEASURED_BOIL_SIZE", m(postBoil.volumeL)) : "",
    xmlTag("STATUS", entry.status === "done" ? "Completed" : "Active"),
    xmlTag("BM_ID", entry.id || ""),
    xmlTag("BM_STATUS", entry.status || "active"),
    xmlTag("BM_UPDATED_AT", entry.updatedAt || ""),
    xmlTag("BM_CONCLUDED_AT", entry.concludedAt || ""),
    `<BM_PAYLOAD><![CDATA[${JSON.stringify(p)}]]></BM_PAYLOAD>`,
  ].filter(Boolean).join("\n");

  return recipeXml.replace("</RECIPE></RECIPES>", `${batchFields}\n</RECIPE></RECIPES>`);
}

// Parse a brew entry XML back into an internal brew entry object.
// Supports both Beermother-native XML (with BM_PAYLOAD) and external BeerXML.
// parseBeerXml is injected so this module has no dependency on beerxml.js.
export function brewEntryFromXml(xmlContent, parseBeerXml) {
  const doc = new globalThis.DOMParser().parseFromString(xmlContent, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  const recipe = doc.getElementsByTagName("RECIPE")[0];
  if (!recipe) return null;

  // Path 1: Beermother-native XML with BM_PAYLOAD CDATA
  const bmIdEl = recipe.getElementsByTagName("BM_ID")[0];
  const bmPayloadEl = recipe.getElementsByTagName("BM_PAYLOAD")[0];
  if (bmIdEl && bmPayloadEl) {
    const id = bmIdEl.textContent.trim();
    if (!id) return null;
    let payload = null;
    try { payload = JSON.parse(bmPayloadEl.textContent || "null"); } catch { return null; }
    if (!payload) return null;
    return {
      id,
      status: xmlText(recipe, "BM_STATUS") || "active",
      recipeName: payload.recipe?.name || xmlText(recipe, "NAME") || "",
      styleName: payload.recipe?.styleName || "",
      updatedAt: xmlText(recipe, "BM_UPDATED_AT") || "",
      concludedAt: xmlText(recipe, "BM_CONCLUDED_AT") || "",
      payload,
    };
  }

  // Path 2: External BeerXML (Brewfather, BeerSmith, etc.)
  const name = xmlText(recipe, "NAME");
  if (!name) return null;
  const batchNo = xmlText(recipe, "BATCH_NO");
  const id = `imported-${name.toLowerCase().replace(/\s+/g, "-")}-${batchNo || Date.now()}`;
  const statusRaw = xmlText(recipe, "STATUS");
  const status = /complet/i.test(statusRaw) ? "done" : "active";
  const date = xmlText(recipe, "DATE");

  let recipe_obj = null;
  try { recipe_obj = parseBeerXml(xmlContent); } catch { recipe_obj = { name }; }

  const payload = {
    brewId: id,
    recipe: recipe_obj,
    savedAt: date || new Date().toISOString(),
    measurements: {
      postBoil: {
        wri: xmlText(recipe, "MEASURED_OG") || "",
        volumeL: xmlText(recipe, "MEASURED_BOIL_SIZE") || "",
      },
      cold: { wri: xmlText(recipe, "MEASURED_FG") || "" },
    },
    properties: {},
    fermentationTracking: {},
    notes: xmlText(recipe, "NOTES") || "",
    timerEvents: [],
    hopLots: [],
    correctionRounds: [],
    additionChecks: {},
    phasesDone: {},
    correctionChecks: {},
    guideEnabled: false,
    guideChecks: {},
    correctionAccepted: {},
    calibration: false,
    phLog: {},
  };

  return {
    id,
    status,
    recipeName: name,
    styleName: recipe_obj?.styleName || "",
    updatedAt: new Date().toISOString(),
    concludedAt: status === "done" ? new Date().toISOString() : "",
    payload,
  };
}
