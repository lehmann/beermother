# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Beermother — Guia do projeto para Claude

## O que é este projeto

**Beermother** é um assistente de cerveja artesanal. É uma SPA estática em português brasileiro, servida via GitHub Pages (`https://lehmann.github.io`). Não há servidor de aplicação — todo o estado do usuário fica no `localStorage` do navegador.

---

## Estrutura de diretórios

```
beermother/
├── docs/                   ← raiz do site estático (o que é servido)
│   ├── index.html          ← HTML raiz; carrega gate.js como módulo
│   ├── policy.html         ← Política de Privacidade
│   ├── terms.html          ← Termos de Uso
│   ├── allowed.users       ← lista de hashes SHA-256 de e-mails autorizados
│   ├── js/                 ← todos os módulos ES da aplicação (sem bundler)
│   ├── css/                ← folhas de estilo (tokens, app, screens, editor, analysis)
│   ├── assets/             ← fontes Inter auto-hospedadas e imagens de marca
│   └── api/beta/           ← endpoint de saúde ({"ok":true})
├── recipes/                ← arquivos BeerXML do desenvolvedor (~40 receitas)
├── analyzer/               ← scripts Python offline de simulação de cerveja
└── data/                   ← scripts Python de extração de dados / CSV
```

---

## Módulos JavaScript principais (`docs/js/`)

O app usa **ES modules nativos** — sem bundler, sem framework. Cada arquivo é um módulo com `import`/`export` explícitos. Os arquivos são formatados com Prettier (não minificados manualmente).

| Arquivo | Responsabilidade |
|---|---|
| `gate.js` | Tela de login Google (GSI One Tap + FedCM). Só carrega `main.js` após verificar o hash do e-mail contra `allowed.users`. |
| `main.js` | Ponto de entrada da app após o gate. Monta o shell (header, sidebar, nav de fases), gerencia o loop de render e o timer. |
| `state.js` | Estado global (`app`), todas as funções de `localStorage` (receitas, brassagens, configurações, autosave) e funções de Drive settings (`loadDriveEnabled`, `saveDriveEnabled`, `loadDriveFolderName`, `saveDriveFolderName`). |
| `engine.js` | Cálculos puros de cerveja (OG, FG, IBU, ABV, volumes, água). Sem efeitos colaterais. |
| `recipes.js` | CRUD de receitas (`listMyRecipes`, `saveMyRecipe`, `deleteMyRecipe`), perfis de equipamento, biblioteca de ingredientes do usuário, exportação BeerXML. |
| `editor.js` | Tela completa do editor de receitas, tela inicial (workspace), tela de log de brassagens e painel de configurações (incluindo seção Google Drive). Arquivo maior do projeto. |
| `screens.js` | Renderização das fases da brassagem (preparo, mostura, fervura, fermentação, resumo). |
| `beerxml.js` | Parser BeerXML (`parseBeerXml`) e sanitizador. |
| `i18n.js` | Função `t()` de tradução, locales em `locales/{pt,en,es}.js`. |
| `ui.js` | Helpers DOM: `el()`, `button()`, `iconButton()`, `toast()`, `downloadTextFile()`, etc. |
| `guide.js` | Lógica do guia passo a passo (modo copiloto). |
| `timer.js` | Cronômetro de mostura/fervura. |
| `ph.js` | Cálculos de pH e ácidos. |
| `analysis-screen.js` | Tela de análise sensorial (beta). Faz POST para `/api/analyze-recipe`. |
| `report.js` | Geração do relatório de brassagem para impressão. |
| `gdrive.js` | Integração com Google Drive (OAuth2 implicit flow + upload de receitas como `.xml`). Token persistido em `localStorage`. `authHeaders(interactive)`, `hasDriveCredential()`, `overwriteDriveFile()`, `syncFolderWithCache()`. |
| `batch-xml.js` | Serialização/parsing XML de perfis de equipamento (`equipmentProfileFromXml/ToXml`) e entradas de brassagem (`brewEntryFromXml/ToXml`). Dependências injetadas (`parseBeerXml`, `recipeToXml`) — testável em Node sem browser APIs. |
| `inventory.js` | Tela e lógica de inventário de ingredientes, com cache/hydrate pattern idêntico ao de receitas e equipamentos. |
| `library.js` | Catálogo de maltes, lúpulos, leveduras, estilos BJCP. |
| `calibration.js` | Geração da brassagem de calibração de equipamento. |
| `chart.js` | Gráfico da curva de fermentação. |

