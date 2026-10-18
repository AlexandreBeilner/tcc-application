# Inventário de Telas — Plataforma Gamificada de Investimentos

> Documento vivo. Complementa `especificacao-plataforma-investimentos.md` e `analise-telas-plataforma-investimentos.md`. Aqui está definida, com precisão, **toda tela da aplicação** — objetivo, conteúdo, estados e como cada uma se conecta às outras. Inclui a extensão do **sistema de amigos/relações sociais**, ainda não coberto na spec original.

**Versão:** 0.1
**Convenção de leitura:** cada tela segue o mesmo template — Objetivo · Acesso (de onde chega) · Conteúdo · Ações (para onde leva) · Estados especiais · Dados envolvidos (entidades do DER, quando relevante).

---

## 0. Arquitetura de Informação (visão macro)

### 0.1 Navegação primária (sempre visível, tab bar / sidebar)

```
Portfólio · Trilha · Mercado · Assembleias · Classificação
```

Cinco itens — mesmo número da spec original, com "Trilha" adicionada como novo item de primeiro nível, já que é o núcleo pedagógico do produto (seção 1.1 da análise anterior) e não deveria viver escondida dentro de outra aba. **Mudança da MO.9.6 (2026-10-11):** "Assembleias" (ícone de edifício) ocupa o lugar da Calculadora e está **sempre presente**, porque a Assembleia nasce com a aplicação; a **Calculadora vai para o menu do avatar** (bloco "Ferramentas"), com o mesmo gate de trilha (cadeado, e a rota mostra o bloqueio). Com o desligamento de emergência (`ASSEMBLIES_ENABLED=off`) a aba continua e abre a tela "Assembleias indisponíveis no momento", com a saída "Voltar ao Mercado".

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
- **Verificação de e-mail (EM.3.3, D2):** o cadastro **não cria sessão**: o cartão vira o aviso "Enviamos um link para X" (vale 24 h) com "Reenviar e-mail de confirmação" e "Já confirmei, quero entrar". Login de conta por e-mail e senha ainda não verificada (`403 email_not_verified`, só depois de a senha conferir) mostra "Falta confirmar seu e-mail" e o mesmo reenvio, sempre visível. Reenvio com limite (429) tem mensagem própria. Login com Google sem `email_verified` numa conta existente volta de `/auth/callback` com mensagem própria (nada é vinculado).
- **Recuperação de senha (EM.2.3):** no modo "Entrar" há o link "Esqueci minha senha" (abaixo do campo de senha), que leva à **1.3**.

### 1.3 Esqueci minha senha (`/esqueci-senha`)
- **Objetivo:** pedir o link de redefinição de senha por e-mail, sem revelar se o e-mail tem conta.
- **Acesso:** link "Esqueci minha senha" da **1.1** (modo "Entrar"). Pública, fora do shell.
- **Conteúdo:** campo de e-mail, texto "Enviaremos um link para você escolher uma senha nova", botão "Enviar link", link "Voltar para a entrada". Depois de enviar, o cartão vira o aviso "Pedido enviado": "Se existir uma conta com o e-mail X, enviamos um link ... vale por 30 minutos e só pode ser usado uma vez", com "Pedir outro link" e o caminho de volta.
- **Ações:** enviar → aviso neutro (igual para qualquer e-mail, existente ou não); "Voltar" → **1.1**.
- **Estados especiais:** enviando; limite de pedidos (429) com mensagem própria; erro genérico.
- **Responsivo:** cartão único centralizado (como a 1.1); no mobile ocupa a largura toda.
- **Dados envolvidos:** `POST /auth/forgot-password` (`.docs/backend/auth.md`).

### 1.4 Redefinir senha (`/redefinir-senha#token=...`)
- **Objetivo:** concluir a troca de senha com o link recebido por e-mail.
- **Acesso:** link do e-mail. O token vem no **fragmento** da URL (nunca na query), é lido e removido da barra de endereço na entrada. Pública, fora do shell.
- **Conteúdo:** "Senha nova" e "Confirmar senha" (8 a 72 caracteres, mesma regra do cadastro) com o indicador de força, botão "Redefinir senha".
- **Ações:** sucesso → aviso "Pronto, sua senha foi alterada" (sessões de outros aparelhos encerradas; a deste navegador também) com botão para a **1.1**. Link sem token, desconhecido (401), expirado ou já usado (410) → "Este link não vale mais" com "Pedir um novo link" → **1.3**.
- **Estados especiais:** enviando; senhas diferentes (validação local); limite de tentativas (429); link inválido.
- **Responsivo:** mesmo cartão único da 1.3.
- **Dados envolvidos:** `POST /auth/reset-password`.

### 1.5 Verificar e-mail (`/verificar-email#token=...`)
- **Objetivo:** confirmar que o e-mail da conta é de quem se cadastrou, com o link recebido.
- **Acesso:** link do e-mail. O token vem no **fragmento**, é consumido ao abrir (uma única chamada, mesmo em StrictMode) e removido da barra de endereço. Pública, fora do shell. Não cria sessão.
- **Conteúdo:** "Só um instante..." enquanto confirma; sucesso → "Pronto, seu e-mail foi confirmado" com botão para a **1.1**. Link vencido (410 `token_expired`), sem token ou desconhecido (401) → "Este link não vale mais"; já usado (410 `token_used`) → "Este link já foi usado". Nos dois últimos há o reenvio com campo de e-mail, sempre visível, e o caminho de volta.
- **Estados especiais:** verificando; sucesso; expirado; usado; inválido; erro de rede ou 5xx ("Tentar de novo" repete com o token em memória, sem dizer que o link morreu); limite de reenvios (429).
- **Responsivo:** mesmo cartão único da 1.3.
- **Dados envolvidos:** `POST /auth/verify-email`, `POST /auth/resend-verification`.

