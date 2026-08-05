import {
  app as c,
  loadSettings as ot,
  saveSettings as ga,
  loadColorPalette as it,
  COLOR_PALETTES as st,
  saveTheme as lt,
  loadGuideLevel as ct,
  saveGuideLevel as dt,
  loadPhMode as ut,
  savePhMode as mt,
  loadPhAcidType,
  savePhAcidType,
  loadPhAcidConcentration as loadPhAcidConc,
  savePhAcidConcentration as savePhAcidConc,
  loadAnalysisBetaMode as va,
  saveAnalysisBetaMode as wa,
  APP_VERSION as bt,
  loadDriveEnabled as drvEnabled,
  saveDriveEnabled as drvSetEnabled,
  loadDriveFolderName as drvFolder,
  saveDriveFolderName as drvSetFolder,
  startRecipe as Me,
  writeAutosaveNow as Be,
} from "../state.js";
import { requestDriveAccess as drvAuth } from "../gdrive.js";
import {
  el as a,
  button as d,
  icon as R,
  toast as b,
  downloadTextFile as Ie,
  decimalInput as U,
} from "../ui.js";
import {
  LANGUAGES as Jt,
  getLanguage as Xt,
  setLanguage as Qt,
  t,
  fmt as P,
  formatVolume as z,
} from "../i18n.js";
import { PH_ACID_TYPES as ht } from "../ph.js";
import { parseBeerXml, sanitizeXmlText as It } from "../beerxml.js";
import {
  listProductionProfiles as X,
  saveProductionProfileEntry as ne,
  productionParamsFromImportedRecipe as Ft,
  draftFromRecipe,
  recipeFromDraft as Le,
  saveMyRecipe,
} from "../recipes.js";
import {
  openBrewSessionText as zt,
  isExpectedUnlocked as Ht,
  setExpectedUnlocked as Wt,
} from "../screens.js";
import { openSheet as I, closeSheet as h, confirmDialog } from "./sheets.js";
import { W, F } from "./shared-ui.js";
import {
  toNumber as m,
  round as T,
} from "../engine.js";

const Cn = {
    ambar: { label: "Cor padrão", swatch: "#c9701a" },
    beermother: { label: "Beermother Academy", swatch: "#ed6823" },
  },
  Tn = [
    { id: "auto", label: "Automático" },
    { id: "light", label: "Claro" },
    { id: "dark", label: "Escuro" },
  ],
  Nn = [
    { id: "essencial", label: "Essencial" },
    { id: "guia", label: "Guia" },
    { id: "copiloto", label: "Copiloto" },
  ],
  Mn = {
    essencial:
      "Só as leituras e correções — o app aparece onde é mais esperto que você.",
    guia: "Acompanha o dia da brassagem pela receita (o padrão).",
    copiloto:
      "Passo a passo, do preparo ao envase — com o porquê de cada passo.",
  };
