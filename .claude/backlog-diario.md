# Backlog — Diário (jogo diário de economia e investimentos)

Backlog executável criado em 2026-10-17, a partir de uma sessão de ideação sobre engajamento diário e pertencimento (pesquisa de mercado: Termo/Wordle, Duolingo, Ticker League, Spotify Wrapped, BeReal, caso Robinhood). O autor escolheu seguir com este item: **um jogo diário no estilo Termo, com perguntas sobre termos técnicos, conhecimentos gerais de economia e finanças e a história disso no Brasil**, igual para todo mundo, que a pessoa responde em poucos minutos e depois segue para o resto do app.

O jogo existe em **dois lugares com a mesma API**: uma **página pública na landing** (`selucra.com.br/diario`, sem login, feita para ser achada por busca) e uma **rota dentro do app** (`app.selucra.com.br/diario`, logada, onde o jogo vale XP e conta para o streak).

Não há documento de proposta separado: o "porquê" está resumido na seção 1.

**Como usar este arquivo**

1. Siga a ordem da "Sequência sugerida" no final. Dependências reais estão em cada tarefa.
2. Uma tarefa por sessão. Ao concluir: verificar os critérios de aceite, marcar ✅ no título e acrescentar um bullet **Entregável** (mesmo padrão dos outros backlogs).
3. Tarefa que toca `backend/` passa pelo checklist obrigatório do `CLAUDE.md` inteiro (regra em `domain/`/`application/`, port em `application/ports/` + adapter em `infrastructure/`, Zod na borda, teste no mesmo commit, `.docs/backend/<módulo>.md`, lint/build/test, `docker compose up`). **Nenhuma tarefa toca `engine/`.**
4. Telas novas nascem responsivas nos três breakpoints (desktop com composição própria, não mobile esticado) e seguem `identidade-visual-tokens.md` e `identidade-visual-padroes.md`. Texto mostrado ao usuário nunca usa "—" como pontuação.
5. Módulo novo no backend: `backend/src/modules/daily/`. Migrations Drizzle em `backend/src/db/migrations/`: o `when` do journal precisa ser maior que o da última migration aplicada (senão ela é pulada em silêncio) e `drizzle-kit generate` precisa de TTY.
6. A parte pública vive em `landing/` (HTML/CSS/JS puros, sem React, decisão LW.6.1) e segue as regras dela: sem preço nem PRO, conteúdo principal no HTML entregue (sem depender de JS), testes de SEO do `landing/test/` passando, sem Dockerfile.
7. **Sem IA.** Decisão do autor (2026-10-17): nenhuma pergunta, dica ou explicação é gerada por modelo de linguagem. Todo conteúdo vem de banco curado ou de gerador determinístico (seção 3).
8. Fato histórico ou número mostrado ao usuário tem **fonte primária registrada**, mesma disciplina do `regulatoryFacts.ts` e de `diretrizes-redacao-licoes.md`.

---

## 1. Por que (resumo da ideação de 2026-10-17)

- **Motivo para voltar todo dia.** O app tinha streak, missões e XP, mas nada que acontece *hoje* e não acontece amanhã. Jogos diários (Termo, Wordle) funcionam por três coisas: uma rodada por dia, a mesma para todos, e resultado compartilhável sem spoiler.
- **Porta de entrada, não só retenção.** Diferente de uma pergunta sobre o mercado simulado (que só faz sentido para quem já tem carteira), um quiz de economia funciona para qualquer pessoa, até sem conta. Por isso a versão pública fica na landing, indexável, e o cartão compartilhado no WhatsApp traz gente nova.
- **O erro vira porta para a trilha.** Toda resposta tem um "Saiba mais" que leva ao Glossário, a um guia da landing ou à lição que ensina aquilo.
- **Ponte para o Modo História** (ideia registrada na seção 5, fora deste backlog): a Linha do tempo e a Pergunta do dia são a amostra grátis e diária dos episódios históricos.
- **Guarda-corpos:** vale só XP, nunca dinheiro do jogo nem prêmio (distância das bets, Lei 14.790/2023); nenhuma escassez artificial (não existe "pague para jogar mais", limite já fixado em `proposta-engajamento-licoes.md`); nada de patrimônio no cartão compartilhado (RNF09).

## 2. Decisões

### Fechadas pelo autor (2026-10-17)

| # | Decisão |
|---|---|
| DI1 | Formato Termo + perguntas: um jogo de palavra e mais cartões de pergunta, todo dia. |
| DI2 | Conteúdo: termos técnicos, conhecimentos gerais de economia e finanças e a história disso no Brasil (ajustado pela DI17). |
| DI3 | Sem IA em nenhuma parte (conteúdo, dica, correção). |
| DI4 | **Jogar o Diário conta como atividade do dia para o streak principal.** |
| DI5 | **O dia do Diário segue o mesmo fuso do streak** (hoje UTC, `todayUtc` em `gamification/domain/streak`). Consequência: o jogo novo aparece às **21h de Brasília**. O texto da tela diz isso ("novo Diário todo dia às 21h"), em vez de esconder. Se um dia o streak mudar de fuso, o Diário muda junto. |
| DI6 | **XP: 50 se acertar todos os cartões, menos se errar algum.** Fórmula (decidida em 2026-10-17): **20 por concluir o Diário + 10 por cartão acertado, de 20 a 50** (3 cartões). No Termo, "acertou" = descobriu a palavra nas 6 tentativas. |
| DI7 | **Página pública, sem login e com SEO**, junto da landing (`selucra.com.br/diario`). **E o mesmo jogo dentro do app**, onde ele vale XP e streak. |
| DI8 | **Quem joga fora do app não ganha XP por aquele jogo.** Nada jogado sem login é importado (para ganhar o XP, joga de novo no app, DP6). |
| DI9 | **Ao terminar o Diário fora do app, a pessoa é convidada a entrar no app** (criar conta ou fazer login). |
| DI10 | Lista de palavras aceitas: fica a cargo da implementação, com a abordagem da seção 3.1. |
| DI11 | **Conteúdo inicial de pelo menos 30 dias**, revisado, antes da estreia. |
| DI12 | **O autor controla a data de estreia.** Publicar o código não começa o jogo: entre a publicação e a estreia há o tempo de subir a aplicação, o Google indexar a página e divulgar nas redes. O jogo #1 é o da data de estreia (seção 3.5). |
| DI13 | **Conteúdo variado, centrado no mercado brasileiro**, ou em fatos de fora que afetaram o mercado brasileiro (seção 3.3). |
| DI14 | **Só o dia atual e os anteriores são acessíveis.** Nenhuma rota entrega um jogo do futuro (seção 3.6). |
| DI15 | **Quem volta no mesmo dia vê o que já respondeu**, como no Termo: o jogo não reinicia ao recarregar a página (seção 3.4). |
| DI16 | **Três cartões por dia** (decidido em 2026-10-17): **Palavra do dia**, **Pergunta do dia** e **Linha do tempo** (a Pergunta do dia substituiu o "Neste dia na história" em 2026-10-17, ver DI17). O cartão "Mais ou menos" (pergunta de número sobre séries históricas) foi cogitado e ficou de fora: perguntas numéricas já tinham saído dos checkpoints das lições, e tirá-lo dispensa a importação de séries do Banco Central. |

