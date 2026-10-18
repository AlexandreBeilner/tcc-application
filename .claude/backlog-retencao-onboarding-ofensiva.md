# Backlog — Painel de retenção, primeira ação no onboarding e ofensiva em dupla

Backlog executável criado em 2026-10-17, na mesma sessão de ideação do `backlog-diario.md`, `backlog-empresas-jogadores.md` e `backlog-nivelamento.md`. São três melhorias menores, escolhidas pelo autor para os próximos dias, que reaproveitam peças que já existem e não se sobrepõem às outras três frentes:

| Fase | Melhoria | Prefixo |
|---|---|---|
| A | **Painel de retenção** no admin: medir se as novidades funcionam | RT |
| B | **Primeira ação no onboarding**: fazer, não só ler, antes da primeira lição | OB |
| C | **Ofensiva em dupla**: sequência mantida por dois amigos juntos | OD |

As três são independentes entre si. **A Fase A deveria ir primeiro**: sem ela não há como saber se Diário, Empresas, Nivelamento e as Fases B e C mudaram alguma coisa.

**Como usar este arquivo**

1. Uma tarefa por sessão. Ao concluir: verificar os critérios de aceite, marcar ✅ e acrescentar o bullet **Entregável**.
2. Tarefa que toca `backend/` passa pelo checklist obrigatório do `CLAUDE.md` inteiro. Nenhuma tarefa toca `engine/`.
3. Telas novas responsivas nos três breakpoints, tokens de `identidade-visual-tokens.md`, texto sem "—", tela nova no `inventario-telas-plataforma-investimentos.md`.
4. Nada expõe patrimônio de um usuário a outro (RNF09). O admin pode ver números agregados.

---

## Fase A, painel de retenção (RT)

### Contexto

- `daily_activity` (`backend/src/db/schema.ts`, MO.5.4) guarda um dia por pessoa com **atividade qualificadora** (lição ou missão concluída, o dia do streak, em UTC). Mede estudo, mas **não mede presença**: quem só entra para operar ou olhar o mercado não aparece.
- `funnel_events` guarda o funil do PRO (convite visto, planos abertos, compra iniciada, assinou, cancelou).
- As ordens de usuário passam pelo backend (`POST /market/orders` em `market/interfaces/http/marketRouter.ts`), então o backend consegue registrar a **primeira operação real** sem tocar o motor.
- O painel já tem uma visão geral (`admin/application/useCases/getAdminOverview.ts`).

### Decisões propostas (confirmar ao abrir a tarefa)

| # | Proposta |
|---|---|
| RP1 | **Duas medidas de retenção, lado a lado:** "voltou" (qualquer acesso autenticado no dia) e "estudou" (`daily_activity`). A diferença entre as duas é informação: gente que volta mas não estuda. |
| RP2 | **Coorte por semana de cadastro**, com a % que voltou no dia 1, dia 7 e dia 30 depois do cadastro (o dia em UTC, mesma convenção do streak). |
| RP3 | **Marcos por pessoa** guardados uma vez, nunca recalculados: primeiro acesso depois do cadastro, primeira lição concluída, **primeira operação real** (ação, FII, ETF ou renda fixa do mercado ao vivo; Sandbox não conta), primeiro Diário (quando existir), entrou numa empresa (quando existir). |
| RP4 | Só números agregados no painel. Nenhuma lista de "quem não voltou" com nome nesta fase. |

