import { t } from "./i18n.js";
import { loadDriveFolderName } from "./state.js";

const CLIENT_ID =
  "737027827720-hvm2q49b9cnojoe0voo8nlfu2ehhtdsd.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const STORAGE_KEY = "beermother.drive.token.v1";

// Sub-folder names inside the root Beer Mother folder
const SUBFOLDER_RECIPES = "recipes";
const SUBFOLDER_EQUIPMENTS = "equipments";
const SUBFOLDER_BATCHES = "batches";
const SUBFOLDER_BIN = "bin";
const SUBFOLDER_BIN_RECIPES = "recipes";
const SUBFOLDER_BIN_EQUIPMENTS = "equipments";

let _tokenClient = null;
let _token = null;
let _tokenExpiry = 0;
let _pendingResolve = null;
let _pendingReject = null;

function hasValidToken() {
  return !!(_token && Date.now() < _tokenExpiry - 30000);
}

function persistToken(resp) {
  const expiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
  _token = resp;
  _tokenExpiry = expiry;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ access_token: resp.access_token, expiry }),
    );
  } catch {}
}

function loadPersistedToken() {
  if (hasValidToken()) return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { access_token, expiry } = JSON.parse(raw);
    if (!access_token || Date.now() >= expiry - 30000) return false;
    _token = { access_token };
    _tokenExpiry = expiry;
    return true;
  } catch {
    return false;
  }
}

function revokeLocalToken() {
  _token = null;
  _tokenExpiry = 0;
  _tokenClient = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function buildTokenClient(prompt) {
  return window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    prompt,
    callback: (resp) => {
      if (resp.error) {
        _pendingReject?.(
          new Error(resp.error_description || resp.error || t("Acesso ao Google Drive negado.")),
        );
      } else {
        persistToken(resp);
        _pendingResolve?.(_token);
      }
      _pendingResolve = null;
      _pendingReject = null;
    },
    error_callback: (err) => {
      _pendingReject?.(
        new Error(err?.message || t("Erro ao autenticar com o Google.")),
      );
      _pendingResolve = null;
      _pendingReject = null;
    },
  });
}

// Tries a silent token renewal first (no UI). Falls back to the account-picker
// popup only when the silent attempt fails (session expired, access revoked, etc.).
function requestTokenSilent() {
  return new Promise((resolve, reject) => {
    _pendingResolve = resolve;
    _pendingReject = reject;
    const client = buildTokenClient("");
    client.requestAccessToken({ prompt: "" });
  });
}

async function requestTokenInteractive() {
  return new Promise((resolve, reject) => {
    _pendingResolve = resolve;
    _pendingReject = reject;
    _tokenClient = buildTokenClient("select_account");
    _tokenClient.requestAccessToken({});
  });
}

function waitForGsi(timeout = 10000) {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - start >= timeout)
        return reject(new Error(t("Google Identity Services não disponível.")));
      setTimeout(check, 100);
    };
    check();
  });
}

// Called once at app boot — restores a previously persisted token into memory
// so drive operations can proceed without waiting for user interaction.
export function restorePersistedToken() {
  loadPersistedToken();
}

export async function requestDriveAccess() {
  await waitForGsi();
  if (hasValidToken()) return _token;
  if (loadPersistedToken()) return _token;
  // Try silent renewal first — works as long as the user has an active Google
  // session in the browser. Only falls back to the account-picker popup when
  // the silent attempt fails (session expired, access revoked, popup blocked).
  try {
    return await requestTokenSilent();
  } catch {
    return await requestTokenInteractive();
  }
}

// interactive=true: user-initiated action — re-authenticate if token is missing
// or expired (may show OAuth consent screen).
// interactive=false (default): background operation — fail fast if no valid token.
async function authHeaders(interactive = false) {
  if (!hasValidToken()) loadPersistedToken();
  if (!hasValidToken()) {
    if (!interactive) throw new Error(t("Token do Google Drive não disponível."));
    await requestDriveAccess();
  }
  return { Authorization: `Bearer ${_token.access_token}` };
}

async function apiFetch(url, options = {}) {
  return fetch(url, options);
}

// ── folder helpers ────────────────────────────────────────────────────────────

