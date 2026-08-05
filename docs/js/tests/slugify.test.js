import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { slugify } from "../engine.js";

describe("slugify", () => {
  it("lowercases ASCII letters", () => {
    assert.equal(slugify("Hello World"), "hello-world");
  });

  it("replaces spaces with hyphens", () => {
    assert.equal(slugify("no sparge"), "no-sparge");
  });

  it("replaces parentheses with hyphens, keeping inner text distinct", () => {
    assert.equal(slugify("Default (no sparge)"), "default--no-sparge");
  });

  it("two names differing only by parentheses produce different slugs", () => {
    const a = slugify("Default (no sparge)");
    const b = slugify("Default no sparge");
    assert.notEqual(a, b);
  });

  it("strips leading/trailing hyphens", () => {
    assert.equal(slugify(" leading and trailing "), "leading-and-trailing");
  });

  it("strips diacritics", () => {
    assert.equal(slugify("Brassagem Açaí"), "brassagem-acai");
  });

  it("replaces brackets with hyphens", () => {
    assert.equal(slugify("BIAB [20L]"), "biab--20l");
  });

  it("replaces # with hyphen", () => {
    assert.equal(slugify("Equipamento #1"), "equipamento--1");
  });

  it("handles leading space before special char (trim scenario)", () => {
    assert.equal(slugify(" Default (no sparge)"), "default--no-sparge");
  });

  it("returns 'brassagem' for empty string", () => {
    assert.equal(slugify(""), "brassagem");
  });

  it("returns 'brassagem' for null/undefined", () => {
    assert.equal(slugify(null), "brassagem");
    assert.equal(slugify(undefined), "brassagem");
  });

  it("handles name with only special chars", () => {
    assert.equal(slugify("()[]"), "brassagem");
  });

  it("preserves digits", () => {
    assert.equal(slugify("Equipment 10L v2"), "equipment-10l-v2");
  });
});