### Fechadas pelo autor na revisão das propostas (2026-10-17)

| # | Decisão | Onde pesa |
|---|---|---|
| DP2 | **Mesmo jogo para todo mundo** no mesmo dia, com número sequencial (`#47`). | DI.1.1 |
| DP3 | **Gabarito nunca vai ao navegador antes da resposta.** O servidor avalia cada palpite (inclusive as cores do Termo). | DI.2.1 |
| DP4 | Conteúdo no banco, editado por um painel admin com auditoria (mesmo modelo das lições, N.23), nunca só em arquivo de seed. | DI.1.2, DI.5.1 |
| DP5 | **Jogo escrito uma vez, sem framework**, usado pela landing e pelo app (seção 3.2). | DI.3.1 |
| DP6 | **Sem trava para quem jogou fora do app.** O convite da landing leva ao app sem marcar nada; quem já jogou na landing pode jogar de novo logado e ganha o XP do dia normalmente. O que vale de DI8 é só que nada jogado sem login é importado. A trava pelo link (`?jogado=`) foi cogitada e descartada. | DI.3.2, DI.4.1 |
| DA1 | **Nome: Diário Selucra.** Título da página, SEO e cartão compartilhado ("Diário Selucra #47"); URL `selucra.com.br/diario`; no app, `/diario`. | DI.3.2 |

### Revisão posterior (2026-10-17)

| # | Decisão | Onde pesa |
|---|---|---|
| DI17 | **O cartão "Neste dia na história" sai; entra a "Pergunta do dia" (`trivia`).** O cartão datado era difícil de manter: exigia um fato para cada dia e mês do calendário (ponto 057). A Pergunta do dia é de **conhecimentos gerais sobre economia, finanças e mercado**, sem data: história econômica do Brasil, eventos de fora que afetaram o Brasil, instituições, produtos financeiros, termos e conceitos. Múltipla escolha, mesma mecânica. O banco da Pergunta (`daily_questions`) é separado do banco de eventos da Linha do tempo (`daily_events`); a Linha do tempo deixa de depender de um banco de "fatos" com pergunta. | DI.1.1 a DI.1.4, DI.2.1, DI.3.1, DI.5.1 |

Não há decisão em aberto neste backlog.

## 3. Os três cartões e de onde vem o conteúdo

| Cartão | Exemplo (ilustrativo, conferir fonte antes de usar) | Fonte do conteúdo | Curadoria |
|---|---|---|---|
| **Palavra do dia** | `JUROS` em 6 tentativas, letras verde/amarelo/cinza. O tamanho muda por dia (`IPCA`, `SELIC`, `SPREAD`, `LIQUIDEZ`). Acento ignorado na digitação, mostrado na revelação (`ACOES` => `AÇÕES`). Ao acertar, mostra a definição. | Banco de palavras-resposta, cada uma com definição curta e link opcional para lição, glossário ou guia. Os 83 termos de `frontend/src/features/lessons/glossary/index.ts` são ponto de partida, mas o banco vive no backend. | Lista única, ~300 palavras (~10 meses) |
| **Pergunta do dia** | "Qual índice é a referência da meta de inflação no Brasil?" ou "O que a crise de 2008 fez com o capital estrangeiro na bolsa brasileira?" 4 alternativas, com explicação curta depois. | Banco de perguntas de conhecimentos gerais (enunciado, alternativas, resposta, explicação, **fonte primária**, categoria, marcador Brasil/fora). Sem data: não precisa cobrir o calendário. | A parte manual. A agenda só se preocupa com variedade e não repetição. |
| **Linha do tempo** | Ordenar: Plano Collor, Plano Real, crise de 2008, Joesley Day. | **Gerado** sorteando 4 eventos do banco de eventos (`daily_events`: ano, nome curto, explicação, fonte), com anos distintos. | Nenhuma |

Gerador determinístico = função pura de (data, banco) com semente derivada da data: rodar duas vezes para o mesmo dia dá o mesmo jogo. Mesmo assim, o jogo do dia é **materializado** numa agenda (tabela) com antecedência, para o admin ver e corrigir antes de ir ao ar.

Cartão compartilhável (texto, sem spoiler, sem patrimônio):

```
Diário Selucra #47
🟩🟩🟨⬜⬜ palavra em 3
❓ ✅  ⏳ ❌
selucra.com.br/diario
```

### 3.1 Lista de palavras aceitas como palpite (DI10)

O Termo recusa o que não é palavra (senão o jogo vira caça-letra). Para isso é preciso saber quais sequências são palavras do português. Abordagem:

- **Fonte:** o dicionário ortográfico **VERO (pt-BR)**, o mesmo do LibreOffice, publicado no repositório `dictionaries` do LibreOffice (`pt_BR/`), com **licença dupla LGPL 3 / MPL**. Nunca copiar a lista de outro jogo (Termo etc.).
- **Geração (script versionado, não à mão):** o dicionário vem em formato hunspell (`.dic` + regras `.aff`); a ferramenta `unmunch` do hunspell expande as regras e gera todas as formas (plural, feminino, conjugações). Depois, filtrar: só letras, de 4 a 9 caracteres (o tamanho das respostas), fora nomes próprios (entradas com maiúscula), fora uma lista de palavras ofensivas; normalizar para maiúsculas sem acento (a mesma regra de comparação do jogo).
- **Siglas e termos do mercado** que não estão no dicionário (`SELIC`, `IPCA`, `CDB`, `FII`, `SPREAD`...) entram numa lista extra própria, sempre aceita. Toda palavra-resposta precisa estar na lista aceita (o seed recusa se não estiver).
- **Onde mora:** numa tabela do Postgres (`daily_accepted_words`, chave primária na forma normalizada), carregada pelo seed a partir do arquivo gerado. Consulta por palpite é uma busca por chave, sem carregar milhões de palavras na memória do backend.
- **Licença:** o arquivo gerado fica no repositório com cabeçalho dizendo a origem (repositório, commit), a licença e o script que o gerou, e a licença vai junto (`NOTICE`). A lista nunca vai para o navegador (a validação é no servidor, DP3).

### 3.2 Um jogo, dois lugares (DP5)

- A landing é HTML puro e o app é React. Em vez de escrever a grade do Termo, o teclado, os cartões e a tela de resultado duas vezes, o jogo é um **módulo sem framework** (TypeScript + DOM) que recebe um cliente da API e um "modo" (`publico` ou `app`).
- A landing monta o módulo direto na página. O app monta o mesmo módulo dentro de um organismo React fino (o organismo só cuida de autenticação, XP e celebração).
- Local proposto: `landing/src/diario/` (a landing já importa arquivo de fora no build, ex: `regulatoryFacts.ts`), importado pelo `frontend/` por caminho relativo ou alias do Vite. Confirmar na DI.3.1. Os tokens de cor já são duplicados entre `landing/` e `frontend/src/index.css` (regra da LW.6.1); o módulo usa variáveis CSS com os mesmos nomes nos dois.
- Toda regra (avaliar palpite, conferir resposta, pontuar) fica no backend. O módulo só desenha e envia.

### 3.3 Linha editorial do conteúdo (DI13)

**Foco:** o mercado brasileiro (história, instituições, produtos, crises, planos econômicos) e fatos de fora **só quando afetaram o Brasil**, sempre com a ligação explicada ("a crise da Rússia de 1998 fez o capital fugir de emergentes e pressionou o real").

**Temas para a pesquisa** (ponto de partida para a DI.1.4; nenhum entra sem a data, o número e o fato conferidos em fonte primária; vale para as perguntas e para os eventos da Linha do tempo):

| Categoria | Exemplos de tema |
|---|---|
| Planos e moeda | Planos econômicos dos anos 1980 e 1990, URV e Plano Real, as trocas de moeda, câmbio fixo e a mudança para câmbio flutuante |
| Juros e inflação | Hiperinflação, criação do Copom, metas de inflação, ciclos de alta e de queda da Selic, a mínima histórica da Selic |
| Instituições | Banco Central, CVM, criação da Bovespa, fusões que formaram a B3, FGC, Tesouro Direto |
| Crises e choques | Crises domésticas (recessões, episódios de circuit breaker na B3) e choques de fora que bateram aqui (crises do petróleo, dívida externa, crises asiática e russa, 2008, pandemia, guerras com efeito em commodities) |
| Produtos e regras | Poupança, CDB, LCI/LCA, FII, ETF, tributação, Novo Mercado e governança |
| Termos técnicos | Palavras do Glossário e do jargão do mercado (para a Palavra do dia) |

**Variedade (regra da agenda, DI.1.3):** cada palavra, pergunta e evento tem uma **categoria** e um marcador **Brasil** ou **fora (com efeito no Brasil)**. A agenda evita a mesma categoria em dias seguidos no mesmo cartão, mistura década e tema na Linha do tempo, e mantém a maioria do conteúdo de cada semana sobre o Brasil.

**Checklist de cada item** (aplicado na revisão do autor):
1. Fonte primária registrada (Banco Central, CVM, B3, Tesouro, IBGE, legislação, ou documento da época).
2. Data e número conferidos na fonte, não em memória ou em site de terceiro.
3. Fato de fora tem a frase que explica o efeito no Brasil.
4. Enunciado não entrega a resposta; as alternativas erradas são plausíveis.
5. Explicação curta (até ~280 caracteres, como os cartões das lições) e sem termo que ela mesma não explique.
6. Sem "—" como pontuação; sem opinião política nem julgamento de governos, só fatos e efeitos.

### 3.4 Estado salvo no navegador (DI15)

Igual ao Termo: quem já respondeu hoje e volta à página vê o jogo como deixou.

- **Deslogado (landing e app):** o estado fica no `localStorage`, numa chave só e versionada (ex: `selucra.diario.v1`), com:
  - por jogo (chave = número do jogo): os palpites do Termo com as cores que o servidor devolveu, a resposta de cada cartão com o resultado e a explicação recebidos, se terminou e quando;
  - estatísticas (jogos, acertos por cartão, distribuição de tentativas, sequência atual e maior);
  - só os últimos 60 jogos (o resto é apagado, para não crescer sem fim).
- **Ao abrir a página:** o módulo pergunta ao servidor qual é o jogo de hoje (`GET /daily/today`) e procura esse número no estado salvo. Se achar, redesenha tudo sem chamar a API de novo; se não achar, começa um jogo novo. Estatísticas seguem de um dia para o outro.
- **Defesa contra estado estranho:** número salvo maior que o de hoje (relógio adulterado, dado editado) é ignorado; JSON corrompido ou versão antiga desconhecida é descartado sem quebrar a página; sem `localStorage` (aba anônima, bloqueado), o jogo funciona, só não lembra depois de recarregar. Todo acesso ao storage fica em try/catch.
- **O estado local nunca vale XP.** Ele só serve para redesenhar. Quem decide acerto é sempre o servidor (DP3).
- **Logado (app):** a fonte é o servidor. `daily_results` guarda os palpites do Termo e as respostas de cada cartão, e `GET /daily/:number/me` devolve o estado para redesenhar, em qualquer aparelho. O `localStorage` não é usado para o jogo logado.
- **Virada do dia com a página aberta:** quando chega a hora do jogo novo, a página avisa "Novo Diário disponível" e oferece abrir, sem apagar o jogo que estava na tela. No app, o XP do dia só vale se o Diário for concluído antes da virada; a tela mostra a contagem nos últimos minutos.

### 3.5 Estreia controlada (DI12)