async function findOrCreateFolderUnder(name, parentId, interactive = false) {
  const h = await authHeaders(interactive);
  const parentClause = parentId
    ? ` and '${parentId}' in parents`
    : " and 'root' in parents";
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
  );
  const searchRes = await apiFetch(
    `${API}/files?q=${q}&fields=files(id)&spaces=drive`,
    { headers: h },
  );
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files?.length > 0) return data.files[0].id;
  } else if (searchRes.status === 403) {
    revokeLocalToken();
    throw new Error(t("Acesso ao Google Drive negado."));
  } else {
    throw new Error(t("Erro ao buscar pasta no Google Drive."));
  }

  const body = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const createRes = await apiFetch(`${API}/files`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) throw new Error(t("Erro ao criar pasta no Google Drive."));
  const folder = await createRes.json();
  return folder.id;
}

async function resolveSubFolder(subFolder, interactive = false) {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null, interactive);
  return findOrCreateFolderUnder(subFolder, rootId, interactive);
}

// ── file primitives ───────────────────────────────────────────────────────────

// Single metadata-only listing — one API call, no content download.
async function listFilesMetadataInFolder(folderId, extension, interactive = false) {
  const h = await authHeaders(interactive);
  const extClause = extension ? ` and name contains '${extension}'` : "";
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false${extClause}`,
  );
  const res = await apiFetch(
    `${API}/files?q=${q}&fields=files(id,name,md5Checksum)&spaces=drive&pageSize=1000&orderBy=name`,
    { headers: h },
  );
  if (!res.ok) {
    if (res.status === 403) revokeLocalToken();
    throw new Error(t("Erro ao listar arquivos no Google Drive."));
  }
  const data = await res.json();
  return data.files || [];
}

async function downloadFileById(fileId, interactive = false) {
  const h = await authHeaders(interactive);
  const r = await apiFetch(`${API}/files/${fileId}?alt=media`, { headers: h });
  if (!r.ok) throw new Error(t("Erro ao baixar arquivo do Google Drive."));
  return r.text();
}

// ── cache-aware sync ──────────────────────────────────────────────────────────
//
// cache:   [{driveFileId, name, md5Checksum, ...rest}]
//          content is optional — recipes pass index-only entries (no content)
//
// Returns: {entries, changed}
//   entries: [{driveFileId, name, md5Checksum, content, fresh}]
//     - content is present only for entries that were downloaded this call
//     - fresh=true  → file was new or its md5 changed (content downloaded)
//     - fresh=false → file unchanged (content not downloaded, may be absent)
//   changed: true if any entry is fresh OR any cache entry was deleted
//
// Pure diff logic — exported for unit tests.
export function diffCacheWithMetadata(metaList, cache) {
  const cacheByDriveId = new Map(cache.map((entry) => [entry.driveFileId, entry]));
  const driveIds = new Set(metaList.map((m) => m.id));
  const toDownload = [];
  const unchanged = [];

  for (const meta of metaList) {
    const cached = cacheByDriveId.get(meta.id);
    if (cached && cached.md5Checksum === meta.md5Checksum) {
      unchanged.push({ ...cached, fresh: false });
    } else {
      toDownload.push(meta);
    }
  }

  const deleted = cache.some((entry) => !driveIds.has(entry.driveFileId));
  return { toDownload, unchanged, deleted };
}

async function syncFolderWithCache(folderId, extension, cache, interactive = false) {
  const metaList = await listFilesMetadataInFolder(folderId, extension, interactive);
  const { toDownload, unchanged, deleted } = diffCacheWithMetadata(metaList, cache);

  let changed = deleted;
  const entries = [...unchanged];

  for (const meta of toDownload) {
    try {
      const content = await downloadFileById(meta.id, interactive);
      entries.push({ driveFileId: meta.id, name: meta.name, md5Checksum: meta.md5Checksum, content, fresh: true });
      changed = true;
    } catch {}
  }

  return { entries, changed };
}

// ── generic upsert / patch ────────────────────────────────────────────────────

// Overwrites an existing Drive file by ID — no name search needed.
async function patchFileById(fileId, content, fileName, mimeType = "application/xml", interactive = false) {
  const h = await authHeaders(interactive);
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify({ name: fileName })], { type: "application/json" }),
  );
  form.append("file", new Blob([content], { type: mimeType }));
  const res = await apiFetch(
    `${UPLOAD_API}/files/${fileId}?uploadType=multipart&fields=id,name,md5Checksum`,
    { method: "PATCH", headers: h, body: form },
  );
  if (!res.ok) {
    if (res.status === 403) revokeLocalToken();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || t("Erro ao salvar no Google Drive."));
  }
  return res.json();
}

async function saveFileToFolder(content, fileName, folderId, mimeType = "application/xml", interactive = false) {
  const h = await authHeaders(interactive);

  const q = encodeURIComponent(
    `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
  );
  const searchRes = await apiFetch(
    `${API}/files?q=${q}&fields=files(id)&spaces=drive`,
    { headers: h },
  );
  if (!searchRes.ok) {
    if (searchRes.status === 403) revokeLocalToken();
    throw new Error(t("Erro ao verificar arquivo no Google Drive."));
  }
  const searchData = await searchRes.json();
  const existing = searchData.files?.[0];

  const metadata = existing
    ? { name: fileName }
    : { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append("file", new Blob([content], { type: mimeType }));

  const uploadUrl = existing
    ? `${UPLOAD_API}/files/${existing.id}?uploadType=multipart&fields=id,md5Checksum`
    : `${UPLOAD_API}/files?uploadType=multipart&fields=id,md5Checksum`;

  const uploadRes = await apiFetch(uploadUrl, {
    method: existing ? "PATCH" : "POST",
    headers: h,
    body: form,
  });

  if (!uploadRes.ok) {
    if (uploadRes.status === 403) revokeLocalToken();
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || t("Erro ao salvar no Google Drive."));
  }

  // Return {id, md5Checksum} so callers can update their local cache entry
  return uploadRes.json();
}