### RT.1.1 · Registro de presença diária e marcos ✅
- **Descrição:** tabela `daily_presence` (usuário, dia; chave primária composta, como `daily_activity`) gravada por um middleware depois da autenticação, no máximo uma escrita por pessoa por dia (cache em memória do último dia gravado por usuário, para não escrever a cada requisição). Tabela `user_milestones` (usuário, marco, quando; UNIQUE por usuário e marco) gravada pelos casos de uso donos de cada fato, por port: lição concluída (`lessons`), ordem real executada (`market`, só quando o ativo não é Sandbox e a ordem teve execução), renda fixa comprada no mercado ao vivo. Diário e Empresas acrescentam os seus marcos quando existirem.
- **Dependências:** nenhuma.
- **Aceite:** falha ao gravar presença ou marco nunca derruba a requisição (best-effort com log, como o dia de atividade); o mesmo marco gravado duas vezes não duplica; ordem de Sandbox não gera o marco de primeira operação; teste do middleware com o cache (duas requisições no mesmo dia = uma escrita).
- **Entregável:** migration `0060_add_retention_tracking` (journal `when` 1795300000000) com `daily_presence` (PK `(user_id, day)`, índice por `day` para o DAU) e `user_milestones` (UNIQUE `(user_id, milestone)`; `milestone` é texto, não enum de banco, para um marco novo não exigir migração). Módulo novo `backend/src/modules/retention/` (DDD lite): `domain/milestones.ts` (`first_lesson`, `first_trade`, `first_fixed_income`, `first_daily`; "primeiro acesso depois do cadastro" sai de `daily_presence`, não é marco gravado), ports `PresenceRepository` e `MilestoneRepository`, casos de uso `RecordPresenceUseCase` (cache em memória do último dia UTC gravado por pessoa, reiniciado na virada do dia; se a gravação falha, solta a marca e tenta na próxima requisição) e `RecordMilestoneUseCase` (best-effort com log), adapters Drizzle com `onConflictDoNothing` e `composition.ts` que devolve a presença e um listener por módulo dono do fato. Presença entra em `createAuthMiddleware` por um terceiro argumento opcional `PresenceTracker`, chamado só depois que a guarda de sessão aprova (conta suspensa ou sessão revogada não "voltou"). Marcos pelos donos do fato, por ports próprias: `LessonCompletionListener` (já existia, agora composto com a indicação) para a primeira lição, novo `LiveTradeListener` em `market` (`PlaceOrderUseCase` só avisa se `filled_quantity > 0` e o ativo não é Sandbox; `PurchaseFixedIncomeUseCase` idem sem a exigência de execução) e novo `DailyCompletionListener` em `daily` (`DailyProgressRecorder`, vale também para dia anterior sem XP). Falha de qualquer gravação só vira log. Testes: presença (duas requisições no mesmo dia = uma escrita, virada de dia, falha e nova tentativa), marco (duplicado mantém a primeira data, falha não propaga), middleware (4 casos), mercado (ao vivo, Sandbox, sem execução, listener que falha, renda fixa), Diário (aviso uma vez, jogo em andamento não avisa) e 2 integrações em Postgres real. `drizzle-kit generate` responde "No schema changes". Lint, `tsc`, prettier nos arquivos tocados e suíte (5033 testes) passando; imagem do backend reconstruída e migração aplicada.
  - **Limite conhecido:** uma ordem limitada que fica no livro e só enche depois, num tick do motor, não passa pelo backend no momento do preenchimento, então o marco `first_trade` sai na próxima operação com execução imediata. Usuários que já existiam não têm marcos antigos (as coortes antigas aparecem como "sem dado" no painel).
- **Observação:** os dados começam a contar na publicação. Para usuários que já existiam, a primeira operação real pode ser preenchida uma vez a partir do extrato do motor, se valer o esforço; senão, as coortes antigas ficam marcadas como "sem dado".