### 1.6 Cancelar inscrição de e-mail (`/cancelar-inscricao#token=...`)
- **Objetivo:** desligar uma categoria opcional de e-mail com um clique, sem login (EM.6.1).
- **Acesso:** link "cancelar inscrição" do rodapé de um e-mail opcional (a URL da API redireciona para cá). O token vem no **fragmento** e sai da barra de endereço ao abrir. Pública, fora do shell.
- **Conteúdo:** "Quer deixar de receber estes e-mails?" com o botão "Cancelar inscrição" e o link "Manter e voltar para a plataforma". **Abrir a página nunca cancela** (scanners de e-mail abrem todo link); só o botão confirma. Sucesso → "Pronto, você não vai mais receber esses e-mails", diz qual categoria foi desligada, lembra que os avisos de segurança continuam e aponta para Configurações para ligar de novo.
- **Estados especiais:** pronto; cancelando; cancelado; link inválido (sem token ou 400); erro de rede (mostra o erro e permite repetir com o mesmo token).
- **Responsivo:** mesmo cartão único da 1.3.
- **Dados envolvidos:** `POST /email/unsubscribe`.

### 1.2 Onboarding / Boas-vindas
- **Objetivo:** contextualizar o novo usuário antes de cair "sem explicação" no Portfólio — explicar que existe um saldo simulado de R$10.000 (equidade de partida, seção 3.5 da spec) e que o aprendizado acontece pela Trilha.
- **Acesso:** apenas na primeira sessão após cadastro (1.1).
- **Conteúdo:** 2–3 telas curtas (carrossel), tom leve: "Você começa com R$10.000 simulados", "Aprenda fazendo, não lendo", "Compita com amigos, não só com estranhos" (gancho pro sistema social).
- **Pergunta de e-mail (EM.6.1, D8):** o último passo do carrossel pergunta se a pessoa quer e-mails opcionais ("Amigos" e "Resumo e lembretes"), **tudo desmarcado**. "Começar" grava só o que foi marcado; "Pular" nunca liga nada. Falha ao gravar não trava o onboarding (o padrão é desligado). Avisos de segurança da conta sempre são enviados e a pergunta diz isso.
- **Primeira ação (OB.1.2):** o slide "Aprenda fazendo, não lendo" tem uma compra guiada de 5 ações de treino (`SAND3`, Modo Aprendizado) em três toques, cada termo definido antes de aparecer (ação, ticker, preço, quantidade, total). Sem resolver a compra, o botão principal é "Pular esta etapa"; erro na compra ou ativo indisponível mostra a mensagem e o onboarding segue. Não gasta o saldo do mercado ao vivo nem conta pro ranking (ponto 063). O resultado aparece no próximo acesso, na tela 3.1.
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
  - **Faixa compacta** (não card), visualmente distinta (fundo diferente, selo "modo aprendizado"), de patrimônio do **sandbox** — reforça a separação exigida na seção 3.1 da spec. Só aparece com posição de treino aberta e leva a `/extrato?escopo=aprendizado`; sem posição, vira uma dica de uma linha, nunca "R$ 0,00" (decisões D5 opção B e D7 da revisão de trilhas, 2026-10-03; RC.7.4).
  - Indicador de **XP/nível** e **streak diário** (mecânicas da seção 6, hoje sem espaço em nenhuma tela).
  - Gráfico de rosca de distribuição de investimentos (herdado do wireframe original, Fig. 3), **interativo** (RC.7.3): anel em SVG, furo com o total investido por padrão e, ao passar o mouse, tocar ou focar uma fatia, o nome, o R$ e a %; legenda sempre com R$ e %; teclado (Tab, setas, Enter, Esc). Só mercado ao vivo, a preço de mercado (a soma bate com "Investido" do card).
  - Atalho "Retomar lição" se a trilha não estiver concluída — link direto pra **4.2 Lição** no ponto onde o usuário parou.
  - Botão **"Investir"** no rodapé do card de patrimônio (MO.9.1, decisão do autor): uma vez só, fora da área clicável do card. "Conquistas" saiu da tela (continua no menu do avatar e na Classificação).
- **Ações:**
  - "Investir" → **5.1 Navegação de Mercado**.
  - "Retomar lição" → **4.2 Lição** (estado atual do usuário).
  - Clique no card de patrimônio → **2.2 Meus ativos** (MO.8.4); clique numa fatia ou linha da rosca → **2.2** já filtrado pela categoria (`?categoria=`); faixa do Modo Aprendizado → **2.2** na aba de aprendizado. O extrato (5.8) segue pelo link "Ver extrato completo" da 2.2.
- **Estados especiais:** usuário sem nenhuma posição ainda (estado vazio, oferecendo a Trilha; o "Investir" do card já leva ao Mercado); carregamento com placeholders de altura próxima da final. **Composição por breakpoint (RC.7.5):** coluna única em mobile e tablet; a partir de 1024px, 2 colunas (patrimônio e Distribuição à esquerda; missões, retomar lição e ações à direita).
- **Dados envolvidos:** `accounts`, `positions`, `assets` (join pro gráfico de distribuição).