- O Diário tem um estado: **desligado**, **agendado** (com a data de estreia) ou **no ar**. Quem muda é o admin, no painel (DI.5.1), com auditoria. A data de estreia fica no banco (configuração do módulo), não em variável de ambiente, para não precisar de deploy.
- **Antes da estreia:** a página pública existe e é indexável, com o conteúdo de "como jogar", as perguntas frequentes e a data de estreia ("Estreia em 3 de novembro"). É o tempo de o Google indexar e da divulgação. A API responde que o jogo ainda não começou, com a data; nenhuma rota de jogo funciona.
- **O jogo #1 é o do dia da estreia.** A numeração é sempre "dias desde a estreia + 1", então não há buracos nem jogos "queimados" antes do lançamento.
- **Regras para não estragar a numeração:** a data de estreia pode ser mudada à vontade enquanto estiver no futuro; depois que o jogo está no ar, ela não muda mais (mudar renumeraria jogos já jogados e compartilhados).
- **A estreia só pode ser agendada** se houver pelo menos 30 dias de jogos materializados e revisados a partir dela (DI11). O painel mostra quantos dias de conteúdo existem à frente.
- **O admin vê qualquer dia futuro** numa prévia própria do painel (rota de admin, com `role = admin`), nunca pelas rotas públicas.

### 3.6 Acesso só ao dia atual e aos anteriores (DI14)

- O servidor calcula o número do jogo de hoje (DI5 + estreia). Todas as rotas que recebem um número recusam qualquer número maior que o de hoje com **404**, o mesmo erro de um jogo que não existe (não revela se o jogo futuro já está pronto). Antes da estreia, todas as rotas de jogo respondem como "ainda não começou".
- O relógio do navegador não manda em nada: mudar a data do computador não abre jogo novo.
- **Dias anteriores** podem ser jogados (no app e na landing), sem XP e sem contar para o streak nem para a sequência do Diário: só o jogo do dia vale.
- Prévia de dias futuros só existe nas rotas de admin (seção 3.5).

---

## Fase A, conteúdo e domínio (backend)

