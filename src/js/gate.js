const ACCESS_HASH="62ae4901700688eedfd031bdadef38aa8fcd619785e88be3442060394f026900",UNLOCK_KEY="beerSchool.receitasDinamicas.fable.betaUnlock.v1";async function sha256hex(e){const a=new TextEncoder().encode(e),t=await crypto.subtle.digest("SHA-256",a);return Array.from(new Uint8Array(t)).map(o=>o.toString(16).padStart(2,"0")).join("")}let booted=!1;async function boot(){if(booted)return;booted=!0;const e=document.getElementById("beta-gate");e&&e.remove(),await import("./main.js")}function renderGate(){const e=document.createElement("style");e.textContent=`
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
    #beta-gate .beta-err { min-height: 1em; font-size: .85rem; color: var(--danger, #c0392b); }`,document.head.appendChild(e);const a=document.createElement("div");a.id="beta-gate";const t=document.createElement("form");t.className="beta-card",t.autocomplete="off",t.innerHTML=`
    <h1>Acesso beta</h1>
    <p>Beer School \u2014 Receitas Din\xE2micas. Beta fechado: digite o c\xF3digo de acesso.</p>
    <input type="password" id="beta-code" placeholder="C\xF3digo de acesso" aria-label="C\xF3digo de acesso" autocomplete="off" />
    <div class="beta-err" id="beta-err" role="alert"></div>
    <button type="submit">Entrar</button>`,a.appendChild(t),document.body.appendChild(a);const o=t.querySelector("#beta-code"),r=t.querySelector("#beta-err");o.focus(),t.addEventListener("submit",async i=>{i.preventDefault(),r.textContent="";const n=await sha256hex(String(o.value||"").trim());if(n===ACCESS_HASH){try{localStorage.setItem(UNLOCK_KEY,n)}catch{}boot()}else r.textContent="C\xF3digo incorreto.",o.select()})}(function(){let e=!1;try{e=localStorage.getItem(UNLOCK_KEY)===ACCESS_HASH}catch{}e?boot():renderGate()})();