### 2.2 Meus ativos (MO.8.3)
- **Objetivo:** mostrar todos os ativos que o jogador possui e quanto cada um rendeu desde a compra. Padrão de corretora, sem gamificação em tela de dado.
- **Acesso:** `/ativos`, fora da barra principal. Entradas: card de patrimônio e rosca do Portfólio (MO.8.4).
- **Conteúdo:**
  - Abas **Mercado Ao Vivo** (padrão) e **Modo Aprendizado** (`?aba=aprendizado`); o aprendizado nunca entra nos totais do ao vivo.
  - Resumo: valor atual das posições (e custo), resultado total (R$ e %, com proventos) e proventos recebidos.
  - Filtro por categoria (Todos, Ações, FIIs, ETFs, Renda fixa; `?categoria=`) e ordenação (valor atual, resultado %, ticker; `?ordem=`).
  - Desktop (>= 1024 px): tabela com ativo, quantidade, preço médio, preço atual, valor atual, resultado, peso e proventos. Mobile e tablet: um cartão por ativo, sem rolagem horizontal.
  - Renda fixa: resultado sobre o valor bruto; "Líquido se resgatar hoje" como informação secundária; sem avaliação do motor mostra "Sem avaliação agora" em vez de zero.
- **Ações:** a linha leva à página do ativo (`/mercado/ativos/:id` ou `/mercado/renda-fixa/:id`); "Ver extrato completo" leva a `/extrato`.
- **Estados especiais:** carregando (skeleton), vazio (convite ao Mercado e à Trilha), erro, filtro sem resultado.
- **Dados envolvidos:** `GET /market/me/account` (posições, `markPrice`, `currentValue`, `netValue`, `dividendsReceived`).

---

## 3. Trilha de Aprendizado

### 3.1 Mapa da Trilha
- **Objetivo:** dar corpo visual à progressão pedagógica (RF11) — é a tela que substitui a ausência total de UI pra esse conceito hoje.
- **Cartão "Sua primeira ação" (OB.1.2, OA1):** no topo da tela, só quando a compra de treino do onboarding existe e o roteiro de preço já andou (ex: "+3,0%"), com "Ver por que o preço mexe" (lição 2.5, ou o convite de desbloqueio dela) e "Entendi" (dispensa de vez, por pessoa). Fica aqui, e não no Portfólio, porque o Portfólio só abre na lição 0.1.
- **Acesso:** nav primária ("Trilha"), ou via atalho do Portfólio (2.1).
- **Conteúdo:**
  - As 4 trilhas (Fundamentos, Renda Fixa, Renda Variável, Estratégia) mais a Trilha F paralela (Finanças do dia a dia, sem desbloqueio, em qualquer ordem) como seções/módulos expansíveis.
  - Cada uma das 43 lições como um "nó" no formato mapa de progressão (concluída / disponível / bloqueada), mostrando o que cada lição desbloqueia (ex: "Tesouro Selic" ao lado da lição 1.2).
  - Indicador de progresso geral (ex: "12 de 43 lições concluídas").
- **Ações:**
  - Clique em lição disponível → **3.2 Lição**.
  - Clique em lição bloqueada → estado informativo (o que falta pra desbloquear), sem navegação.
  - Clique em item já desbloqueado no mapa (ex: "Tesouro Selic") → **5.3 Detalhe de Ativo (Renda Fixa)** diretamente, sem passar pela listagem.
- **Estados especiais:** trilha 100% concluída (destaca "mundo aberto liberado", conforme lição 3.4).
- **Dados envolvidos:** `lessons`, `user_lesson_progress`.

### 3.2 Lição (componente genérico reutilizável)
- **Objetivo:** ensinar um conceito através do padrão "aprender fazendo" (seção 5.2 da spec) — reutilizado pelas 43 lições e por produtos parecidos (CDB/LCI/LCA/CRI/CRA compartilham a mesma estrutura de tela).
- **Acesso:** a partir do Mapa da Trilha (3.1) ou do atalho "Retomar lição" (2.1).
- **Conteúdo, em 4 estados sequenciais dentro da mesma tela:**
  1. **Cenário/gatilho** — texto + ilustração da situação simulada.
  2. **Micro-decisão** — interação restrita ao conceito (ex: mini-calculadora, comparação de dois valores, escolha entre opções).
  3. **Revelação** — resultado numérico real, usando as fórmulas do cap. 2 do TCC, com explicação do "porquê".
  4. **Desbloqueio** — confirmação visual do que foi liberado (produto, tela, ou próxima lição), com CTA pra continuar ou ir usar o que foi desbloqueado na prática.
- **Ações:**
  - "Continuar" ao final → próxima lição (3.2, nova instância) ou volta ao **3.1 Mapa da Trilha** se for a última do bloco.
  - "Usar agora" no passo de desbloqueio → leva direto pra tela recém-liberada (ex: lição 1.2 desbloqueia Tesouro Selic → **5.3 Detalhe de Ativo**).
