# Beermother — Guia do projeto para Claude

## O que é este projeto

**Beermother** é um assistente de cerveja artesanal. É uma SPA estática em português brasileiro, servida via GitHub Pages (`https://lehmann.github.io`). Não há servidor de aplicação — todo o estado do usuário fica no `localStorage` do navegador.

---

## Estrutura de diretórios

```
beermother/
├── docs/                   ← raiz do site estático (o que é servido)
│   ├── index.html          ← HTML raiz; carrega gate.js como módulo
│   ├── allowed.users       ← lista de hashes SHA-256 de e-mails autorizados
│   ├── js/                 ← todos os módulos ES da aplicação (sem bundler)
│   ├── css/                ← folhas de estilo (tokens, app, screens, editor, analysis)
│   ├── assets/             ← fontes Inter auto-hospedadas
│   └── api/beta/           ← endpoint de saúde ({"ok":true})
├── recipes/                ← arquivos BeerXML do desenvolvedor (~40 receitas)
├── analyzer/               ← scripts Python offline de simulação de cerveja
└── data/                   ← scripts Python de extração de dados / CSV
```

---

## Módulos JavaScript principais (`docs/js/`)

O app usa **ES modules nativos** — sem bundler, sem framework. Cada arquivo é um módulo com `import`/`export` explícitos. Os arquivos são leve e manualmente minificados (nomes de variáveis curtos, sem espaços).

| Arquivo | Responsabilidade |
|---|---|
| `gate.js` | Tela de login Google (GSI One Tap). Só carrega `main.js` após verificar o hash do e-mail contra `allowed.users`. |
| `main.js` | Ponto de entrada da app após o gate. Monta o shell (header, sidebar, nav de fases), gerencia o loop de render e o timer. |
| `state.js` | Estado global (`app`), todas as funções de `localStorage` (receitas, brassagens, configurações, autosave). |
| `engine.js` | Cálculos puros de cerveja (OG, FG, IBU, ABV, volumes, água). Sem efeitos colaterais. |
| `recipes.js` | CRUD de receitas (`listMyRecipes`, `saveMyRecipe`, `deleteMyRecipe`), perfis de equipamento, biblioteca de ingredientes do usuário, exportação BeerXML. |
| `editor.js` | Tela completa do editor de receitas, tela inicial (workspace), tela de log de brassagens e painel de configurações. Arquivo maior do projeto. |
| `screens.js` | Renderização das fases da brassagem (preparo, mostura, fervura, fermentação, resumo). |
| `beerxml.js` | Parser BeerXML (`parseBeerXml`) e sanitizador. |
| `i18n.js` | Função `t()` de tradução, locales em `locales/{pt,en,es}.js`. |
| `ui.js` | Helpers DOM: `el()`, `button()`, `iconButton()`, `toast()`, `downloadTextFile()`, etc. |
| `guide.js` | Lógica do guia passo a passo (modo copiloto). |
| `timer.js` | Cronômetro de mostura/fervura. |
| `ph.js` | Cálculos de pH e ácidos. |
| `analysis-screen.js` | Tela de análise sensorial (beta). Faz POST para `/api/analyze-recipe`. |
| `report.js` | Geração do relatório de brassagem para impressão. |
| `gdrive.js` | Integração com Google Drive (OAuth2 + upload de receitas como `.xml`). |
| `library.js` | Catálogo de maltes, lúpulos, leveduras, estilos BJCP. |
| `calibration.js` | Geração da brassagem de calibração de equipamento. |
| `chart.js` | Gráfico da curva de fermentação. |

---

## Fluxo de autenticação

1. `gate.js` carrega o Google Identity Services (GSI).
2. O usuário faz login com Google; o payload JWT é decodificado no cliente.
3. O e-mail é convertido em SHA-256 e comparado com `allowed.users`.
4. Se autorizado, `main.js` é importado dinamicamente e a app inicializa.

O **mesmo** Client ID Google (`737027827720-...`) é reutilizado para o login do gate e para o OAuth2 do Google Drive (escopo `drive.file`). O Drive usa `google.accounts.oauth2.initTokenClient` com fluxo implícito — não persiste refresh token.

