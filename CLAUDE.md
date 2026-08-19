# CLAUDE.md

Este arquivo orienta qualquer sessão do Claude Code neste repositório. Leia-o antes de iniciar qualquer tarefa.

## Visão geral do projeto

Protótipo de plataforma web gamificada para educação financeira (TCC — Alexandre Beilner, UNO, 2026). Simula investimentos em Renda Fixa e Renda Variável com dados sintéticos, ensinando por meio de uma trilha de lições e reforçando engajamento com XP, conquistas, streak, missões diárias e um sistema social (ranking entre amigos).

## Documentação de referência

Toda decisão de produto e arquitetura já está fechada nestes três documentos, em `.claude/`. **Não redecida algo que já está documentado ali — leia antes de assumir.**

| Arquivo | O que contém |
|---|---|
| `.claude/especificacao-plataforma-investimentos.md` | Fonte da verdade: arquitetura, modelo de dados (DER), motor de mercado, currículo de 33 lições, requisitos formais (RF/RNF), corte de MVP, roadmap de 8 semanas, changelog de decisões (v0.1–v0.5) |
| `.claude/inventario-telas-plataforma-investimentos.md` | As 28 telas da aplicação — objetivo, conteúdo, ações e navegação de cada uma |
| `.claude/backlog-plataforma-investimentos.md` | Quebra de tarefas executáveis, organizada pelas 8 semanas do roadmap, com critérios de aceite e dependências |
| `.claude/identidade-visual-tokens.md` | Tokens de design (tarefa 1.0): paleta dark/light, tipografia, espaçamento, raio/elevação — toda estilização de componente/tela deve seguir este documento |

Ao pegar uma tarefa, sempre confira a numeração (ex: RF17, tela 4.5, tarefa 5.4) contra esses documentos — as referências cruzadas são intencionais e existem pra evitar retrabalho.

## Arquitetura — resumo rápido

| Serviço | Stack | Container? |
|---|---|---|
| Motor de Simulação | Go | **Sim**, sempre |
| Backend Gamificado | Node.js + TypeScript | **Sim**, sempre |
| Frontend | React + TypeScript | **Não** — roda local (dev server / build estático fora do Compose) |
| Postgres (2 bancos lógicos: usuário/gamificação e mercado) | — | Sim |
| Redis (cache de cotações e rankings) | — | Sim |

Comunicação entre serviços: HTTP/JSON, via proxy reverso (gateway) como porta de entrada única do backend. Ver diagrama completo na spec, seção 3.

## Regras críticas — não esquecer

Estas são decisões já fechadas que geram retrabalho se ignoradas:

- **Container é obrigatório para todo o backend** (motor, backend gamificado, Postgres, Redis). O frontend é a única exceção — nunca criar Dockerfile pra ele.
- **Event Sourcing é a fonte da verdade financeira**: nenhuma escrita de saldo/posição acontece sem antes gravar um evento imutável em `market_events`. Não escrever direto em `positions`/`accounts` sem passar por esse fluxo.
- **Capital inicial é sempre R$ 10.000,00** por conta nova, no mercado ao vivo (RNF06) — não deixar configurável.
- **Não há perfil privado nesta fase.** Todo usuário é público por decisão explícita (spec v0.4/8.2). Não implementar toggle de visibilidade de perfil — isso é candidato de Fase 2, fora de escopo agora.
- **Valor absoluto de patrimônio nunca é exposto a outro usuário** — nem no ranking, nem no perfil público, nem na busca de amigos. Só rentabilidade percentual, nível e conquistas (RNF09). Essa regra não é configurável, é garantia do sistema.
- **Amizade é bilateral com aceite**, não é "seguir" unilateral. Sem bloqueio de usuário nesta fase (deferido pra Fase 2).
- **Indicadores de ativo variam por classe** (RF21, spec 3.6): Ações mostram fundamentalistas tradicionais (P/L, P/VP, ROE etc.); ETFs mostram índice de referência + metodologia + composição sintética, **não** indicadores de empresa; FIIs se dividem em tijolo (segmento, patrimônio, vacância) e papel (indexador), ambos com Dividend Yield. Não reaproveitar o layout de indicadores de Ações pra ETF/FII.
- **`role = admin` nunca é atribuível por autocadastro** — só via seed manual.
- **Ranking usa janela fixa** (semana/mês), não é cumulativo desde a criação da conta (RF17), e tem dois escopos independentes — Global e Amigos — que compartilham a mesma janela.

## Como trabalhar a partir do backlog

1. Siga `.claude/backlog-plataforma-investimentos.md` na ordem das semanas. Dentro de uma semana, respeite as dependências listadas em cada tarefa antes de começá-la.
2. Cada tarefa do backlog é pensada como escopo razoável de uma sessão — não tente empacotar várias tarefas numa sessão só, isso dificulta revisão e rollback.
3. Ao concluir uma tarefa, verifique os critérios de aceite listados nela antes de considerar pronta.
4. Tarefas marcadas como "tela âncora" no backlog (Mapa da Trilha, Detalhe de Ativo + Confirmação de Ordem) merecem um mockup/rascunho de layout antes da implementação — elas definem um padrão visual reaproveitado em outras telas.
5. Se uma tarefa exigir uma decisão de produto que não está em nenhum dos três documentos, pare e pergunte — não assuma. Documente a decisão tomada de volta nos arquivos correspondentes depois.

## Convenções de código

- **Go (motor de simulação):** `golangci-lint`, domínio separado de infraestrutura, testes unitários obrigatórios para toda fórmula financeira (cap. 7.2.4 do TCC).
- **Node.js/TypeScript (backend gamificado):** ESLint + Prettier.
- **React/TypeScript (frontend):** Vite, componentes seguindo os tokens de identidade visual (tarefa 1.0 do backlog) antes de estilizar qualquer tela.
