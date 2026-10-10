# Especificação — Plataforma Gamificada de Aprendizado de Investimentos

> **Documento vivo.** Nada aqui é definitivo — é um ponto de partida estruturado que deve ser revisado conforme o desenvolvimento avança. Seções marcadas como `[EM ABERTO]` indicam decisões ainda não fechadas.

**Versão:** 0.1
**Contexto:** TCC (Ciência da Computação — UNO Chapecó) com implementação real, prazo de desenvolvimento ~2 meses (Claude Code).
**Público-alvo:** Adolescentes/adultos, sem foco infantil.

---

## 1. Visão Geral

Plataforma web que ensina investimentos na prática, por meio de um mercado financeiro simulado. Diferente da concepção inicial (economia completa com múltiplos agentes e multiplayer real), o escopo atual foca em:

- Um único mercado simulado, compartilhado por todos os usuários (equidade: mesmas regras, mesmos preços, no mesmo instante do calendário simulado).
- Interação social limitada à camada de gamificação (ranking, conquistas), não a negociação entre usuários.
- Progressão contínua, sem "fim" fixo — o mercado ao vivo roda em tempo de calendário simulado e sempre gera situações novas.

Multiplayer real (usuários negociando entre si, economia completa) fica como evolução futura da aplicação, fora do escopo desta fase.

---

## 2. Escopo

### Dentro do escopo
- Renda Fixa: Tesouro Selic, Tesouro Prefixado, Tesouro IPCA+, CDB, LCI/LCA, CRI/CRA, marcação a mercado.
- Renda Variável: ações (ON/PN), IPO, indicadores fundamentalistas básicos (P/L, VPA), dividendos/data ex, ETFs, FIIs.
- Conceitos transversais: inflação, rendimento real vs nominal, tributação regressiva de IR, comparação com poupança.
- Trilha de aprendizado progressiva + mundo aberto.
- Gamificação: XP/nível, conquistas, streak diário, missões diárias, ranking por rentabilidade em janela fixa (semana/mês).
- Sistema social: amizade bilateral com aceite entre usuários, busca por `username`, ranking com escopo Global e Amigos (seção 8).

### Fora do escopo (por enquanto)
- Módulos de orçamento doméstico, controle de gastos, prevenção de inadimplência (já delimitado no TCC original).
- Multiplayer real / negociação entre usuários.
- Temporadas de ranking com reset (avaliar em versão futura).
- Avaliação com usuários reais (não faz parte da pesquisa do TCC).
- Bloqueio de usuários / moderação (fora do escopo desta fase, revisitar em versão futura junto com critérios de abuso/spam — seção 8).

---

## 3. Arquitetura

Mantém a espinha dorsal do TCC original: arquitetura orientada a serviços, separando a camada de gamificação da camada de simulação financeira.

```
Usuário → Frontend Gamificado (React/TS)
        → Proxy Reverso
        → Backend Plataforma Gamificada (Node.js) → Redis (cache/rankings) + PostgreSQL (usuários/gamificação)
        → Motor de Simulação (Go) → Redis (cotações) + PostgreSQL (mercado, Event Sourcing)
```

### 3.1 Dois ambientes de mercado

| Ambiente | Escopo | Determinismo | Objetivo |
|---|---|---|---|
| **Sandbox de aprendizado** | Individual, por usuário | Roteirizado/determinístico | Garantir que a primeira experiência de cada conceito seja pedagogicamente controlada e equivalente entre usuários (ex: a primeira ação comprada por qualquer usuário sobe 3% nos primeiros dias) |
| **Mercado Ao Vivo** | Global, único, compartilhado | Estocástico, mas com parâmetros iguais para todos | Mundo aberto pós-trilha. Equidade = mesmas regras e mesmo estado de mercado para todos no mesmo instante do calendário simulado, não trajetórias idênticas por usuário |

O sandbox usa ativos fictícios de ensino, isolados do catálogo do mercado ao vivo, para não contaminar nem ser contaminado pelo estado real da simulação. As operações do sandbox **reaproveitam as mesmas tabelas transacionais** (`positions`, `order_book`) usadas no mercado ao vivo, aplicadas sobre os ativos fictícios isolados via `sandbox_assets` — mantendo consistência arquitetural em vez de criar um caminho de dados paralelo. O Portfólio distingue visualmente saldo/posições de sandbox das de mercado ao vivo, e apenas as posições do mercado ao vivo contam para o ranking (seção 6).

### 3.2 Geração de preços (Mercado Ao Vivo)

- **Renda Variável:** Movimento Browniano Geométrico (GBM) por ativo, com drift/volatilidade calibrados por `risk_class` (campo já existente em `assets`, classes Conservador/Sofisticado dos wireframes). Componente de jump-diffusion (tipo Merton) para eventos agendados (balanços, notícias).

  | Classe (`risk_class`) | Volatilidade anualizada (σ) | Drift (retorno esperado) |
  |---|---|---|
  | Conservador | 22% a.a. | Selic simulada + 3% a.a. |
  | Sofisticado | 45% a.a. | Selic simulada + 7% a.a. |

  Conversão para o tick diário via σ_diário = σ_anual / √252 (base de 252 dias úteis, mesma convenção já usada nas fórmulas de Tesouro Prefixado do TCC, cap. 2.2.1).

- **Renda Fixa:** curva de juros com reversão à média (tipo Vasicek simplificado), simulando reuniões do "Copom" via ator Temporizador (calendário em 3.2.1).
- **IPCA+:** IPCA mensal sintético, pequena variação em torno de uma meta, alimentando o cálculo de VNA já documentado no TCC (cap. 2.2.2).
- **Fundamentos das empresas:** gerados sinteticamente a cada ciclo de relatório (3.3.1), combinando crescimento base + ruído + o fator sistêmico da Selic (ver 3.2.2) + efeitos pendentes de eventos macro (3.3), suportando os indicadores fundamentalistas (RF07).

### 3.2.1 Calendário de eventos de mercado

Dois ritmos fixos e dessincronizados, para alternar o foco de atenção do usuário em vez de concentrar tudo no mesmo dia:

- **Relatórios de empresas:** a cada **14 dias reais** (seção 3.3.1).
- **Reuniões do Copom (ajuste da curva de juros):** a cada **21 dias reais**, disparadas pelo Temporizador, afetando a marcação a mercado dos títulos prefixados (cap. 2.2.3 do TCC).

Como 14 e 21 têm MMC = 42, os dois calendários coincidem a cada **42 dias reais** (a cada 3 ciclos de relatório e 2 reuniões do Copom), criando um "super dia" de mercado periódico e previsível, em que resultados de empresas e decisão de juros saem juntos. Nos demais ciclos, os eventos caem em dias diferentes, mantendo o ritmo alternado.

