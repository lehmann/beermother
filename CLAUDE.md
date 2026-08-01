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
| `gdrive.js` | Integração com Google Drive (OAuth2 implicit flow + upload de receitas como `.xml`). |
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
- O token OAuth2 é mantido apenas em memória (`_token`, `_tokenExpiry`). Não é persistido em localStorage. Expira em ~1 hora.
- Ao detectar 403 na API, `revokeLocalToken()` apaga o token local e o `_tokenClient`, forçando nova tela de consentimento na próxima tentativa.
- `saveRecipeToDrive(xmlContent, fileName)`: busca ou cria a pasta configurada → faz upsert do arquivo (POST se novo, PATCH se já existe).
- A pasta padrão é `"Beer Mother"`, configurável pelo usuário. Como o escopo é `drive.file`, pastas criadas manualmente pelo usuário fora do app **não são visíveis** — o app sempre usa a pasta que ele mesmo criou.
- O botão "Salvar no Drive" aparece no editor apenas quando `loadDriveEnabled()` retorna `true`.
- Aliases usados em `editor.js` para os símbolos de Drive: `drvEnabled`, `drvSetEnabled`, `drvFolder`, `drvSetFolder`, `drvUpload`, `drvAuth`.

### Atenção: colisão de aliases em `editor.js`

`editor.js` usa nomes de variáveis curtos como aliases de import (ex: `xa`, `_a`, `Ia`). Ao adicionar novos imports de `state.js` ou `gdrive.js`, **sempre verifique** se o alias pretendido não colide com uma função ou constante local já existente no arquivo — o browser falha silenciosamente com `duplicate binding`, resultando em tela preta sem erro no console.

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
- **Formatação com Prettier**: todos os arquivos JS e CSS são formatados com `npx prettier`. Não minificar manualmente.
- **Aliases curtos em `editor.js`**: o arquivo usa aliases curtos nos imports (`as bt`, `as Qa`, etc.). Ao adicionar novos imports, use nomes descritivos sem conflito (ex: `drvEnabled`, `drvUpload`) e valide com `node --input-type=module --check`.
- **`null` é válido nos arrays de UI**: as funções de render retornam `null` para elementos condicionais; o código de montagem usa `.filter(Boolean)` antes de `appendChild`.
- **CSS formatado**: os arquivos CSS são formatados com Prettier. Adicione novas regras ao final do arquivo relevante.
- **Versionamento de imports**: `main.js` importa alguns módulos com query string (`?v=beta44-release1`). Ao alterar `editor.js` ou `analysis-screen.js` em releases, atualize esse sufixo.
- **Validação de sintaxe**: após editar qualquer módulo JS, valide com `node --input-type=module --check < arquivo.js` antes de commitar.
