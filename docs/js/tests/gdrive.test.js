import { test } from "node:test";
import assert from "node:assert/strict";
import { diffCacheWithMetadata } from "../gdrive.js";

// ── diffCacheWithMetadata ─────────────────────────────────────────────────────

test("cache vazio e Drive vazio: sem downloads, sem deleções, changed=false", async () => {
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata([], []);
  assert.deepEqual(toDownload, []);
  assert.deepEqual(unchanged, []);
  assert.equal(deleted, false);
});

test("Drive tem arquivo novo (não está no cache): vai para toDownload", async () => {
  const meta = [{ id: "abc", name: "recipe.xml", md5Checksum: "hash1" }];
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(meta, []);
  assert.equal(toDownload.length, 1);
  assert.equal(toDownload[0].id, "abc");
  assert.equal(unchanged.length, 0);
  assert.equal(deleted, false);
});

test("Arquivo no cache com mesmo md5: fica em unchanged com fresh=false", async () => {
  const meta = [{ id: "abc", name: "recipe.xml", md5Checksum: "hash1" }];
  const cache = [{ driveFileId: "abc", name: "recipe.xml", md5Checksum: "hash1", content: "<xml/>" }];
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(meta, cache);
  assert.equal(toDownload.length, 0);
  assert.equal(unchanged.length, 1);
  assert.equal(unchanged[0].fresh, false);
  assert.equal(unchanged[0].driveFileId, "abc");
  assert.equal(unchanged[0].content, "<xml/>");
  assert.equal(deleted, false);
});

test("Arquivo no cache com md5 diferente: vai para toDownload (atualização)", async () => {
  const meta = [{ id: "abc", name: "recipe.xml", md5Checksum: "hash-novo" }];
  const cache = [{ driveFileId: "abc", name: "recipe.xml", md5Checksum: "hash-antigo", content: "<xml/>" }];
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(meta, cache);
  assert.equal(toDownload.length, 1);
  assert.equal(toDownload[0].id, "abc");
  assert.equal(unchanged.length, 0);
  assert.equal(deleted, false);
});

test("Arquivo no cache mas não no Drive: deleted=true", async () => {
  const meta = [];
  const cache = [{ driveFileId: "abc", name: "recipe.xml", md5Checksum: "hash1", content: "<xml/>" }];
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(meta, cache);
  assert.equal(toDownload.length, 0);
  assert.equal(unchanged.length, 0);
  assert.equal(deleted, true);
});

test("Mistura: arquivo unchanged + arquivo novo + arquivo deletado", async () => {
  const meta = [
    { id: "id1", name: "a.xml", md5Checksum: "m1" },
    { id: "id3", name: "c.xml", md5Checksum: "m3" },
  ];
  const cache = [
    { driveFileId: "id1", name: "a.xml", md5Checksum: "m1", content: "<a/>" },
    { driveFileId: "id2", name: "b.xml", md5Checksum: "m2", content: "<b/>" }, // deletado
  ];
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(meta, cache);

  assert.equal(unchanged.length, 1);
  assert.equal(unchanged[0].driveFileId, "id1");
  assert.equal(unchanged[0].fresh, false);

  assert.equal(toDownload.length, 1);
  assert.equal(toDownload[0].id, "id3");

  assert.equal(deleted, true);
});

test("unchanged preserva todos os campos do cache (content, extra metadata)", async () => {
  const meta = [{ id: "abc", name: "r.xml", md5Checksum: "h1" }];
  const cache = [{ driveFileId: "abc", name: "r.xml", md5Checksum: "h1", content: "<r/>", extra: "dado" }];
  const { unchanged } = diffCacheWithMetadata(meta, cache);
  assert.equal(unchanged[0].content, "<r/>");
  assert.equal(unchanged[0].extra, "dado");
});

test("múltiplos arquivos, todos unchanged: nenhum download", async () => {
  const n = 10;
  const meta = Array.from({ length: n }, (_, i) => ({ id: `id${i}`, name: `r${i}.xml`, md5Checksum: `h${i}` }));
  const cache = meta.map((m) => ({ driveFileId: m.id, name: m.name, md5Checksum: m.md5Checksum, content: "<x/>" }));
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(meta, cache);
  assert.equal(toDownload.length, 0);
  assert.equal(unchanged.length, n);
  assert.equal(deleted, false);
});

test("múltiplos arquivos, todos novos: todos vão para toDownload", async () => {
  const n = 5;
  const meta = Array.from({ length: n }, (_, i) => ({ id: `id${i}`, name: `r${i}.xml`, md5Checksum: `h${i}` }));
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(meta, []);
  assert.equal(toDownload.length, n);
  assert.equal(unchanged.length, 0);
  assert.equal(deleted, false);
});