### RT.1.2 · Casos de uso das métricas ✅
- **Descrição:** em `admin/application/useCases/`: retenção por coorte semanal (dia 1, 7 e 30, nas duas medidas de RP1), usuários ativos por dia e por mês e a razão entre eles (DAU/MAU), mediana do tempo entre o cadastro e cada marco de RP3 e a % de cada coorte que chegou nele. Consultas agregadas por port; nada calculado no router.
- **Dependências:** RT.1.1.
- **Aceite:** testes com dados sintéticos de tamanho realista (milhares de usuários e meses de atividade, não os poucos de hoje); coorte que ainda não chegou ao dia 30 aparece como "em andamento", não como zero; rota com Zod documentada em `.docs/backend/admin.md`.
- **Entregável:** `GET /admin/retention?weeks=&days=` (Zod: `weeks` 1 a 52, padrão 12; `days` 7 a 180, padrão 60), documentada em `.docs/backend/admin.md`. Domínio puro em `admin/domain/retention.ts` (semana UTC de segunda a domingo, `retentionCell`, maturidade de coorte). Port `RetentionReader` com consultas agregadas (`trackingStart`, `cohortCounts`, `dailyActive`, `milestoneStats`) e adapter `drizzleRetentionReader.ts` em SQL, que só devolve números e conta só `role = user`. Três casos de uso em `admin/application/useCases/`: `GetRetentionCohortsUseCase` (coorte semanal dia 1, 7 e 30 nas duas medidas de RP1), `GetActiveUsersUseCase` (DAU por "voltou" e "estudou", MAU de 30 dias, DAU/MAU) e `GetMilestoneTimesUseCase` (mediana em segundos até cada marco, % de cada coorte que chegou). Decisões de leitura que o painel precisa respeitar: o dia N é o dia **exato** depois do cadastro (UTC); célula cujo dia N não fechou é `in_progress` e a anterior ao início do registro é `no_data`, nunca zero; `partial` quando só parte da coorte foi medida; as duas medidas têm início de registro próprio (`daily_activity` é mais antiga que `daily_presence`); o gráfico termina ontem; MAU e DAU/MAU ficam `null` até a janela de 30 dias estar toda dentro do período registrado (MAU incompleto inflaria a razão); os marcos só contam quem se cadastrou depois do primeiro dia de registro, e "primeiro retorno" sai de `daily_presence` com precisão de dia. Testes: 13 de domínio; 16 dos casos de uso com 5 mil pessoas sintéticas e 40 administradores em 7 meses (`test/retentionDataset.ts`, PRNG determinístico) sobre um leitor em memória (`test/fakes/inMemoryRetentionReader.ts`) que implementa a mesma semântica do SQL; 10 do router (401, 403, 400 em 6 entradas, padrões, ausência de identificadores); e **5 de integração em Postgres real** que gravam 3 mil pessoas e milhares de linhas de presença, atividade e marcos e exigem resultado idêntico ao do leitor em memória (coortes, ativos por dia, MAU, medianas). Lint, `tsc`, build, prettier nos arquivos tocados e suíte (5072 testes) passando.
  - **Custo conhecido:** o MAU é um `count(distinct)` por dia sobre uma janela de 30 dias (180 dias de gráfico = 180 janelas). Está certo e rápido na escala atual; se o produto passar de algumas dezenas de milhares de pessoas ativas, vale trocar por uma tabela diária agregada.

### RT.1.3 · Tela `/admin/retencao`
- **Descrição:** tabela de coortes (linhas = semana de cadastro, colunas = dia 1, 7, 30, cor por faixa), gráfico de ativos por dia com a razão DAU/MAU, cartões de tempo até cada marco. Link a partir da visão geral do painel.
- **Dependências:** RT.1.2.
- **Aceite:** responsiva; gráfico segue a regra de linha com altos e baixos de `identidade-visual-padroes.md`; tela no inventário.

---

## Fase B, primeira ação no onboarding (OB)

### Contexto

- O onboarding (`frontend/src/pages/Onboarding/index.tsx`) tem 5 slides só de texto ("Você começa com R$ 10.000 simulados", "Aprenda fazendo, não lendo", "Aqui o tempo passa mais rápido"...) e a tela de preferências. A pessoa não faz nada antes da primeira lição.
- O Sandbox (RF12/RNF08, `engine/internal/domain/sandbox/sandbox.go`) usa um **roteiro fixo de preço por ticker**, igual para todos, contado em **dias simulados a partir da primeira compra**. Logo depois de comprar, o preço ainda não andou.
- Compra de Sandbox passa pela mesma rota de ordens e **mexe no mesmo saldo** da conta (`.docs/engine/orders.md`: `current_balance` e `total_invested` não filtram `is_sandbox`). As lições que usam Sandbox já resolvem como isso aparece no Portfólio e fica fora do ranking (spec seção 6: só posição do mercado ao vivo conta).

