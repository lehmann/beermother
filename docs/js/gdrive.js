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
let _pendingResolve = null;
let _pendingReject = null;

function hasValidToken() {
  return !!(_token && Date.now() < _tokenExpiry - 30000);
}

function revokeLocalToken() {
  _token = null;
  _tokenExpiry = 0;
  // Force a new token client on the next request so the prompt is shown fresh.
  _tokenClient = null;
}

function buildTokenClient(prompt) {
  return window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    prompt,
    callback: (resp) => {
      if (resp.error) {
        const err = new Error(
          resp.error_description || resp.error || t("Acesso ao Google Drive negado."),
        );
        _pendingReject?.(err);
      } else {
        _token = resp;
        _tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
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
    // Always use "select_account" so the user explicitly picks the account and
    // consents to the drive.file scope. Using "" or "consent" with FedCM active
    // (gate.js sets use_fedcm_for_prompt: true) causes the token flow to fail
    // silently or return access_denied.
    if (!_tokenClient) _tokenClient = buildTokenClient("select_account");
    _tokenClient.requestAccessToken({});
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
