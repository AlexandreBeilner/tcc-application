# Inventário de Telas — Plataforma Gamificada de Investimentos

> Documento vivo. Complementa `especificacao-plataforma-investimentos.md` e `analise-telas-plataforma-investimentos.md`. Aqui está definida, com precisão, **toda tela da aplicação** — objetivo, conteúdo, estados e como cada uma se conecta às outras. Inclui a extensão do **sistema de amigos/relações sociais**, ainda não coberto na spec original.

**Versão:** 0.1
**Convenção de leitura:** cada tela segue o mesmo template — Objetivo · Acesso (de onde chega) · Conteúdo · Ações (para onde leva) · Estados especiais · Dados envolvidos (entidades do DER, quando relevante).

---

## 0. Arquitetura de Informação (visão macro)

### 0.1 Navegação primária (sempre visível, tab bar / sidebar)

```
Portfólio · Trilha · Mercado · Calculadora · Classificação
```

Cinco itens — mesmo número da spec original, com "Trilha" adicionada como novo item de primeiro nível, já que é o núcleo pedagógico do produto (seção 1.1 da análise anterior) e não deveria viver escondida dentro de outra aba.

### 0.2 Barra superior (persistente em todas as telas autenticadas)

- Logo/nome do app
- **Ícone de notícias/eventos** (com badge de novidade) → Feed de Notícias
- **Relógio do mercado** (tarefa S.12, tela 4.11): chip com o dia simulado, a data e o tempo até o próximo dia ("Dia 135 · qua 20/05 · próximo dia em 2h14"), com ponteiro que avança; no fim de semana simulado vira o selo tracejado "Mercado fechado" com quando reabre. Toque abre o Calendário (4.11). No mobile (375px, com logo, dois sinos e avatar) vira duas linhas curtas: "Dia 135" / "qua 20/05" (fechado: "Fechado" / "sáb 23/05"); o texto completo fica no tablet, no desktop e no rótulo de acessibilidade.
- **Avatar do usuário** → menu suspenso:
  - Meu Perfil
  - Amigos
  - Conquistas
  - Configurações e Privacidade
  - Painel Administrativo *(visível apenas se `role = admin`)*
  - Sair

### 0.3 Diagrama de fluxo entre grupos de telas

```
Autenticação → Onboarding → [Shell principal]
                                 │
        ┌──────────┬────────────┼────────────┬──────────────┐
        │          │            │             │              │
   Portfólio    Trilha      Mercado      Calculadora   Classificação
        │          │            │                             │
        │          │       ┌────┴────┐                   (toggle)
        │          │   Renda Fixa  Renda Variável      Global · Amigos
        │          │       │            │
        │          │   Detalhe RF   Detalhe RV ── Perfil da Empresa
        │          │       │            │
        │          │       └─── Confirmação de Ordem ───┘
        │          │                    │
        │          └──── Lição ─────  Extrato/Histórico
        │
   Avatar (menu) → Meu Perfil · Amigos · Conquistas · Configurações · Admin
```

### 0.4 Nota sobre o sistema de amigos (extensão à spec)

A spec atual não cobre relações sociais além do ranking. Para "amigos competirem entre si" é preciso um relacionamento explícito entre usuários — decisões assumidas aqui (a validar):

- **Amizade é bilateral e requer aceite** (solicitação → aceite/recusa), não é "seguir" unilateral. Isso importa porque rentabilidade é dado sensível e LGPD (RNF04) já exige gestão de consentimento — expor patrimônio de alguém sem aceite mútuo seria inconsistente com esse requisito.
- **Extensão ao modelo de dados** (já formalizada na seção 8 da spec v0.4):

| Nova entidade / campo | Onde | Motivo |
|---|---|---|
| `friendships` (nova tabela) | Liga dois `users`, com `status` (pending/accepted) e `requester_id`/`addressee_id` | Modela o relacionamento bilateral |
| `username` público (novo campo) | `users` | Necessário pra busca de amigos sem expor e-mail |

**Decisões já fechadas na spec (v0.4):** amizade é bilateral com aceite; não há bloqueio de usuário nesta fase; **não há opção de perfil privado** — todo perfil é público, aparece em buscas e no ranking global desde o cadastro. A única garantia de privacidade mantida é que **o valor absoluto de patrimônio nunca é exposto a outros usuários**, só rentabilidade percentual — isso não é configurável, é regra do sistema.

---

## 1. Autenticação e Onboarding

### 1.1 Tela de Autenticação
- **Objetivo:** ponto único de entrada — login de usuário existente ou criação de conta nova.
- **Acesso:** primeira tela do app para usuário não autenticado.
- **Conteúdo:** campo de e-mail, botão "Entrar com e-mail", botão "Entrar com Google" (OAuth, já modelado em `user_identities`), links de Termos de Uso e Política de Privacidade.
- **Ações:**
  - Cadastro bem-sucedido → **1.2 Onboarding** (primeira vez) ou **3.1 Portfólio** (login recorrente).
  - Login com credencial inválida → estado de erro inline, sem navegação.
- **Estados especiais:** carregando (aguardando resposta do provedor OAuth), erro de credencial.
- **Dados envolvidos:** `users`, `user_identities`.

### 1.2 Onboarding / Boas-vindas
- **Objetivo:** contextualizar o novo usuário antes de cair "sem explicação" no Portfólio — explicar que existe um saldo simulado de R$10.000 (equidade de partida, seção 3.5 da spec) e que o aprendizado acontece pela Trilha.
- **Acesso:** apenas na primeira sessão após cadastro (1.1).
- **Conteúdo:** 2–3 telas curtas (carrossel), tom leve: "Você começa com R$10.000 simulados", "Aprenda fazendo, não lendo", "Compita com amigos, não só com estranhos" (gancho pro sistema social).
- **Ações:** CTA final "Começar" → **4.1 Mapa da Trilha** (não direto pro Portfólio — força o primeiro contato com a lição 0.1).
- **Estados especiais:** pulável ("pular" leva direto ao Portfólio, mas não recomendado como padrão).
- **Dados envolvidos:** nenhum dado persistido além de uma flag `onboarding_completed` em `users` (campo a acrescentar).

---

## 2. Portfólio