Eventos macro pontuais (seção 3.3) não têm calendário próprio — podem ser disparados a qualquer momento entre esses dois ritmos fixos, seja pelo pool de templates curados, seja pelo painel administrativo.

### 3.2.2 Selic como fator macroeconômico sistêmico

Diferente dos eventos macro (pontuais, narrativos, disparados manualmente ou por template — seção 3.3), a Selic simulada afeta os fundamentos das empresas de forma **contínua e automática**, replicando o mecanismo real de transmissão da política monetária (Selic alta → desaceleração econômica → resultados corporativos mais fracos):

```
crescimento_trimestral = crescimento_base − sensibilidade × (Selic_atual − Selic_neutra) + ruído
```

A sensibilidade reaproveita a `risk_class` do ativo vinculado à empresa: classes "Sofisticado" (setores cíclicos/mais alavancados) são mais sensíveis a juros altos que "Conservador" (fluxo de caixa mais estável) — reforçando na prática o conceito de diversificação defensiva vs. cíclica. `Selic_neutra` é adotada como premissa de referência (ex: 10% a.a., aproximando a média histórica), ajustável conforme calibração.

### 3.3 Eventos Macro

Requisito solicitado pela banca: eventos que simulam acontecimentos do mundo real e impactam setores/ativos específicos (ex: uma notícia regulatória afetando mineradoras), exigindo que o usuário compreenda o contexto e tome decisões — não apenas observe números mudarem.

- **Escopo do impacto:** setor (via `companies.sector`), classe de ativo, ou ativo específico.
- **Dois tipos de efeito, não excludentes:**
  - **Efeito imediato de preço** — choque de drift, volatilidade ou salto, aplicado ao gerador de preços do Mercado Ao Vivo (reaproveita o jump-diffusion da seção 3.2). Representa a reação especulativa do mercado no momento da notícia.
  - **Efeito nos fundamentos** — o evento fica pendente e, quando o **próximo relatório trimestral** daquela empresa é gerado (ver cadência abaixo), ele influencia as linhas contábeis (`net_income`, `ebit`, `gross_debt`, `cash_equivalents`) além do ruído/crescimento sintético já previsto. Cria o cenário didático de "o mercado já precificou certo, ou o relatório vai confirmar/desmentir a reação inicial?".
- **Regras de defasagem entre preço e fundamentos:**
  - **Janela de corte:** um evento só afeta o relatório mais próximo se disparado com pelo menos 2 dias de antecedência do fechamento do ciclo de 14 dias — evita o cenário didaticamente estranho de "notícia de ontem virando balanço hoje". Se disparado depois desse corte, o efeito é atribuído ao relatório seguinte (28 dias à frente).
  - **Múltiplos eventos no mesmo ciclo sobre a mesma empresa:** os efeitos são somados (aditivo), com um teto de magnitude total por ciclo (ex: ±40% de variação no crescimento do trimestre) para evitar resultado absurdo.
  - **Reação de preço na divulgação do relatório:** o preço reage novamente, mas apenas pela "surpresa" — a diferença entre o que já havia sido precificado pelo efeito imediato do evento e o que de fato veio no relatório. Se o resultado bate com o que o mercado já precificou, o preço quase não se move na divulgação; se veio pior que o esperado, cai mais; se veio melhor, sobe (efeito "alívio"). Essa regra é o principal veículo pedagógico do mecanismo: ensina que o que move preço não é o resultado em si, é o resultado versus expectativa.
- **Como o evento é disparado (não excludentes):**
  - Pool de templates curados, com narrativa pedagógica pronta, sorteados/disparados periodicamente pelo ator Temporizador.
  - **Painel administrativo de criação e disparo manual — requisito formal** (não apenas script de demonstração), incluindo necessidade de distinção de papel `admin` vs usuário comum no modelo de autenticação.
- **Como o evento afeta todos:** como o Mercado Ao Vivo é único e global, o evento impacta todos os usuários ao mesmo tempo, no mesmo instante do calendário simulado — consistente com a regra de equidade já definida (seção 3.1).
- **Ganho pedagógico:** o evento aparece como notícia/feed explicando o porquê do movimento, e pode abrir um ponto de decisão gamificado (manter/comprar/vender), reforçando o raciocínio de risco em vez de apenas expor a variação de preço.

### 3.3.1 Cadência de relatórios das empresas

Todas as empresas cadastradas (`companies`) divulgam resultados no **mesmo ciclo global**, a cada **14 dias reais (quinzenal)**, disparado pelo Temporizador para todas de uma vez — decisão tomada para simplificar o agendamento (em vez de ciclos escalonados por empresa, como ocorreria na vida real). O intervalo quinzenal busca equilíbrio: tempo suficiente para o usuário observar o efeito de um evento macro no preço e tomar uma decisão antes do relatório confirmar (ou desmentir) a reação inicial do mercado, sem esfriar a sensação de "mercado vivo". A cada ciclo, uma nova linha de `company_fundamentals` é gerada para cada empresa, combinando: crescimento/ruído sintético de base (já previsto) + efeitos pendentes de eventos macro que tenham como alvo aquela empresa/setor desde o último relatório.

### 3.3.2 Bandas de magnitude e catálogo inicial de templates

Para manter consistência e agilidade no painel administrativo (seleção por banda em vez de campo numérico livre), os eventos usam três bandas padronizadas:

| Banda | Efeito de preço (choque imediato) | Efeito nos fundamentos (próximo relatório) |
|---|---|---|
| Leve | ±3% a ±5% | ±5% a ±10% |
| Moderado | ±8% a ±12% | ±10% a ±20% |
| Severo | ±15% a ±25% | ±20% a ±35% |

Catálogo inicial de templates (`macro_events` pré-cadastrados, sorteados/disparados pelo Temporizador ou usados de referência no painel admin):

| Categoria | Template | Direção | Banda | Efeito |
|---|---|---|---|---|
| Regulatório | Nova legislação ambiental restringe atividade de mineração | Negativo | Moderado | Preço + Fundamentos |
| Commodities | Minério de ferro dispara no mercado internacional | Positivo | Moderado | Preço + Fundamentos |
| Commodities | Queda do petróleo no mercado internacional | Negativo | Leve/Moderado | Preço + Fundamentos |
| Setorial (Tecnologia) | Nova regulamentação de dados eleva custos do setor de tecnologia | Negativo | Leve | Fundamentos |
| Setorial (Bancário) | Aumento da inadimplência pressiona resultado dos bancos | Negativo | Moderado | Fundamentos |
| Corporativo | Escândalo contábil identificado em empresa do varejo | Negativo | Severo | Preço + Fundamentos |
| Corporativo | Empresa anuncia expansão/parceria estratégica | Positivo | Moderado | Preço |
| Cambial | Forte desvalorização do real frente ao dólar | Misto (por setor) | Moderado | Preço + Fundamentos |
| Geopolítico | Tensão comercial internacional afeta cadeias de suprimento | Negativo | Leve/Moderado | Preço |
| Agronegócio | Quebra de safra por evento climático reduz oferta agrícola | Misto | Moderado | Preço + Fundamentos |