- **Estados especiais:** lição já concluída antes (modo revisão, sem repetir XP/conquista; pode ser revista e o aluno pode voltar de passo, RC.2.1/RC.2.2). Conteúdo em `blocks` (texto curto, widgets, perguntas intermediárias que só avançam ao acertar, bloco "Na plataforma"); item travado pela trilha usa o `LockedGate` único. No Mapa, a etiqueta "Você está aqui" fica acima do nó atual e a grade de fundo usa o token `--grid-line` nos dois temas (RC.7.1).
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
  - **Visual (MO.9.5):** padrão "corretora": ticker em destaque, nome em linha secundária, preço à direita, variação em chip (`Delta`), etiqueta de risco e **mini sparkline de 30 dias** (série real, uma chamada em lote `GET /market/assets/quotes`, cache de 5 min no backend; sem série a lista segue sem o gráfico). Mobile: cartões de pelo menos 64 px; tablet: 2 cartões por linha; desktop: tabela com coluna "Últimos 30 dias".
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
- **Estados especiais:** sem transações ainda (estado vazio). Filtro de **escopo** (Tudo, Modo Aprendizado, Mercado Ao Vivo) lido de `?escopo=`, usado pela faixa do Sandbox no Portfólio (RC.7.4).
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
  - **"Para você" (RC.6.1 a RC.6.4):** faixa em destaque com o que afeta o usuário (posição em ação, FII, renda fixa a vencer, salário), separado do que é só do mercado; seletor Meus/Todos. Proventos e balanços saem em dias diferentes por ativo (política trimestral, semestral ou anual por empresa; FIIs no mês real), com valor exato após a data ex e estimativa antes dela.
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
- **Conteúdo:** nome, e-mail, username, alteração de senha, provedores conectados (OAuth) e a seção **E-mails** (EM.6.1): duas caixas, "Amigos" e "Resumo e lembretes", desligadas por padrão, cada clique grava na hora. Avisa quando o endereço da conta não recebe e-mail (bounce ou reclamação de spam). Segurança e avisos da conta não aparecem como opção porque nunca são desligáveis.
- **Ações:** "Salvar" → confirmação inline, sem navegação.
- **Estados especiais:** conflito de username já em uso.
- **Dados envolvidos:** `users`, `user_identities`, `email_preferences` (`GET/PATCH /me/email-preferences`).

### 9.3 Privacidade e LGPD
- **Objetivo:** cumprir RNF04 (gestão de consentimento, portabilidade, anonimização). Nesta fase não há controle de visibilidade de perfil configurável (decisão da spec v0.4, seção 8.2) — todo perfil é público por padrão, então esta tela fica restrita à gestão de dados pessoais exigida por lei, sem se misturar com o sistema social.
- **Acesso:** a partir de 9.2.
- **Conteúdo:** exportar dados (portabilidade), excluir conta/anonimizar dados pessoais não financeiros. Seção **"Como usamos seu e-mail"** (EM.8.2): para que o endereço é usado, que segurança não é desligável e o resto é opt-in com cancelamento de um clique, o **Resend** como operador (sede nos Estados Unidos, possível transferência internacional, art. 33 da LGPD), a retenção de 30 dias do endereço e do conteúdo de cada e-mail enviado e o apagamento da fila ao excluir a conta, com atalho para as preferências em 9.2. Uma nota informativa explica que rentabilidade percentual, nível e conquistas são sempre visíveis a outros usuários, e que o valor absoluto de patrimônio nunca é exposto, independentemente de qualquer configuração.
- **Ações:** "Exportar dados" gera download; "Excluir conta" pede confirmação em duas etapas.
- **Estados especiais:** confirmação de exclusão (modal de segurança).
- **Dados envolvidos:** `users` (consentimentos, dados de exportação).

---

## 10. Painel Administrativo

### 10.1 Painel Admin — Visão geral (hub)
- **Objetivo:** porta de entrada do painel administrativo, que a Fase N de `backlog-motor-mercado-realista.md` amplia pra centro de controle geral da aplicação (spec 3.3.3, nota de revisão de 2026-10-03). Desde a N.3 o painel tem um shell próprio (navegação por seções) em volta de todas as telas 10.x.
- **Acesso:** menu do avatar, visível apenas para `role = admin`; rota `/admin` protegida por `role = admin`.
- **Conteúdo:** navegação por seções (Visão geral, Tempo, Mercado, Bots, Usuários, Conteúdo, Gamificação, Sistema, Auditoria) — barra lateral fixa no desktop, faixa horizontal no tablet, gaveta no mobile; seção sem tela ainda aparece desabilitada com "Em breve". Desde a N.5 a tela em si é o dashboard de entrada: (1) **faixa de saúde** com backend, motor, banco de usuários, banco de mercado, Redis (cada um "No ar", "Lento" ou "Fora", com latência e o motivo da falha) e a **fila de e-mail** (EM.8.1: "Em dia", "Atenção" ou "Fora", com pendentes, falhas em 24 h e, no alerta, há quanto tempo o pendente mais antigo espera; "Atenção" quando passa de 10 min ou há 5 ou mais falhas em 24 h); (2) cartões **Mercado** (dia simulado, Selic, IPCA no mês e em 12 meses, eventos macro pendentes, ativos sem Market Maker), **Tempo** (agenda ativa/pausada/desligada, próximo tick, ritmo, tick em andamento, último tick), **Negociação** (negócios, volume e ordens abertas no dia simulado, bots ativos) e **Usuários** (total, cadastros em 24 h e 7 dias). Atualiza sozinha por polling de 15 s.
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

