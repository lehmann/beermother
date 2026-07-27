const SESSION_ENDPOINT = "/api/beta/session",
    GATE_LANG = (() => {
        const e = String(navigator.language || "").toLowerCase();
        return e.startsWith("es") ? "es" : e.startsWith("en") ? "en" : "pt"
    })(),
    GATE_TEXT = {
        pt: {
            title: "Acesso beta",
            intro: "Beer School \u2014 Receitas Din\xE2micas. Beta fechado: digite o c\xF3digo de acesso.",
            code: "C\xF3digo de acesso",
            enter: "Entrar",
            wrong: "C\xF3digo incorreto."
        },
        en: {
            title: "Beta access",
            intro: "Beer School \u2014 Dynamic Recipes. Closed beta: enter your access code.",
            code: "Access code",
            enter: "Enter",
            wrong: "Incorrect code."
        },
        es: {
            title: "Acceso beta",
            intro: "Beer School \u2014 Recetas Din\xE1micas. Beta cerrada: escribe el c\xF3digo de acceso.",
            code: "C\xF3digo de acceso",
            enter: "Entrar",
            wrong: "C\xF3digo incorrecto."
        }
    }[GATE_LANG];
let booted = !1;
async function boot() {
    if (booted) return;
    booted = !0;
    const e = document.getElementById("beta-gate");
    e && e.remove(), await
    import ("./main.js")
}

function renderGate() {
    const e = document.createElement("style");
    e.textContent = `
    #beta-gate { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 24px;
      background: var(--bg, #faf7f2); color: var(--ink, #221a12);
      font-family: Inter, system-ui, -apple-system, sans-serif; }
    #beta-gate .beta-card { width: 100%; max-width: 360px; display: grid; gap: 14px; padding: 28px 24px;
      background: var(--surface, #fff); border: 1px solid var(--line, #e7ddcf);
      border-radius: 16px; box-shadow: 0 14px 44px rgba(0,0,0,.14); }
    #beta-gate h1 { margin: 0; font-size: 1.25rem; }
    #beta-gate p { margin: 0; font-size: .9rem; line-height: 1.4; color: var(--ink-soft, #6b5d49); }
    #beta-gate input { width: 100%; box-sizing: border-box; padding: 11px 12px; font: inherit;
      border: 1px solid var(--line-strong, #d8ccb8); border-radius: 10px;
      background: var(--surface, #fff); color: inherit; }
    #beta-gate button { width: 100%; padding: 11px 12px; font: inherit; font-weight: 650; cursor: pointer;
      border: 0; border-radius: 10px; background: var(--accent, #c9701a); color: #fff; }
    #beta-gate .beta-err { min-height: 1em; font-size: .85rem; color: var(--danger, #c0392b); }`, document.head.appendChild(e);
    const o = document.createElement("div");
    o.id = "beta-gate";
    const t = document.createElement("form");
    t.className = "beta-card", t.autocomplete = "off", t.innerHTML = `
    <h1>${GATE_TEXT.title}</h1>
    <p>${GATE_TEXT.intro}</p>
    <input type="password" id="beta-code" placeholder="${GATE_TEXT.code}" aria-label="${GATE_TEXT.code}" autocomplete="off" />
    <div class="beta-err" id="beta-err" role="alert"></div>
    <button type="submit">${GATE_TEXT.enter}</button>`, o.appendChild(t), document.body.appendChild(o);
    const r = t.querySelector("#beta-code"),
        a = t.querySelector("#beta-err");
    r.focus(), t.addEventListener("submit", async i => {
        i.preventDefault(), a.textContent = "";
        let n;
        try {
            n = await fetch(SESSION_ENDPOINT, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    code: String(r.value || "").trim()
                })
            })
        } catch {
            a.textContent = GATE_TEXT.wrong;
            return
        }
        n.ok ? boot() : (a.textContent = GATE_TEXT.wrong, r.select())
    })
}(async function() {
    try {
        const e = await fetch(SESSION_ENDPOINT, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });
        if (e.ok && (await e.json()).ok) {
            await boot();
            return
        }
    } catch {}
    renderGate()
})();