Isso implica padronizar `companies.sector` (hoje texto livre no DER) em uma lista fixa de setores, garantindo que os templates casem com as empresas cadastradas: **Mineração, Agronegócio, Bancário/Financeiro, Varejo, Energia, Tecnologia**.

### 3.3.3 Escopo do painel administrativo

Escopo enxuto para esta fase, focado apenas no requisito da banca (evitar que o painel vire um back-office completo e consuma tempo do núcleo pedagógico nos 2 meses de desenvolvimento):

**Dentro do escopo (via interface, papel `admin` distinto de usuário comum):**
- Disparo manual de evento macro: selecionar template do catálogo (3.3.2) ou criar um avulso (título, narrativa, setor/ativo-alvo, banda de magnitude, tipo de efeito) e confirmar disparo imediato.
- Listagem/histórico simples dos eventos disparados.

**Fora do escopo da interface nesta fase — populado via seed/script de banco de dados, não via UI:**
- Cadastro de empresas e ativos (`companies`, `assets`, `fixed_income_assets`, `variable_income_assets`) — catálogo que não muda com frequência, mais eficiente popular via seed inicial.
- Gestão de usuários (edição de perfil, banimento, etc.) — não é requisito da banca.
- Edição do catálogo de templates de eventos macro (3.3.2) — versionado em script/seed, também tratado como conteúdo "vivo" e editável ao longo do desenvolvimento, só que fora da aplicação.

Essa divisão é uma decisão de fase, não definitiva: cadastro de empresas/ativos, gestão de usuários e edição do catálogo de templates são candidatos naturais a ganhar interface própria numa evolução futura da plataforma, quando o volume de conteúdo justificar sair do script para uma tela de administração.

**Revisão (2026-10-03):** o autor ampliou o escopo do painel para centro de controle geral da aplicação (tempo, mercado, bots, catálogo, usuários, conteúdo, gamificação, sistema). As tarefas estão na Fase N de `backlog-motor-mercado-realista.md` (N.3 a N.22); as decisões ainda abertas estão no achado 029 de `pontos-em-aberto-decisao-produto.md`.

### 3.4 Event Sourcing / CQRS

Mantido do TCC original, mas com escopo de implementação simplificado no MVP: log de eventos append-only real desde o início; separação plena de read models (CQRS completo) pode entrar de forma incremental, não precisa estar pronta no dia 1.

### 3.5 Capital inicial e equidade de partida

Toda conta nova inicia com o mesmo saldo simulado (`accounts.current_balance`), fixado como premissa em **R$ 10.000,00** — valor didático redondo, ajustável durante a calibração. Essa padronização é o que garante que o ranking por rentabilidade percentual (seção 6) seja de fato comparável entre usuários, independente de quando cada um entrou na plataforma.

### 3.6 Indicadores por Classe de Ativo

O RF07 do TCC original (indicadores fundamentalistas) foi desenhado pensando em ações. ETFs e FIIs não compartilham a mesma lógica de fundamentos de uma empresa individual, então os indicadores exibidos na tela de detalhe de ativo variam por classe:

- **Ações:** indicadores fundamentalistas tradicionais, já mapeados no currículo (lições 2.6.1–2.6.6) — P/L, P/VP, LPA, VPA, ROE, Margem EBIT, Margem Líquida, Dívida Líquida/EBIT, Dividend Yield.
- **ETFs:** não fazem sentido indicadores de rentabilidade de empresa individual. Em vez disso, exibem o índice de referência que replicam e um resumo da metodologia de replicação, além de uma composição sintética simplificada — principais constituintes e peso percentual, derivada da carteira teórica do índice simulado.
- **FIIs:** divididos em dois perfis, com campos próprios por perfil:
  - **Tijolo** (ativos físicos): segmento (Shopping, Logístico, Lajes Corporativas, Outros), patrimônio líquido do fundo, taxa de vacância.
  - **Papel** (recebíveis, tipo CRI/CRA): indexador da carteira (CDI, IPCA+, prefixado); taxa de vacância não se aplica.
  - Ambos os perfis exibem Dividend Yield e a relação cota/valor patrimonial (análoga ao P/VP das ações).

### 3.7 Salário Mensal Simulado

Único mecanismo de injeção externa de capital além do depósito inicial (3.5) — sem ele, todo crescimento de patrimônio dependeria exclusivamente da rentabilidade de investimento, o que não reflete a vida real (a maior parte da capacidade de investir de uma pessoa vem de renda de trabalho, não de retorno sobre capital já investido).

- **Valor:** cresce com o nível de gamificação (seção 6), em degraus sem teto — nível 1-10 soma R$100 por nível, nível 10-20 soma R$200 por nível, nível 20-30 soma R$300 por nível, e assim por diante (tier k = ⌈nível/10⌉, incremento por nível dentro do tier = R$100×k). Referência: nível 10 → R$1.000/mês, nível 20 → R$3.000/mês, nível 30 → R$6.000/mês. Decisão explícita do autor: aceitável que, para um usuário muito engajado por muito tempo, o salário eventualmente supere qualquer retorno de investimento razoável.
- **Cadência:** 5º dia útil de cada mês-calendário simulado (o dia simulado mapeia 1:1 para uma data real de calendário, seção 3.2.1 — não reaproveita o bloco de 30 dias fixos usado internamente pelo cálculo do IPCA).
- **Efeito no caixa, não na rentabilidade:** creditado como caixa livre (evento próprio de Event Sourcing, análogo ao depósito inicial de 3.5), nunca contabilizado como capital de risco. Isso exige que a rentabilidade percentual (RF17) passe a ser calculada apenas sobre capital que já foi de risco em algum momento — compras históricas, líquidas de vendas/resgates realizados e dividendos — nunca sobre caixa nunca investido (nem o salário, nem a parcela do depósito inicial que permaneça sem investir). Lucro já realizado numa venda e mantido em caixa continua contando: só o caixa que nunca foi de risco é excluído.
- **Sem novo ranking:** o salário não cria ranking por patrimônio absoluto — permanece intocada a garantia de RNF09 de que o valor absoluto nunca é exposto a outro usuário.
- **Visibilidade:** aparece na tela Calendário (seção 3.2.1) como fato do próprio usuário, com teatro de recompensa no momento em que o nível sobe (seção 6) e indicador do próximo pagamento na tela inicial.