### DI.1.1 · Domínio do Diário ✅ (2026-10-17)
- **Descrição:** módulo `backend/src/modules/daily/` (DDD lite). `domain/`: estado do Diário (desligado, agendado, no ar) e número do jogo a partir da data de estreia (seção 3.5: #1 = dia da estreia; DI5: mesma regra de dia do streak, com o relógio entrando por parâmetro); regra de acesso (seção 3.6: número maior que o de hoje = inexistente; só o jogo do dia vale XP); regras da data de estreia (muda livre enquanto futura, trava depois do início, exige 30 dias de conteúdo à frente); tipos de cartão (`word`, `trivia`, `timeline`); avaliação do palpite do Termo (verde/amarelo/cinza com letra repetida tratada como no Termo, acento ignorado na comparação); avaliação dos outros cartões; fórmula de XP (DI6); gerador determinístico da Linha do tempo a partir de (data, banco).
- **Dependências:** nenhuma.
- **Aceite:** testes table-driven da avaliação do Termo (letra repetida no palpite e na resposta, acento, tamanho variável), da virada de dia (teste que prova que o dia do Diário e o do streak são o mesmo para o mesmo instante, inclusive às 20h59 e 21h00 de Brasília), da fórmula de XP (0 a 3 acertos => 20 a 50), da numeração e do acesso (antes da estreia nada é acessível; no dia da estreia só o #1; número futuro sempre recusado; mudar a estreia depois do início recusado) e dos geradores (mesma data => mesmo jogo; datas diferentes => jogos diferentes; Linha do tempo nunca sorteia dois eventos do mesmo ano).

- **Alterado pela DI17 (2026-10-17):** o tipo de cartão `on_this_day` virou `trivia` (Pergunta do dia); o resto do domínio não mudou.
- **Entregável:** `backend/src/modules/daily/domain/`, só funções puras (relógio sempre por parâmetro, sem banco nem HTTP): `gameDay.ts` (`dailyDay` = a mesma regra do streak via `shared/utcDate`; `resolveStatus` com `off`/`scheduled`/`live` derivado de `startDate` null ou da comparação com hoje, então o estado nunca contradiz o relógio; `gameNumberFor`/`gameDateFor` com #1 = dia da estreia; `resolveGameAccess`: desligado, antes da estreia, número futuro ou inexistente = `not_found` igual, só o jogo do dia com `awardsXp`), `launchSchedule.ts` (`validateStartDateChange`: trava depois do início, desligar também conta como mudança, data estritamente futura, mínimo de 30 dias revisados), `cards.ts` (`word`, `on_this_day`, `timeline`), `wordGuess.ts` (normalização sem acento/cedilha, verde/amarelo/cinza com letra repetida como no Termo, 4 a 9 letras, 6 tentativas, `isWordCardCorrect`), `cardAnswers.ts` (alternativa e ordem da Linha do tempo, que exige permutação exata), `xp.ts` (20 + 10 por cartão, de 20 a 50) e `timelineGenerator.ts` (PRNG com semente derivada da data, 4 fatos com anos distintos, nunca já em ordem, independe da ordem do banco). 90 testes table-driven novos, incluindo o que prova que o dia do Diário é o do streak (`todayUtc`) às 20h59 e às 21h00 de Brasília; suíte completa (4358 testes), lint, prettier e build passando.
  - **Fora de escopo, de propósito:** sem tabela, porta, caso de uso, rota ou composição (DI.1.2 em diante). Por isso não há `.docs/backend/daily.md` novo nem validação por `docker compose up`, como na EM.1.1. A janela de não repetição e a regra de variedade da agenda ficam na DI.1.3; o gerador só garante anos distintos e devolve `null` quando o banco não tem 4 anos distintos (a agenda trata como aviso).
  - **Escolhas de implementação (não são decisão de produto):** o estado "desligado" é `startDate` null, sem flag separada; agendar exige data estritamente futura (começar "hoje" não é agendar, e o jogo já estaria no ar). Se o autor quiser permitir estrear no próprio dia do agendamento, é só trocar a comparação em `validateStartDateChange`.

### DI.1.2 · Tabelas e repositórios ✅ (2026-10-17)
- **Descrição:** migration com `daily_settings` (estado do Diário e data de estreia, uma linha; quem e quando alterou), `daily_words` (resposta, definição, link opcional, categoria, marcador Brasil/fora, ativo), `daily_accepted_words` (forma normalizada, origem `vero` ou `extra`), `daily_questions` (enunciado, alternativas, resposta, explicação, fonte primária obrigatória, categoria, marcador Brasil/fora, revisado por e quando, ativo) e `daily_events` (ano, nome curto, explicação, fonte primária, categoria, marcador, ativo) para a Linha do tempo, `daily_puzzles` (número, data, conteúdo materializado de cada cartão, origem de cada item, revisado, publicado), `daily_results` (usuário, número, por cartão: acertou, tentativas, **os palpites do Termo e as respostas dadas**, para redesenhar o jogo em qualquer aparelho, seção 3.4; XP concedido; uma linha por usuário e jogo). Ports + adapters Drizzle.
- **Dependências:** DI.1.1.
- **Aceite:** teste de integração dos repositórios em banco descartável; UNIQUE (usuário, número) em `daily_results`; `when` do journal acima da última migration.

- **Alterado pela DI17 (2026-10-17), antes de qualquer merge:** `daily_facts` foi dividida em `daily_questions` (Pergunta do dia, sem data) e `daily_events` (Linha do tempo: `year`, `label`, `explanation`, fonte); `timeline_label` deixou de existir (o nome curto é `label`, obrigatório); `daily_puzzles` passou a `question_id` e `timeline_event_ids` (`question_origin`); `daily_results` a `question_choice` e `question_correct`. A migration `0053` foi regerada em vez de ganhar uma `0054`, porque ainda não foi aplicada em lugar nenhum. Os ports `DailyFactRepository` e o adapter viraram `DailyQuestionRepository` e `DailyEventRepository`. As frases abaixo sobre `daily_facts` e `timeline_label` descrevem a versão anterior.
- **Entregável:** migration `0053_add_daily_diary` (journal com `when` 1794500000000, acima da 0052) e as seis tabelas em `backend/src/db/schema.ts`: `daily_settings` (linha única por CHECK `id = 1`, criada pela migration; `start_date` nulo = desligado, sem coluna de estado), `daily_words`, `daily_accepted_words` (PK na forma normalizada), `daily_facts`, `daily_puzzles` (PK `number`, `game_date` UNIQUE, origem `generated`/`manual` por cartão, `reviewed_*`, `published_at`) e `daily_results` (UNIQUE `(user_id, puzzle_number)`, palpites e respostas dadas, nunca o gabarito). CHECKs no banco: resposta e palavra aceita só `[A-Z]{4,9}`, fonte primária não vazia, alternativa certa dentro das opções (2 a 6), Linha do tempo com 4 ids, "saiba mais" com tipo e referência juntos, XP não negativo. Domínio: `domain/content.ts` (entidades). Ports em `application/ports/` (`DailySettingsRepository`, `DailyWordRepository`, `AcceptedWordRepository`, `DailyFactRepository`, `DailyPuzzleRepository`, `DailyResultRepository`) e adapters Drizzle em `infrastructure/persistence/`. 17 testes de integração em banco real (UNIQUE, CHECKs, upsert de resultado, ordem e limite da agenda, apagar a agenda sem tocar jogo publicado); com `TEST_DATABASE_URL` passam, sem ele pulam. Lint, prettier, build e suíte (4358 testes) passando; migrations aplicadas do zero em Postgres 16 descartável.
  - **Escolhas de implementação (não são decisão de produto):** (1) `daily_facts.timeline_label`, coluna que o texto da tarefa não listava, mas a Linha do tempo precisa de um nome curto por evento ("Plano Real"); fato sem ela não entra no sorteio. (2) `daily_puzzles` **referencia** palavra e fatos dos bancos em vez de copiar o conteúdo: corrigir um texto no banco corrige o jogo. O custo é que desativar um item já agendado não o tira do jogo; a DI.1.3/DI.5.1 devem avisar. (3) `daily_results` não tem coluna de tentativas: no Termo é o tamanho de `word_guesses`, e os outros dois cartões têm uma tentativa válida só. (4) Categoria é texto livre (até 40 caracteres), sem lista fechada, porque o backlog não fixa as categorias; a DI.1.4 define as usadas.
  - **Fora de escopo, de propósito:** sem fakes de repositório em `test/fakes/` (nascem na DI.1.3, que é o primeiro caso de uso a consumi-los), sem caso de uso, rota ou composição, então nada novo em `.docs/backend/` e sem `docker compose up`. Os métodos dos ports são os que a DI.1.3 a DI.2.2 precisam; o seed por chave estável (DI.1.4) e as edições do painel (DI.5.1) acrescentam os seus.
  - **Aviso para quem rodar a suíte com banco:** as integrações de vários módulos compartilham o mesmo `TEST_DATABASE_URL` e se atrapalham em execução paralela (ex: `user_identities` sobrando bloqueia o `delete users` do billing). Rode por módulo ou com `--no-file-parallelism` em banco novo. Os testes do Diário limpam o que criam e não deixam resíduo.

### DI.1.3 · Agenda: materializar os próximos dias ✅ (2026-10-17)
- **Descrição:** caso de uso que garante jogos materializados para os próximos N dias (padrão 30), **a partir da data de estreia** enquanto o Diário estiver agendado e a partir de hoje depois que estiver no ar, usando os bancos e os geradores, nunca repetindo uma palavra-resposta dentro de uma janela (ex: 365 dias) nem uma pergunta dentro de outra, e aplicando a regra de variedade da seção 3.3 (categoria diferente em dias seguidos no mesmo cartão, maioria da semana sobre o Brasil). Materializar não é publicar: o jogo materializado fica pendente de revisão no painel. Scheduler no formato dos existentes (`payrollScheduler`/ranking), idempotente. Jogo já publicado nunca é regenerado sozinho (só por ação do admin). Mudar a data de estreia enquanto agendada refaz a agenda a partir da nova data, preservando o que já foi revisado sempre que possível.
- **Dependências:** DI.1.2.
- **Aceite:** testes com fakes: idempotência, janela de não repetição, regra de variedade, banco insuficiente gera aviso (não jogo quebrado), jogo publicado intocado, troca da data de estreia.

- **Alterado pela DI17 (2026-10-17):** o planejador não procura mais fato do dia e mês exatos (o aviso `on_this_day_not_exact` e o ponto 057 saíram); escolhe a pergunta por não repetição (365 dias), variedade de categoria e maioria do Brasil, como a palavra, e a Linha do tempo sorteia de `daily_events` (janela de 14 dias). Aviso `no_fact_available` virou `no_question_available`. Para a DI.1.4: 30 dias pedem 30 perguntas, 30 palavras e ~56 eventos distintos com anos diferentes.
- **Entregável:** `domain/agenda.ts` (`planDay`, função pura: dado o dia, os bancos e o histórico agendado ao redor, escolhe palavra, fato do "Neste dia" e Linha do tempo, ou devolve avisos `no_word_available`, `no_fact_available`, `no_timeline_available`, `on_this_day_not_exact`, `scope_rule_relaxed`), `domain/seededRandom.ts` (PRNG por semente, extraído do gerador da Linha do tempo), `MaterializeUpcomingPuzzlesUseCase` (estreia nula = não faz nada; agendado = 30 dias a partir da estreia; no ar = 30 dias a partir de hoje, com a numeração da estreia; só cria o que falta, nunca toca jogo publicado, e jogo criado nasce `generated`, sem revisão e sem publicação), `startDailyAgendaScheduler` (formato do `payrollScheduler`, registrado no `jobHealth` como `daily-agenda`, cadência de 1 h, `DAILY_AGENDA_INTERVAL_MS`), `daily/composition.ts` e a ligação no `server.ts` (sem estreia agendada é inofensivo). Port `DailyPuzzleRepository` troca `deleteUnpublishedFromDate` por `replaceUnpublished` (transação que substitui todos os não publicados). Fakes em `test/fakes/fakeDailyRepositories.ts`. 49 testes novos (35 do planejador puro, 14 do caso de uso com fakes) e 1 de integração ponta a ponta em banco real, mais 2 do `replaceUnpublished`; suíte (4388 testes), lint, prettier e build passando.
  - **Regras aplicadas (escolhas de implementação, valores ajustáveis em `DEFAULT_WINDOWS`):** palavra não repete em 365 dias (para os dois lados da data), pergunta do dia também 365, eventos da Linha do tempo em 14 (janela menor de propósito: o mesmo evento numa ordenação nova é aceitável, e uma janela grande exigiria um banco enorme); a Linha do tempo tenta até 20 sementes para misturar pelo menos 3 décadas e 2 categorias; categoria igual à do dia anterior ou seguinte é evitada no mesmo cartão, mas só como preferência; maioria sobre o Brasil = no máximo 3 itens "fora" em qualquer 7 dias seguidos por cartão, regra dura enquanto houver candidato do Brasil, senão relaxa com aviso.
  - **Mudança da estreia:** não há ação à parte. A cada execução os jogos não publicados são realinhados: antes da estreia saem, os demais são renumerados mantendo palavra, pergunta, eventos e revisão. A DI.5.1 só grava a nova data e roda o mesmo caso de uso. Jogo **publicado** nunca muda; se ficar desalinhado, vira aviso `published_misaligned` e o número ocupado é pulado, em vez de derrubar o job.
  - **Para a DI.1.4:** com essas janelas, 30 dias de agenda pedem 30 perguntas e 30 palavras, mais ~56 eventos distintos com anos diferentes para a Linha do tempo (cada dia consome 4 e nada repete por 14 dias). Como a Pergunta do dia não tem data, a curadoria não precisa cobrir o calendário.
  - **Ponto 057 (fato do dia exato):** superado pela DI17, sem decisão pendente.
  - **Fora de escopo, de propósito:** sem rota (DI.2.1), sem painel (DI.5.1) e sem `.docs/backend/` novo. Não rodei o `docker compose up` completo porque nada visível ao usuário mudou; o job só age com a estreia agendada, e a migration foi aplicada do zero em Postgres 16 descartável.

### DI.1.4 · Lista de palavras e conteúdo inicial
- **Descrição:** script que gera a lista aceita a partir do VERO (seção 3.1), com o arquivo gerado, a lista extra e o `NOTICE` versionados. Seed que importa só o que falta (por chave estável, nunca sobrescreve o que o painel editou, mesma regra do seed de lições): lista aceita, ~300 palavras-resposta, perguntas e eventos suficientes para **pelo menos 30 dias** de jogo (DI11; o ideal é sobrar folga para a regra de variedade e para a Linha do tempo sortear de um conjunto maior). Conteúdo segundo a linha editorial da seção 3.3 (Brasil no centro, fatos de fora só com o efeito no Brasil explicado, categorias variadas).
- **Dependências:** DI.1.2.
- **Aceite:** script reproduzível (rodar de novo gera o mesmo arquivo para o mesmo commit do VERO); toda palavra-resposta está na lista aceita; nenhum nome próprio nem palavra da lista de ofensivas na lista aceita; toda pergunta e todo evento têm fonte primária, categoria e marcador; os primeiros 30 dias materializados passam no checklist da seção 3.3 e na revisão do autor; tabela registrada aqui com a contagem por categoria e por marcador; texto sem "—".

## Fase B, API

### DI.2.1 · Rotas públicas do jogo
- **Descrição:** `GET /daily/today` (sem auth: estado do Diário; antes da estreia, só `{ status: "scheduled", startsAt }` ou `{ status: "off" }`; no ar, número, data, horário do próximo jogo e estrutura dos cartões **sem gabarito**); `GET /daily/:number` (o mesmo para um dia anterior; número maior que o de hoje = 404, seção 3.6); `POST /daily/:number/word/guess` (avalia um palpite, recusa palavra fora da lista aceita sem gastar tentativa, devolve as cores; ao acertar ou na 6ª tentativa, devolve resposta e definição); `POST /daily/:number/cards/:card/answer` (avalia, devolve certo/errado, explicação e o link "Saiba mais"). Zod na borda. Sem auth, o servidor não guarda estado: o progresso anônimo fica no navegador. **CORS:** essas rotas aceitam também a origem da landing (`https://selucra.com.br`), sem credenciais; o resto da API continua só com a origem do app. **Rate limit por IP** nas rotas sem auth, lendo o IP real atrás do Cloudflare (mesmo cuidado de proxy já registrado em `analise-ambiente-producao.md`).
- **Dependências:** DI.1.3.
- **Aceite:** testes de router (supertest) provando que nenhuma resposta antes do fim do cartão contém o gabarito; **toda rota com número recusa o dia seguinte ao de hoje com 404**, inclusive às 20h59 e 21h00 de Brasília (virada UTC); antes da estreia nenhuma rota de jogo funciona; dia anterior acessível; origem da landing aceita só nas rotas `/daily` públicas; `.docs/backend/daily.md` criado.

### DI.2.2 · Resultado, estatísticas, XP e streak com login
- **Descrição:** com auth, as mesmas rotas gravam em `daily_results` (uma tentativa válida por cartão por dia, com os palpites e respostas dados). `GET /daily/:number/me` devolve o estado salvo do usuário naquele jogo para redesenhar a tela (seção 3.4). Dia anterior jogado logado é gravado, mas sem XP, sem streak e sem sequência do Diário (seção 3.6). Ao concluir o último cartão **do jogo de hoje, antes da virada do dia**: XP pela fórmula DI6 via port (`xpAwarder`, mesmo padrão de lições e missões) e toque de streak via port (`streakTracker`, DI4), ambos uma vez por dia. `GET /daily/me/stats` (jogos, % de acerto por cartão, distribuição de tentativas do Termo, sequência atual e maior sequência do Diário). Nada jogado sem login é importado (DI8).
- **Dependências:** DI.2.1.
- **Aceite:** XP e streak concedidos uma vez por dia (idempotente, inclusive com duas abas); jogo de dia anterior nunca dá XP; jogo começado num dia e concluído depois da virada não dá XP; `GET /daily/:number/me` redesenha o mesmo estado em outro aparelho; resposta do último cartão devolve o XP ganho, o nível e as conquistas desbloqueadas (para o teatro de recompensa, Fase I do backlog de engajamento); documentação atualizada.

## Fase C, o jogo e a página pública (landing)

### DI.3.1 · Módulo do jogo, sem framework
- **Descrição:** o módulo da seção 3.2: grade do Termo (teclado físico e na tela, acento ignorado, animação de revelação, aviso de palavra não aceita sem gastar tentativa), os dois cartões de pergunta (alternativas da Pergunta do dia; ordenar a Linha do tempo por arrastar e por botões), tela de resultado (cartão de texto pela Web Share API, cópia para a área de transferência como fallback, contagem até o próximo jogo às 21h). Recebe o cliente da API, o modo (`publico`/`app`) e um "guardador de estado" por parâmetro: no modo `publico`, o `localStorage` com as regras da seção 3.4; no modo `app`, o servidor (`GET /daily/:number/me`). Ao abrir, redesenha o jogo do dia se já houver estado salvo, em vez de reiniciar. Aviso "Novo Diário disponível" na virada do dia sem apagar o jogo da tela. Lista de dias anteriores para jogar (sem XP). **Acessível:** a informação nunca depende só de cor (símbolo ou borda por estado, leitor de tela por letra, ordenação da linha do tempo sem precisar arrastar).
- **Dependências:** DI.2.1. O local exato do módulo (seção 3.2) é escolha técnica da própria tarefa.
- **Aceite:** testes do módulo (letra repetida, palavra recusada, resultado compartilhado sem resposta e sem valor em R$; recarregar a página no mesmo dia mostra o jogo como estava, com o tabuleiro e as respostas; dia seguinte começa limpo e mantém as estatísticas; estado com número futuro, corrompido ou de versão desconhecida é ignorado sem erro; sem `localStorage` o jogo funciona); modo claro e escuro pelas variáveis de cor; funciona em 320, 390, 768 e 1280 px.

### DI.3.2 · Página `selucra.com.br/diario`
- **Descrição:** nova página no build da landing (`landing/build.mjs`), com o conteúdo para busca **no HTML entregue** (título, como jogar, o que se aprende, perguntas frequentes) e o módulo do jogo montado em modo `publico`. Progresso, estatística e sequência do anônimo só no navegador (seção 3.4). **Antes da estreia** (seção 3.5), a mesma página mostra o conteúdo de "como jogar", as perguntas frequentes e a data de estreia no lugar do jogo, e já é indexável: é ela que vai para o Google e para a divulgação. Ao terminar (DI9): convite "Entre no app para ganhar XP e manter sua sequência", com link para `app.selucra.com.br/diario?origem=diario` (o parâmetro só serve para medir, DI.7.1; não trava nada, DP6) e para criar conta. Ligação no menu do cabeçalho da landing (mesmo lugar dos "Guias").
- **Dependências:** DI.3.1.
- **Aceite:** jogável deslogado do início ao fim; antes da estreia mostra a data e nenhum jogo; convite aparece ao terminar e leva ao app; com JS desligado a página ainda mostra o conteúdo e explica que o jogo precisa de JS; sem preço nem PRO.

### DI.3.3 · SEO e segurança da página
- **Descrição:** `title`, meta description, `canonical`, Open Graph com imagem própria do Diário, JSON-LD (`WebApplication` e `FAQPage` gerado das perguntas visíveis, mesmo teste de consistência da LW.6.2), entrada no `sitemap.xml`. **CSP** do `landing/src/static/_headers`: `connect-src` passa a liberar a origem da API. Cabeçalho de cache da página igual ao do `index.html` (sem cache longo).
- **Dependências:** DI.3.2.
- **Aceite:** testes de SEO do `landing/test/` cobrindo a página nova; Lighthouse SEO e Acessibilidade >= 95; Rich Results Test sem erro.

### DI.3.4 · Arquivo público dos dias anteriores (recomendado)
- **Descrição:** uma página estática por jogo encerrado (`/diario/47`, com a palavra, a definição, as perguntas e as explicações) e um índice do arquivo. É o que mais traz busca de cauda longa ("o que é spread", "quando foi o Plano Real"), porque o jogo do dia, sozinho, muda todo dia e carrega por JS. `GET /daily/archive` (público, só jogos encerrados) alimenta o build; um **build agendado por dia** (gatilho de deploy do Cloudflare Pages, disparado por um job agendado do GitHub Actions logo depois das 21h) gera as páginas novas. Se a API estiver fora no momento do build, o build mantém o arquivo anterior e não falha.
- **Dependências:** DI.3.3; Pages da landing publicado (LW.6.x).
- **Aceite:** jogo do dia nunca aparece no arquivo antes de encerrar; páginas no sitemap; links internos para os guias e para o Diário do dia.

## Fase D, o jogo dentro do app

### DI.4.1 · Rota `/diario` no app
- **Descrição:** rota logada no `frontend/` com um organismo que monta o módulo da DI.3.1 em modo `app`. Ao terminar: XP e conquistas pelo componente de celebração existente (Fase I do backlog de engajamento) e streak atualizado. O service worker não guarda resposta de `/daily` (regra do PWA: API nunca em cache).
- **Dependências:** DI.2.2, DI.3.1.
- **Aceite:** XP aparece uma vez por dia; teste de componente; responsivo nos três breakpoints.

### DI.4.2 · Portas de entrada e saída no app
- **Descrição:** chamada "Diário de hoje" no app (ex: cartão no Portfólio ou indicador na `TopBar`, apagado quando já jogado); "Saiba mais" de cada cartão leva ao Glossário ou à lição, respeitando o bloqueio da trilha (nunca aponta para lição inacessível, Fase N do backlog de engajamento); depois do último cartão, um próximo passo dentro do app (continuar a lição em andamento ou ver o mercado).
- **Dependências:** DI.4.1.
- **Aceite:** nenhum link para lição bloqueada; teste do destino seguro.

## Fase E, painel admin

### DI.5.1 · `/admin/diario`
- **Descrição:** **controle da estreia** (seção 3.5): ver o estado (desligado, agendado, no ar), agendar e mudar a data de estreia enquanto futura, ver quantos dias revisados existem à frente, desligar em emergência. Listar, criar, editar e desativar palavras-resposta, termos da lista extra, perguntas e eventos da Linha do tempo (ações auditadas, como as do painel de conteúdo); **prévia de qualquer dia futuro** como o jogador vai ver, marcar como revisado e corrigir antes de publicar; contagem por categoria e marcador Brasil/fora dos próximos 30 dias (seção 3.3); alerta quando o conteúdo revisado cobre menos de 14 dias à frente.
- **Dependências:** DI.1.3. **Precisa estar pronta antes da estreia** (é por ela que o autor agenda a data).
- **Aceite:** toda alteração gera linha de auditoria; agendar a estreia sem 30 dias revisados à frente é recusado; mudar a data depois do início é recusado; prévia de dia futuro só para `role = admin`; pergunta ou evento sem fonte recusado; palavra-resposta fora da lista aceita recusada; jogo já publicado não editável sem confirmação explícita.

## Fase F, integração com a gamificação

### DI.6.1 · Conquistas e missão
- **Descrição:** conquistas por qualidade, não por volume (ex: "Palavra na primeira", "7 Diários seguidos sem errar a Linha do tempo"), pelo enum de critérios já estendido na H.1 do backlog de engajamento. Opcional: missão diária "Jogue o Diário" (se entrar, o XP da missão soma ao do Diário: conferir que um dia perfeito não passa do teto que o autor achar razoável).
- **Dependências:** DI.2.2.
- **Aceite:** conquistas desbloqueadas pelo teatro de recompensa existente; teste de que jogo de dia anterior não conta para conquista.

### DI.6.2 · E-mail
- **Descrição:** incluir o Diário nos e-mails de engajamento opt-in que já existem (resumo semanal EM.7.1; streak em risco EM.7.3: "o Diário de hoje leva 3 minutos e mantém sua sequência"). Sem e-mail novo diário nesta fase.
- **Dependências:** DI.4.1.
- **Aceite:** só para quem optou; template no `registry.ts` com o teste de travessão.

## Fase G, medição

### DI.7.1 · Contadores do Diário
- **Descrição:** contadores agregados por dia, contados no servidor (o Web Analytics da Cloudflare na landing não registra evento): jogos iniciados e concluídos (públicos e logados), cadastros e logins que chegaram com `?origem=diario`. Visão simples no painel admin. Sem rastrear pessoa anônima individualmente (nada de identificador no navegador).
- **Dependências:** DI.3.2, DI.4.1.
- **Aceite:** números dos logados batem com `daily_results`; nenhum dado pessoal de anônimo gravado.

---

## Sequência sugerida

1. **DI.1.1 → DI.1.2 → DI.1.3** (fundação, sem tela).
2. **DI.1.4** em paralelo com a etapa seguinte: escrever e conferir as perguntas e os eventos leva mais tempo que o código.
3. **DI.2.1 → DI.3.1 → DI.3.2 → DI.3.3**: a partir daqui o jogo já roda na landing, sem login (dá para testar com amigos).
4. **DI.2.2 → DI.4.1 → DI.4.2**: o jogo no app, com XP e streak.
5. **DI.5.1** (painel e controle da estreia), depois **DI.6.1, DI.6.2, DI.7.1**.
6. **DI.3.4** quando a landing estiver publicada no Pages.

**Roteiro de lançamento** (fora do código, depois que tudo acima estiver publicado):
1. Publicar com o Diário **agendado** para uma data com folga (ex: 2 a 3 semanas). A página pública vai ao ar com a data de estreia.
2. Enviar a página ao Google (Search Console) e conferir que foi indexada.
3. Revisar no painel os 30 primeiros dias, um por um, pela prévia.
4. Divulgar nas redes apontando para a página, com a data.
5. No dia da estreia, conferir o jogo #1 na página pública e no app.

## 5. Relacionado, fora deste backlog

- **Modo História** (ideia de que o autor gostou na mesma sessão, sem backlog aberto): episódios solo de crises reais do mercado brasileiro (ex: Plano Collor, crise de 2008, Joesley Day, março de 2020), jogados no Sandbox determinístico (RF12), iguais para todos (ranking justo por episódio), com debrief do que aconteceu de verdade. Candidato a âncora PRO, com o primeiro episódio grátis. Quando existir, a Linha do tempo e a Pergunta do dia ganham a chamada "Quer viver esse dia? ▶ Modo História". Precisa de documento próprio antes de virar tarefa (conferir em fonte primária as datas e a sequência de cada episódio).
- Outras ideias da mesma sessão, não escolhidas agora: tribos de investidor, streak em dupla e evento "Reacende", clubes de investimento com as regras da CVM, licença de aprendiz e prova de nivelamento, teses com reputação, torcida por empresa, modo turma.