### 10.10 Bots
- **Objetivo:** operar os bots de liquidez (N.2). Rota `/admin/bots`, seção própria "Bots" do painel.
- **Conteúdo:** resumo ("X de Y bots ativos"); painel "Saúde dos bots" (N.14: cartões tracejados de bots parados, bots sem caixa e Market Maker sem ações de um ativo coberto, cada bot clicável abre o desempenho dele; seção recolhível com quem provê a liquidez em repouso de cada ativo e as maiores concentrações de float em um bot); aviso tracejado dos ativos negociáveis sem Market Maker ativo cobrindo; filtros de arquétipo e de status; tabela de bots com arquétipo e id curto (link pra tela de ordens filtrada pelo bot), escopo (setores, risco, classes de ativo e fatia da atividade), caixa, posições, cobertura (`N de teto` e os tickers, só Market Maker) e status; formulário de criação (arquétipo, escopo, atividade no escopo 85 a 90%, conhecimento só no Fundamentalista, posição máxima, preferência por ordem a mercado, spread, teto de cobertura só no Market Maker, caixa inicial; percentuais digitados em %).
- **Ações:** **Desempenho** por bot (N.14: expande abaixo da linha ou do cartão; janela de 7, 30 ou 90 dias simulados; patrimônio, capital aportado e P&L desde a criação, ordens por situação e motivo de cancelamento, taxa de execução, negócios e volume, última ordem e, no Market Maker, a cotação atual por ativo com spread e inventário contra o alvo); **Editar** (N.15: diálogo com o escopo e os números atuais, só envia o que mudou; a preferência por ordem a mercado não é editável, achado 001; vale na próxima rodada); **Aportar** (N.15: caixa e/ou uma posição, só soma e nunca remove; entra por evento imutável e conta como capital aportado; aporte de posição é recusado se passar do total de cotas em circulação); ativar (direto) e desativar (confirmação: sai da próxima rodada, caixa e posição ficam; num Market Maker avisa que a cobertura deixa de valer); editar cobertura e teto de um Market Maker num diálogo (conjunto final de ativos; avisa que tirar um ativo cancela as ordens dele nele); criar bot. O bot novo nasce só com caixa (sem posição inicial) e entra na rodada seguinte; Market Maker novo nasce sem cobertura. Tudo na auditoria (`bot.create`, `bot.update`, `bot.fund`).
- **Estados especiais:** carregando; falha ao carregar; sem bot com os filtros; sem ativo disponível pra cobrir; bot inexistente (404), ativo já coberto por outro Market Maker (409) ou ordens demais pra cancelar (422), todos com mensagem e lista atualizada; recusa do motor na criação aparece no formulário. Tabela no tablet/desktop e cartões no mobile; desktop: lista à esquerda e formulário fixo à direita, tablet/mobile: formulário abre pelo botão "Novo bot" acima da lista.
- **Dados envolvidos:** `GET/POST /admin/bots`, `PATCH /admin/bots/:id`, `GET /admin/bots/summary`, `GET /admin/bots/:id/activity`, `POST /admin/bots/:id/funding` (`.docs/backend/admin.md`, `.docs/engine/admin.md`).

### 10.3 Histórico de Eventos Macro
- **Objetivo:** cumprir RF14 — lista de eventos disparados (era o conteúdo do hub 10.1 antes da N.3). Seção "Mercado" do painel, rota `/admin/eventos`.
- **Conteúdo:** lista de eventos (histórico), paginada, com a situação de cada um (**agendado**, pendente, aplicado ou **cancelado**, N.11), filtros por status, alvo (setor, classe de risco ou ativo) e período em dias simulados, botão "Novo evento", e, no fim, o **catálogo de templates** em somente leitura (a edição segue via código, spec 3.3.3).
- **Ações:** "Novo evento" → **10.2 Criar/Disparar Evento**; "Ver detalhe" em cada evento → **10.12 Detalhe do Evento Macro**; filtrar e limpar filtros.
- **Estados especiais:** nenhum evento para o filtro; período inválido (aviso, filtro de período ignorado).
- **Dados envolvidos:** `macro_events`, `macro_event_targets`.

### 10.2 Criar/Disparar Evento Macro
- **Objetivo:** formalizar RF13 — criação e disparo manual de evento.
- **Acesso:** a partir de 10.3.
- **Conteúdo:** seleção de template do catálogo (seção 3.3.2 da spec, 10 templates pré-definidos) OU criação avulsa (título, narrativa, setor/ativo-alvo, banda de magnitude — Leve/Moderado/Severo, tipo de efeito — preço/fundamentos/ambos).
- **Ações:** "Disparar agora" → confirma e retorna a **10.3**, evento aparece no topo do histórico. Com um **dia de aplicação** preenchido (N.11) o botão vira "Agendar evento": o evento nasce pendente, só começa a produzir efeito naquele dia simulado e só aparece pros jogadores quando faltar a **antecedência** escolhida (campo "dias de antecedência", N.25; vazio usa a véspera, 0 só mostra quando o efeito começa); vazio, dispara já (efeito a partir do próximo tick).
- **Estados especiais:** validação de campos obrigatórios ao criar evento avulso; dia de aplicação que não é posterior ao dia simulado atual (recusado na tela e no motor).
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