### 2.1 Tela de Portfólio (home)
- **Objetivo:** visão consolidada da saúde financeira do usuário — é a tela padrão pós-login.
- **Acesso:** nav primária ("Portfólio"), destino padrão após login recorrente.
- **Conteúdo:**
  - Card de patrimônio do **mercado ao vivo** (o que conta pro ranking) — saldo total, variação percentual, total investido.
  - Card separado, visualmente distinto (ex: fundo diferente, selo "modo aprendizado"), de patrimônio do **sandbox** — reforça a separação exigida na seção 3.1 da spec.
  - Indicador de **XP/nível** e **streak diário** (mecânicas da seção 6, hoje sem espaço em nenhuma tela).
  - Gráfico de rosca de distribuição de investimentos (herdado do wireframe original, Fig. 3).
  - Atalho "Retomar lição" se a trilha não estiver concluída — link direto pra **4.2 Lição** no ponto onde o usuário parou.
  - Botões "Investir" e "Conquistas".
- **Ações:**
  - "Investir" → **5.1 Navegação de Mercado**.
  - "Conquistas" → **8.1 Conquistas**.
  - "Retomar lição" → **4.2 Lição** (estado atual do usuário).
  - Clique no card de patrimônio → **5.8 Extrato/Histórico** (ver o que compõe aquele número).
- **Estados especiais:** usuário sem nenhuma posição ainda (estado vazio, incentivando ir pro Mercado ou pra Trilha).
- **Dados envolvidos:** `accounts`, `positions`, `assets` (join pro gráfico de distribuição).

---

## 3. Trilha de Aprendizado

### 3.1 Mapa da Trilha
- **Objetivo:** dar corpo visual à progressão pedagógica (RF11) — é a tela que substitui a ausência total de UI pra esse conceito hoje.
- **Acesso:** nav primária ("Trilha"), ou via atalho do Portfólio (2.1).
- **Conteúdo:**
  - As 4 trilhas (Fundamentos, Renda Fixa, Renda Variável, Estratégia) como seções/módulos expansíveis.
  - Cada uma das 35 lições como um "nó" no formato mapa de progressão (concluída / disponível / bloqueada), mostrando o que cada lição desbloqueia (ex: "Tesouro Selic" ao lado da lição 1.2).
  - Indicador de progresso geral (ex: "12 de 35 lições concluídas").
- **Ações:**
  - Clique em lição disponível → **3.2 Lição**.
  - Clique em lição bloqueada → estado informativo (o que falta pra desbloquear), sem navegação.
  - Clique em item já desbloqueado no mapa (ex: "Tesouro Selic") → **5.3 Detalhe de Ativo (Renda Fixa)** diretamente, sem passar pela listagem.
- **Estados especiais:** trilha 100% concluída (destaca "mundo aberto liberado", conforme lição 3.4).
- **Dados envolvidos:** `lessons`, `user_lesson_progress`.

### 3.2 Lição (componente genérico reutilizável)
- **Objetivo:** ensinar um conceito através do padrão "aprender fazendo" (seção 5.2 da spec) — reutilizado pelas 35 lições e por produtos parecidos (CDB/LCI/LCA/CRI/CRA compartilham a mesma estrutura de tela).
- **Acesso:** a partir do Mapa da Trilha (3.1) ou do atalho "Retomar lição" (2.1).
- **Conteúdo, em 4 estados sequenciais dentro da mesma tela:**
  1. **Cenário/gatilho** — texto + ilustração da situação simulada.
  2. **Micro-decisão** — interação restrita ao conceito (ex: mini-calculadora, comparação de dois valores, escolha entre opções).
  3. **Revelação** — resultado numérico real, usando as fórmulas do cap. 2 do TCC, com explicação do "porquê".
  4. **Desbloqueio** — confirmação visual do que foi liberado (produto, tela, ou próxima lição), com CTA pra continuar ou ir usar o que foi desbloqueado na prática.
- **Ações:**
  - "Continuar" ao final → próxima lição (3.2, nova instância) ou volta ao **3.1 Mapa da Trilha** se for a última do bloco.
  - "Usar agora" no passo de desbloqueio → leva direto pra tela recém-liberada (ex: lição 1.2 desbloqueia Tesouro Selic → **5.3 Detalhe de Ativo**).
- **Estados especiais:** lição já concluída antes (modo revisão, sem repetir XP/conquista).
- **Dados envolvidos:** `lessons`, `user_lesson_progress`; grava progresso a cada etapa (permite retomar no meio).

---

## 4. Mercado

### 4.1 Navegação de Mercado (hub)
- **Objetivo:** roteador principal entre Renda Fixa, Renda Variável, os indicadores macro por trás dos dois e o histórico de ordens do usuário (herdado do wireframe original, Fig. 4, com extensão das tarefas M.4/O.4).
- **Acesso:** nav primária ("Mercado"), ou via "Investir" no Portfólio (2.1).
- **Conteúdo:** quatro cards — Renda Fixa, Renda Variável, Indicadores Econômicos e Minhas Ordens — com descrição curta de cada um.
- **Ações:**
  - Card Renda Fixa → **4.2 Lista de Renda Fixa**.
  - Card Renda Variável → **4.4 Lista de Renda Variável**.
  - Card Indicadores Econômicos → **4.9 Indicadores Econômicos**.
  - Card Minhas Ordens → **4.10 Minhas Ordens**.
- **Estados especiais:** produtos ainda bloqueados pela trilha aparecem visualmente atenuados dentro das listas (não nesta tela-hub, que se mantém simples).
- **Dados envolvidos:** nenhum dado próprio, só roteamento.

### 4.2 Lista de Ativos de Renda Fixa
- **Objetivo:** listar os produtos conservadores disponíveis no motor de simulação (herdado do wireframe original, Fig. 5, com extensões).
- **Acesso:** a partir de 4.1.
- **Conteúdo:**
  - Abas: Tesouro Direto · CDBs, LCA e LCI · CRI e CRA.
  - Tabela por produto: nome, risco, vencimento, taxa, aplicação mínima — **+ badges novos**: isento de IR (`tax_exempt`), classificação de risco de crédito (`credit_risk_rating`), tipo de emissor (`issuer_type`).
  - Produtos ainda bloqueados pela trilha aparecem atenuados, com indicação de qual lição libera.
