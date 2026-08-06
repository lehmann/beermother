# Beer Mother

Assistente de cerveja artesanal para cervejeiros domésticos. SPA estática em português brasileiro, servida via GitHub Pages — sem servidor de aplicação, sem banco de dados, sem backend próprio.

## O que é

Beer Mother é um guia de brassagem interativo que acompanha o cervejeiro do planejamento da receita até o fim da fermentação. Tudo roda no navegador; os dados ficam no `localStorage` e, opcionalmente, sincronizados com o Google Drive do próprio usuário.

O acesso é fechado: somente e-mails cadastrados (hashes SHA-256 em `docs/allowed.users`) conseguem fazer login via Google.

## Capacidades atuais

### Editor de receitas

- Criação e edição de receitas com maltes, lúpulos, leveduras, adjuntos e sais
- Cálculo em tempo real de OG, FG, ABV, IBU e cor (EBC)
- Comparação visual com faixas de estilo BJCP (89 estilos + extensões regionais)
- Escalonamento automático de receita ao trocar equipamento (preserva OG e IBU)
- Edição de percentuais do grist com modo base-malt
- Escalonamento de OG (escala maltes) e IBU (escala apenas lúpulos de amargor)
- Curvas de mostura e fermentação com presets editáveis
- Perfil de água com seis íons, adição de sais e previsão de pH de mostura
- Perfis de água reutilizáveis via inventário
- FG manual sobrescrevendo a calculada
- Exportação BeerXML compatível com Brewfather e outros apps

### Guia de brassagem

Três níveis de detalhe selecionáveis:
- **Essencial** — checklist mínimo de cada fase
- **Guia** — instruções detalhadas passo a passo
- **Copiloto** — modo interativo com confirmações e sugestões contextuais

Fases cobertas: preparo, mostura, fervura, fermentação e resumo. Timer integrado para mostura e fervura com notificações de adição de lúpulo.

### Brassagem ao vivo

- Sessão persistida em autosave; retoma exatamente onde parou após fechar o navegador
- Correções de volume e densidade em cada fase (pré-fervura, pós-fervura, no fermentador)
- Leituras de pH com sugestão de dose de ácido
- Rastreamento de fermentação com múltiplas leituras de temperatura e extrato
- Relatório de brassagem para impressão (PDF via navegador)
- Gráfico da curva de fermentação

### Brassagem de calibração

Receita de Cream Ale simples gerada automaticamente para medir o equipamento real do usuário. Ao fim, os parâmetros medidos (eficiência, evaporação, absorção de grãos, perda de trub) são salvos como perfil de equipamento.

### Caderno de brassagens

Histórico completo de brassagens concluídas com notas, leituras e relatório. Permite excluir entradas da média de parâmetros do equipamento sem apagá-las do histórico.

### Inventário de ingredientes

Quatro categorias: fermentáveis, lúpulos, leveduras, outros. Mostra estoque disponível diretamente no seletor de ingredientes do editor. Perfis de água reutilizáveis como categoria separada.

### Lista de compras

Gerada a partir da receita ou do inventário atual, com quantidades calculadas pelo volume do lote.

### Equipamentos

Perfis de equipamento com todos os parâmetros de produção (volume, eficiência, evaporação, absorção, perfil de água base). Múltiplos perfis; um marcado como principal.

### Internacionalização

Interface disponível em português (padrão), inglês e espanhol. Troca de idioma nas configurações sem recarregar a página.

### Integração Google Drive

- Escopo `drive.file` — acesso restrito a arquivos criados pelo próprio app
- Receitas salvas como `.xml` na pasta `Beer Mother/recipes/`
- Equipamentos e brassagens sincronizados nas subpastas correspondentes
- Inventário como arquivo único `inventory.xml`
- Renovação silenciosa de token; usuário raramente precisa re-autenticar
- Resolução de conflitos por `updatedAt` (versão mais recente vence)
- Conversão automática de arquivos no formato legado durante a sincronização

### Análise sensorial (beta)

Tela experimental que envia a receita para análise e retorna previsões de percepção sensorial com bandas de confiança calculadas por regressão linear local.

## Arquitetura técnica

- ES modules nativos, sem bundler, sem framework
- Renderização imperativa: evento → muta `app` → `requestRender()` → reconstrói o DOM
- Zero dependências externas em runtime (Google Identity Services e Drive API carregados sob demanda)
- Testes com Node.js `--test` nativo; loader ESM para stubs de browser APIs

## Potenciais melhorias e novas features

### Qualidade e confiabilidade

- Testes de integração para os fluxos de Drive (upload, overwrite, sync), hoje sem cobertura
- Testes para `engine.js` (cálculos de pH, IBU, volumes) — único arquivo sem suite dedicada
- Validação de esquema nos payloads de brassagem ao restaurar do Drive, com migração versionada
- Tratamento explícito de conflitos de sync quando o mesmo arquivo foi editado em dois dispositivos

### Editor de receitas

- Histórico de versões de receita (além do undo/redo in-session)
- Clonagem de receita com escalonamento de volume em um passo
- Suporte a lúpulos em pellet vs. extrato com fator de utilização diferente
- Campo de notas/descrição da receita
- Modo de comparação lado a lado entre duas receitas
- Importação direta de receitas do Brewfather via API (hoje só aceita BeerXML exportado)

### Brassagem

- Notificações push para alertas do timer quando a aba estiver em segundo plano (Web Push API)
- Compartilhamento de sessão ao vivo entre dispositivos via Drive (útil quando o celular fica na cozinha e o computador em outro cômodo)
- Suporte a brassagens com lúpulo fresco (wet hop) com fator de conversão
- Registro de temperatura ambiente e do mosto ao longo do dia

### Inventário e compras

- Débito automático do inventário ao concluir uma brassagem
- Integração com fornecedores brasileiros para consulta de disponibilidade e preço
- Lista de compras exportável para WhatsApp ou e-mail

### Análise

- Persistência local dos resultados de análise sensorial por receita
- Comparação entre análise prevista e notas sensoriais registradas após a brassagem
- Regressão com mais pares de treino à medida que o usuário acumula brassagens

### Plataforma

- PWA com `service worker` para uso offline completo (hoje a ausência de internet só quebra o Drive)
- Modo embed (`?embed=1`) mais completo para incorporação em sites de clubes de cerveja
- API de exportação para permitir que outros apps consultem o histórico de brassagens
- Suporte a múltiplos usuários no mesmo dispositivo (hoje os dados são compartilhados pelo `localStorage` da origem)