### 10.11 Parâmetros de simulação
- **Objetivo:** ver e ajustar o ritmo do Temporizador sem reiniciar o motor (N.7). Rota `/admin/tempo/parametros`, dentro da seção "Tempo" (link na tela 10.5).
- **Conteúdo:** dois cartões editáveis, **dias simulados por dia real** (1 a 24) e **recuperação máxima depois de uma parada** (1 a 30), cada um com valor atual, padrão do ambiente, faixa permitida e quando foi alterado; abaixo, a lista **somente leitura** (semente da simulação, capital inicial, intervalo do Copom, teto de spread do bot, teto de ordem do bot sobre o volume, teto de avançar dias, teto do lote de cancelamento) com o motivo de cada um, sem nenhum controle de edição.
- **Ações:** salvar (valida a faixa na tela e no motor, confirma antes de enviar e avisa que afeta todos os usuários a partir do próximo tick agendado) e restaurar o padrão (só habilitado quando o valor foi alterado, com confirmação). Tudo na auditoria (`settings.update`, `settings.reset`).
- **Estados especiais:** valor fora da faixa (mensagem da faixa), recusa do motor (mostra a mensagem dele), erro ao carregar.
- **Dados envolvidos:** `engine_settings`.

### 10.12 Detalhe do Evento Macro
- **Objetivo:** olhar um evento macro de perto e, se ainda der tempo, cancelá-lo (N.11). Rota `/admin/eventos/:id`, dentro da seção "Mercado".
- **Conteúdo:** situação (agendado, pendente, aplicado, cancelado) e data de criação; **ciclo de vida** (dia simulado agora, dia em que o efeito começa, duração, dia e data do relatório de fundamentos, se os jogadores já enxergam o evento); **o que foi sorteado** (narrativa, direção, magnitude, template, efeitos de preço e de fundamentos, alvos); **o que o jogador vê hoje** (a mesma versão redigida do feed: enquanto o evento está pendente, sem direção, magnitude, efeitos nem alvos); **impacto realizado no preço** por alvo e por ativo, entre o último dia antes do efeito e a janela escolhida (5, 10 ou 30 dias), que só aparece depois de o mercado chegar ao fim da janela.
- **Ações:** trocar a janela do impacto; **cancelar evento** (confirmação; só enquanto o evento é pendente e o efeito ainda não começou; o evento não é apagado, deixa de produzir efeito e some do feed). O cancelamento fica na auditoria (`macro_event.cancel`).
- **Estados especiais:** cancelar desabilitado com o motivo (já aplicado, já cancelado, efeito em andamento); impacto indisponível (cancelado, evento só de fundamentos, janela ainda aberta); recusa do motor ao cancelar (tick em andamento) mostra o motivo; evento inexistente; erro ao carregar.
- **Dados envolvidos:** `macro_events`, `macro_event_targets`, `asset_quotes`.

### 10.13 Usuários
- **Objetivo:** achar uma conta e abrir o detalhe (N.16). Rota `/admin/usuarios`, seção "Usuários".
- **Conteúdo:** busca por nome, e-mail, username ou id; filtros de papel, status, provedor de login e data de cadastro; lista paginada (tabela no tablet e no desktop, cartões no mobile).
- **Ações:** abrir o detalhe de uma conta.
- **Estados especiais:** conta suspensa com borda tracejada; conta excluída (LGPD) aparece como "Conta excluída"; lista vazia; erro ao carregar.
- **Dados envolvidos:** `users`, `user_identities`.

### 10.14 Detalhe do usuário
- **Objetivo:** ver uma conta por inteiro e atuar sobre ela (N.16 e N.17). Rota `/admin/usuarios/:id`.
- **Conteúdo:** cartões de conta, progressão, carteira (o administrador **vê o patrimônio absoluto**, exceção deliberada à RNF09), ordens abertas e linha do tempo de ações do painel sobre a conta; abaixo, **Correções de conta** (N.17): crédito de caixa sem teto, ajuste de XP, definir streak, conceder conquista (sem revogar, N.26), concluir ou reabrir lição.
- **Ações:** suspender (motivo obrigatório), reativar, encerrar sessões, excluir a pedido (LGPD, digitando o username) e cada correção, todas com senha recente (exceto reativar) e na auditoria. O crédito pede confirmação mostrando o valor formatado; concluir lição não dá XP e reabrir pode tirar o acesso à lição seguinte (avisado na tela). Resetar carteira não existe.
- **Estados especiais:** conta de administrador não é suspensa nem excluída pelo painel; motor fora do ar (carteira e ordens vêm vazias, o resto segue); recusa do backend aparece no formulário; conta excluída não mostra as correções.
- **Dados envolvidos:** `users`, `user_progression`, `user_achievements`, `user_lesson_progress`, `admin_audit_log`, e `accounts`/`market_events` (via motor).