Quebra completa em tarefas executáveis na Fase T de `backlog-motor-mercado-realista.md` (decisões fechadas com o autor em 2026-09-27).

---

## 4. Modelo de Dados — extensões ao DER do TCC

Além das entidades já modeladas (`users`, `accounts`, `positions`, `assets`, `fixed_income_assets`, `variable_income_assets`, `order_book`, `market_events`, `companies`, `company_fundamentals`, `achievements`, `user_achievements`):

| Nova entidade / campo | Onde | Motivo |
|---|---|---|
| `issuer_type` | `fixed_income_assets` | Distinguir Tesouro / Banco / Securitizadora |
| `tax_exempt` (bool) | `fixed_income_assets` | LCI/LCA/CRI/CRA isentos de IR vs CDB/Tesouro tributados |
| `credit_risk_rating` | `fixed_income_assets` | Ensinar risco de crédito do emissor (sem garantia FGC em CRI/CRA) |
| `dividend_events` (nova tabela) | Ligada a `variable_income_assets` | Valor por ação, data ex, data de pagamento |
| `lessons` (nova tabela) | — | Conteúdo da trilha: título, trilha/módulo, o que desbloqueia |
| `user_lesson_progress` (nova tabela) | Liga `users` e `lessons` | Progresso individual na trilha |
| `sandbox_assets` (nova tabela ou flag em `assets`) | — | Isolar ativos fictícios do sandbox dos ativos do mercado ao vivo |
| `macro_events` (nova tabela) | — | Título, narrativa, tipo de impacto (preço/fundamentos/ambos), magnitude, direção, início, duração, status (pendente/aplicado) — evento solicitado pela banca (ver 3.3) |
| `macro_event_targets` (nova tabela) | Liga `macro_events` a setor/classe de ativo/ativo específico, com métrica afetada (preço, `net_income`, `ebit`, `gross_debt`, `cash_equivalents`) | Permite eventos setoriais sem listar ativo por ativo, e diferencia efeito de preço vs efeito de fundamentos |
| `role` (novo campo) | `users` | Distinção admin vs usuário comum, necessária para o painel de criação de eventos macro |
| `report_frequency_days` / próxima data de relatório | `companies` | Define a cadência de divulgação de resultados trimestrais de cada empresa (3.3.1) |
| `net_revenue` (novo campo) | `company_fundamentals` | Receita líquida — necessária para calcular Margem EBIT e Margem Líquida (lição 2.5.2 do currículo, seção 5.1) |
| `username` (novo campo, único) | `users` | Identificador público para busca de amigos, sem expor e-mail (seção 8) |
| `friendships` (nova tabela) | Liga dois `users` (`requester_id`, `addressee_id`) | Relacionamento bilateral com aceite entre usuários, base do ranking por escopo Amigos e da busca de perfis (seção 8) |
| `etf_details` (nova tabela, estende `variable_income_assets`) | `benchmark_index`, `methodology_summary` | Índice replicado e metodologia — substituem indicadores fundamentalistas de empresa, que não se aplicam a ETFs (seção 3.6) |
| `etf_holdings` (nova tabela) | Liga `etf_details` a uma lista de constituintes sintéticos (`name`, `weight_pct`) | Composição simplificada da carteira teórica do ETF, exibida na tela de detalhe (seção 3.6) |
| `fii_details` (nova tabela, estende `variable_income_assets`) | `fii_type` (tijolo/papel), `segment`, `net_worth`, `vacancy_rate` (nulo se papel), `indexador` (nulo se tijolo) | Diferencia FII de tijolo e de papel, cada um com métricas próprias (seção 3.6) |
| `daily_missions` (nova tabela) | Catálogo de missões (título, critério de conclusão, recompensa em XP) | Base do sistema de missões diárias (seção 6) |
| `user_mission_progress` (nova tabela) | Liga `users` e `daily_missions`, com data e status de conclusão | Registra o progresso diário individual nas missões |
| `salary_payment` (novo tipo de evento) | `market_events` | Crédito mensal de caixa proporcional ao nível — nunca soma a capital de risco (3.7) |
| `total_disinvested` (novo campo) | `accounts` | Soma bruta de vendas/resgates realizados — junto com `total_invested`/`total_dividends_received` já existentes, sustenta o cálculo de rentabilidade sobre capital de risco (3.7, RF17) |

---

## 5. Progressão e Aprendizado

### 5.1 Currículo — lição a lição

Cada lição segue o mesmo padrão pedagógico (5.2: cenário → micro-decisão → revelação → desbloqueio), reaproveitando um único componente de UI entre produtos parecidos.

**Trilha 0: Fundamentos (obrigatória, 5 lições)**

| # | Lição | Conceito central | Desbloqueia |
|---|---|---|---|
| 0.1 | O que é investir | Investir vs poupar; capital trabalhando para você | Acesso ao Portfólio |
| 0.2 | Juros simples vs compostos | Crescimento linear vs exponencial (TCC cap. 2.1.1) | Calculadora Financeira |
| 0.3 | Inflação e poder de compra | Por que R$100 hoje ≠ R$100 amanhã | — |
| 0.4 | Rendimento nominal vs real | Descontar a inflação do retorno | — |
| 0.5 | Por que a poupança geralmente perde | Comparação direta poupança vs Selic/CDI | Acesso à Trilha 1 (Renda Fixa) |

**Trilha 1: Renda Fixa (11 lições)**

| # | Lição | Conceito central | Desbloqueia |
|---|---|---|---|
| 1.1 | O que é renda fixa | Emprestar dinheiro a um emissor | Tesouro Selic |
| 1.2 | Tesouro Selic | O "porto seguro", liquidez diária | Primeira operação real de Renda Fixa |
| 1.3 | Como a Selic é formada | Reunião do Copom reagindo ao desvio do IPCA frente à meta (tarefa M.5) | — |
| 1.4 | CDB e o CDI | Remuneração bancária, garantia FGC | CDB |
| 1.5 | Tributação regressiva de IR | Tabela regressiva, líquido vs bruto | — |
| 1.6 | LCI e LCA | Isenção de IR — comparação de retorno líquido | LCI/LCA |
| 1.7 | Tesouro Prefixado | Deságio, taxa travada na compra | Tesouro Prefixado |
| 1.8 | Marcação a mercado | Risco de vender antes do vencimento | — |
| 1.9 | O que é o IPCA | Índice de preços ao consumidor (IBGE), referência da meta de inflação (tarefa M.5) | — |
| 1.10 | Tesouro IPCA+ | Proteção contra inflação, VNA | Tesouro IPCA+ |
| 1.11 | CRI e CRA | Risco de crédito sem FGC, maior remuneração | CRI/CRA, acesso à Trilha 2 (Renda Variável) |