function Bn(e) {
  lt(e);
  const o =
    c.theme === "light" || c.theme === "dark"
      ? c.theme
      : window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = o;
}
function ie(e, o, n) {
  return a("section", "settings-section", [
    a("div", "settings-head", [
      a("b", "settings-title", e),
      a("span", "settings-hint", o),
    ]),
    n,
  ]);
}
function driveSettingsBlock() {
  const e = drvEnabled(),
    o = drvFolder();
  let r = o;
  const n = d(
    e ? t("Ativado") : t("Desativado"),
    async () => {
      if (e) {
        (drvSetEnabled(!1), c.requestRender());
        return;
      }
      try {
        await drvAuth();
      } catch (s) {
        b(
          s.message || t("Não foi possível conectar ao Google Drive."),
          "error",
        );
        return;
      }
      (drvSetEnabled(!0), c.requestRender());
    },
    `btn small ${e ? "primary" : "ghost"}`,
    { "aria-pressed": e ? "true" : "false" },
  );
  if (!e) return a("div", "settings-toggle-row", [n]);
  const i = document.createElement("input");
  ((i.type = "text"),
    (i.value = r),
    (i.placeholder = "Beer Mother"),
    (i.className = "settings-input"),
    i.setAttribute("aria-label", t("Nome da pasta no Google Drive")),
    i.addEventListener("blur", () => {
      const s = i.value.trim();
      s && s !== r && ((r = s), drvSetFolder(s));
    }),
    i.addEventListener("keydown", (s) => {
      s.key === "Enter" && i.blur();
    }));
  return a("div", "settings-drive-block", [
    a("div", "settings-toggle-row", [n]),
    a("div", "settings-drive-folder", [
      a("span", "field-label", t("Pasta no Drive")),
      i,
    ]),
  ]);
}
export function openSettingsSheet() {
  const e = () => {
    const r = ot(),
      i = it(),
      s = Ht(),
      l = va(),
      u = a(
        "div",
        "seg-switch settings-seg",
        Tn.map((k) => {
          const B = (c.theme || "auto") === k.id;
          return d(
            t(k.label),
            () => {
              B || (Bn(k.id), n());
            },
            "seg-btn",
            { "aria-pressed": B ? "true" : "false" },
          );
        }),
      ),
      p = ct(),
      f = a(
        "div",
        "seg-switch settings-seg",
        Nn.map((k) => {
          const B = p === k.id;
          return d(
            t(k.label),
            () => {
              B || (dt(k.id), c.requestRender(), n());
            },
            "seg-btn",
            { "aria-pressed": B ? "true" : "false" },
          );
        }),
      ),
      E = a("div", "settings-guide", [
        f,
        a("p", "settings-hint settings-guide-desc", t(Mn[p] || "")),
      ]),
      y = { pt: "Português", en: "English", es: "Español" },
      g = a(
        "div",
        "seg-switch settings-seg",
        Jt.map((k) => {
          const B = Xt() === k;
          return d(
            y[k] || k,
            () => {
              B || (Qt(k), c.requestRender(), n());
            },
            "seg-btn",
            { "aria-pressed": B ? "true" : "false" },
          );
        }),
      ),
      q = W(
        r.authorName || "",
        (k) => {
          ga({ authorName: k.trim() });
        },
        {
          placeholder: t("Ex.: Lehmann"),
          "aria-label": t("Seu nome"),
          class: "settings-input",
        },
      ),
      N = st.map((k) => {
        const B = Cn[k] || { label: k, swatch: "#888888" },
          K = k === i,
          ue = a("span", "palette-dot");
        return (
          (ue.style.background = B.swatch),
          d(
            [
              ue,
              a("span", "palette-name", t(B.label)),
              K
                ? R("check", "icon palette-check")
                : a("span", "palette-check-slot"),
            ],
            () => {
              K ||
                (ga({ colorPalette: k }),
                (document.documentElement.dataset.palette = k),
                n());
            },
            `palette-btn ${K ? "active" : ""}`,
            { "aria-pressed": K ? "true" : "false" },
          )
        );
      }),
      v = d(
        s ? t("Ativada") : t("Desativada"),
        () => {
          (Wt(!s), c.requestRender(), n());
        },
        `btn small ${s ? "primary" : "ghost"}`,
        { "aria-pressed": s ? "true" : "false" },
      ),
      $ = d(
        l ? t("Ativada") : t("Desativada"),
        async () => {
          if (l) {
            (wa(!1),
              (c.analysisLoading = !1),
              c.view === "analysis" && (c.view = "editor"),
              c.requestRender(),
              n());
            return;
          }
          ((await confirmDialog({
            title: t("Ativar análise da receita em modo beta?"),
            message: t(
              "Este recurso está em fase de testes e pode errar. Ingredientes ainda não cadastrados, diferenças entre lotes, técnicas e condições de cada produção podem alterar bastante o resultado.",
            ),
            confirmLabel: t("Ativar mesmo assim"),
          })) && wa(!0),
            c.requestRender(),
            openSettingsSheet());
        },
        `btn small ${l ? "primary" : "ghost"}`,
        { "aria-pressed": l ? "true" : "false" },
      ),
      M = ut(),
      V = d(
        M ? t("Ativada") : t("Desativada"),
        () => {
          (mt(!M), c.requestRender(), n());
        },
        `btn small ${M ? "primary" : "ghost"}`,
        { "aria-pressed": M ? "true" : "false" },
      ),
      w = loadPhAcidType(),
      L = M
        ? a(
            "div",
            "seg-switch settings-seg",
            ht.map((k) => {
              const B = w === k.type;
              return d(
                t(k.short),
                () => {
                  B || (savePhAcidType(k.type), c.requestRender(), n());
                },
                "seg-btn",
                { "aria-pressed": B ? "true" : "false" },
              );
            }),
          )
        : null,
      acidTypeDef = ht.find((k) => k.type === w) || ht[0],
      acidConcBlock = M
        ? a("div", "settings-acid-conc", [
            a("span", "field-label", t("Concentração")),
            U(
              loadPhAcidConc(w),
              (B) => {
                (savePhAcidConc(
                  w,
                  B === "" ? acidTypeDef.defaultConcentration : B,
                ),
                  c.requestRender());
              },
              {
                "aria-label": t("Concentração do {acid}", {
                  acid: t(acidTypeDef.label),
                }),
                class: "settings-input settings-acid-input",
              },
            ),
            a("span", "settings-acid-unit", "%"),
          ])
        : null,
      x = a("div", "settings-guide", [
        a("div", "settings-toggle-row", [V]),
        L,
        acidConcBlock,
        M
          ? a(
              "p",
              "settings-hint settings-guide-desc",
              t(
                "Cards opcionais no dia: trate as águas, confira a mostura, registre a fervura. O app aprende quanto ácido a SUA água pede — sem fórmula.",
              ),
            )
          : null,
      ]),
      ae = a("div", "settings-appearance", [u, a("div", "palette-row", N)]);
    return [
      a("b", "sheet-title", t("Configurações")),
      a("div", "sheet-fields settings-scroll", [
        ie(
          t("Seu nome"),
          t("Entra automático como autor nas receitas novas."),
          q,
        ),
        ie(
          t("Idioma"),
          t(
            "Português é o idioma de referência; English e Español em tradução.",
          ),
          g,
        ),
        ie(
          t("Aparência"),
          t("Tema e cor do app — valem no claro e no escuro."),
          ae,
        ),
        a("p", "settings-group-title", t("Ferramentas em desenvolvimento")),
        ie(t("Guia"), t("Quanta companhia durante a brassagem."), E),
        ie(
          t("Água e pH"),
          t(
            "Medição de pH no dia de brassagem, com dose de ácido sugerida.",
          ),
          x,
        ),
        ie(
          t("Previsão de fermentação"),
          t("A curva esperada e as faixas durante a fermentação."),
          a("div", "settings-toggle-row", [v]),
        ),
        ie(
          t("Análise da receita (beta)"),
          t(
            "Simula tendências de aroma e sabor. O botão só aparece no editor quando este modo está ativo.",
          ),
          a("div", "settings-toggle-row", [$]),
        ),
        ie(
          t("Google Drive"),
          t(
            "Salva cada receita individualmente como um .xml em uma pasta no seu Google Drive.",
          ),
          driveSettingsBlock(),
        ),
        a(
          "p",
          "settings-version",
          t("Beermother · Fable — v{v}", { v: bt }),
        ),
      ]),
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
    ];
  };
  let o = I(e(), "details settings-sheet");
  function n() {
    const r = o.querySelector(".settings-scroll")?.scrollTop || 0;
    ((o.innerHTML = ""),
      e()
        .flat()
        .filter(Boolean)
        .forEach((s) => o.append(s)));
    const i = o.querySelector(".settings-scroll");
    i && (i.scrollTop = r);
  }
}
export function openBackupSheet() {
  I(
    [
      a("b", "sheet-title", t("Backup")),
      a(
        "p",
        "sheet-message",
        t(
          "Seus dados ficam neste navegador. O backup gera um arquivo .json com tudo (receitas, brassagens, perfis) — restaure aqui ou em outro dispositivo.",
        ),
      ),
      a("div", "sheet-stack", [
        d(
          t("Fazer backup"),
          () => {
            (h(), On());
          },
          "btn primary",
        ),
        d(
          t("Restaurar backup"),
          () => {
            (h(), openImportPicker());
          },
          "btn",
        ),
      ]),
      a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
    ],
    "details",
  );
}
const $a = "beermother-backup",
  Ia = "beermother";