- **Ações:** clique na linha/botão "Investir" → **4.3 Detalhe de Ativo (Renda Fixa)** (não opera direto — precisa simular antes).
- **Estados especiais:** lista vazia por categoria (raro, mas cobrir).
- **Dados envolvidos:** `assets`, `fixed_income_assets`.

### 4.3 Detalhe de Ativo — Renda Fixa
- **Objetivo:** permitir simular o aporte antes de confirmar, cumprindo o "aprender fazendo" mesmo fora da lição guiada.
- **Acesso:** a partir de 4.2, ou diretamente do Mapa da Trilha (3.1) quando acabou de ser desbloqueado.
- **Conteúdo:**
  - Nome do produto, todas as taxas e prazos.
  - Simulador de aporte: campo de valor → projeção de retorno até o vencimento (fórmulas do cap. 2.2 do TCC).
  - Aviso de marcação a mercado, caso o resgate ocorra antes do vencimento (cap. 2.2.3 do TCC).
  - Botão "Investir" com o valor simulado.
- **Ações:** "Investir" → **4.7 Confirmação de Ordem**.
- **Estados especiais:** valor abaixo da aplicação mínima (bloqueia o botão com aviso).
- **Dados envolvidos:** `assets`, `fixed_income_assets`.

### 4.4 Lista de Ativos de Renda Variável
- **Objetivo:** listar ações, ETFs e FIIs disponíveis para negociação (herdado do wireframe original, Fig. 6, com extensão de aba).
- **Acesso:** a partir de 4.1.
- **Conteúdo:**
  - Abas: **Ações · ETFs · FIIs** (a aba de FIIs faltava no wireframe original e precisa existir, já que está no escopo).
  - Tabela — colunas variam por aba (mesma diferenciação da tela de detalhe, 4.5): **Ações** — ticker, risco, último preço, variação do dia; **ETFs** — ticker, índice replicado, último preço, variação do dia; **FIIs** — ticker, perfil (tijolo/papel), segmento (se tijolo), último preço, Dividend Yield.
  - Mesma lógica de bloqueio por trilha da lista de renda fixa.
- **Ações:** clique na linha/botão "Comprar" → **4.5 Detalhe de Ativo (Renda Variável)**.
- **Estados especiais:** nenhum ativo disponível na aba (raro).
- **Dados envolvidos:** `assets`, `variable_income_assets`, `companies`, `etf_details`, `fii_details`.

### 4.5 Detalhe de Ativo — Renda Variável
- **Objetivo:** dar todo o contexto de preço e indicadores antes da compra — é onde os indicadores das lições 2.6.1–2.6.6 realmente aparecem (para Ações). O conteúdo varia por classe de ativo (spec seção 3.6, RF21), então esta tela tem três variações de layout na seção de indicadores, mantendo gráfico de preço e fluxo de compra iguais para as três.
- **Acesso:** a partir de 4.4, do Mapa da Trilha (3.1), ou de **4.6 Perfil da Empresa** (só se aplica a Ações).
- **Conteúdo:**
  - Gráfico de preço (histórico de cotações) — comum às três classes.
  - **Se Ação:** P/L, P/VP, LPA, VPA, ROE, Margem EBIT, Margem Líquida, Dívida Líquida/EBIT, Dividend Yield; histórico de dividendos e datas ex (`dividend_events`); link "Ver empresa" → 4.6.
  - **Se ETF:** índice de referência replicado (`benchmark_index`), resumo da metodologia de replicação, composição sintética — principais constituintes e peso percentual (`etf_holdings`). Sem indicadores de empresa individual (não se aplicam).
  - **Se FII:** perfil do fundo (`fii_type` — tijolo ou papel); **tijolo** mostra segmento, patrimônio líquido, taxa de vacância; **papel** mostra indexador da carteira; ambos mostram Dividend Yield e relação cota/valor patrimonial.
  - Campo de quantidade e resumo do valor total antes de confirmar — comum às três classes.
- **Ações:**
  - "Comprar"/"Vender" → **4.7 Confirmação de Ordem**.
  - "Ver empresa" → **4.6 Perfil da Empresa**.
- **Estados especiais:** ativo suspenso/circuit breaker (se implementado); usuário sem saldo suficiente.
- **Dados envolvidos:** `assets`, `variable_income_assets`, `companies`, `dividend_events`, `order_book` (preço corrente via cache Redis); `etf_details`/`etf_holdings` se ETF; `fii_details` se FII.

### 4.6 Perfil da Empresa
- **Objetivo:** consolidar os fundamentos históricos de uma empresa, separando "empresa" de "ativo negociável" (uma empresa pode emitir ON e PN).
- **Acesso:** a partir de 4.5, ou do Feed de Notícias (5.1) quando um evento macro cita a empresa.
- **Conteúdo:**
  - Nome, setor, CNPJ.
  - Série histórica de `company_fundamentals` (Receita, EBIT, Lucro Líquido, Patrimônio Líquido, Dívida Bruta, Caixa) — gráfico de evolução trimestral.
  - Lista de ativos emitidos por ela (ON/PN) com link pra 4.5.
  - Histórico de eventos macro que já a afetaram (conecta com o Feed, 5.1) — reforça pedagogicamente a relação entre notícia e número.
- **Ações:** clique em um ativo listado → **4.5 Detalhe de Ativo**; clique em um evento → **5.1 Feed de Notícias** (item específico).
- **Estados especiais:** empresa recém-cadastrada, sem histórico suficiente pra gráfico.
- **Dados envolvidos:** `companies`, `company_fundamentals`, `variable_income_assets`, `macro_events`, `macro_event_targets`.

### 4.7 Confirmação de Ordem
- **Objetivo:** passo explícito de confirmação antes de efetivar qualquer operação — hoje inexistente, o fluxo salta direto da listagem pra execução.
- **Acesso:** a partir de 4.3 ou 4.5.
- **Conteúdo:** resumo da ordem (ativo, quantidade/valor, preço, taxas simuladas, saldo restante projetado), botão de confirmar/cancelar.
- **Ações:** "Confirmar" → efetiva a ordem e retorna a **2.1 Portfólio** (ou à tela de origem) com feedback de sucesso; "Cancelar" → volta à tela anterior sem persistir nada.
- **Estados especiais:** erro de execução (ex: preço mudou entre a simulação e a confirmação — comum em mercado ao vivo estocástico); saldo insuficiente.
- **Dados envolvidos:** `order_book`, `positions`, `accounts`, `market_events` (Event Sourcing).