**Trilha 2: Renda Variável (15 lições)**

| # | Lição | Conceito central | Desbloqueia |
|---|---|---|---|
| 2.1 | O que é uma ação | Ser sócio de uma empresa | — |
| 2.2 | IPO | Como uma empresa vai à bolsa | — |
| 2.3 | Nomenclatura de tickers | Final 3 (ON), final 4 (PN), final 11 (units/FII) | Primeira operação real de ações |
| 2.4 | Lendo notícias de mercado | Como interpretar um evento macro (3.3) e decidir | Painel de notícias/feed de eventos — movido para cá, logo após a primeira operação real, para que o usuário já tenha contexto assim que puder ser afetado por um evento |
| 2.5 | Oferta e demanda | Formação de preço no livro de ofertas (TCC cap. 2.3.3) | — |
| 2.6.1 | Lendo um balanço | Peças básicas: Receita, EBIT, Lucro Líquido, Patrimônio Líquido, Dívida Bruta, Caixa | — |
| 2.6.2 | Margens de rentabilidade | O que é EBIT na prática, diferença para lucro líquido | Margem EBIT = EBIT / Receita Líquida · Margem Líquida = Lucro Líquido / Receita Líquida |
| 2.6.3 | Retorno sobre patrimônio (ROE) | Quão bem a empresa usa o capital dos sócios | ROE = Lucro Líquido / Patrimônio Líquido |
| 2.6.4 | Indicadores de preço (P/L e P/VP) | Ação "cara" ou "barata" frente ao que a empresa entrega | LPA = Lucro Líquido / Nº ações · P/L = Preço / LPA · VPA = Patrim. Líquido / Nº ações · P/VP = Preço / VPA |
| 2.6.5 | Endividamento | Risco de alavancagem | Dívida Líquida = Dívida Bruta − Caixa · Dívida Líquida/EBIT |
| 2.6.6 | Dividend Yield | Quanto a ação "paga" em relação ao preço | Dividend Yield = Dividendos (12m) / Preço atual — Painel de indicadores no mercado |
| 2.7 | Dividendos e data ex | Como e quando o acionista recebe | — |
| 2.8 | Setores e ciclicidade | Conecta com Selic afetando fundamentos (3.2.2) — defensivo vs cíclico | — |
| 2.9 | ETFs | Diversificação automática via índice | ETFs |
| 2.10 | FIIs | Fundos imobiliários, tickers final 11 | FIIs, acesso à Trilha 3 |

**Trilha 3: Estratégia e Tributação (transversal, 4 lições)**

| # | Lição | Conceito central | Desbloqueia |
|---|---|---|---|
| 3.1 | Diversificação | Por que não concentrar tudo num ativo | — |
| 3.2 | Perfil de risco | Conservador vs Sofisticado, risco x retorno | — |
| 3.3 | Comparando produtos na prática | Ex: CDB 110% CDI líquido vs LCI 90% CDI isento — qual rende mais? | — |
| 3.4 | Desafio final da trilha | Cenário combinando renda fixa + variável + um evento macro | Conclusão da trilha guiada, mundo aberto liberado por completo |

**Total: 43 lições** (6 + 12 + 18 + 5 + 2). **Revisão das trilhas (2026-10-03 a 2026-10-07, `backlog-revisao-trilhas-e-ux.md`):** as tabelas acima são o currículo original (35 lições, v0.5); a lista abaixo é a numeração vigente, com as lições novas (Juros, Selic, CDI e TR; Reserva de emergência; B3, corretora e ordens; Custos de investir; Imposto em renda variável; Cabeça de investidor; e a Trilha F paralela, sem desbloqueio de ativo, aberta em qualquer ordem) e a Trilha 3 reescrita como planejamento real (perfil conservador, moderado ou arrojado por questionário, sem "Sofisticado"). O conteúdo de cada lição passou a ser em `blocks` (cartões curtos, widgets interativos, bloco "Na plataforma" separando o mundo real do que a plataforma simplifica, fatos regulatórios com fonte primária em `regulatoryFacts.ts`).

**Trilha 0: Fundamentos**

- 0.1 O que é investir
- 0.2 Juros simples vs compostos
- 0.3 Inflação e poder de compra
- 0.4 Rendimento nominal vs real
- 0.5 Juros, Selic, CDI e TR
- 0.6 Poupança: quando ela perde e quando não

**Trilha 1: Renda Fixa**

- 1.1 O que é renda fixa
- 1.2 Tesouro Selic
- 1.3 Reserva de emergência: quanto e onde
- 1.4 Como a Selic é formada
- 1.5 CDB e o CDI
- 1.6 Tributação regressiva de IR
- 1.7 LCI e LCA
- 1.8 Tesouro Prefixado
- 1.9 Marcação a mercado
- 1.10 O que é o IPCA
- 1.11 Tesouro IPCA+
- 1.12 CRI e CRA

**Trilha 2: Renda Variável**

- 2.1 O que é uma ação
- 2.2 Nomenclatura de tickers
- 2.3 IPO
- 2.4 Como a ação é negociada: B3, corretora e ordens
- 2.5 Oferta e demanda
- 2.6 Lendo notícias de mercado
- 2.7.1 Lendo um balanço
- 2.7.2 Margens de rentabilidade
- 2.7.3 Endividamento
- 2.7.4 Retorno sobre patrimônio (ROE)
- 2.7.5 Indicadores de preço (P/L e P/VP)
- 2.7.6 Dividendos, JCP e data ex
- 2.7.7 Dividend Yield
- 2.8 Setores e ciclicidade
- 2.9 ETFs
- 2.10 FIIs
- 2.11 O que custa investir
- 2.12 Imposto em renda variável

**Trilha 3: Estratégia e Tributação**

- 3.1 Diversificação
- 3.2 Perfil de risco
- 3.3 Comparando produtos na prática
- 3.4 Cabeça de investidor
- 3.5 Desafio final da trilha

**Trilha F: Finanças do dia a dia (paralela)**

- F.1 Para onde vai seu dinheiro
- F.2 Dívida: os juros do outro lado

Todas reaproveitam o mesmo componente de UI (5.2).

