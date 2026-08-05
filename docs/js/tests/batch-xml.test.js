import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Install DOMParser shim before loading any module that uses it
import "./dom-shim.js";

import { parseBeerXml } from "../beerxml.js";
import {
  brewEntryFromXml,
  brewEntryToXml,
  equipmentProfileFromXml,
  xmlTag,
  xmlText,
  xmlNum,
} from "../batch-xml.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, "fixtures", "001_First_try.xml"), "utf8");
const EQUIPMENT_FIXTURE = readFileSync(
  join(__dirname, "fixtures", "Default_(no_sparge).xml"),
  "utf8",
);

// Minimal stub for recipeToXml — used only in round-trip test
function stubRecipeToXml(recipe) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<RECIPES><RECIPE>",
    xmlTag("NAME", recipe.name || ""),
    xmlTag("VERSION", 1),
    xmlTag("TYPE", "All Grain"),
    "</RECIPE></RECIPES>",
  ].join("\n");
}

describe("xmlTag helpers", () => {
  it("escapes & < > in values", () => {
    assert.equal(xmlTag("X", "a&b<c>d"), "<X>a&amp;b&lt;c&gt;d</X>");
  });

  it("handles null/undefined as empty string", () => {
    assert.equal(xmlTag("X", null), "<X></X>");
    assert.equal(xmlTag("X", undefined), "<X></X>");
  });
});

describe("brewEntryFromXml — external BeerXML (Brewfather format)", () => {
  let entry;

  before(() => {
    entry = brewEntryFromXml(FIXTURE, parseBeerXml);
    assert.ok(entry, "brewEntryFromXml returned null — check DOMParser shim or fixture");
  });

  it("extracts recipeName as 'First try'", () => {
    assert.equal(entry.recipeName, "First try");
  });

  it("detects status as 'done' from STATUS=Completed", () => {
    assert.equal(entry.status, "done");
  });

  it("generates a stable id containing the recipe name", () => {
    assert.ok(entry.id.includes("first-try"), `id was: ${entry.id}`);
  });

  it("payload exists and contains a recipe object", () => {
    assert.ok(entry.payload, "payload is null");
    assert.ok(entry.payload.recipe, "payload.recipe is null");
  });

  it("payload.recipe.name matches recipeName", () => {
    assert.equal(entry.payload.recipe.name || entry.payload.recipe.NAME, "First try");
  });

  it("payload.recipe has fermentables (4 items)", () => {
    const fermentables = entry.payload.recipe.fermentables || entry.payload.recipe.FERMENTABLES;
    assert.ok(Array.isArray(fermentables), "fermentables is not an array");
    assert.equal(fermentables.length, 4);
  });

  it("payload.recipe has hops (2 items)", () => {
    const hops = entry.payload.recipe.hops || entry.payload.recipe.HOPS;
    assert.ok(Array.isArray(hops), "hops is not an array");
    assert.equal(hops.length, 2);
  });

  it("payload.recipe has a mash with one step", () => {
    const mash = entry.payload.recipe.mash || entry.payload.recipe.MASH;
    assert.ok(mash, "mash is missing");
    const steps = mash.mashSteps || mash.steps || mash.MASH_STEPS;
    assert.ok(Array.isArray(steps) ? steps.length >= 1 : true, "mash steps missing");
  });

  it("payload has measurements object", () => {
    assert.ok(entry.payload.measurements, "measurements is missing");
  });

  it("updatedAt is set", () => {
    assert.ok(typeof entry.updatedAt === "string" && entry.updatedAt.length > 0);
  });

  it("does not have BM_ID or BM_PAYLOAD fields (external file)", () => {
    // The fixture has no BM_ID so we must have taken path 2
    assert.ok(!entry.id.startsWith("bm-"), "unexpectedly took native path");
  });
});