### 4.8 Extrato / Histórico Transacional
- **Objetivo:** cumprir RF05 — registro imutável de ordens executadas, proventos recebidos e taxas pagas.
- **Acesso:** a partir do Portfólio (2.1, clique no card de patrimônio), ou item de menu dentro de Mercado.
- **Conteúdo:** lista cronológica reversa de eventos (compra, venda, dividendo recebido, imposto pago, resgate de renda fixa), com filtro por tipo e por período.
- **Ações:** clique num item → detalhe expandido inline (sem navegação nova, é só um "accordion").
- **Estados especiais:** sem transações ainda (estado vazio).
- **Dados envolvidos:** `market_events` (fonte de verdade, Event Sourcing).

### 4.9 Indicadores Econômicos
- **Objetivo:** tornar visíveis os dois indicadores macro que o motor já simula por trás do rendimento/preço de todo produto (Selic e IPCA) — hoje o usuário só sente o efeito indireto deles, nunca vê o número (tarefa M.4, pedido do autor além da proposta original, 2026-09-13).
- **Acesso:** card "Indicadores Econômicos" no hub de Mercado (4.1).
- **Conteúdo:**
  - 4 cards de valor corrente: Selic (meta anual), IPCA mensal, IPCA acumulado 12m, e a data do próximo Copom simulado (derivada no cliente a partir do último dia simulado conhecido, cadência fixa de 21 dias — o motor só marca reuniões já ocorridas).
  - 2 gráficos de linha histórica (mesmo motivo visual "papel de gráfico" do gráfico de preço, 4.5, sem a semântica de ganho/perda): Selic ao longo do tempo, IPCA acumulado 12m ao longo do tempo — com seletor de intervalo (3M/6M/1A) compartilhado entre os dois.
- **Ações:** nenhuma navegação a partir daqui — tela só de leitura.
- **Estados especiais:** motor recém-subido, sem nenhum tick ainda (cards mostram "Aguardando primeiro tick", gráficos mostram estado vazio, sem erro).
- **Dados envolvidos:** `market_indicator_history` (via `GET /market/indicators`, proxy do motor — `.docs/backend/market.md`).

### 4.10 Minhas Ordens
- **Objetivo:** fecha o achado 012 (`pontos-em-aberto-decisao-produto.md`) junto com a O.3 — sem uma tela real, o cancelamento manual de ordem (O.1) fica correto no motor mas inutilizável ponta a ponta, já que nenhum cliente tinha como descobrir qual `order_id` passar (tarefa O.4, 2026-09-21).
- **Acesso:** card "Minhas Ordens" no hub de Mercado (4.1).
- **Conteúdo:**
  - Três abas — **Pendentes** (`pending`/`partially_filled`), **Executadas** (`filled`), **Recusadas** (`cancelled`, qualquer `cancel_reason`) — mesma tela-tipo "lista com abas" de 4.2/4.4 (identidade-visual-padroes.md).
  - Tabela por ordem (desktop) / cards empilhados (mobile/tablet, mesma dupla responsiva de 4.2/4.4): ativo (ticker/nome), lado (compra/venda), tipo (mercado/limitada), quantidade (preenchida/total quando `partially_filled`), preço.
  - Aba Recusadas ganha uma coluna a mais: motivo humanizado a partir de `cancel_reason` (`user_cancelled` → "Cancelada por você"; `expired` → "Expirada no fechamento do dia"; `no_liquidity` → "Sem liquidez disponível"; `requoted` nunca aparece pra um usuário real).
  - Aba Pendentes ganha um botão "Cancelar ordem" por linha, com confirmação leve em duas etapas (clicar de novo confirma, mesmo padrão de "Desfazer amizade" em 8.1 — sem `window.confirm` nativo).
- **Ações:** "Cancelar ordem" (confirmado) → `POST /market/orders/:id/cancel` (O.1); a linha sai de Pendentes e entra em Recusadas com o motivo "Cancelada por você" assim que a lista refaz o fetch.
- **Estados especiais:** aba sem nenhuma ordem naquele grupo (mensagem vazia própria por aba); erro ao carregar `GET /market/orders`; erro ao cancelar (mensagem inline, a linha permanece em Pendentes).
- **Dados envolvidos:** `order_book` (via `GET /market/orders`, proxy enriquecido do motor — `.docs/backend/market.md`).

---

### 4.11 Calendário do Mercado

- **Objetivo:** dizer em uma olhada em que dia do mercado simulado estamos, que o tempo é acelerado (1 dia real = 5 dias de mercado), por que o mercado às vezes está fechado (sábado e domingo simulados) e o que aconteceu e vem aí (tarefa S.12, decisão do autor de 2026-09-26). Mockup vivo (mobile, tablet e desktop, virada de dia e passo de onboarding): https://claude.ai/artifact/CqcmBmoJfpEKeUBAnks8zn
- **Acesso:** chip do relógio no TopBar (0.2), em qualquer tela autenticada. Não é rota do menu: mobile abre como bottom sheet sobre a tela de origem, tablet como painel abaixo da barra, desktop como coluna lateral fixa à direita (o conteúdo da tela segue interativo) que traz a grade do trimestre inteiro no topo do próprio painel.
- **Conteúdo:**
  - Sem barra de progresso do trimestre: o último dia dele (dia de relatório) é um bloco dourado com o rótulo "fim do trim." na faixa de dias, na grade e na legenda.
  - Faixa horizontal de dias (7 atrás, hoje, 6 à frente) com marcadores por tipo, sempre ícone mais texto: evento de mercado, Copom, balanço, provento, suas ordens, renda fixa. Fim de semana com fundo cinza, borda tracejada e o texto "fechado". Futuro tracejado.
  - Detalhe do dia escolhido: listas "Aconteceu" e "Vem aí" (fatos do usuário com a etiqueta VOCÊ; futuro só com o que é determinístico: Copom, relatório, proventos anunciados e vencimentos do usuário, nunca evento macro que ainda não aconteceu).
  - Desktop: "visão geral dos dias" (uma coluna por semana, sólido passado e tracejado futuro, bloco dourado no fim do trimestre).
  - Legenda e a linha fixa "cada dia real equivale a 5 dias de mercado".
