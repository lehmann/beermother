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

function requestTokenInteractive() {
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

export async function requestDriveAccess() {
  await waitForGsi();
  if (hasValidToken()) return _token;
  if (loadPersistedToken()) return _token;
  return await requestTokenInteractive();
}

async function authHeaders() {
  if (!hasValidToken()) await requestDriveAccess();
  return { Authorization: `Bearer ${_token.access_token}` };
}

async function apiFetch(url, options = {}) {
  return fetch(url, options);
}

// ── folder helpers ────────────────────────────────────────────────────────────

async function findOrCreateFolderUnder(name, parentId) {
  const h = await authHeaders();
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

async function resolveSubFolder(subFolder) {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null);
  return findOrCreateFolderUnder(subFolder, rootId);
}

// ── file primitives ───────────────────────────────────────────────────────────

// Single metadata-only listing — one API call, no content download.
async function listFilesMetadataInFolder(folderId, extension) {
  const h = await authHeaders();
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

async function downloadFileById(fileId) {
  const h = await authHeaders();
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
async function syncFolderWithCache(folderId, extension, cache) {
  const metaList = await listFilesMetadataInFolder(folderId, extension);
  const cacheByDriveId = new Map(cache.map((entry) => [entry.driveFileId, entry]));
  const driveIds = new Set(metaList.map((m) => m.id));

  let changed = false;
  const entries = [];

  for (const meta of metaList) {
    const cached = cacheByDriveId.get(meta.id);
    if (cached && cached.md5Checksum === meta.md5Checksum) {
      entries.push({ ...cached, fresh: false });
    } else {
      try {
        const content = await downloadFileById(meta.id);
        entries.push({ driveFileId: meta.id, name: meta.name, md5Checksum: meta.md5Checksum, content, fresh: true });
        changed = true;
      } catch {}
    }
  }

  // Detect deletions
  if (!changed && cache.some((entry) => !driveIds.has(entry.driveFileId))) {
    changed = true;
  }

  return { entries, changed };
}

// ── generic upsert ────────────────────────────────────────────────────────────

async function saveFileToFolder(content, fileName, folderId, mimeType = "application/xml") {
  const h = await authHeaders();

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

async function loadSingleFile(folderId, fileName) {
  const h = await authHeaders();
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
export async function syncRecipesFromDrive(cache) {
  const folderId = await resolveSubFolder(SUBFOLDER_RECIPES);
  return syncFolderWithCache(folderId, ".xml", cache);
}

// Saves a recipe and returns {driveFileId, md5Checksum} for cache update
export async function saveRecipeToDrive(xmlContent, fileName) {
  const folderId = await resolveSubFolder(SUBFOLDER_RECIPES);
  const result = await saveFileToFolder(xmlContent, fileName, folderId);
  return { driveFileId: result.id, md5Checksum: result.md5Checksum, name: fileName, content: xmlContent };
}

// ── public API — inventory ────────────────────────────────────────────────────

export async function saveInventoryToDrive(xmlContent) {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null);
  return saveFileToFolder(xmlContent, "inventory.xml", rootId);
}

export async function loadInventoryFromDrive() {
  const rootName = loadDriveFolderName();
  const rootId = await findOrCreateFolderUnder(rootName, null);
  return loadSingleFile(rootId, "inventory.xml");
}

// ── public API — equipment ────────────────────────────────────────────────────

// cache: [{driveFileId, name, md5Checksum, content}] from localStorage
export async function syncEquipmentsFromDrive(cache) {
  const folderId = await resolveSubFolder(SUBFOLDER_EQUIPMENTS);
  return syncFolderWithCache(folderId, ".json", cache);
}

export async function saveEquipmentToDrive(profile) {
  const folderId = await resolveSubFolder(SUBFOLDER_EQUIPMENTS);
  const fileName = `${profile.id}.json`;
  const result = await saveFileToFolder(JSON.stringify(profile), fileName, folderId, "application/json");
  return { driveFileId: result.id, md5Checksum: result.md5Checksum, name: fileName, content: JSON.stringify(profile) };
}

// ── public API — batches ──────────────────────────────────────────────────────

// cache: [{driveFileId, name, md5Checksum, content}] from localStorage
export async function syncBatchesFromDrive(cache) {
  const folderId = await resolveSubFolder(SUBFOLDER_BATCHES);
  return syncFolderWithCache(folderId, ".json", cache);
}

export async function saveBatchToDrive(brewEntry) {
  const folderId = await resolveSubFolder(SUBFOLDER_BATCHES);
  const fileName = `${brewEntry.id}.json`;
  const result = await saveFileToFolder(JSON.stringify(brewEntry), fileName, folderId, "application/json");
  return { driveFileId: result.id, md5Checksum: result.md5Checksum, name: fileName, content: JSON.stringify(brewEntry) };
}

// ── misc ──────────────────────────────────────────────────────────────────────

export function hasDriveToken() {
  return hasValidToken() || loadPersistedToken();
}