---

## Fluxo de autenticação

1. `gate.js` carrega o Google Identity Services (GSI) com `use_fedcm_for_prompt: true`.
2. O usuário faz login com Google; o payload JWT é decodificado no cliente.
3. O e-mail é convertido em SHA-256 e comparado com `allowed.users`.
4. Se autorizado, `main.js` é importado dinamicamente e a app inicializa.

O **mesmo** Client ID Google (`737027827720-...`) é reutilizado para o login do gate e para o OAuth2 do Google Drive (escopo `drive.file`). Por causa do FedCM ativo no gate, o token client do Drive é sempre inicializado com `prompt: "select_account"` — isso garante que o usuário consente explicitamente ao escopo `drive.file`, evitando que o Google retorne silenciosamente um token sem o escopo correto.

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

Sheets (painéis modais) são criados em `editor.js` com `fable-overlay` + `fable-sheet`. Só um sheet por vez.

---

## Internacionalização

```js
import { t } from "./i18n.js";
t("Texto em português")          // retorna tradução para o idioma atual
t("Olá {name}", { name: "Ana" }) // com interpolação
```

Idioma padrão: `pt`. Arquivos de locale em `docs/js/locales/`. Ao adicionar strings novas, adicione também nos três locales (`pt.js`, `en.js`, `es.js`).

---

## Integração com Google Drive (`gdrive.js`)

- Ativada nas Configurações → Google Drive (toggle na seção Drive do painel de settings em `editor.js`).
- Escopo: `https://www.googleapis.com/auth/drive.file` — acesso restrito a arquivos e pastas criados pelo próprio app.
- O token OAuth2 é persistido em `localStorage` (`beermother.drive.token.v1`) e restaurado em memória na inicialização via `restorePersistedToken()`. Expira em ~1 hora.
- **Renovação silenciosa**: `requestDriveAccess()` tenta `requestTokenSilent()` (sem UI) antes de cair no popup interativo. Usuário raramente precisa re-autenticar explicitamente.
- **`authHeaders(interactive)`**: caminho único para obter token. `false` (padrão) = falha rápida sem popup; `true` = pode exibir consentimento. Todas as funções internas propagam esse flag.
- **`hasDriveCredential()`**: retorna `true` se há `access_token` em localStorage, mesmo expirado. Usado como guarda para operações com `forceRefresh=true`, permitindo renovação mesmo com token expirado.
- **`hasDriveToken()`**: retorna `true` apenas se o token é válido (não expirado). Usado para decisão de background sync.
- **`overwriteDriveFile(driveFileId, content, fileName)`**: PATCH por ID conhecido — sobrescreve in-place sem busca por nome. Usado para conversão de formato legacy.
- **`syncFolderWithCache(folderId, ext, cache, interactive)`**: uma chamada de metadados (`id,name,md5Checksum`), baixa apenas arquivos com md5 diferente. Retorna `{entries, changed}` com flag `fresh` por entrada.
- Ao detectar 403 na API, `revokeLocalToken()` apaga token local e `_tokenClient`.
- A pasta padrão é `"Beer Mother"` com subpastas `recipes/`, `equipments/`, `batches/`. Como o escopo é `drive.file`, pastas criadas fora do app não são visíveis.
- O botão "Salvar no Drive" aparece no editor apenas quando `loadDriveEnabled()` retorna `true`.
- Aliases usados em `editor.js` para os símbolos de Drive: `drvEnabled`, `drvSetEnabled`, `drvFolder`, `drvSetFolder`, `drvUpload`, `drvAuth`, `drvHasToken`, `drvHasCredential`, `drvOverwriteFile`, `drvSyncEquipments`, `drvSyncBatches`.

### Cache/hydrate pattern (receitas, equipamentos, brassagens, inventário)

Todas as quatro entidades seguem o mesmo padrão:

