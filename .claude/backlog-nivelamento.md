# Backlog — Teste de nivelamento ("Já sei isso")

Backlog executável criado em 2026-10-17, na mesma sessão de ideação do `backlog-diario.md` e do `backlog-empresas-jogadores.md`. Pedido do autor: **responder algumas perguntas para avançar para a próxima fase e já desbloquear as coisas**, sem precisar fazer todas as lições de uma trilha que a pessoa já domina.

Problema que resolve: a primeira compra de ação real só libera depois de cerca de 20 lições (Trilha 0 inteira, Trilha 1 inteira e o começo da Trilha 2). Para quem já investe, a primeira hora no app é toda leitura de coisa que já sabe, e esse é o perfil que mais desiste.

Não redecide a Fase Q do backlog de engajamento ("bloqueio é parede"): **a parede continua**, o teste é só outra forma de atravessá-la, provando que sabe.

**Como usar este arquivo**

1. Siga a "Sequência sugerida" no final. Uma tarefa por sessão; ao concluir, marcar ✅ e acrescentar o bullet **Entregável**.
2. Tarefa que toca `backend/` passa pelo checklist obrigatório do `CLAUDE.md` inteiro. Nenhuma tarefa toca `engine/`.
3. Telas novas responsivas nos três breakpoints, tokens de `identidade-visual-tokens.md`, texto sem "—", tela nova no inventário.
4. Conteúdo das lições vive no banco (N.23): perguntas novas para o teste entram pelo painel `/admin/conteudo`, nunca pelo seed.

---

## 1. Como funciona

- **Um teste por trilha da corrente principal** (Trilhas 0, 1, 2 e 3). A Trilha F (paralela, sempre aberta) não tem teste.
- O teste fica disponível para a **trilha em que a pessoa está** (a que tem a próxima lição disponível). Para pular várias trilhas, faz um teste de cada vez, em sequência.
- **As perguntas são os checkpoints que já existem nas lições daquela trilha** (blocos `check` e micro-decisões com alternativa correta). Não precisa escrever conteúdo novo; o teste sorteia do conjunto da trilha.
- **Passou:** todas as lições ainda não feitas daquela trilha viram **dispensadas** (`waivedAt`, mecanismo da N.24 que já existe). A progressão conta lição dispensada como satisfeita, então tudo o que a trilha libera (produtos, próxima trilha) abre na hora, pela regra atual, sem mudar a lógica de desbloqueio.
- **Não passou:** a pessoa vê **quais assuntos errou**, com o link de cada lição correspondente, e pode tentar de novo depois de um intervalo.
- **Tudo ou nada por trilha.** A progressão é linear e conta *quantas* lições estão satisfeitas, não *quais*; dispensar só algumas lições do meio quebraria essa regra.

## 2. Decisões

### Fechada pelo autor (2026-10-17)

| # | Decisão |
|---|---|
| NV1 | Responder perguntas permite avançar de fase e desbloquear o que ela libera. |

### Propostas (confirmar ao abrir a tarefa que depende delas)

| # | Proposta | Onde pesa |
|---|---|---|
| NP1 | Teste de **10 perguntas** sorteadas da trilha (**15** na Trilha 2, que é a maior), aprovação com **80%**. | NV.1.1 |
| NP2 | **O gabarito nunca aparece no teste.** As respostas são enviadas todas no fim, o servidor corrige e devolve só a nota e os assuntos errados. Isso impede decorar o teste tentando de novo. | NV.1.3 |
| NP3 | **Depois de reprovar, nova tentativa só depois de 24 horas** (contra tentativa e erro em sequência). Não é escassez para vender nada: não existe forma de pagar para tentar antes. | NV.1.1 |
| NP4 | **Lição dispensada pelo teste não dá XP** (regra atual da dispensa). Ela continua aberta: quem fizer a lição depois ganha o XP normal. O mapa mostra a lição como "dispensada pelo teste" com o convite a fazê-la. | NV.2.2 |
| NP5 | Fazer o teste conta como atividade do dia para o streak (mesmo princípio do Diário). | NV.1.3 |
| NP6 | Depois de passar na Trilha 2, uma tela curta "Como funciona aqui" resume os blocos "Na plataforma" das lições dispensadas (ordem, corretora, custos na simulação). Assim quem pulou não fica sem saber as regras do app. | NV.2.1 |

### Em aberto

| # | Pergunta | Recomendação | Bloqueia |
|---|---|---|---|
| NA1 | **Troféu de trilha.** Hoje `completedTrackNumbers` (`lessons/domain/lesson.ts`) conta lição dispensada como satisfeita, então uma trilha dispensada pelo teste daria o troféu de "trilha concluída" (sala de troféus, Fase F do engajamento) e contaria para conquistas de trilha. | Separar a origem da dispensa (coluna nova, ex: `waive_source` = `catalog_insert` ou `placement`). Dispensa pelo teste libera a progressão, mas **não** dá troféu nem conquista de trilha; o troféu vem quando a pessoa fizer as lições. Conquista própria "Nivelado na Trilha X". | NV.1.2 |
| NA2 | **Oferecer o teste no onboarding** ("Você já investe?") ou só no hub de trilhas? | Os dois: no onboarding, para quem diz que já investe; no hub, para todos. | NV.2.1 |