### 10.15 Gamificação
- **Objetivo:** operar o catálogo de conquistas e de missões diárias e olhar o ranking (N.19). Rota `/admin/gamificacao`, seção "Gamificação". Três abas; cada uma só consulta quando aberta.
- **Conteúdo:** **Conquistas**: nome, regra e meta, quantos usuários ganharam, status. **Missões diárias**: título, tipo de conferência (só leitura), XP, quantos concluíram (no total e hoje), status. **Ranking**: ranking global da janela corrente (semana ou mês, em UTC, com início e fim), por critério (geral, renda fixa, renda variável, nível), paginado, só nível, XP e rentabilidade percentual.
- **Ações:** criar e editar conquista (a regra vem de uma lista fechada, nunca expressão livre), ativar e desativar conquista e missão (desativar pede confirmação e explica que ninguém perde o que já ganhou), editar título, descrição e XP da missão. Tudo na auditoria (`achievement.create`, `achievement.update`, `mission.update`). O ranking é somente leitura: é calculado na hora, sem janela gravada, então não há fechar nem recalcular. Não existe criar missão nova.
- **Estados especiais:** desativada com borda tracejada; meta inválida (inteiro nos critérios de contagem, reais no patrimônio); nome de conquista repetido (409) mostrado no formulário; ranking vazio; erro ao carregar.
- **Dados envolvidos:** `achievements`, `user_achievements`, `daily_missions`, `user_mission_progress`.

---

### 10.16 Catálogo de ativos
- **Objetivo:** consultar os parâmetros de todos os ativos e ajustar uma lista fechada de campos (N.12). Rota `/admin/mercado/catalogo`, dentro da seção "Mercado"; link na 10.6.
- **Conteúdo:** filtros de classe (ações, FIIs, ETFs, renda fixa) e busca por ticker ou nome; um cartão por ativo com o bloco da classe (RF21: ação com empresa, setor, crescimento base e multiplicador de qualidade; ETF com índice, taxa, rebalanceamento, cesta e metodologia; FII com tipo, segmento, indexador ou vacância; renda fixa com emissor, taxa, vencimento e aplicação mínima). Os campos estruturais (ticker, setor, cotas em circulação, ciclo de relatório) aparecem separados por borda tracejada, sem controle de edição. Ativo do sandbox vem marcado e travado.
- **Ações:** editar nome (todos), crescimento base e multiplicador de qualidade (ação; valem pra empresa emissora, ou seja, ON e PN), metodologia (ETF). Confirmação com o de/para antes de gravar, e a alteração vai pra auditoria. **Cadastrar ativo novo (N.13):** formulário por classe (ação com empresa, CNPJ, setor, float, crescimento e qualidade; FII de tijolo com segmento e vacância; FII de papel com indexador; ETF com índice, metodologia e cesta de ações/FIIs já cadastrados), preview do que será criado (bots novos, Market Maker que cobre, float distribuído) e confirmação digitando o ticker. Não há exclusão de ativo.
- **Estados especiais:** carregando; erro de carga; filtro sem resultado; valor fora da regra (recusado na tela e, se passar, com a mensagem do motor); ativo removido no meio do caminho. Cartões em 1, 2 ou 3 colunas conforme o breakpoint.
- **Dados envolvidos:** `GET /admin/catalog`, `PATCH /admin/catalog/:id`, `POST /admin/catalog/preview`, `POST /admin/catalog` (`.docs/backend/admin.md`, `.docs/engine/admin.md`).

### 10.17 Sistema
- **Objetivo:** avisar todos os usuários de algo que vai acontecer, pôr a plataforma em manutenção (N.20), provar que o estado financeiro bate com o histórico e exportar dados (N.21). Rota `/admin/sistema`, seção "Sistema", uma página só com quatro blocos.
- **Conteúdo:** **Modo de manutenção** (formulário ou, com uma manutenção em aberto, o resumo dela com "Encerrar manutenção"); **Integridade financeira** (botão "Verificar agora", a última verificação, o resumo do que foi conferido, uma contagem por categoria de divergência mesmo quando zero, e a lista de divergências com esperado e encontrado); **Exportar dados em CSV** (conjunto, período, limite de linhas, o que o conjunto contém e o que nunca contém); **Novo comunicado** (título até 80 e texto até 280 caracteres, só texto, severidade, início, fim, "o usuário pode dispensar" e, só para severidade crítica na criação, "avisar também por e-mail", que envia uma vez a quem tem o e-mail confirmado; o modo de manutenção tem a mesma opção); **lista de comunicados** com o estado de cada um (no ar com selo sólido; agendado e encerrado com selo tracejado).
- **Ações:** publicar, editar (menos a manutenção), encerrar, cancelar um agendado; iniciar e encerrar manutenção. Iniciar manutenção com a pausa de negociação liga a pausa global (N.9) e pede digitar `PAUSAR TUDO` e senha recente; encerrar a manutenção levanta a pausa que ela abriu. Verificar integridade só lê (nunca há botão de corrigir) e roda em segundo plano, com a tela consultando a cada 2 segundos enquanto roda; só uma por vez. Baixar CSV entrega o arquivo ao navegador e informa quantas linhas vieram e se o teto cortou; a exportação de usuários (traz e-mail) pede senha recente. Tudo na auditoria (`announcement.create`, `announcement.update`, `announcement.end`, `maintenance.start`, `integrity.check`, `export.csv`).
- **No app do usuário:** faixa no topo de todas as telas autenticadas (e no WebView do app mobile, que carrega o mesmo frontend), com o rótulo da severidade em texto (Aviso, Atenção, Importante, Manutenção). Comunicado dispensável tem botão de fechar e não volta na mesma sessão do navegador; a manutenção é crítica e não dispensável. Fora da janela de início e fim o comunicado não aparece.
- **Estados especiais:** texto com `<` ou `>` recusado na tela e no servidor; fim antes do início; segunda manutenção em aberto (409); integridade sem verificação anterior, em andamento, falha, zero divergências, mais de 200 divergências (lista cortada, contagens exatas); exportação com período invertido, arquivo cortado pelo teto, senha não confirmada; carregando; erro de carga.
- **Dados envolvidos:** `announcements`; `GET/POST/PATCH /admin/announcements`, `POST /admin/announcements/:id/end`, `POST /admin/maintenance`, `GET /announcements`, `POST/GET /admin/integrity/check` e `GET /admin/exports/:dataset` (`.docs/backend/admin.md`, `.docs/backend/announcements.md`, `.docs/engine/admin.md`).