- **Teatro de recompensa leve:** na virada de dia, o ponteiro do relógio gira e aparece um toast "Novo dia: Selic X%" (dourado, só aqui); no fim de semana, "Mercado fechado até segunda. Hora de estudar." Respeita `prefers-reduced-motion`.
- **Onboarding (1.2):** um passo novo explicando o tempo acelerado, o fim de semana fechado e o que segue aberto (lições, Modo Aprendizado, cancelar ordem).
- **Estados especiais:** motor sem nenhum tick (dia 0, sem histórico); agenda automática desligada (sem "próximo dia em", o relógio mostra só o dia).
- **Dados envolvidos:** `GET /market/clock` e `GET /market/calendar` (`.docs/backend/market.md`, tarefas S.10 e S.11).

## 5. Feed de Notícias / Eventos de Mercado

### 5.1 Feed de Notícias
- **Objetivo:** cumprir RF16 — explicar o "porquê" por trás de cada movimento de preço, principal veículo pedagógico do mecanismo de eventos macro (seção 3.3 da spec).
- **Acesso:** ícone de notícias na barra superior (0.2), ou desbloqueado formalmente na lição 2.4 da trilha.
- **Conteúdo:** lista cronológica de eventos (macro, Copom, relatórios trimestrais), cada item com título, categoria (regulatório/commodities/setorial/etc.), setor ou ativo afetado, e uma breve narrativa do impacto esperado.
- **Ações:** clique num evento → expande a narrativa completa e mostra o(s) ativo(s)/empresa(s) afetados, com link pra **4.5 Detalhe de Ativo** ou **4.6 Perfil da Empresa**.
- **Estados especiais:** evento com efeito "pendente" (ainda não confirmado no próximo relatório) vs. "efetivado" — vale diferenciar visualmente, reforça o ensinamento de "preço reage à expectativa, resultado confirma ou desmente depois".
- **Dados envolvidos:** `macro_events`, `macro_event_targets`, `companies`.

---

## 6. Calculadora Financeira

### 6.1 Calculadora — modo simples
- **Objetivo:** projeção de juros simples/compostos (herdado do wireframe original, Fig. 7).
- **Acesso:** nav primária ("Calculadora").
- **Conteúdo:** igual ao wireframe original — capital inicial, aporte mensal, taxa, período, resultado com gráfico total vs. investido.
- **Ações:** toggle "Comparar produtos" → **6.2 Calculadora — modo comparação**.
- **Estados especiais:** nenhum.
- **Dados envolvidos:** nenhum dado persistido (cálculo client-side/stateless).

### 6.2 Calculadora — modo comparação
- **Objetivo:** cumprir a lição 3.3 ("CDB 110% CDI líquido vs. LCI 90% CDI isento — qual rende mais?"), hoje sem suporte na calculadora original.
- **Acesso:** a partir de 6.1, ou diretamente da lição 3.3.
- **Conteúdo:** dois produtos lado a lado, cada um com seus próprios parâmetros (incluindo isenção de IR quando aplicável), resultado líquido comparado.
- **Ações:** nenhuma navegação nova — é uma variação de estado da mesma tela de calculadora.
- **Estados especiais:** nenhum.
- **Dados envolvidos:** nenhum dado persistido.

---

## 7. Classificação (Ranking) e Gamificação

### 7.1 Classificação
- **Objetivo:** ranking por rentabilidade percentual (RF17), agora com toggle Global/Amigos.
- **Acesso:** nav primária ("Classificação").
- **Conteúdo:**
  - Toggle de escopo: **Global** vs. **Amigos** (novo, ver 8.x).
  - Seletor de janela: semana / mês (substituindo o filtro por classe de ativo do wireframe original, que não reflete mais o critério da spec).
  - Pódio + lista, igual à estrutura do wireframe original (Fig. 8).
  - Indicação explícita de que só patrimônio do mercado ao vivo conta (reforça 3.1 da spec).
- **Ações:** clique num usuário do ranking → **8.4 Perfil Público de Outro Usuário**.
- **Estados especiais:** escopo "Amigos" vazio (sem amigos adicionados ainda) → CTA pra **8.2 Buscar Amigos**.
- **Dados envolvidos:** `accounts`, `positions` (agregados por janela), `friendships` (para o escopo Amigos).

### 7.2 Conquistas
- **Objetivo:** dar destino real ao botão "Conquistas" do Portfólio, hoje sem tela.
- **Acesso:** menu do avatar (0.2), ou botão "Conquistas" no Portfólio (2.1).
- **Conteúdo:** grid de insígnias, desbloqueadas (destacadas) e bloqueadas (atenuadas, com o critério visível — ex: "atingir R$15.000 em patrimônio").
- **Ações:** clique numa conquista bloqueada → mostra progresso atual em relação ao critério, sem navegação nova.
- **Estados especiais:** nenhuma conquista desbloqueada ainda (estado inicial).
- **Dados envolvidos:** `achievements`, `user_achievements`.

### 7.3 Missões Diárias / Streak
- **Objetivo:** dar espaço visual à mecânica de sustentação de longo prazo (seção 5.4 e 6.1 da spec), formalizada no RF22 — hoje sem tela dedicada.
- **Acesso:** pode viver como seção dentro do Portfólio (2.1) inicialmente; se o catálogo de missões crescer, promover a tela própria acessível pelo menu do avatar.
- **Conteúdo:** lista de 2–3 missões do dia (ex: "Complete uma lição da trilha", "Compare dois produtos de renda fixa na calculadora", "Consulte o feed de notícias"), com indicador de streak atual e recompensa de XP por missão.
- **Ações:** clique numa missão → leva à tela correspondente pra cumpri-la (ex: 6.1 Calculadora, 3.1 Mapa da Trilha, 5.1 Feed de Notícias).
- **Estados especiais:** todas as missões do dia concluídas (estado de celebração).
- **Dados envolvidos:** `daily_missions`, `user_mission_progress` (RF22, spec v0.5).

---

## 8. Social / Amigos *(extensão nova)*

