import { t } from "./i18n.js";
import { loadDriveFolderName } from "./state.js";

const CLIENT_ID =
  "737027827720-hvm2q49b9cnojoe0voo8nlfu2ehhtdsd.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

let _tokenClient = null;
let _token = null;
let _tokenExpiry = 0;
let _scopeGranted = false; // true only after user explicitly consented to drive.file this session
let _pendingResolve = null;
let _pendingReject = null;

function hasValidToken() {
  return !!(_token && Date.now() < _tokenExpiry - 30000);
}

// Clears the local token so the next requestDriveAccess call forces a new consent screen.
function revokeLocalToken() {
  _token = null;
  _tokenExpiry = 0;
  _scopeGranted = false;
}

function getTokenClient() {
  if (_tokenClient) return _tokenClient;
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error) {
        const err = new Error(
          resp.error_description || t("Acesso ao Google Drive negado."),
        );
        _pendingReject?.(err);
      } else {
        _token = resp;
        _tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        _scopeGranted = true;
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
  return _tokenClient;
}

export function requestDriveAccess() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error(t("Google Identity Services não disponível.")));
      return;
    }
    if (hasValidToken()) {
      resolve(_token);
      return;
    }
    _pendingResolve = resolve;
    _pendingReject = reject;
    // Use "consent" until the user has explicitly granted drive.file this session.
    // This is necessary because the app reuses the same CLIENT_ID for the sign-in
    // gate: without "consent", Google silently returns a token that lacks the
    // drive.file scope, causing 403 on all Drive API calls.
    getTokenClient().requestAccessToken({
      prompt: _scopeGranted ? "" : "consent",
    });
  });
}

async function authHeaders() {
  if (!hasValidToken()) await requestDriveAccess();
  return { Authorization: `Bearer ${_token.access_token}` };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 403) {
    revokeLocalToken();
    throw new Error(t("Acesso ao Google Drive negado. Tente salvar novamente para reconectar."));
  }
  return res;
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
  if (!searchRes.ok) throw new Error(t("Erro ao buscar pasta no Google Drive."));

  const data = await searchRes.json();
  if (data.files?.length > 0) return data.files[0].id;

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

export async function saveRecipeToDrive(xmlContent, fileName) {
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