### 10.18 Retenção
- **Objetivo:** medir se as novidades funcionam (RT.1.3, Fase A de `backlog-retencao-onboarding-ofensiva.md`). Rota `/admin/retencao`, seção "Retenção"; também aberta pelo cartão "Retenção" da 10.1. Só números agregados: nenhuma lista de pessoas, nenhum patrimônio (RP4, RNF09).
- **Conteúdo:** filtros de janela (coortes de 8, 12, 26 ou 52 semanas; gráfico de 30, 60, 90 ou 180 dias); cartão **Ontem** (voltaram, estudaram, ativos em 30 dias, DAU/MAU); **tabela de coortes** (linha = semana de cadastro, colunas = dia 1, 7 e 30 nas duas medidas, "voltou" = qualquer acesso no dia e "estudou" = lição ou missão concluída), com cor por faixa em cada coluna (verde acima da régua, vermelho abaixo, legenda na tela), célula tracejada para "em andamento" (o dia ainda não chegou) e "sem dado" (antes do início do registro), nunca 0%, e asterisco quando só parte da coorte pôde ser medida; **gráfico de ativos por dia** (voltaram e estudaram) e **gráfico de DAU/MAU**, com os valores reais de cada dia ligados em reta, sem suavização, e dia sem registro em branco; **tempo até cada marco** (voltou depois do cadastro, primeira lição, primeira operação real, primeira renda fixa, primeiro Diário: mediana e quantos chegaram) e, recolhida, a % de cada coorte em cada marco.
- **Ações:** trocar as janelas; passar o cursor, tocar ou usar as setas do teclado no gráfico para ver o valor de um dia. Só leitura.
- **Estados especiais:** carregando; erro de carga; sem nenhum registro de presença ainda (tudo "sem dado", com a explicação); coorte recente (em andamento, parcial); MAU e DAU/MAU só aparecem depois de 30 dias de registro; marcos só contam quem se cadastrou depois do início do registro.
- **Responsividade:** mobile em uma coluna, com a tabela rolando na horizontal e a semana fixa à esquerda; tablet com os cartões de marco em duas colunas; desktop com os gráficos à esquerda e os marcos como coluna lateral fixa.
- **Dados envolvidos:** `GET /admin/retention` (`.docs/backend/admin.md`).

## 11. Resumo — todas as telas numeradas

| # | Tela | Grupo |
|---|---|---|
| 1.1 | Autenticação | Auth |
| 1.2 | Onboarding | Auth |
| 1.3 | Esqueci minha senha | Auth |
| 1.4 | Redefinir senha | Auth |
| 1.5 | Verificar e-mail | Auth |
| 1.6 | Cancelar inscrição de e-mail | Auth |
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
| 10.10 | Bots | Admin |
| 10.11 | Parâmetros de simulação | Admin |
| 10.12 | Detalhe do Evento Macro | Admin |
| 10.13 | Usuários | Admin |
| 10.14 | Detalhe do usuário | Admin |
| 10.15 | Gamificação | Admin |
| 10.16 | Catálogo de ativos | Admin |
| 10.17 | Sistema | Admin |
| 10.18 | Retenção | Admin |

**Total: 42 telas** (contando estados distintos de uma mesma família, como 6.1/6.2, como telas separadas por terem conteúdo e propósito diferentes).

---

## 12. Pendências a validar com você

- [x] ~~Sistema de amigos (seção 8) é uma proposta minha, não estava na spec — precisa de validação de modelo~~ — resolvido: amizade bilateral com aceite, sem bloqueio nesta fase, sem perfil privado. Já formalizado em `especificacao-plataforma-investimentos.md` v0.4.
- [x] ~~Missões diárias (7.3) menciona entidades novas (`daily_missions`, `user_mission_progress`) que não existem na spec~~ — resolvido: formalizado no MVP, RF22, spec v0.5.
- [x] ~~Onde exatamente entram as abas de ETFs/FIIs dentro da Renda Variável e se compartilham indicadores fundamentalistas com Ações~~ — resolvido: ETFs mostram índice/metodologia/composição, FIIs se dividem em tijolo (segmento/patrimônio/vacância) e papel (indexador), ambos com Dividend Yield. RF21, spec v0.5, seção 3.6.

Nenhuma pendência remanescente nesta lista — pronto para virar wireframes ou quebra de tarefas.

---

Próximo passo natural: transformar esse inventário em wireframes reais, tela por tela — posso começar por qualquer uma. As de maior prioridade pra destravar o resto continuam sendo 3.1 (Mapa da Trilha) e 4.5 + 4.7 (Detalhe de Ativo + Confirmação de Ordem).