### 8.1 Amigos — hub/lista
- **Objetivo:** ponto central do sistema social — ver quem já é amigo, gerenciar solicitações, buscar novos.
- **Acesso:** menu do avatar (0.2).
- **Conteúdo:** lista de amigos atuais (nome, avatar, rentabilidade percentual resumida — nunca patrimônio absoluto), contador de solicitações pendentes, campo de busca.
- **Ações:**
  - Buscar → **8.2 Buscar Amigos**.
  - Ícone de solicitações → **8.3 Solicitações de Amizade**.
  - Clique num amigo → **8.4 Perfil Público de Outro Usuário**.
- **Estados especiais:** sem amigos ainda (estado vazio, CTA pra buscar).
- **Dados envolvidos:** `friendships`, `users`.

### 8.2 Buscar Amigos
- **Objetivo:** encontrar outros usuários por `username` público e enviar solicitação.
- **Acesso:** a partir de 8.1.
- **Conteúdo:** campo de busca, resultados com avatar/nome/username, botão "Adicionar" por resultado.
- **Ações:** "Adicionar" → envia solicitação (não navega, muda o estado do botão para "Pendente").
- **Estados especiais:** nenhum resultado encontrado para o termo buscado (todo usuário é buscável nesta fase — não há perfil privado, seção 0.4).
- **Dados envolvidos:** `users`, `friendships` (criação com `status = pending`).

### 8.3 Solicitações de Amizade
- **Objetivo:** gerenciar pedidos recebidos e enviados.
- **Acesso:** a partir de 8.1.
- **Conteúdo:** duas listas — "Recebidas" (com botões Aceitar/Recusar) e "Enviadas" (com botão Cancelar).
- **Ações:** "Aceitar" → move o par para amigos confirmados, atualiza 8.1; "Recusar"/"Cancelar" → remove a solicitação.
- **Estados especiais:** nenhuma solicitação pendente (estado vazio).
- **Dados envolvidos:** `friendships` (`status` pending → accepted/removed).

### 8.4 Perfil Público de Outro Usuário
- **Objetivo:** visão do perfil de um amigo (ou de alguém do ranking global), respeitando o que essa pessoa optou por tornar visível.
- **Acesso:** a partir de 7.1 (Classificação) ou 8.1 (Amigos).
- **Conteúdo:** avatar, nível/XP, rentabilidade (se pública), conquistas em destaque, streak — **nunca** valor absoluto de patrimônio, só percentual, evitando expor dado sensível mesmo entre amigos.
- **Ações:** se ainda não são amigos, botão "Adicionar" (mesmo fluxo de 8.2); se já são, sem ação adicional além de voltar.
- **Estados especiais:** nenhum (todo perfil é público nesta fase — seção 0.4); a única omissão é sempre a mesma, o valor absoluto de patrimônio, que nunca aparece.
- **Dados envolvidos:** `users`, `accounts` (agregado, apenas rentabilidade percentual), `achievements`.

---

## 9. Perfil e Configurações

### 9.1 Meu Perfil
- **Objetivo:** visão que o próprio usuário tem de si — espelha 8.4, mas com dados completos e acesso à edição.
- **Acesso:** menu do avatar (0.2).
- **Conteúdo:** avatar, nome, username, nível/XP, streak, conquistas, link editar.
- **Ações:** "Editar perfil" → **9.2 Configurações de Conta**.
- **Estados especiais:** nenhum.
- **Dados envolvidos:** `users`, `achievements`.

### 9.2 Configurações de Conta
- **Objetivo:** dados cadastrais e credenciais.
- **Acesso:** a partir de 9.1, ou direto do menu do avatar.
- **Conteúdo:** nome, e-mail, username, alteração de senha, provedores conectados (OAuth).
- **Ações:** "Salvar" → confirmação inline, sem navegação.
- **Estados especiais:** conflito de username já em uso.
- **Dados envolvidos:** `users`, `user_identities`.

### 9.3 Privacidade e LGPD
- **Objetivo:** cumprir RNF04 (gestão de consentimento, portabilidade, anonimização). Nesta fase não há controle de visibilidade de perfil configurável (decisão da spec v0.4, seção 8.2) — todo perfil é público por padrão, então esta tela fica restrita à gestão de dados pessoais exigida por lei, sem se misturar com o sistema social.
- **Acesso:** a partir de 9.2.
- **Conteúdo:** exportar dados (portabilidade), excluir conta/anonimizar dados pessoais não financeiros. Uma nota informativa explica que rentabilidade percentual, nível e conquistas são sempre visíveis a outros usuários, e que o valor absoluto de patrimônio nunca é exposto, independentemente de qualquer configuração.
- **Ações:** "Exportar dados" gera download; "Excluir conta" pede confirmação em duas etapas.
- **Estados especiais:** confirmação de exclusão (modal de segurança).
- **Dados envolvidos:** `users` (consentimentos, dados de exportação).

---

## 10. Painel Administrativo

### 10.1 Painel Admin — Visão geral (hub)
- **Objetivo:** porta de entrada do painel administrativo, que a Fase N de `backlog-motor-mercado-realista.md` amplia pra centro de controle geral da aplicação (spec 3.3.3, nota de revisão de 2026-10-03). Desde a N.3 o painel tem um shell próprio (navegação por seções) em volta de todas as telas 10.x.
- **Acesso:** menu do avatar, visível apenas para `role = admin`; rota `/admin` protegida por `role = admin`.
- **Conteúdo:** navegação por seções (Visão geral, Tempo, Mercado, Bots, Usuários, Conteúdo, Gamificação, Sistema, Auditoria) — barra lateral fixa no desktop, faixa horizontal no tablet, gaveta no mobile; seção sem tela ainda aparece desabilitada com "Em breve". Desde a N.5 a tela em si é o dashboard de entrada: (1) **faixa de saúde** com backend, motor, banco de usuários, banco de mercado e Redis (cada um "No ar", "Lento" ou "Fora", com latência e o motivo da falha); (2) cartões **Mercado** (dia simulado, Selic, IPCA no mês e em 12 meses, eventos macro pendentes, ativos sem Market Maker), **Tempo** (agenda ativa/pausada/desligada, próximo tick, ritmo, tick em andamento, último tick), **Negociação** (negócios, volume e ordens abertas no dia simulado, bots ativos) e **Usuários** (total, cadastros em 24 h e 7 dias). Atualiza sozinha por polling de 15 s.
- **Ações:** abrir a seção de um cartão ("Eventos macro", "Controlar o tempo").
- **Estados especiais:** carregando; backend fora do ar (aviso no lugar da faixa e do resumo); **fonte fora do ar** (o cartão daquela fonte mostra "Indisponível: motivo" e os demais seguem). Composição própria por breakpoint: 2 colunas de cartões a partir de 768 px, 5 chips lado a lado na faixa de saúde.
- **Dados envolvidos:** `GET /admin/system/health` e `GET /admin/overview` (`.docs/backend/admin.md`), que agregam `GET /admin/overview` do motor (`.docs/engine/admin.md`), `GET /admin/scheduler`, o último item de `GET /admin/ticks` e a contagem de usuários.

