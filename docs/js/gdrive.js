import { t } from "./i18n.js";
import { loadDriveFolderName } from "./state.js";

const CLIENT_ID =
  "737027827720-hvm2q49b9cnojoe0voo8nlfu2ehhtdsd.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const STORAGE_KEY = "beermother.drive.token.v1";

let _tokenClient = null;
let _token = null;       // in-memory cache
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
    // "consent" (not "select_account") forces Google to re-show the consent
    // screen so a newly-added scope is actually granted. With a prior grant for
    // this client, "select_account" would silently reissue a token carrying only
    // the previously-consented scope, causing 403 on drive-scope API calls.
    _tokenClient = buildTokenClient("consent");
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

  // 1. In-memory token still valid.
  if (hasValidToken()) return _token;

  // 2. Persisted token in localStorage still valid.
  if (loadPersistedToken()) return _token;

  // 3. No valid token — ask the user to authenticate interactively.
  return await requestTokenInteractive();
}

async function authHeaders() {
  if (!hasValidToken()) await requestDriveAccess();
  return { Authorization: `Bearer ${_token.access_token}` };
}

async function apiFetch(url, options = {}) {
  return fetch(url, options);
}

async function findOrCreateFolder(name) {
  const h = await authHeaders();
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const searchRes = await apiFetch(
    `${API}/files?q=${q}&fields=files(id)&spaces=drive`,
    { headers: h },
  );
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files?.length > 0) return data.files[0].id;
  } else if (searchRes.status !== 403) {
    throw new Error(t("Erro ao buscar pasta no Google Drive."));
  }

  const createRes = await apiFetch(`${API}/files`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) throw new Error(t("Erro ao criar pasta no Google Drive."));

  const folder = await createRes.json();
  return folder.id;
}

async function doSave(xmlContent, fileName) {
  const folderName = loadDriveFolderName();
  const folderId = await findOrCreateFolder(folderName);
  const h = await authHeaders();

  const q = encodeURIComponent(
    `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
  );
  const searchRes = await apiFetch(
    `${API}/files?q=${q}&fields=files(id)&spaces=drive`,
    { headers: h },
  );
  if (!searchRes.ok) throw new Error(t("Erro ao verificar arquivo no Google Drive."));
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
  form.append("file", new Blob([xmlContent], { type: "application/xml" }));

  const url = existing
    ? `${UPLOAD_API}/files/${existing.id}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`;

  const uploadRes = await apiFetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: h,
    body: form,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || t("Erro ao salvar no Google Drive."));
  }

  return uploadRes.json();
}

export async function saveRecipeToDrive(xmlContent, fileName) {
  return doSave(xmlContent, fileName);
}