### Decisões propostas (confirmar ao abrir a tarefa)

| # | Proposta |
|---|---|
| OP1 | **Um slide vira ação:** "Aprenda fazendo, não lendo" deixa de ser texto e passa a ser uma compra guiada de uma ação de ensino do Sandbox (quantidade pequena e fixa, valor bem abaixo dos R$ 10.000), em 2 ou 3 toques, com cada passo explicado (o que é o ticker, o preço, a quantidade, o total). |
| OP2 | **Sem fingir a subida.** Em vez de animar um preço que ainda não mudou, a tela diz a verdade: "Aqui o tempo passa mais rápido. Volte amanhã para ver como foi sua primeira ação." No próximo acesso, um cartão no Portfólio mostra o resultado real do roteiro ("Sua primeira ação: +3% em 5 dias simulados") e leva à lição que explica por que preço muda. Isso também é um motivo concreto para voltar no dia 1. |
| OP3 | **Mesmo caminho das lições com Sandbox.** O onboarding usa exatamente a mesma chamada, o mesmo ativo de ensino (ou um roteiro já existente que suba) e a mesma forma de exibir a posição que as lições já usam. Nenhuma regra nova de saldo ou de ranking. |
| OP4 | **Pular é sempre possível**, e quem pula segue o onboarding normal. |

### Em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| OA1 | **O Portfólio só libera na lição 0.1** ("Acesso ao Portfólio"). O cartão de resultado do OP2 aparece mesmo antes da 0.1 (como exceção, só esse cartão), ou aparece na tela da trilha até a 0.1 ser feita? | OB.1.2 |

### OB.1.1 · Verificar o caminho do Sandbox usado pelas lições
- **Descrição:** sessão curta de leitura e teste: qual ativo de ensino e qual roteiro as lições usam, como a compra de Sandbox aparece no Portfólio e no extrato, como fica fora do ranking e da rentabilidade, o que acontece se a pessoa repetir a compra numa lição depois (o roteiro conta da primeira compra: `created_day`). Registrar o resultado aqui e, se algo exigir decisão de produto, em `pontos-em-aberto-decisao-produto.md`.
- **Dependências:** nenhuma.
- **Aceite:** seção "Achados" acrescentada nesta tarefa com as respostas; nenhum código alterado (se houver bug mecânico, corrige-se na hora, na mesma sessão).

### OB.1.2 · Compra guiada no onboarding
- **Descrição:** o slide "Aprenda fazendo" vira o passo de compra guiada (OP1), usando o caminho registrado na OB.1.1 (OP3). Erro na compra (mercado fora do ar etc.) não trava o onboarding: mostra uma mensagem e segue. Cartão do resultado no próximo acesso (OP2), conforme OA1. Marco "primeira operação" **não** é gravado (é Sandbox, RP3).
- **Dependências:** OB.1.1; OA1 decidida.
- **Aceite:** teste de integração do onboarding com a compra (sucesso, erro, pular); cartão só aparece quando o roteiro já andou; texto sem "—"; responsivo.

---

## Fase C, ofensiva em dupla (OD)

### Contexto

- O streak (`gamification/domain/streak.ts`) é individual, por dia UTC, sem congelamento.
- `daily_activity` já tem, por pessoa, cada dia em que ela teve atividade qualificadora. A ofensiva em dupla pode ser **calculada a partir dessa tabela**, sem gancho novo em lição, missão ou Diário: um dia conta para a dupla quando os dois aparecem nele.
- Amizade é bilateral com aceite (`friendships`). Sem bloqueio entre usuários nesta fase.

### Decisões propostas (confirmar ao abrir a tarefa)