### 10.6 Mercado (monitor ao vivo)
- **Objetivo:** ver o mercado simulado inteiro numa tela, só leitura (N.8). Seção "Mercado" do painel, rota `/admin/mercado`; o preço só se forma por negociação, então a tela não tem botão que o altere.
- **Conteúdo:** filtros por classe (ação, ETF, FII), setor e texto; tabela de todos os ativos negociáveis com último preço, variação, melhor compra/venda e spread, ordens abertas (e quantas são de bots), negociado no dia, cotas em circulação versus posse de bots e usuários, e o indicador da classe (P/L da ação, ágio/deságio do ETF, P/VP do FII); aviso dos ativos sem Market Maker ativo; seção de indicadores macro (Selic, IPCA, próximo Copom e gráfico da Selic); coluna lateral "Próximos eventos" com os fatos globais futuros do calendário. Link "Eventos macro" para a 10.3.
- **Ações:** ordenar pelos cabeçalhos; abrir um ativo (**10.7**).
- **Estados especiais:** carregando; motor fora do ar (aviso no lugar da tabela); ativo sem cotação ou book (campos com traço, nunca quebra); lista filtrada vazia. Tabela no tablet/desktop e cartões no mobile; no desktop os indicadores ficam à esquerda e o calendário em coluna lateral.
- **Dados envolvidos:** `GET /admin/market/assets`, `GET /market/indicators`, `GET /market/clock`, `GET /market/calendar` (`.docs/backend/admin.md`, `.docs/engine/admin.md`).

### 10.7 Detalhe do Ativo no Monitor
- **Objetivo:** inspecionar um ativo (N.8), rota `/admin/mercado/ativos/:id`.
- **Conteúdo:** resumo (último negócio, melhor compra/venda, negociado no dia, ordens abertas, cotas com bots/usuários/livres, indicador da classe); book completo agregado por preço com a parcela de bots (nunca o dono de uma ordem); últimos 30 negócios; gráfico das cotações (30 e 60 dias); para ETF, tabela de NAV e ágio.
- **Estados especiais:** ativo inexistente ou fora do universo negociável (mensagem e volta ao monitor); sem Market Maker (aviso); book e negócios vazios.
- **Dados envolvidos:** `GET /admin/market/assets/:id`.

### 10.8 Ordens do Book
- **Objetivo:** achar e cancelar ordens por intervenção (N.10). Rota `/admin/mercado/ordens`, dentro da seção "Mercado"; link na 10.6 e, com o ativo já filtrado, na 10.7.
- **Conteúdo:** filtros de status (abertas por padrão), lado, ativo e dono (UUID do usuário ou bot); tabela de ordens com ativo, lado e tipo, executado/total, preço, dono (bot com arquétipo ou usuário com id curto), status com o motivo do cancelamento e data. Cancelar tira a ordem do book sem mexer em saldo nem posição (nenhuma ordem em repouso reserva nada).
- **Ações:** cancelar uma ordem em repouso (confirmação); cancelar em lote as ordens abertas de um ativo e/ou dono (só com um dos dois filtros, exige digitar o ticker ou "CANCELAR", teto de 500 por lote). Tudo vai pra auditoria, o lote como uma linha com a lista de ids.
- **Estados especiais:** carregando; lista vazia; ordem já executada ou cancelada no meio do caminho (409, mensagem e lista atualizada); lote acima do teto (mensagem com a contagem, nada é cancelado); id de dono inválido (aviso, filtro ignorado). Tabela no tablet/desktop e cartões no mobile.
- **Dados envolvidos:** `GET /admin/orders`, `POST /admin/orders/:id/cancel`, `POST /admin/orders/cancel-batch` (`.docs/backend/admin.md`, `.docs/engine/admin.md`).

### 10.9 Pausas de Negociação
- **Objetivo:** disjuntor operacional (N.9). Rota `/admin/mercado/pausas`, dentro da seção "Mercado"; link na 10.6, que também mostra uma faixa quando há pausa vigente.
- **Conteúdo:** aviso das consequências (a pausa não suspende o tick, ordens em repouso expiram a cada tick, o book pode ficar vazio ao retomar); formulário com motivo obrigatório, "Pausar ativo" (escolha do ativo) e "Pausar tudo"; lista de pausas vigentes com "Retomar" e as últimas encerradas.
- **Ações:** pausar tudo (digitar PAUSAR TUDO), pausar um ativo (digitar o ticker), retomar (confirmação). Tudo na auditoria.
- **Estados especiais:** carregando; sem pausa vigente; pausa duplicada ou já retomada (409, mensagem e lista atualizada); mercado já pausado (botão desabilitado). Para o usuário, o detalhe do ativo (4.5) mostra "Negociação pausada" e desabilita a ordem.
- **Dados envolvidos:** `GET/POST /admin/halts`, `POST /admin/halts/:id/lift`, `GET /market/halts`.

### 10.3 Histórico de Eventos Macro
- **Objetivo:** cumprir RF14 — lista de eventos disparados (era o conteúdo do hub 10.1 antes da N.3). Seção "Mercado" do painel, rota `/admin/eventos`.
- **Conteúdo:** lista de eventos disparados (histórico), com status (pendente/aplicado), paginada, botão "Novo evento".
- **Ações:** "Novo evento" → **10.2 Criar/Disparar Evento**.
- **Estados especiais:** nenhum evento disparado ainda.
- **Dados envolvidos:** `macro_events`, `macro_event_targets`.