async function loadSingleFile(folderId, fileName, interactive = false) {
  const h = await authHeaders(interactive);
  const q = encodeURIComponent(
    `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
  );
  const searchRes = await apiFetch(
    `${API}/files?q=${q}&fields=files(id)&spaces=drive`,
    { headers: h },
  );
  if (!searchRes.ok) return null;
  const file = (await searchRes.json()).files?.[0];
  if (!file) return null;
  const r = await apiFetch(`${API}/files/${file.id}?alt=media`, { headers: h });
  if (!r.ok) return null;
  return r.text();
}

// ── public API — recipes ──────────────────────────────────────────────────────

// cache: [{driveFileId, name, md5Checksum, content}] from localStorage
// Returns {entries, changed}
export async function syncRecipesFromDrive(cache, interactive = false) {
  const folderId = await resolveSubFolder(SUBFOLDER_RECIPES, interactive);
  return syncFolderWithCache(folderId, ".xml", cache, interactive);
}

// Saves a recipe and returns {driveFileId, md5Checksum} for cache update
export async function saveRecipeToDrive(xmlContent, fileName, interactive = false) {
  const folderId = await resolveSubFolder(SUBFOLDER_RECIPES, interactive);
  const result = await saveFileToFolder(xmlContent, fileName, folderId, "application/xml", interactive);
  return { driveFileId: result.id, md5Checksum: result.md5Checksum, name: fileName, content: xmlContent };
}

// ── public API — inventory ────────────────────────────────────────────────────

export async function saveInventoryToDrive(xmlContent, interactive = false) {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null, interactive);
  return saveFileToFolder(xmlContent, "inventory.xml", rootId, "application/xml", interactive);
}

// Diff-aware sync: returns {content, md5Checksum, changed}.
// cachedMd5 is the md5 stored locally from the last successful sync.
// When the remote md5 matches cachedMd5, content is null and changed is false.
export async function syncInventoryFromDrive(cachedMd5, interactive = false) {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null, interactive);
  const h = await authHeaders(interactive);
  const q = encodeURIComponent(
    `name='inventory.xml' and '${rootId}' in parents and trashed=false`,
  );
  const res = await apiFetch(
    `${API}/files?q=${q}&fields=files(id,md5Checksum)&spaces=drive`,
    { headers: h },
  );
  if (!res.ok) {
    if (res.status === 403) revokeLocalToken();
    throw new Error(t("Erro ao verificar inventário no Google Drive."));
  }
  const files = (await res.json()).files || [];
  if (!files.length) return { content: null, md5Checksum: null, changed: false };
  const { id, md5Checksum } = files[0];
  if (md5Checksum && md5Checksum === cachedMd5) {
    return { content: null, md5Checksum, changed: false };
  }
  const content = await downloadFileById(id, interactive);
  return { content, md5Checksum, changed: true };
}

export async function loadInventoryFromDrive(interactive = false) {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null, interactive);
  return loadSingleFile(rootId, "inventory.xml", interactive);
}

// Overwrites an existing Drive file by its known ID (used for in-place
// format conversion — replaces legacy BeerXML with native app format).
// Returns {driveFileId, name, md5Checksum}.
export async function overwriteDriveFile(driveFileId, content, fileName, interactive = false) {
  const result = await patchFileById(driveFileId, content, fileName, "application/xml", interactive);
  return { driveFileId: result.id, name: result.name, md5Checksum: result.md5Checksum };
}

// ── public API — equipment ────────────────────────────────────────────────────

// cache: [{driveFileId, name, md5Checksum, content}] from localStorage
export async function syncEquipmentsFromDrive(cache, interactive = false) {
  const folderId = await resolveSubFolder(SUBFOLDER_EQUIPMENTS, interactive);
  return syncFolderWithCache(folderId, ".xml", cache, interactive);
}

export async function saveEquipmentToDrive(xmlContent, profileId, interactive = false) {
  const folderId = await resolveSubFolder(SUBFOLDER_EQUIPMENTS, interactive);
  const fileName = `${profileId}.xml`;
  const result = await saveFileToFolder(xmlContent, fileName, folderId, "application/xml", interactive);
  return { driveFileId: result.id, md5Checksum: result.md5Checksum, name: fileName, content: xmlContent };
}

// ── public API — batches ──────────────────────────────────────────────────────

// cache: [{driveFileId, name, md5Checksum}] from localStorage
export async function syncBatchesFromDrive(cache, interactive = false) {
  const folderId = await resolveSubFolder(SUBFOLDER_BATCHES, interactive);
  return syncFolderWithCache(folderId, ".xml", cache, interactive);
}

export async function saveBatchToDrive(xmlContent, brewId, interactive = false) {
  const folderId = await resolveSubFolder(SUBFOLDER_BATCHES, interactive);
  const fileName = `${brewId}.xml`;
  const result = await saveFileToFolder(xmlContent, fileName, folderId, "application/xml", interactive);
  return { driveFileId: result.id, md5Checksum: result.md5Checksum, name: fileName, content: xmlContent };
}

// ── public API — bin (trash) ──────────────────────────────────────────────────

async function resolveBinSubFolder(subFolder, interactive = false) {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null, interactive);
  const binId = await findOrCreateFolderUnder(SUBFOLDER_BIN, rootId, interactive);
  return findOrCreateFolderUnder(subFolder, binId, interactive);
}

// Moves a Drive file to Beer Mother/bin/<subfolder> by updating its parents.
// subfolder should be SUBFOLDER_BIN_RECIPES or SUBFOLDER_BIN_EQUIPMENTS.
// Fire-and-forget: callers should not await — local deletion is already done.
export async function moveFileToBin(driveFileId, subfolder, interactive = false) {
  const h = await authHeaders(interactive);
  // Fetch the file's current parents
  const metaRes = await apiFetch(`${API}/files/${driveFileId}?fields=parents`, { headers: h });
  if (!metaRes.ok) {
    if (metaRes.status === 403) revokeLocalToken();
    throw new Error(t("Erro ao mover arquivo para a lixeira."));
  }
  const { parents } = await metaRes.json();
  const binFolderId = await resolveBinSubFolder(subfolder, interactive);
  const removeParents = (parents || []).join(",");
  const moveRes = await apiFetch(
    `${API}/files/${driveFileId}?addParents=${binFolderId}&removeParents=${removeParents}&fields=id`,
    { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: "{}" },
  );
  if (!moveRes.ok) {
    if (moveRes.status === 403) revokeLocalToken();
    throw new Error(t("Erro ao mover arquivo para a lixeira."));
  }
}

export const BIN_SUBFOLDER_RECIPES = SUBFOLDER_BIN_RECIPES;
export const BIN_SUBFOLDER_EQUIPMENTS = SUBFOLDER_BIN_EQUIPMENTS;

// ── misc ──────────────────────────────────────────────────────────────────────

export function hasDriveToken() {
  return hasValidToken() || loadPersistedToken();
}

// Returns true when the user has previously granted Drive access — even if the
// stored token is now expired.  Used as the guard for interactive operations so
// that an expired token triggers renewal instead of being silently skipped.
export function hasDriveCredential() {
  if (hasValidToken()) return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { access_token } = JSON.parse(raw);
    return !!access_token;
  } catch {
    return false;
  }
}