| # | Proposta |
|---|---|
| ODP1 | Só entre **amigos** (amizade aceita). Um convida, o outro aceita. Até **5 duplas** por pessoa. Grátis (streak é core loop, nunca PRO). |
| ODP2 | **Conta o dia em que os dois tiveram atividade qualificadora** (o mesmo critério do streak individual, dia UTC). Se o Diário passar a contar para o streak (`backlog-diario.md`, DI4), conta para a dupla também, de graça, pela mesma tabela. |
| ODP3 | **Proteção:** cada dupla ganha 1 proteção a cada 7 dias de ofensiva (acumula no máximo 2). Num dia em que só um dos dois teve atividade, a proteção é usada sozinha e a ofensiva não quebra. Nunca se compra proteção. |
| ODP4 | **Ver o amigo durante o dia:** a tela mostra se o amigo já fez a parte dele hoje. Botão "Lembrar" grava um aviso que o amigo vê ao abrir o app (sem push, decisão LW8) e, se ele tiver ativado o e-mail social, vai no e-mail de streak em risco (EM.7.3) daquele dia. No máximo um lembrete por dupla por dia. |
| ODP5 | Marcos de 7, 30 e 100 dias de dupla viram conquista e evento no feed social ("Ana e Bruno chegaram a 30 dias juntos"). |
| ODP6 | Desfazer a amizade encerra a dupla. Qualquer um dos dois pode encerrar a dupla sem desfazer a amizade. |

### OD.1.1 · Domínio e tabelas
- **Descrição:** módulo novo (ex: `backend/src/modules/pairStreaks/`) ou dentro de `gamification`, decidir na tarefa seguindo `arquitetura-backend-ddd-lite.md`. `domain/`: avanço da dupla dia a dia a partir dos dias de atividade dos dois (função pura), uso e ganho de proteção (ODP3), marcos (ODP5). Tabelas: `pair_streaks` (os dois usuários em ordem fixa para a dupla ser única, estado: pendente, ativa, encerrada; sequência atual e maior; proteções; último dia avaliado), lembretes do dia.
- **Dependências:** nenhuma.
- **Aceite:** testes table-driven: os dois ativos, só um ativo com e sem proteção, nenhum ativo, avaliar o mesmo dia duas vezes não muda nada, voltar depois de vários dias sem avaliação (job parado) dá o mesmo resultado que avaliar dia a dia.

### OD.1.2 · Avaliação diária e casos de uso
- **Descrição:** job idempotente logo depois da virada do dia UTC (formato dos schedulers existentes) que avalia o dia anterior de cada dupla ativa, lendo `daily_activity` por port. Casos de uso: convidar (só amigo, limite de 5), aceitar, recusar, encerrar, lembrar (ODP4), listar minhas duplas com o estado de hoje. Encerramento automático quando a amizade é desfeita (port chamada pelo módulo `friendships`). Rotas com Zod; documentação em `.docs/backend/`.
- **Dependências:** OD.1.1.
- **Aceite:** testes com fakes de cada regra; teste de que "hoje" aparece como "os dois já fizeram" antes do job rodar (a tela não espera o job para mostrar o dia corrente).

### OD.1.3 · Telas
- **Descrição:** seção "Ofensivas em dupla" (no Perfil ou em Amigos, junto da sequência individual): cada dupla com a chama, os dias, as proteções e o estado de hoje dos dois; convidar a partir da lista de amigos; aviso de lembrete ao abrir o app; celebração dos marcos pelo componente existente (Fase I do engajamento).
- **Dependências:** OD.1.2.
- **Aceite:** responsiva; telas no inventário; texto sem "—"; nenhum dado além de dias e sequência aparece para o amigo.

### OD.1.4 · Conquistas, feed e e-mail
- **Descrição:** conquistas de 7, 30 e 100 dias de dupla (enum de critérios, H.1 do engajamento); evento no feed social; lembrete incluído no e-mail de streak em risco (EM.7.3) para quem optou.
- **Dependências:** OD.1.2.
- **Aceite:** conquista desbloqueada uma vez por dupla e marco; e-mail só para quem optou; template com o teste de travessão.

---

## Sequência sugerida

1. **RT.1.1** primeiro (os dados só começam a contar quando o registro existe), depois **RT.1.2 → RT.1.3**.
2. **OB.1.1 → OB.1.2** (decidir OA1 antes da OB.1.2).
3. **OD.1.1 → OD.1.2 → OD.1.3 → OD.1.4**.