### 10.2 Criar/Disparar Evento Macro
- **Objetivo:** formalizar RF13 — criação e disparo manual de evento.
- **Acesso:** a partir de 10.3.
- **Conteúdo:** seleção de template do catálogo (seção 3.3.2 da spec, 10 templates pré-definidos) OU criação avulsa (título, narrativa, setor/ativo-alvo, banda de magnitude — Leve/Moderado/Severo, tipo de efeito — preço/fundamentos/ambos).
- **Ações:** "Disparar agora" → confirma e retorna a **10.3**, evento aparece no topo do histórico com status "aplicado".
- **Estados especiais:** validação de campos obrigatórios ao criar evento avulso.
- **Dados envolvidos:** `macro_events`, `macro_event_targets`, `companies` (para segmentar por setor).

### 10.4 Auditoria
- **Objetivo:** log das ações administrativas (N.4, regra transversal "nenhuma escrita sem auditoria"). Seção "Auditoria" do painel, rota `/admin/auditoria`, somente leitura (o log é append-only no banco).
- **Conteúdo:** lista paginada, mais recentes primeiro: resultado (sucesso/falha, falha com selo tracejado e motivo), ação, admin e data; detalhe expansível com o alvo e o payload em JSON. Filtros: ação, resultado e período.
- **Ações:** filtrar, paginar, expandir uma entrada.
- **Estados especiais:** nenhum registro para o filtro; período invertido (aviso, filtro de datas ignorado); falha ao carregar.
- **Dados envolvidos:** `admin_audit_log`.

### 10.5 Tempo
- **Objetivo:** controlar o Temporizador do mercado simulado sem reiniciar o motor (N.6). Seção "Tempo" do painel, rota `/admin/tempo`.
- **Conteúdo:** estado da agenda (ativa, pausada ou desligada no ambiente), próximo tick agendado, último tick, ritmo (ticks por dia real e fuso), limite de recuperação e, se houver, quando foi retomada; aviso quando há tick em andamento. Histórico paginado de ticks, mais recente primeiro: dia simulado, gatilho (agendado, recuperação ou manual), resultado (falha com selo tracejado e motivo), duração e, no detalhe, os contadores do tick (cotações, rodadas, negócios de bots, ordens expiradas, proventos etc.) e o descarte do limite de recuperação.
- **Ações:** "Pausar/Retomar agenda" (só vale pro tick agendado; persiste entre restarts), "Disparar 1 tick" e "Avançar N dias" (1 a 30), os dois últimos com confirmação que avisa que o mercado é compartilhado e afeta todos os usuários.
- **Estados especiais:** agenda desligada no ambiente (pausa desabilitada), tick em andamento (ações travadas), falha no meio de "avançar" (informa quantos dias já rodaram), erro ao carregar.
- **Dados envolvidos:** `scheduler_control`, `tick_runs`, `market_calendar`.

---

## 11. Resumo — todas as telas numeradas

| # | Tela | Grupo |
|---|---|---|
| 1.1 | Autenticação | Auth |
| 1.2 | Onboarding | Auth |
| 2.1 | Portfólio | Home |
| 3.1 | Mapa da Trilha | Trilha |
| 3.2 | Lição (genérica) | Trilha |
| 4.1 | Navegação de Mercado | Mercado |
| 4.2 | Lista Renda Fixa | Mercado |
| 4.3 | Detalhe Ativo — Renda Fixa | Mercado |
| 4.4 | Lista Renda Variável | Mercado |
| 4.5 | Detalhe Ativo — Renda Variável | Mercado |
| 4.6 | Perfil da Empresa | Mercado |
| 4.7 | Confirmação de Ordem | Mercado |
| 4.8 | Extrato/Histórico | Mercado |
| 4.11 | Calendário do Mercado | Mercado |
| 5.1 | Feed de Notícias | Eventos |
| 6.1 | Calculadora — simples | Calculadora |
| 6.2 | Calculadora — comparação | Calculadora |
| 7.1 | Classificação | Gamificação |
| 7.2 | Conquistas | Gamificação |
| 7.3 | Missões Diárias | Gamificação |
| 8.1 | Amigos — hub | Social |
| 8.2 | Buscar Amigos | Social |
| 8.3 | Solicitações de Amizade | Social |
| 8.4 | Perfil Público de Outro Usuário | Social |
| 9.1 | Meu Perfil | Perfil |
| 9.2 | Configurações de Conta | Perfil |
| 9.3 | Privacidade e LGPD | Perfil |
| 10.1 | Painel Admin — Visão geral (hub) | Admin |
| 10.2 | Criar/Disparar Evento | Admin |
| 10.3 | Histórico de Eventos Macro | Admin |
| 10.4 | Auditoria | Admin |
| 10.5 | Tempo | Admin |
| 10.6 | Mercado (monitor ao vivo) | Admin |
| 10.7 | Detalhe do Ativo no Monitor | Admin |
| 10.8 | Ordens do Book | Admin |
| 10.9 | Pausas de Negociação | Admin |

**Total: 36 telas** (contando estados distintos de uma mesma família, como 6.1/6.2, como telas separadas por terem conteúdo e propósito diferentes).

---

## 12. Pendências a validar com você

- [x] ~~Sistema de amigos (seção 8) é uma proposta minha, não estava na spec — precisa de validação de modelo~~ — resolvido: amizade bilateral com aceite, sem bloqueio nesta fase, sem perfil privado. Já formalizado em `especificacao-plataforma-investimentos.md` v0.4.
- [x] ~~Missões diárias (7.3) menciona entidades novas (`daily_missions`, `user_mission_progress`) que não existem na spec~~ — resolvido: formalizado no MVP, RF22, spec v0.5.
- [x] ~~Onde exatamente entram as abas de ETFs/FIIs dentro da Renda Variável e se compartilham indicadores fundamentalistas com Ações~~ — resolvido: ETFs mostram índice/metodologia/composição, FIIs se dividem em tijolo (segmento/patrimônio/vacância) e papel (indexador), ambos com Dividend Yield. RF21, spec v0.5, seção 3.6.

Nenhuma pendência remanescente nesta lista — pronto para virar wireframes ou quebra de tarefas.

---

Próximo passo natural: transformar esse inventário em wireframes reais, tela por tela — posso começar por qualquer uma. As de maior prioridade pra destravar o resto continuam sendo 3.1 (Mapa da Trilha) e 4.5 + 4.7 (Detalhe de Ativo + Confirmação de Ordem).
