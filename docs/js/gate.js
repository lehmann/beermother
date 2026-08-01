const GOOGLE_CLIENT_ID =
  "737027827720-hvm2q49b9cnojoe0voo8nlfu2ehhtdsd.apps.googleusercontent.com";

const ALLOWED_USERS_PATH = "allowed.users";
const SESSION_KEY = "beermother.gate.session.v1";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { emailHash, expiresAt } = JSON.parse(raw);
    if (!emailHash || Date.now() >= expiresAt) return null;
    return emailHash;
  } catch {
    return null;
  }
}

function saveSession(emailHash) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ emailHash, expiresAt: Date.now() + SESSION_TTL_MS }),
    );
  } catch {}
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

const GATE_LANG = (() => {
  const l = String(navigator.language || "").toLowerCase();
  return l.startsWith("es") ? "es" : l.startsWith("en") ? "en" : "pt";
})();

const GATE_TEXT = {
  pt: {
    title: "Beer Mother",
    intro: "Entre com a sua conta Google para continuar.",
    denied: "Acesso negado. Esta conta não está autorizada.",
    error: "Erro de autenticação. Tente novamente.",
  },
  en: {
    title: "Beer Mother",
    intro: "Sign in with your Google account to continue.",
    denied: "Access denied. This account is not authorized.",
    error: "Authentication error. Please try again.",
  },
  es: {
    title: "Beer Mother",
    intro: "Inicia sesión con tu cuenta de Google para continuar.",
    denied: "Acceso denegado. Esta cuenta no está autorizada.",
    error: "Error de autenticación. Inténtalo de nuevo.",
  },
}[GATE_LANG];

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;
  const gate = document.getElementById("google-gate");
  if (gate) gate.remove();
  await import("./main.js");
}

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

async function hashEmail(email) {
  const encoded = new TextEncoder().encode(email.toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchAllowedHashes() {
  const res = await fetch(ALLOWED_USERS_PATH, { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load allowed users list.");
  const text = await res.text();
  return text
    .split("\n")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function handleCredential(response) {
  const payload = decodeJwtPayload(response.credential);
  if (!payload || !payload.email) {
    showError(GATE_TEXT.error);
    return;
  }
  try {
    const [allowed, emailHash] = await Promise.all([
      fetchAllowedHashes(),
      hashEmail(payload.email),
    ]);
    if (allowed.includes(emailHash)) {
      saveSession(emailHash);
      await boot();
    } else {
      showError(GATE_TEXT.denied);
    }
  } catch {
    showError(GATE_TEXT.error);
  }
}

function showError(msg) {
  const el = document.getElementById("gate-err");
  if (el) el.textContent = msg;
}

function renderGate() {
  const style = document.createElement("style");
  style.textContent = `
    #google-gate {
      position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 24px;
      background: var(--bg, #faf7f2); color: var(--ink, #221a12);
      font-family: Inter, system-ui, -apple-system, sans-serif;
    }
    #google-gate .gate-card {
      width: 100%; max-width: 360px; display: grid; gap: 20px; padding: 32px 24px;
      background: var(--surface, #fff); border: 1px solid var(--line, #e7ddcf);
      border-radius: 16px; box-shadow: 0 14px 44px rgba(0,0,0,.14); text-align: center;
    }
    #google-gate h1 { margin: 0; font-size: 1.25rem; }
    #google-gate p  { margin: 0; font-size: .9rem; line-height: 1.4; color: var(--ink-soft, #6b5d49); }
    #google-gate .gate-btn-row { display: flex; justify-content: center; }
    #google-gate .gate-err { min-height: 1.2em; font-size: .85rem; color: var(--danger, #c0392b); }`;
  document.head.appendChild(style);

  const gate = document.createElement("div");
  gate.id = "google-gate";
  gate.innerHTML = `
    <div class="gate-card">
      <h1>${GATE_TEXT.title}</h1>
      <p>${GATE_TEXT.intro}</p>
      <div class="gate-btn-row" id="google-btn"></div>
      <div class="gate-err" id="gate-err" role="alert"></div>
    </div>`;
  document.body.appendChild(gate);
}

(async function () {
  // Resume a previously verified session without showing the gate.
  if (loadSession()) {
    await boot();
    return;
  }

  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  renderGate();

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: false,
    use_fedcm_for_prompt: true,
  });

  window.google.accounts.id.renderButton(
    document.getElementById("google-btn"),
    {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: 280,
    },
  );

  // Attempt One Tap (silently skipped if user dismissed it previously)
  window.google.accounts.id.prompt();
})();