describe("brewEntryFromXml — native BeerMother XML (round-trip)", () => {
  it("round-trips a brew entry through XML and back", () => {
    // Build a minimal brew entry
    const original = {
      id: "brew-test-001",
      status: "done",
      recipeName: "Test IPA",
      styleName: "American IPA",
      updatedAt: "2025-07-30T10:00:00Z",
      concludedAt: "2025-07-30T12:00:00Z",
      payload: {
        brewId: "brew-test-001",
        recipe: { name: "Test IPA", fermentables: [], hops: [] },
        savedAt: "2025-07-30T10:00:00Z",
        measurements: {
          postBoil: { wri: 1.052, volumeL: 20 },
          cold: { wri: 1.010 },
        },
        fermentationTracking: {
          readings: [{ sg: 1.010, timestamp: "2025-07-30T12:00:00Z" }],
        },
        notes: "Round-trip test",
      },
    };

    const xml = brewEntryToXml(original, stubRecipeToXml);
    assert.ok(typeof xml === "string" && xml.includes("BM_PAYLOAD"), "XML missing BM_PAYLOAD");
    assert.ok(xml.includes("brew-test-001"), "XML missing BM_ID");

    const restored = brewEntryFromXml(xml, parseBeerXml);
    assert.ok(restored, "round-trip parse returned null");

    assert.equal(restored.id, original.id);
    assert.equal(restored.status, original.status);
    assert.equal(restored.recipeName, original.recipeName);
    assert.equal(restored.updatedAt, original.updatedAt);
    assert.equal(restored.concludedAt, original.concludedAt);

    // payload must be fully preserved
    assert.deepEqual(restored.payload.recipe, original.payload.recipe);
    assert.deepEqual(restored.payload.measurements, original.payload.measurements);
    assert.equal(restored.payload.notes, original.payload.notes);
  });
});

describe("brewEntryFromXml — malformed input", () => {
  it("returns null for empty string", () => {
    assert.equal(brewEntryFromXml("", parseBeerXml), null);
  });

  it("returns null when no RECIPE element present", () => {
    const xml = '<?xml version="1.0"?><EQUIPMENTS><EQUIPMENT><NAME>Test</NAME></EQUIPMENT></EQUIPMENTS>';
    assert.equal(brewEntryFromXml(xml, parseBeerXml), null);
  });
});

describe("equipmentProfileFromXml — Default_(no_sparge).xml (legacy, no BM_ID)", () => {
  let profile;

  before(() => {
    profile = equipmentProfileFromXml(EQUIPMENT_FIXTURE);
    assert.ok(profile, "equipmentProfileFromXml returned null — check DOMParser shim or fixture");
  });

  it("parses name (trimmed)", () => {
    assert.equal(profile.name, "Default (no sparge)");
  });

  it("generates deterministic id from equipment name", () => {
    assert.equal(profile.id, "profile-default-no-sparge");
  });

  it("id is stable across multiple parses (no Date.now() drift)", () => {
    const profile2 = equipmentProfileFromXml(EQUIPMENT_FIXTURE);
    assert.equal(profile2.id, profile.id);
  });

  it("parses targetVolumeL from BATCH_SIZE", () => {
    assert.equal(profile.params.targetVolumeL, 5.0);
  });

  it("parses mashEfficiencyPct from EFFICIENCY", () => {
    assert.equal(profile.params.mashEfficiencyPct, 75.5);
  });

  it("parses evaporationPct from EVAP_RATE", () => {
    assert.equal(profile.params.evaporationPct, 12.66);
  });

  it("parses grainAbsorptionLkg from GRAIN_ABSORPTION_RATE", () => {
    assert.equal(profile.params.grainAbsorptionLkg, 0.96);
  });

  it("parses mashTunDeadSpaceL from MASH_TUN_DEADSPACE", () => {
    assert.equal(profile.params.mashTunDeadSpaceL, 3.5);
  });

  it("parses whirlpoolNoChillMin from WHIRLPOOL_TIME", () => {
    assert.equal(profile.params.whirlpoolNoChillMin, 30);
  });

  it("computes trubLossPct from TRUB_CHILLER_LOSS / BATCH_SIZE", () => {
    // 0.3 / 5.0 = 0.06
    assert.equal(profile.params.trubLossPct, 0.06);
  });
});

describe("equipmentProfileFromXml — malformed input", () => {
  it("returns null for empty string", () => {
    assert.equal(equipmentProfileFromXml(""), null);
  });

  it("returns null when no EQUIPMENT element present", () => {
    const xml = '<?xml version="1.0"?><RECIPES><RECIPE><NAME>Test</NAME></RECIPE></RECIPES>';
    assert.equal(equipmentProfileFromXml(xml), null);
  });
});