function On() {
  const e = {};
  for (let n = 0; n < localStorage.length; n += 1) {
    const r = localStorage.key(n);
    r && r.startsWith(Ia) && (e[r] = localStorage.getItem(r));
  }
  const o = new Date().toISOString().slice(0, 10);
  (Ie(
    JSON.stringify(
      { kind: $a, version: 1, savedAt: new Date().toISOString(), data: e },
      null,
      2,
    ),
    `receitas-dinamicas-backup-${o}.json`,
    "application/json;charset=utf-8",
  ),
    b(t("Backup exportado — guarde o arquivo em lugar seguro.")));
}
async function Gn(e) {
  const o = Object.entries(e.data || {}).filter(
    ([r, i]) => r.startsWith(Ia) && typeof i == "string",
  );
  if (!o.length) {
    b(t("Backup vazio ou inválido."), "error");
    return;
  }
  (await confirmDialog({
    title: t("Restaurar backup?"),
    message: t(
      "Receitas, perfis, histórico e biblioteca atuais serão substituídos pelos do arquivo.",
    ),
    confirmLabel: "Restaurar",
    danger: !0,
  })) &&
    (o.forEach(([r, i]) => {
      try {
        localStorage.setItem(r, i);
      } catch {}
    }),
    b(t("Backup restaurado.")),
    c.requestRender());
}
let G = null;
export function openImportPicker() {
  (G ||
    ((G = document.createElement("input")),
    (G.type = "file"),
    (G.accept =
      ".xml,.beerxml,.json,text/xml,application/xml,application/json"),
    (G.hidden = !0),
    G.setAttribute("data-purpose", "home-import"),
    G.addEventListener("change", async () => {
      const e = G.files && G.files[0];
      if (e)
        try {
          await Vn(await e.text(), e.name);
        } catch (o) {
          b(o.message || t("Não foi possível ler o arquivo."), "error");
        } finally {
          G.value = "";
        }
    }),
    document.body.append(G)),
    (G.value = ""),
    G.click());
}
async function Vn(e, o) {
  const n = String(e || "").trim();
  if (n.startsWith("{")) {
    let s = null;
    try {
      s = JSON.parse(n);
    } catch {}
    if (s && s.kind === $a) {
      await Gn(s);
      return;
    }
    await zt(n);
    return;
  }
  const r = parseBeerXml(e),
    i = Rn(e);
  _n(r, i, o);
}
function Un(e) {
  const o = (n, r, i) => Math.abs(m(n) - m(r)) <= i;
  return (
    X().find(
      (n) =>
        o(n.params.targetVolumeL, e.targetVolumeL, 0.05) &&
        o(n.params.mashEfficiencyPct, e.mashEfficiencyPct, 0.15) &&
        o(n.params.evaporationPct, e.evaporationPct, 0.15) &&
        o(n.params.trubLossPct, e.trubLossPct, 0.002),
    ) || null
  );
}
function _n(e, o, n) {
  const r = { recipeSaved: !1, profileSaved: "" },
    i = [e.styleName || t("Estilo próprio"), z(m(e.batchVolumeL, 20), 0)];
  (m(e.og) > 1 && i.push(`OG ${Number(m(e.og)).toFixed(3)}`),
    m(e.ibu) > 0 && i.push(`${P(m(e.ibu), 0)} IBU`));
  const s = () => {
      const p = o.hasEquipmentBlock ? Un(o.params) : null,
        f = a("div", "import-section", [
          a("span", "import-section-title", t("Receita")),
          a("b", "import-item-name", e.name || t("Receita importada")),
          a("p", "sheet-message", i.join(" · ")),
          a("div", "sheet-stack", [
            r.recipeSaved
              ? d(t("Salva em Minhas receitas ✓"), () => {}, "btn", {
                  disabled: "disabled",
                })
              : d(
                  t("Salvar em Minhas receitas"),
                  () => {
                    saveMyRecipe(draftFromRecipe(e))
                      ? ((r.recipeSaved = !0),
                        b(
                          t(
                            "Receita salva — dá para editar e brassar quando quiser.",
                          ),
                        ),
                        u(),
                        c.requestRender())
                      : b(
                          t("Não foi possível salvar a receita."),
                          "error",
                        );
                  },
                  "btn primary",
                ),
            d(
              t("Brassar agora"),
              () => {
                (h(),
                  Be(),
                  Me(e, n || "BeerXML"),
                  (c.view = "brew"),
                  (c.phase = "prepare"),
                  c.requestRender(),
                  b(t('Brassagem de "{name}" iniciada.', { name: e.name })),
                  window.scrollTo({ top: 0, behavior: "instant" }));
              },
              "btn",
            ),
          ]),
        ]),
        E = o.hasEquipmentBlock
          ? a("div", "import-section", [
              a("span", "import-section-title", t("Equipamento")),
              a("b", "import-item-name", o.name),
              p
                ? a(
                    "p",
                    "muted import-note",
                    t('Igual ao perfil "{name}" — nada novo a importar.', {
                      name: p.name,
                    }),
                  )
                : r.profileSaved
                  ? d(
                      t('Perfil "{name}" salvo ✓', {
                        name: r.profileSaved,
                      }),
                      () => {},
                      "btn",
                      { disabled: "disabled" },
                    )
                  : d(
                      t("Importar como perfil de equipamento"),
                      () => {
                        const y = ne({ name: o.name, params: o.params });
                        y
                          ? ((r.profileSaved = y.name),
                            b(
                              t('Perfil "{name}" salvo em Equipamentos.', {
                                name: y.name,
                              }),
                            ),
                            u(),
                            c.requestRender())
                          : b(
                              t("Não foi possível salvar o perfil."),
                              "error",
                            );
                      },
                      "btn",
                    ),
            ])
          : null;
      return [
        a("b", "sheet-title", t("Importar do BeerXML")),
        n ? a("p", "sheet-message import-file", n) : null,
        f,
        E,
        a("div", "sheet-actions", [d(t("Fechar"), () => h(), "btn ghost")]),
      ];
    },
    l = I(s().flat().filter(Boolean), "details");
  function u() {
    ((l.innerHTML = ""),
      s()
        .flat()
        .filter(Boolean)
        .forEach((p) => l.append(p)));
  }
}
function Rn(e) {
  const o = parseBeerXml(e);
  let n = "",
    r = null,
    i = !1;
  try {
    const l = new DOMParser()
      .parseFromString(It(e), "text/xml")
      .getElementsByTagName("EQUIPMENT")[0];
    if (l) {
      ((i = !0),
        (n = l.getElementsByTagName("NAME")[0]?.textContent?.trim() || ""));
      for (const u of [
        "LAUTER_DEADSPACE",
        "TUN_DEADSPACE",
        "MASH_TUN_DEADSPACE",
      ]) {
        const p = l.getElementsByTagName(u)[0],
          f = p ? Number(String(p.textContent).trim().replace(",", ".")) : NaN;
        if (Number.isFinite(f) && f >= 0) {
          r = f;
          break;
        }
      }
    }
  } catch {}
  return {
    name: n || `Equipamento · ${o.name || "importado"}`,
    recipeName: o.name || t("Receita importada"),
    hasEquipmentBlock: i,
    params: Ft(o, { deadSpaceL: r }),
  };
}