**Fonte da verdade do conteúdo (N.23, decisão do autor de 2026-10-03):** o conteúdo das lições vive no **banco**, não em arquivo. O `seedLessons.ts` é só a importação inicial (insere o que falta, por `stable_key`, e nunca sobrescreve uma lição existente); a edição e a criação de lições são feitas no painel administrativo (`/admin/conteudo`), com histórico de revisões (`lesson_revisions`) e a regra de dispensa da N.24 pra lição criada no meio do currículo.

### 5.2 Padrão de lição ("aprender fazendo")

Toda lição segue o mesmo formato, reaproveitável entre produtos parecidos (CDB, LCI, LCA, CRI, CRA compartilham estrutura de tela e mecânica):

1. **Cenário/gatilho** — situação concreta simulada.
2. **Micro-decisão** — interação restrita ao conceito da lição (calculadora, comparação).
3. **Revelação** — resultado numérico real, usando as fórmulas do cap. 2 do TCC.
4. **Desbloqueio** — libera a operação real daquele produto no mercado ao vivo.

**Regras do player (revisão das trilhas, 2026-10):** (a) a lição é feita de `blocks` por fase (texto curto, widgets e perguntas `check`); (b) **errar não avança**: a pergunta da micro-decisão e as perguntas intermediárias só liberam a próxima fase ao acerto, com tentativas ilimitadas, XP fixo (nunca punição) e gabarito/explicação só depois do acerto; (c) lição concluída pode ser **revista** (sem alterar XP, streak nem progresso) e o aluno pode **voltar** de passo; (d) o conteúdo travado pela trilha usa um único `LockedGate`; (e) a progressão aceita lição **dispensada** (`waived_at`) e inserção de lição nova no meio da trilha sem quebrar quem já avançou; (f) nenhuma conta é feita fora da plataforma: o cálculo vem de um widget.

### 5.3 Trilha guiada + mundo aberto

A trilha não é o único caminho: assim que uma categoria é destravada, o usuário pode operar livremente nela mesmo sem terminar a trilha inteira. A trilha guia, não aprisiona.

### 5.4 Sustentação de longo prazo (sem fim)

- Mercado ao vivo, único e contínuo, sempre gera situação nova (não depende de conteúdo roteirizado).
- Eventos de mercado periódicos (Copom, balanços, IPCA) via ator Temporizador.
- Missões diárias/semanais e streaks.

---

## 6. Gamificação

- **Base teórica:** SDT (autonomia, competência, relacionamento) + Octalysis. O mercado financeiro puxa naturalmente para impulsos Black Hat (escassez, perda, imprevisibilidade) — o design compensa com mecânicas White Hat (conquistas, propriedade, propósito, criatividade).
- **Mecânicas:** XP/nível, conquistas (`achievements`), streak diário, ranking, sistema social de amigos (seção 8).
- **Ranking:** por rentabilidade percentual em **janela fixa** (semana/mês), sem reset de patrimônio, sem temporadas nesta versão — decisão tomada para não penalizar quem entra depois de quem já acumulou tempo de mercado. O ranking passa a ter dois escopos, Global e Amigos, ambos respeitando a mesma janela fixa.
- **Fundamentação do sistema social:** a adição de amigos reforça diretamente a necessidade de **Relacionamento** da SDT (TCC cap. 3.3.1) e o **Impulso 5 — Influência Social e Relacionamento** do Octalysis (TCC cap. 3.3.2), hoje pouco explorado no design — o produto concentra-se nos impulsos de Desenvolvimento/Realização (2) e Perda/Prevenção (8). Competir num círculo de pessoas conhecidas tende a gerar engajamento mais saudável (White Hat) do que competir apenas num ranking global anônimo, sem abrir mão da mecânica de ranking já especificada.

### 6.1 Missões Diárias

Catálogo simples de missões (`daily_missions`), renovado diariamente, recompensando XP por ações que reforçam hábitos de uso da plataforma — não apenas negociação, mas também aprendizado e consulta de contexto. Exemplos: "Complete uma lição da trilha", "Compare dois produtos de renda fixa na calculadora", "Consulte o feed de notícias". O progresso diário é registrado por usuário em `user_mission_progress`, e conclusão de todas as missões do dia mantém o streak (seção 6, já especificado) sem depender exclusivamente de uma operação financeira — evita que o usuário sinta que "precisa investir todo dia" só para manter o streak.

---

## 7. Requisitos (herdados e estendidos do TCC)

Os requisitos funcionais e não funcionais do capítulo 6.2 do TCC (RF01–RF10, RNF01–RNF05) seguem válidos como base. Os quadros abaixo formalizam as extensões definidas neste documento, no mesmo padrão do TCC original.

**Requisitos funcionais adicionais**

| Identificador | Nome | Descrição |
|---|---|---|
| RF11 | Trilha de Aprendizagem | O sistema deve apresentar lições sequenciais no padrão cenário → micro-decisão → revelação → desbloqueio, registrando o progresso individual do usuário. |
| RF12 | Ambiente de Sandbox | O sistema deve prover um ambiente de simulação individual e determinístico para a primeira experiência de cada conceito, usando ativos fictícios isolados do mercado ao vivo. |
| RF13 | Eventos Macro | O sistema deve permitir a criação e o disparo de eventos macroeconômicos que impactam setores ou ativos específicos, com efeito imediato de preço e/ou efeito futuro nos fundamentos da empresa. |
| RF14 | Painel Administrativo de Eventos | O sistema deve prover interface restrita a usuários com papel administrativo para criação, disparo manual e histórico de eventos macro. |
| RF15 | Relatórios Trimestrais Simulados | O sistema deve gerar periodicamente novos dados fundamentalistas para cada empresa cadastrada, combinando crescimento sintético, o fator sistêmico da Selic e efeitos pendentes de eventos macro. |
| RF16 | Feed de Notícias de Mercado | O sistema deve exibir ao usuário um registro dos eventos de mercado relevantes (macro, Copom, relatórios), explicando o contexto e o possível impacto. |
| RF17 | Ranking por Janela Fixa | O sistema deve calcular e exibir a classificação de usuários por rentabilidade percentual em uma janela de tempo fixa (ex: semanal/mensal), não cumulativa desde a criação da conta. A partir da introdução do salário mensal simulado (3.7), a rentabilidade considera apenas capital que já foi de risco em algum momento, nunca caixa nunca investido (RF23). |
| RF18 | Amizade entre Usuários | O sistema deve permitir buscar usuários por `username`, enviar solicitação de amizade e aceitar ou recusar solicitações recebidas. |
| RF19 | Ranking por Escopo Social | O sistema deve permitir alternar a exibição do ranking entre escopo Global e escopo Amigos, mantendo a mesma janela fixa (RF17) em ambos. |
| RF20 | Perfil Público de Usuário | O sistema deve exibir o perfil público de outro usuário mostrando rentabilidade percentual, nível e conquistas, nunca o valor absoluto de patrimônio. |
| RF21 | Indicadores por Classe de Ativo | O sistema deve exibir, na tela de detalhe de ativo, indicadores diferentes conforme a classe: fundamentalistas tradicionais para Ações, índice de referência e composição sintética para ETFs, e segmento/patrimônio/vacância (tijolo) ou indexador (papel) para FIIs, além de Dividend Yield para ambos os perfis de FII (seção 3.6). |
| RF22 | Missões Diárias | O sistema deve apresentar um conjunto de missões diárias renovadas a cada dia, registrar seu progresso e conclusão por usuário, e recompensar XP ao completá-las. |
| RF23 | Salário Mensal Simulado | O sistema deve creditar automaticamente, no 5º dia útil de cada mês-calendário simulado, um valor de caixa proporcional ao nível de gamificação do usuário — renda independente do desempenho de investimento, nunca contabilizada como capital de risco na rentabilidade percentual (RF17, seção 3.7). |