1. **Hydrate** (síncrono, ao renderizar a tela): lê o índice de cache (`cache.<entity>.v1`) e popula o estado local sem tocar na rede.
2. **Sync** (assíncrono, background): `syncFolderWithCache` compara md5 remotos com o índice — baixa apenas o que mudou. `changed=true` dispara re-render.
3. **`effectiveIndex`**: o índice é filtrado para entradas cujo item existe localmente antes de passar ao sync — garante re-download de itens ausentes.
4. **Conversão de formato legacy**: arquivos sem `<BM_ID>` (equipamentos) ou sem `schema`/`version` (brassagens) são convertidos para o formato nativo e sobrescritos no Drive via `overwriteDriveFile` durante o processamento de entradas `fresh`.

### Split localStorage para Drive cache

- **Índice** (`cache.<entity>.v1`): array de `{driveFileId, name, md5Checksum}` — metadados apenas.
- **Item** (`cache.<entity>.<driveFileId>`): objeto completo. Para brassagens, armazena o `brewEntry` parseado; para equipamentos, o `profile`; para receitas, o conteúdo XML.

### `normalizeLegacyBatchEntry`

Converte payload de brassagem Path 2 (BeerXML externo, sem `schema`/`version`) para o formato nativo `beermother-recipe-session` que `validateBrewSessionPayload` aceita. Injeta `schema: "beermother-recipe-session"`, `version: 1`, converte receita via `draftFromRecipe`.

### Atenção: colisão de aliases em `editor.js`

`editor.js` usa nomes de variáveis curtos como aliases de import (ex: `xa`, `_a`, `Ia`). Ao adicionar novos imports de `state.js` ou `gdrive.js`, **sempre verifique** se o alias pretendido não colide com uma função ou constante local já existente no arquivo — o browser falha silenciosamente com `duplicate binding`, resultando em tela preta sem erro no console.

---

## Inventário (`inventory.js`)

- Quatro categorias: `fermentables`, `hops`, `yeasts`, `others`.
- Persistido como um único objeto em `beermother.fable.inventory.v1` (via `loadInventory`/`saveInventory` em `state.js`).
- Drive sync: arquivo único `inventory.xml` na pasta raiz do Drive (não usa o padrão de pasta/por-arquivo dos outros). MD5 cacheado em `beermother.drive.inventory.md5`. Após qualquer mutação, `syncInventoryToDrive` é chamado via `afterMutation`.
- Shapes dos itens: `{ id, name, type, amountKg, yieldPct, ebc }` (fermentáveis), `{ id, name, alpha, amount, form, unit }` (lúpulos), `{ id, name, attenuation, amount, unit }` (leveduras), `{ id, name, amount, unit, use, miscType, qtyPerL }` (outros).
- IDs gerados como `inv-${Date.now()}-${Math.floor(Math.random() * 1e6)}`.

## Perfil de água — modelo de dados

O perfil de água é um objeto de 6 campos de íons (definido em `engine.js`):
```js
{ calciumPpm, magnesiumPpm, sodiumPpm, chloridePpm, sulfatePpm, bicarbonatePpm }
```
- `DEFAULT_BASE_WATER_PROFILE` (engine.js): valores padrão moderados (Ca=10, Mg=4, etc.).
- **No draft de receita**: `draft.baseWaterProfile` + `draft.salts` (array de `{ formula, amountG }`).
- **No perfil de equipamento**: `profile.params.baseWaterProfile` — presente **apenas quando difere do padrão** (ver `customizedBaseWater` em `recipes.js`).
- **Na sessão de brassagem**: `session.properties.baseWaterProfile` — seeded a partir do draft ao iniciar.
- `computeTargets(draft)` (recipes.js) combina `baseWaterProfile` + `salts` → `ions` (ajustado) + `mashPh`.
- A seção "Água e sais" no editor (`bo()` em `editor.js`) edita `draft.salts` e exibe os íons calculados; o perfil base era editado no sheet de equipamento e **não** no editor de receita.

## Scripts Python (ferramentas offline)

Não fazem parte do servidor web. São utilitários de desenvolvimento:

| Arquivo | Uso |
|---|---|
| `analyzer/beer_simulator.py` | Simula propriedades de receitas; lê `request.json`, escreve `response.json`. |
| `data/data_extractor.py` | Extrai dados das receitas XML para CSV. |
| `data/json_flatter.py` | Achata JSON para CSV. |
| `recipes/files.py` | Cria diretórios e stubs JSON em `analyzer/simulation/` para cada receita `.xml`. |

---

## `batch-xml.js` — serialização de equipamentos e brassagens

- **`equipmentProfileFromXml(xmlContent)`**: lê `<EQUIPMENT>`. Quando `<BM_ID>` está ausente (arquivo legacy), gera id como `profile-${slugify(name)}`. **`slugify` usa `/[^a-z0-9]/g` (sem `+`)** para que cada caracter especial vire seu próprio `-`, evitando colisão entre nomes que diferem apenas por parênteses (ex: `"Default (no sparge)"` → `"default--no-sparge"` vs `"Default no sparge"` → `"default-no-sparge"`).
- **`brewEntryFromXml(xmlContent, parseBeerXml)`**: dois caminhos — Path 1 (nativo, com `BM_PAYLOAD` CDATA) e Path 2 (BeerXML externo, sem `BM_ID`). `parseBeerXml` é injetado.
- Todas as dependências são injetadas; o módulo não importa `beerxml.js` nem `recipes.js` diretamente — testável em Node sem browser APIs.

## Testes (`docs/js/tests/`)

Todos os comandos abaixo devem ser executados a partir de `docs/js/`.

```bash
# Rodar todos os testes (Node 18 — usa --experimental-loader)
node --experimental-loader ./tests/loader.js --test tests/*.test.js

# Rodar um arquivo específico sem browser APIs (batch-xml, slugify)
node --test tests/batch-xml.test.js
node --test tests/slugify.test.js

# gdrive.test.js importa gdrive.js que depende de state.js (usa `location`).
# Requer o loader de stubs para rodar em Node:
node --experimental-loader ./tests/loader.js --test tests/gdrive.test.js

# Validar sintaxe de um módulo JS (rodar após qualquer edição)
node --input-type=module --check < editor.js
```

- **`dom-shim.js`**: parser XML recursivo puro para Node — instala `globalThis.DOMParser`. Importar antes de qualquer módulo que use DOM.
- **`loader.js`**: loader ESM que substitui `state.js` e `i18n.js` por stubs quando um módulo depende de browser APIs (`location`, `localStorage`). Usar com `--experimental-loader ./tests/loader.js` (Node 18) ou `--import ./tests/loader.js` (Node 20+).
- **`batch-xml.test.js`**: 29 testes — helpers XML, brassagem externa (Brewfather), round-trip nativo, malformed, equipamento legacy (`Default_(no_sparge).xml`).
- **`gdrive.test.js`**: 9 testes para `diffCacheWithMetadata`.
- **`slugify.test.js`**: 13 testes para `slugify` em `engine.js`.
- Fixtures em `docs/js/tests/fixtures/`.

---

## Convenções de código

- **Sem bundler**: arquivos servidos diretamente; alterações em `docs/js/` e `docs/css/` têm efeito imediato.
- **Formatação com Prettier**: todos os arquivos JS e CSS são formatados com `npx prettier`. Não minificar manualmente.
- **Aliases curtos em `editor.js`**: o arquivo usa aliases curtos nos imports (`as bt`, `as Qa`, etc.). Ao adicionar novos imports, use nomes descritivos sem conflito (ex: `drvEnabled`, `drvUpload`) e valide com `node --input-type=module --check`.
- **`null` é válido nos arrays de UI**: as funções de render retornam `null` para elementos condicionais; o código de montagem usa `.filter(Boolean)` antes de `appendChild`.
- **CSS formatado**: os arquivos CSS são formatados com Prettier. Adicione novas regras ao final do arquivo relevante.
- **Versionamento de imports**: `main.js` importa alguns módulos com query string (`?v=beta44-release1`). Ao alterar `editor.js` ou `analysis-screen.js` em releases, atualize esse sufixo.
- **Validação de sintaxe**: após editar qualquer módulo JS, valide com `node --input-type=module --check < arquivo.js` antes de commitar.