## 3. Tarefas

### NV.1.1 · Domínio do teste
- **Descrição:** em `backend/src/modules/lessons/domain/`: quais trilhas têm teste (exclui as paralelas, `isParallelTrack`), quando o teste está disponível (trilha atual, não toda satisfeita), montagem do teste (sorteio das perguntas de checkpoint e micro-decisão da trilha, sem repetir lição quando der, semente guardada para auditar), correção (reaproveitando `isCheckCorrect` e a regra da micro-decisão), nota e aprovação (NP1), intervalo depois de reprovar (NP3), lista de assuntos errados (lição de origem de cada pergunta).
- **Dependências:** confirmar NP1 e NP3.
- **Aceite:** testes table-driven de disponibilidade (trilha paralela, trilha já feita, trilha futura), sorteio determinístico pela semente, correção, limite de 80% exato, intervalo.

### NV.1.2 · Persistência e origem da dispensa
- **Descrição:** tabela `lesson_placement_attempts` (usuário, trilha, perguntas servidas, semente, respostas, nota, aprovado, quando). Coluna de origem da dispensa em `user_lesson_progress` conforme NA1, e `completedTrackNumbers`/conquistas de trilha passando a ignorar dispensa por teste (se NA1 for aceita). Dispensas antigas (N.24) seguem como estão.
- **Dependências:** NV.1.1; NA1 decidida.
- **Aceite:** integração em banco descartável; teste de que a dispensa antiga continua contando para o troféu e a do teste não (se NA1 for aceita); `when` do journal acima da última migration.

### NV.1.3 · Casos de uso e rotas
- **Descrição:** `GET /lessons/placement/:track` (disponibilidade, intervalo restante, tamanho do teste); `POST /lessons/placement/:track/start` (cria a tentativa, devolve as perguntas **sem gabarito**); `POST /lessons/placement/attempts/:id/submit` (todas as respostas de uma vez; corrige; se aprovado, dispensa numa transação todas as lições não satisfeitas da trilha; devolve nota, assuntos errados com link e o que foi desbloqueado). Toque no streak (NP5) pelo `streakTracker`. Zod na borda; documentação em `.docs/backend/lessons.md`.
- **Dependências:** NV.1.2.
- **Aceite:** testes de router provando que nenhuma resposta antes do envio contém gabarito; envio duplicado não dispensa duas vezes; tentativa de outra pessoa recusada; teste de que, após aprovar, `getUnlockedProductKeys` já traz os produtos da trilha.

### NV.2.1 · Telas do teste
- **Descrição:** chamada "Já sei isso? Fazer o teste" no hub de trilhas e no mapa da trilha atual; pergunta no onboarding (NA2); tela do teste (uma pergunta por vez, barra de progresso, sem mostrar certo/errado durante o teste); tela de resultado: aprovado = celebração existente (Fase I) com a lista do que abriu e, depois da Trilha 2, o "Como funciona aqui" (NP6); reprovado = assuntos errados com link para cada lição e quanto falta para tentar de novo.
- **Dependências:** NV.1.3; NA2 decidida.
- **Aceite:** responsivo; links respeitam o bloqueio (destino seguro da Fase N); texto sem "—"; teste de componente.

### NV.2.2 · Mapa e perfil mostram a dispensa
- **Descrição:** lição dispensada pelo teste aparece no mapa com estado próprio ("dispensada pelo teste: faça para ganhar XP"), diferente de concluída; sala de troféus e perfil seguem a decisão NA1.
- **Dependências:** NV.1.2, NV.2.1.
- **Aceite:** fazer a lição dispensada depois dá XP e, se for a última da trilha, o troféu.

### NV.3.1 · Auditoria do banco de perguntas
- **Descrição:** contar quantas perguntas com alternativa correta cada trilha tem; onde não houver o suficiente para sortear o teste com folga (pelo menos o dobro do tamanho do teste), acrescentar checkpoints nas lições pelo painel `/admin/conteudo`, seguindo `diretrizes-redacao-licoes.md`.
- **Dependências:** nenhuma (pode começar já, em paralelo).
- **Aceite:** tabela por trilha registrada aqui (perguntas existentes, faltantes, acrescentadas); toda trilha com teste tem o mínimo.

## Sequência sugerida

1. **NV.3.1** primeiro ou em paralelo: sem perguntas suficientes não há teste.
2. **NV.1.1 → NV.1.2 → NV.1.3** (decidir NA1 antes da NV.1.2).
3. **NV.2.1 → NV.2.2** (decidir NA2 antes da NV.2.1).