**Requisitos não funcionais adicionais**

| Identificador | Categoria | Descrição |
|---|---|---|
| RNF06 | Equidade de Partida | Toda nova conta deve iniciar com o mesmo saldo simulado padronizado, garantindo comparabilidade no ranking (seção 3.5). |
| RNF07 | Controle de Acesso por Papel | Rotas administrativas devem ser restritas ao papel `admin`, distinto do usuário comum, estendendo o RNF05 do TCC original. |
| RNF08 | Determinismo do Sandbox | O ambiente de sandbox deve garantir que usuários no mesmo estágio da trilha recebam experiências pedagogicamente equivalentes, independente do momento de ingresso na plataforma. |
| RNF09 | Proteção do Valor Absoluto de Patrimônio | O sistema não deve expor, em nenhuma tela ou API acessível a outro usuário (ranking, perfil público, busca), o valor absoluto de patrimônio — apenas rentabilidade percentual. Não há, nesta fase, controle de privacidade de perfil configurável pelo usuário (seção 8.2). |

---

## 8. Sistema Social (Amigos)

Extensão ao escopo original, adicionada para permitir que usuários "compitam" entre si num círculo conhecido, e não apenas contra estranhos no ranking global (seção 6).

### 8.1 Modelo de relacionamento

Amizade é **bilateral e requer aceite** (solicitação → aceite/recusa), não é "seguir" unilateral. Decisão tomada por dois motivos:

- Rentabilidade é dado sensível, e o produto já tem exigência formal de gestão de consentimento via LGPD (RNF04) — expor dado de alguém sem aceite mútuo seria inconsistente com esse requisito.
- Reforça o impulso de Relacionamento (SDT) de forma mais saudável do que um modelo de seguidores, que tende a puxar para mecânicas de vaidade/comparação unilateral.

Bloqueio de usuários (moderação básica) fica **fora do escopo desta fase** — decisão explícita, revisitar junto com critérios de abuso/spam quando o volume de usuários justificar.

### 8.2 Visibilidade de perfil

Nesta fase, **não há opção de perfil privado** — todo usuário é, por padrão, público: aparece em buscas de amigos e no ranking global, com rentabilidade percentual visível a qualquer usuário. Simplificação deliberada para não adicionar um passo de fricção (nem uma tela extra de configuração) antes de validar se a mecânica social engaja como esperado.

Independentemente disso, **o valor absoluto de patrimônio nunca é exposto a outros usuários** — apenas rentabilidade percentual, nível/XP e conquistas. Essa regra vale tanto no ranking quanto no perfil público, e é uma garantia do sistema, não uma opção do usuário.

Controle de privacidade de perfil (público/somente amigos/privado) fica registrado como candidato natural para Fase 2 (seção 9), quando fizer sentido revisitar junto com moderação (8.1).

### 8.3 Ranking com escopo social

O ranking (RF17) passa a ter um seletor de escopo:

- **Global** — todos os usuários (perfil sempre público nesta fase), comportamento já especificado na seção 6.
- **Amigos** — apenas usuários com amizade confirmada (`friendships.status = accepted`) com o usuário logado.

Ambos os escopos aplicam a mesma janela fixa (semana/mês) já definida na seção 6 — não há dois critérios de tempo diferentes.

### 8.4 Fluxo de amizade

1. Usuário busca outro por `username` (todos os usuários são buscáveis nesta fase, seção 8.2).
2. Envia solicitação → `friendships` criada com `status = pending`.
3. Destinatário aceita ou recusa. Aceite → `status = accepted`; recusa → registro removido (sem notificação adicional ao solicitante).
4. Amizade confirmada passa a valer para o escopo Amigos do ranking (8.3).

---

## 9. Corte de MVP vs. Segunda Fase

Dado o prazo de ~2 meses com Claude Code e a preferência por não reduzir o escopo pedagógico, o corte é cirúrgico: mantém tudo já especificado neste documento, isolando apenas o que já vinha sendo tratado como adiável ao longo da discussão.

**Dentro do MVP:**
- Arquitetura completa (frontend, backend, motor Go, PostgreSQL, Redis, Event Sourcing append-only).
- Renda Fixa completa (Selic, Prefixado, IPCA+, CDB, LCI/LCA, CRI/CRA, marcação a mercado).
- Renda Variável completa (GBM por `risk_class`, order book, dividendos, indicadores fundamentalistas, ETFs, FIIs).
- Selic como fator sistêmico nos fundamentos (3.2.2); ciclo de relatórios quinzenal (3.3.1); Copom a cada 21 dias (3.2.1).
- Eventos macro completos: motor, regras de defasagem preço↔fundamentos, catálogo inicial de 10 templates, painel administrativo (3.3).
- Capital inicial padronizado (3.5) e ranking por janela fixa (seção 6).
- Sandbox reaproveitando as tabelas reais com ativos isolados (3.1).
- As 43 lições do currículo completo (5.1).
- Sistema social completo: amizade bilateral com aceite, busca por `username`, visibilidade de perfil, ranking com escopo Global/Amigos (seção 8, RF18–RF20, RNF09).
- Missões diárias formalizadas (`daily_missions`/`user_mission_progress`, seção 6.1, RF22).
- Indicadores diferenciados por classe de ativo — Ações/ETFs/FIIs tijolo e papel (seção 3.6, RF21).