---

## Persistência de dados

Tudo fica no `localStorage` do navegador. Chaves relevantes:

| Chave | Conteúdo |
|---|---|
| `beermother.fable.myRecipes.v1` | Receitas salvas do usuário |
| `beermother.fable.brews.v1` | Registro de brassagens |
| `beermother.fable.activeSession.v1` | Autosave da brassagem ativa |
| `beermother.fable.settings.v1` | Configurações do usuário (inclui `driveEnabled`, `driveFolderName`) |
| `beermother.productionProfile.v1` | Perfil de equipamento ativo |
| `beermother.fable.productionProfiles.v1` | Todos os perfis de equipamento |
| `beermother.fable.userLibrary.v1` | Biblioteca pessoal de ingredientes |

Funções de acesso ficam em `state.js`. O padrão é `loadX()` / `saveX()` — sempre lendo do storage para evitar estado desincronizado.

---

## Renderização

Não há framework reativo. O ciclo é:

1. Algum evento (clique, timer, importação) muta o objeto `app` em `state.js`.
2. Chama `app.requestRender()` (apontado para `render()` em `main.js`).
3. `render()` limpa o `<main>` e reconstrói o DOM chamando as funções de tela (`editorScreen()`, `workspaceScreen()`, etc.).

Sheets (painéis modais) usam `I()` em `editor.js` — criam um overlay fixo com `fable-overlay` + `fable-sheet`. Só um sheet por vez. Fechar com `h()`.

---

## Internacionalização

```js
import { t } from "./i18n.js";
t("Texto em português")          // retorna tradução para o idioma atual
t("Olá {name}", { name: "Ana" }) // com interpolação
```

Idioma padrão: `pt`. Arquivos de locale em `docs/js/locales/`. Ao adicionar strings novas, adicione também nos três locales.

---

## Integração com Google Drive (`gdrive.js`)

- Ativada nas Configurações → Google Drive.
- Usa escopo `https://www.googleapis.com/auth/drive.file` (acesso apenas a arquivos criados pelo app).
- O token OAuth2 é armazenado apenas em memória (variável `_token`). Expira em ~1 hora.
- `saveRecipeToDrive(xmlContent, fileName)` → busca/cria a pasta configurada → faz upsert do arquivo.
- O nome da pasta padrão é `"Beer Mother"`, configurável pelo usuário.
- O botão "Salvar no Drive" aparece no editor apenas quando `loadDriveEnabled()` retorna `true`.

---

## Scripts Python (ferramentas offline)

Não fazem parte do servidor web. São utilitários de desenvolvimento:

| Arquivo | Uso |
|---|---|
| `analyzer/beer_simulator.py` | Simula propriedades de receitas; lê `request.json`, escreve `response.json`. |
| `data/data_extractor.py` | Extrai dados das receitas XML para CSV. |
| `data/json_flatter.py` | Achata JSON para CSV. |
| `recipes/files.py` | Cria diretórios e stubs JSON em `analyzer/simulation/` para cada receita `.xml`. |

---

## Convenções de código

- **Sem bundler**: arquivos servidos diretamente; alterações em `docs/js/` e `docs/css/` têm efeito imediato.
- **Minificação manual**: o código de produção usa nomes curtos de variáveis nos imports (`as Qa`, `as bt`, etc.). Ao editar, preserve o padrão — não renomeie aliases existentes.
- **`null` é válido nos arrays de UI**: as funções de render retornam `null` para elementos condicionais; o código de montagem usa `.filter(Boolean)` antes de `appendChild`.
- **Sem comentários desnecessários**: o código original não tem comentários; siga o mesmo padrão.
- **CSS em linha única**: os arquivos CSS de produção são minificados em uma linha. Adicione regras novas ao final antes do último `}` ou após o último seletor.
- **Versionamento de imports**: `main.js` importa alguns módulos com query string (`?v=beta44-release1`). Ao alterar `editor.js` ou `analysis-screen.js` em releases, atualize esse sufixo.