**Fase 2 (fora do MVP):**
- CQRS com read models totalmente separados (fica só o log append-only na v1 — 3.4).
- Painel administrativo além de eventos macro — cadastro de empresas/ativos, gestão de usuários seguem via seed/script (3.3.3).
- Temporadas de ranking com reset (seção 2, fora do escopo por enquanto).
- Bloqueio de usuários / moderação (seção 8.1, fora do escopo por enquanto).

## 10. Roadmap — 8 semanas

| Semana | Foco | Entregas |
|---|---|---|
| 1 | Fundação | Scaffolding dos serviços, Docker Compose (Postgres, Redis), migrations do DER completo, autenticação com papel `admin`/usuário (RNF07), regra de capital inicial padronizado (RNF06) |
| 2 | Motor — Renda Fixa | Event Sourcing (log append-only), Selic simulada, Tesouro Prefixado (deságio), marcação a mercado, testes unitários das fórmulas (alinhado ao cap. 7.2.4 do TCC) |
| 3 | Motor — Renda Variável e Fundamentos | GBM por `risk_class`, order book, curva de juros (Vasicek) + Copom (21 dias), IPCA sintético (VNA), geração de fundamentos com fator Selic (3.2.2), ciclo de relatórios (14 dias, RF15), especialização de ETFs (`etf_details`/`etf_holdings`) e FIIs tijolo/papel (`fii_details`, seção 3.6) |
| 4 | Eventos Macro | Tabelas `macro_events`/`macro_event_targets`, regras de defasagem preço↔fundamentos, seed do catálogo (3.3.2), painel admin de disparo e histórico (RF13, RF14) |
| 5 | Backend Gamificado | XP/nível, conquistas, streak, missões diárias (`daily_missions`/`user_mission_progress`, RF22), ranking em janela fixa (RF17), `lessons`/`user_lesson_progress` (RF11), cache Redis (cotações/rankings), sistema de amizade — busca, solicitação, aceite (RF18) e ranking com escopo Global/Amigos (RF19) |
| 6 | Frontend | Telas já wireframadas (autenticação, portfólio, mercado, calculadora, classificação) + componente genérico de lição (5.2) + feed de notícias/eventos (RF16, já sequenciado cedo na trilha — lição 2.4) + distinção visual sandbox vs. mercado ao vivo + telas de Amigos e Perfil Público (RF20) + indicadores diferenciados por classe de ativo em Ações/ETFs/FIIs (RF21) |
| 7 | Conteúdo e Integração | Autoria das 33 lições, seed de empresas/ativos/setores (lista fixa de setores — 3.3.2), testes ponta a ponta (compra/venda, resgate, evento macro → preço → relatório) |
| 8 | Polimento | Calibração fina dos parâmetros (GBM/Vasicek/Selic neutra), ajustes de UX, preparação da demonstração para a banca, alinhamento com a monografia |

---

## 11. Decisões em aberto

- [ ] Se/quando revisitar temporadas de ranking (fora do escopo do MVP, avaliar em versão futura — seção 9).
- [ ] Se/quando revisitar bloqueio de usuários / moderação (fora do escopo do MVP — seção 8.1 e 9).
- [ ] Se/quando introduzir controle de privacidade de perfil configurável (`somente_amigos`/`privado`) — nesta fase todo perfil é público por decisão explícita (seção 8.2), candidato natural de Fase 2.

---

## Changelog

- **v0.1** — Consolidação inicial a partir da discussão de estruturação do projeto, a partir da base do TCC (Alexandre Beilner, UNO, 2026).
- **v0.2** — Detalhamento completo: motor de mercado (GBM, Vasicek, calendário 14/21 dias), eventos macro (catálogo, defasagem, painel admin), currículo de 33 lições, requisitos formais RF11–RF17/RNF06–RNF08, corte de MVP e roadmap de 8 semanas. Único ponto em aberto remanescente: temporadas de ranking, deixado para versão futura.
- **v0.3** — Adição do sistema social (seção 8): amizade bilateral com aceite, visibilidade de perfil, ranking com escopo Global/Amigos, requisitos formais RF18–RF20/RNF09. Incluído no MVP (seção 9) e distribuído nas semanas 5–6 do roadmap (seção 10). Bloqueio de usuários deferido para Fase 2.
- **v0.4** — Simplificação da visibilidade de perfil (8.2): removida a opção de perfil privado/somente-amigos nesta fase — todo perfil é público por decisão explícita, sem campo `profile_visibility` no modelo de dados. Mantida a garantia de que o valor absoluto de patrimônio nunca é exposto (RNF09 revisado). Controle de privacidade configurável passa a candidato de Fase 2.
- **v0.5** — Formalização de dois pontos que estavam pendentes: (1) missões diárias como extensão completa no MVP, com `daily_missions`/`user_mission_progress` e RF22 (seção 6.1); (2) indicadores por classe de ativo (seção 3.6, RF21) — Ações mantêm os indicadores fundamentalistas tradicionais; ETFs passam a exibir índice de referência, metodologia e composição sintética (`etf_details`/`etf_holdings`) em vez de indicadores de empresa; FIIs se dividem em tijolo (segmento, patrimônio, vacância) e papel (indexador), ambos com Dividend Yield e relação cota/valor patrimonial (`fii_details`). Ambos os pontos refletidos no corte de MVP e no roadmap (semanas 3, 5 e 6).
- **v0.6** — Adição do salário mensal simulado (3.7, RF23): renda recorrente independente de investimento, crescendo em degraus sem teto com o nível de gamificação, paga no 5º dia útil do mês-calendário simulado — único mecanismo de injeção externa de capital além do depósito inicial (3.5). Exige recalcular a rentabilidade percentual (RF17, revisado) sobre capital de risco apenas (compras históricas líquidas de vendas/resgates/dividendos), excluindo caixa nunca investido, mas preservando lucro já realizado e guardado em caixa. Sem ranking por patrimônio absoluto — RNF09 mantido intocado. Novo tipo de evento `salary_payment` e campo `accounts.total_disinvested` (seção 4). Decisões fechadas com o autor em 2026-09-27, quebradas em 11 tarefas executáveis na Fase T de `backlog-motor-mercado-realista.md`.
- **v0.7** — Revisão das trilhas e da UX (2026-10-03 a 2026-10-07, `backlog-revisao-trilhas-e-ux.md`, decisões D1 a D13): currículo de 35 para 43 lições (5.1), conteúdo em `blocks` com widgets e bloco "Na plataforma", fatos regulatórios versionados, regras do player (5.2), calendário com relevância "Para você" e escalonamento de proventos por ativo (políticas de dividendo, balanço por empresa, FIIs no mês real), donut do Portfólio interativo em R$ e a separação do Sandbox em faixa compacta que só aparece com posição (3.1).
