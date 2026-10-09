# Mapa de cobertura do currículo (RC.4.0)

Entregável da tarefa RC.4.0 de `.claude/backlog-revisao-trilhas-e-ux.md`. Data da pesquisa: **2026-10-03**.
Lições novas aqui seguem os Princípios do backlog: leves (cartões de até ~280 caracteres, uma ideia por cartão,
widget antes de segundo parágrafo), Brasil real, "Na plataforma" quando a plataforma difere, nada de dev visível,
fato regulatório com fonte e data (RC.1.3), validação RC.1.7. **Isto é proposta**: o autor decide quais entram.

## 0. Método, fontes e limites da pesquisa

- Currículo atual lido em `backend/src/db/seedLessons.ts` (35 lições: Trilha 0 = 0.1-0.5; Trilha 1 = 1.1-1.11;
  Trilha 2 = 2.1-2.5, 2.6.1-2.6.6, 2.7-2.10; Trilha 3 = 3.1-3.4) e nos anexos `audit-licoes-*.md`. Lições já
  previstas pelo backlog: **RC.4.1 "Juros, Selic, CDI e TR"** (antes da 0.5) e **RC.4.2 "B3, corretora e ordens"**
  (antes da 2.5; hoje já inclui custos e isenção de R$ 20 mil de forma resumida).
- Programas de referência usados para decidir o que um iniciante brasileiro precisa: ENEF (Estratégia Nacional de
  Educação Financeira: consumo consciente, uso consciente do crédito, gestão de finanças pessoais, investimentos,
  previdência e seguros), Caderno de Educação Financeira do Banco Central, Portal do Investidor (CVM), B3 Bora
  Investir/Educação, Anbima (Como Investir; programa da CPA-20), Tesouro Direto.
- **Limite de verificação:** as páginas do Tesouro Direto (403) e uma da Receita (404) não abriram no fetch; vários
  fatos vieram de resumos de busca restritos a domínios oficiais. Por isso cada fato abaixo está marcado
  **[ok]** (confirmado por resumo de página oficial) ou **[reconferir]** (abrir a página e gravar em RC.1.3 antes
  de escrever texto). Notícia/blog nunca é fonte registrada.
- Achado de coerência interno: as lições 1.1 e 1.2 prometem "montar uma reserva de emergência de verdade ao longo
  desta trilha", mas nenhuma lição ensina quanto guardar, onde e por quê. É uma promessa não cumprida e a principal
  razão da prioridade alta da lição de reserva.

## 1. Tabela tema x status x gancho de funcionalidade futura

Status: **Coberto** (lição dedicada), **Raso** (aparece de passagem ou será coberto só em parte), **Ausente**.
"Gancho" é só ideia, não entra no backlog.

| # | Tema | Status | Lições existentes / previstas | Lição nova | Gancho de funcionalidade futura no app |
|---|---|---|---|---|---|
| 1 | Orçamento pessoal (receita, gasto, 50/30/20) | Ausente | nenhuma | N1 | Calculadora de orçamento que define o "aporte mensal" usado no simulador e no salário mensal do jogo |
| 2 | Reserva de emergência | **Raso** | só citada em 1.1, 1.2, 2.1 (promessa não cumprida) | N4 | Meta "Reserva completa" na Carteira: barra de progresso = patrimônio em liquidez diária / custo mensal x meses |
| 3 | Juros, Selic, CDI, TR | Raso → previsto | 0.5, 1.2, 1.3, 1.4; RC.4.1 | (RC.4.1) | Painel "taxas de hoje" com Selic/CDI/IPCA simulados |
| 4 | Crédito e dívida (cartão, cheque especial, consignado, renegociação) | Ausente | 0.2 só mostra juros compostos a favor | N2 | Simulador "quitar dívida x investir" e quiz de renegociação |
| 5 | Golpes e fraudes financeiras | Ausente | nenhuma | N3 | Alerta educativo no checkout/ordem e no feed ("promessa de retorno garantido") + checklist "essa oferta é legítima?" |
| 6 | Poupança | Coberto (a corrigir) | 0.5 (RC.5.2) | - | - |
| 7 | Tesouro Direto (Selic, Pré, IPCA+) | Coberto | 1.2, 1.7, 1.8, 1.10 | - | - |
| 8 | Tesouro RendA+ e Educa+ | Ausente | nenhuma | N9 | Simulador de renda mensal futura ligado ao plano de aposentadoria/estudo dos filhos |
| 9 | CDB, LCI/LCA, FGC, IR regressivo | Coberto (a aprofundar) | 1.4, 1.5, 1.6 (RC.5.5) | - | Comparador líquido de produtos (já previsto em RC.3.4a) |
| 10 | CRI/CRA | Coberto | 1.11 | - | - |
| 11 | Debêntures | Ausente | citada de relance em 1.11 (emissores) | N8 | Filtro "isento de IR" no catálogo de renda fixa (se houver crédito privado no futuro) |
| 12 | COE | Ausente | nenhuma | N18 (baixa) | Cartão de alerta "produto que o banco oferece" no módulo de golpes/produtos |
| 13 | Fundos de investimento (tipos, taxa de administração/gestão/performance, come-cotas) | Ausente (ETF e FII existem) | 2.9, 2.10 só | N7 | Catálogo de fundos sintéticos com taxa visível e simulação de come-cotas em maio/novembro |
| 14 | Previdência privada PGBL/VGBL | Ausente | nenhuma | N10 | Simulador PGBL x VGBL (dedução de 12%, tabela regressiva x progressiva) |
| 15 | Planejamento de aposentadoria / INSS | Ausente | 3.x fala de planejamento genérico | N12 | Calculadora "quanto preciso para renda X por mês" que alimenta metas na Carteira |
| 16 | FGTS | Ausente | nenhuma | N11 | Calculadora "FGTS x poupança x Tesouro Selic" |
| 17 | Mercado secundário, B3, corretora, ordens, lote/fracionário | Ausente → previsto | RC.4.2 | (RC.4.2) | - |
| 18 | Imposto sobre ações (isenção R$ 20 mil, swing x day trade, DARF, declaração) | **Raso** | RC.4.2 só toca a isenção | N5 | Apurador mensal de imposto sobre as vendas do usuário no jogo + "informe de rendimentos" simulado |
| 19 | Custos (corretagem, custódia, taxa de administração, spread) | **Raso** | RC.4.2 parcial; 1.x custódia | N6 | "Raio-X de custos" da Carteira: quanto o usuário pagou de taxas no período |
| 20 | Análise fundamentalista | Coberto | 2.6.1-2.6.6 | - | - |
| 21 | Análise técnica básica (candle, tendência, suporte/resistência) | Ausente | nenhuma | N13 | Anotações no gráfico de preço do ativo (linha de suporte/resistência desenhável) |
| 22 | Dividendos, JCP, data com/ex | Coberto (a corrigir) | 2.6.6, 2.7 (RC.5.11) | - | Calendário "o que me afeta" (RC.6.*) |
| 23 | ETFs / FIIs / setores | Coberto | 2.8, 2.9, 2.10 | - | - |
| 24 | Diversificação, risco x retorno | Coberto | 3.1 | - | - |
| 25 | Perfil de investidor / suitability | Coberto (a reescrever) | 3.2 (RC.5.8) | - | Questionário real de perfil que recomenda alocação-modelo |
| 26 | Vieses comportamentais (manada, perda, excesso de confiança) | Ausente | nenhuma | N14 | Alerta de comportamento: "você vendeu no pânico X vezes" no Extrato/Perfil |
| 27 | Câmbio e dólar | Ausente | nenhuma | N15 (baixa) | Ativo "dólar" e ETF cambial no catálogo (hoje não existe) |
| 28 | Ouro | Ausente | nenhuma | N16 (baixa, adiar) | - |
| 29 | Criptoativos (risco, regulação, golpes) | Ausente | nenhuma | N17 (baixa; cartões dentro de N3) | - |
| 30 | Open Finance | Ausente | nenhuma | N19 (baixa) | Importar carteira real em modo leitura (muito futuro; exige parceiro) |
| 31 | Investimento sustentável (ESG/ASG, títulos verdes) | Ausente | nenhuma | N20 (baixa) | Selo "IS" em fundos/ETFs sintéticos |
| 32 | Seguros e proteção (vida, residencial, auto) | Ausente | nenhuma | N21 (baixa) | Item "proteção" no checklist de planejamento |
| 33 | Índices (Ibovespa, IFIX, CDI como benchmark) | Raso | 2.9 (ETFs de índice) | cartão em N7/N13 | Linha de benchmark no gráfico da Carteira |
| 34 | Day trade e derivativos | Ausente | nenhuma | cartão em N5; derivativos cortar | - |

## 2. Lições novas propostas

Convenções: **Pré-req** = lições existentes (ou previstas); **Posição** = onde entra na trilha; cartões ≤ 280
caracteres; "Widget" = entradas e saídas; esforço P (1 sessão, sem widget novo), M (1 sessão, 1 widget novo), G (2
sessões ou widget complexo). Fato **[ok]** ou **[reconferir]**; data de acesso 2026-10-03.

Ordem de leitura dos blocos: prioridade alta (N1-N6), média (N7-N14), baixa (N15-N21).

---

### N1 · "Para onde vai seu dinheiro" (orçamento) — prioridade ALTA

- **Objetivo:** o aluno monta um orçamento mensal e descobre quanto sobra para investir.
- **Pré-req:** 0.1. **Posição:** Trilha 0, logo depois da 0.1 (ou primeira de uma trilha paralela de finanças
  pessoais; ver seção 5). Não bloqueia nada.
- **Cartões-chave:** (1) Investir começa na sobra: renda menos gastos = o que dá para aplicar. (2) Gastos fixos,
  variáveis e eventuais: o que cada um é, com exemplo (aluguel, mercado, IPVA). (3) Regra de bolso 50/30/20 como
  ponto de partida, não lei. (4) "Pague-se primeiro": separar o aporte no dia do salário. (5) Pergunta: quanto
  sobra com este perfil de renda e gasto?
- **Widget `budget-split`:** entradas = renda líquida mensal + 6 sliders de categoria (moradia, alimentação,
  transporte, lazer, dívidas, outros); saídas = barra empilhada, sobra em R$ e %, alerta se gasto > renda e
  comparação com 50/30/20. Resumo textual para leitor de tela.
- **Esforço:** M.
- **Fatos regulatórios:** nenhum número legal. Conceito ancorado no Caderno de Educação Financeira do Banco Central
  (gestão de finanças pessoais): https://www.bcb.gov.br/pre/pef/port/caderno_cidadania_financeira.pdf [ok;
  conferir se a 50/30/20 aparece ali, senão rotular "regra de bolso popular", não oficial]. Acesso 2026-10-03.
- **Prioridade alta:** é pré-requisito prático de tudo (sem sobra não há aporte) e o tema nº 1 da ENEF
  ("gestão de finanças pessoais"). Baixo custo.

### N2 · "Dívida: os juros do outro lado" (cartão, cheque especial, consignado, renegociação) — ALTA

- **Objetivo:** o aluno entende por que juros de cartão e cheque especial destroem patrimônio e como sair.
- **Pré-req:** 0.2 (juros compostos), RC.4.1 (taxa a.m. x a.a.). **Posição:** Trilha 0, após RC.4.1.
- **Cartões-chave:** (1) Os mesmos juros compostos da 0.2, agora contra você. (2) Rotativo do cartão: dívida
  paga só o mínimo cresce rápido; a lei limita os juros e encargos ao valor original da dívida (nunca passa de 100%).
  (3) Cheque especial e crédito pessoal: caros; consignado: mais barato porque desconta em folha (menos risco para o
  banco). (4) Regra: dívida cara primeiro, investimento depois (comparar taxa da dívida com o que rende o Tesouro
  Selic). (5) Renegociar: onde (Desenrola, bancos, Procon), o que pedir (taxa menor, prazo, desconto à vista).
- **Widgets:** `debt-snowball` (entradas: saldo, taxa a.m., pagamento mensal; saídas: meses para quitar, total de
  juros, gráfico saldo x tempo; destaca o efeito de pagar só o mínimo) e `pay-or-invest` (taxa da dívida x taxa
  líquida do investimento; veredito).
- **Esforço:** M.
- **Fatos regulatórios:**
  - Lei 14.690/2023: rotativo e parcelamento do saldo da fatura, juros e encargos totais não excedem o valor original
    da dívida. https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14690.htm [ok].
  - Teto de juros do consignado INSS (1,80% a.m. em jan/2025; muda por decisão do conselho): https://www.gov.br/previdencia/pt-br/noticias/2025/janeiro/taxa-maxima-de-juros-do-consignado-sobe-para-1-80-ao-mes
    [reconferir valor vigente; usar como exemplo datado, não como fato permanente].
  - Renegociação/Desenrola: https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/renegociacao-de-dividas
    [reconferir se o programa está ativo hoje].
  - Taxas médias reais por modalidade: estatísticas do Banco Central (https://www.bcb.gov.br/estatisticas/reporttxjuros)
    [reconferir URL e valor do dia].
- **Prioridade alta:** o maior erro financeiro do brasileiro médio e o contraste mais forte com o resto do
  currículo (a 0.2 hoje só mostra juros a favor). Alto valor, widget simples.

### N3 · "Golpes financeiros: como não cair" — ALTA

- **Objetivo:** o aluno reconhece sinais de golpe e sabe checar se quem oferece investimento é autorizado.
- **Pré-req:** 1.1 (o que é renda fixa; saber o que é retorno realista). **Posição:** Trilha 0 (fim) ou Trilha 1
  início. Sem bloqueio. Pode virar pílula reutilizável (aparece também antes de abrir conta com corretora no mundo
  real, no fim da trilha 3).
- **Cartões-chave:** (1) Sinal nº 1: retorno alto + garantido + sem risco não existe. (2) Pirâmide/Ponzi: quem paga
  o rendimento é o dinheiro de novos entrantes. (3) Golpe do perfil falso de influenciador, grupo de "sinais" e falsa
  corretora (a CVM testou: quase metade cairia). (4) Checar: a empresa está autorizada pela CVM/Banco Central? (lista
  de autorizados e de alertas). (5) Pix de golpe: acione o banco rápido, existe o Mecanismo Especial de Devolução
  (não vale para desacordo comercial nem Pix digitado errado). (6, opcional) Cripto: promessa de ganho garantido é o
  alerta máximo (absorve o tema cripto aqui).
- **Widgets:** `scam-or-legit` (6 a 8 ofertas fictícias em cartões; o aluno marca "golpe" ou "legítima" e vê o
  sinal denunciador; contagem de acertos de primeira) e `return-reality-check` (rendimento prometido x Selic/CDI:
  "isso é X vezes o CDI", barra de plausibilidade).
- **Esforço:** M.
- **Fatos regulatórios:**
  - Teste da CVM sobre falsa corretora: https://www.gov.br/investidor/pt-br/em-um-teste-da-cvm-quase-metade-dos-participantes-cairia-em-golpe-de-investimentos-sera-que-voce-tambem [ok]; notícia CVM
    https://www.gov.br/cvm/pt-br/assuntos/noticias/2024/quase-metade-das-pessoas-que-acessaram-site-de-falsa-corretora-cairia-em-golpe-financeiro [ok].
  - Lista de ofertas/atuações irregulares da CVM: https://www.gov.br/cvm/pt-br/assuntos/protecao/alertas/ofertas-atuacoes-irregulares [ok].
  - MED do Pix (Banco Central): https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Guia_MED.pdf [ok; prazo
    de devolução em dias e valor-limite conferir no guia vigente].
  - Alerta CVM sobre criptoativos: https://www.gov.br/investidor/pt-br/educacional/publicacoes-educacionais/alertas/alerta_cvm_criptoativos_10052018.pdf [ok, documento de 2018; reconferir se há versão atual].
- **Prioridade alta:** risco real e crescente para o público-alvo; baixo custo de conteúdo; alto engajamento
  (jogo de identificar golpes). Dá um uso natural ao tema cripto sem uma lição inteira.

### N4 · "Reserva de emergência: quanto e onde" — ALTA

- **Objetivo:** o aluno calcula a própria reserva e escolhe onde guardá-la (liquidez diária, baixo risco).
- **Pré-req:** 1.2 (Tesouro Selic), 0.5 (poupança) e, idealmente, N1. **Posição:** Trilha 1, logo depois da 1.2
  (cumpre a promessa das lições 1.1/1.2). Alternativa: depois da 1.6, quando o aluno já comparou CDB com liquidez
  diária.
- **Cartões-chave:** (1) Reserva é o seguro contra imprevisto, não investimento para ganhar. (2) Quanto: meses de
  custo de vida (CLT: 3 a 6; autônomo/renda variável: 6 a 12), sobre o gasto, não sobre o salário. (3) Onde:
  liquidez diária, baixo risco, não perde valor de um dia para o outro (Tesouro Selic, CDB de liquidez diária; não
  ação). (4) O erro comum: reserva em produto com carência ou marcação a mercado negativa. (5) Ao usar, reponha.
- **Widgets:** `emergency-fund-calculator` (entradas: custo mensal, tipo de renda, dependentes; saídas: meta em R$,
  meses para atingir no aporte escolhido, comparação de onde guardar: poupança x Tesouro Selic x CDB líquido, ver
  saldo após 12 meses) e `where-to-keep` (cartões de produto: arrastar para "serve" ou "não serve" para reserva, com
  motivo).
- **Esforço:** M.
- **Fatos regulatórios:** recomendação de 3 a 6 meses (e mais para autônomo) aparece em materiais de educação
  financeira; conferir a formulação exata no Caderno de Educação Financeira do Banco Central
  (https://www.bcb.gov.br/pre/pef/port/caderno_cidadania_financeira.pdf) e em https://www.bcb.gov.br/cidadaniafinanceira
  [reconferir: a busca devolveu a faixa 3-6 e 6-12 via fontes secundárias; gravar em RC.1.3 só com texto oficial,
  ou rotular "regra de bolso"]. Tesouro Reserva (produto novo para reserva) citado nas dúvidas frequentes
  (https://www.tesourodireto.com.br/en/como-investir/duvidas-frequentes) [reconferir existência e regras antes de
  mencionar]. Acesso 2026-10-03.
- **Prioridade alta:** promessa já feita ao aluno e nunca cumprida; é o primeiro objetivo financeiro real de
  qualquer pessoa. Gancho de funcionalidade forte.

### N5 · "Imposto em renda variável" (ações, FIIs, ETFs, day trade, declaração) — ALTA

- **Objetivo:** o aluno sabe quando paga imposto sobre ações/FIIs/ETFs, quanto, e como declarar.
- **Pré-req:** RC.4.2 (ordens), 2.6.6/2.7 (dividendos), 2.9, 2.10 (ETF, FII). **Posição:** Trilha 2, após 2.10 (fim
  da trilha, antes de Trilha 3). RC.4.2 só planta a ideia da isenção; esta lição aprofunda.
- **Cartões-chave:** (1) Swing trade (venda em outro dia): 15% sobre o lucro. Day trade (compra e venda no mesmo
  dia): 20%, sem isenção. (2) Isenção só para ações no mercado à vista: vendas totais até R$ 20 mil no mês (conta
  o valor vendido, não o lucro). Não vale para ETF nem FII. (3) Passou de R$ 20 mil: paga 15% sobre o lucro do mês
  via DARF até o último dia útil do mês seguinte; dá para compensar prejuízo. (4) "Dedo-duro": retenção mínima
  (0,005%; day trade 1%) que a corretora faz. (5) Mesmo isento, declara no IR (bens e direitos + rendimentos
  isentos). (6) Dividendos de ações: hoje isentos para a maioria; nova regra de 2026 retém 10% acima de R$ 50 mil
  por mês por fonte pagadora.
- **Widgets:** `equity-tax-calculator` (entradas: vendas do mês, lucro, tipo day/swing, prejuízo acumulado;
  saídas: imposto devido, se está isento, DARF, vencimento) e `tax-decision-tree` (3 perguntas -> resultado).
- **Esforço:** M.
- **Fatos regulatórios:**
  - Isenção R$ 20 mil/mês só para ações (e ouro ativo financeiro), 15% swing, 20% day trade, dedo-duro 0,005% e
    1%: B3 Bora Investir https://borainvestir.b3.com.br/noticias/imposto-de-renda/renda-variavel-imposto-de-renda/comprou-ou-vendeu-acoes-veja-como-declarar-swing-trade-day-trade-e-proventos-no-imposto-de-renda/
    [ok]; Receita Federal, isenções https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1/isencoes
    [ok].
  - **MP 1.303/2025 caducou** (previa 17,5% e limite de R$ 60 mil/trimestre) e as regras seguem as de antes em
    2026: fonte para checar o desfecho no Congresso/Planalto; resumo veio de imprensa [reconferir em fonte primária
    (Câmara dos Deputados / Diário Oficial) antes de gravar; documento da Câmara
    https://www2.camara.leg.br/orcamento-da-uniao/estudos/2025/mp-1303-2025-nota-tecnica-no-18-2025-cd-volpe].
  - Lei 15.270/2025 (10% de IRRF sobre dividendos acima de R$ 50 mil/mês por fonte pagadora, a partir de 2026):
    conferir texto em planalto.gov.br e orientação da Receita [reconferir; já listado em RC.1.3].
  - Day trade (risco e regras): Caderno CVM nº 15 https://www.gov.br/investidor/pt-br/educacional/publicacoes-educacionais/cadernos/caderno-cvm-15-day_trade.pdf/@@display-file/file [ok].
- **Prioridade alta:** o tema mais perguntado por quem começa em ações; fatos mudam e já houve ruído (MP), então
  precisa do módulo RC.1.3. Dá gancho direto no jogo (usuário vende e o sistema apura).

### N6 · "O que custa investir" (corretagem, custódia, taxa de administração, spread) — ALTA/MÉDIA

- **Objetivo:** o aluno enxerga como taxas pequenas viram uma diferença grande no longo prazo.
- **Pré-req:** 0.2, RC.4.2, 2.9. **Posição:** Trilha 2, depois de RC.4.2 e 2.9 (ETF mostra taxa de administração).
- **Cartões-chave:** (1) Todo investimento tem custo: corretagem, custódia, taxa de administração (fundos/ETFs),
  spread. (2) Taxa de 2% a.a. parece pequena, mas no longo prazo come uma fatia grande do ganho. (3) Corretagem
  zero é comum em ações, mas não é o único custo. (4) Fundos: taxa de administração, de gestão e de performance
  (só se bater o benchmark) são coisas diferentes. (5) Pergunta: qual produto vence depois de 20 anos?
- **Widget `fee-drag`:** entradas = aporte inicial, aporte mensal, retorno bruto, taxa a.a. A e B, prazo; saídas =
  duas curvas e a diferença final em R$ e %. Reaproveita o `compound-growth`.
- **Esforço:** P/M (reaproveita widget).
- **Fatos regulatórios:** definições de taxa de administração, gestão e performance:
  https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos/fundos-de-investimentos [ok]; custódia do
  Tesouro Direto (taxa B3, isenções) em https://www.tesourodireto.com.br/en/como-investir/duvidas-frequentes e
  corretagem/custódia em ações em B3 Bora Investir [reconferir valores vigentes; já listados em RC.1.3 como "custódia
  B3 0,20%"]. Acesso 2026-10-03.
- **Prioridade alta/média:** visual muito forte (curvas divergindo) com pouca escrita; reduz risco de a lição de
  fundos (N7) ficar pesada. Pode fundir-se com N7 se o autor preferir menos lições.

### N7 · "Fundos de investimento: cotas, taxas e come-cotas" — MÉDIA

- **Objetivo:** o aluno entende o que é um fundo, quem o gere, quanto custa e quando o IR é antecipado.
- **Pré-req:** 1.5 (IR regressivo), 2.9 (ETF), N6. **Posição:** Trilha 2, depois da 2.9 (ETF) ou na Trilha 3 antes
  da 3.3.
- **Cartões-chave:** (1) Fundo = condomínio de investidores com um gestor; você compra cotas. (2) Classes: renda
  fixa, ações, multimercado, cambial. (3) Cota sobe e desce com a carteira; o regulamento diz o que pode comprar.
  (4) Come-cotas: em maio e novembro o IR (15% ou 20% conforme o tipo de fundo) é "comido" em cotas, e não do saldo
  em dinheiro. Fundo de ações, FII e ETF de renda variável não têm come-cotas. (5) FGC não cobre fundo.
- **Widget `fund-cota-simulator`:** entradas = aporte, rentabilidade bruta, taxa de administração, tipo de fundo,
  prazo; saídas = número de cotas ao longo do tempo, linha com come-cotas em maio/novembro x linha sem, líquido final.
- **Esforço:** G (come-cotas tem lógica de cotas).
- **Fatos regulatórios:**
  - Classes de fundos (CVM Res. 175: renda fixa, ações, cambial, multimercado; renda fixa mínimo 80%; ações mínimo
    67%): https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos/fundos-de-investimentos [ok].
  - Come-cotas (últimos dias úteis de maio e novembro; 15% longo prazo, 20% curto prazo; Lei 14.754/2023, IN RFB
    2.166/2023; fundos fechados e exclusivos incluídos): conferir na Lei (planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14754.htm)
    e na IN RFB 2.166 [reconferir; resumo veio de escritórios de advocacia].
  - Classificação Anbima: https://www.anbima.com.br/data/files/E3/62/8C/0B/242085106351AF7569A80AC2/NovaClassificacaodeFundos_PaperTecnico_1_.pdf [ok].
- **Prioridade média:** fundos são o produto mais vendido por bancos no Brasil e o aluno vai encontrá-los; mas a
  plataforma não os tem hoje (sem ganho imediato no jogo).

### N8 · "Debêntures: dívida das empresas" — MÉDIA

- **Objetivo:** o aluno entende o que é debênture, risco de crédito e a isenção das incentivadas.
- **Pré-req:** 1.6 (isenção LCI/LCA), 1.11 (CRI/CRA, crédito privado). **Posição:** Trilha 1, logo depois da 1.11.
- **Cartões-chave:** (1) Empresa que precisa de dinheiro emite debêntures e paga juros (você é credor, não sócio).
  (2) Risco de crédito: a empresa pode não pagar, FGC não cobre. (3) Rating: régua que resume o risco. (4)
  Incentivadas (infraestrutura): rendimento isento de IR para pessoa física. (5) Preço pode oscilar no secundário.
- **Widgets:** `rating-ruler` (já em RC.3.4b), `gross-up-comparator` (taxa isenta x taxa tributada equivalente:
  reaproveita `equivalent-rate`).
- **Esforço:** M.
- **Fatos regulatórios:** Lei 12.431/2011 (isenção de IR para PF em incentivadas) e Lei 14.801/2024 (debêntures de
  infraestrutura, benefício dedutível à emissora): https://www.anbima.com.br/pt_br/noticias/veja-as-diferencas-entre-as-debentures-regidas-pelas-leis-12-431-e-14-801.htm [ok];
  texto das leis no Planalto [reconferir; interação entre as duas leis e prazo médio mínimo].
- **Prioridade média:** conteúdo valioso para quem sai da renda fixa bancária, mas a plataforma não tem o ativo.
  Fica melhor se o autor decidir um catálogo de crédito privado.

### N9 · "RendA+ e Educa+: o Tesouro que vira renda mensal" — MÉDIA

- **Objetivo:** o aluno entende títulos com fase de acumulação e fase de renda mensal (aposentadoria e estudo).
- **Pré-req:** 1.10 (Tesouro IPCA+). **Posição:** Trilha 1, depois da 1.10, ou Trilha 3 junto de N12.
- **Cartões-chave:** (1) Dois tempos: acumula comprando títulos por anos e depois recebe parcelas mensais. (2)
  RendA+: recebe por 20 anos (240 parcelas), pensado para complementar a aposentadoria; Educa+: recebe por 5 anos
  (60 parcelas), pensado para os estudos. (3) Corrigidos pelo IPCA mais juros definidos na compra (renda real).
  (4) Resgate antecipado tem taxa e o preço oscila (marcação a mercado), então o ideal é segurar até a fase de
  renda. (5) Entrada pequena (Educa+ a partir de cerca de R$ 30).
- **Widget `renda-plus-simulator`:** entradas = aporte mensal, anos de acumulação, taxa real; saídas = renda
  mensal estimada na fase de renda, a valores de hoje (IPCA), gráfico dos dois tempos.
- **Esforço:** M.
- **Fatos regulatórios:** Tesouro RendA+ (240 prestações, IPCA + taxa; taxa de resgate antecipado 0,50% a.a. <10
  anos, 0,20% a.a. entre 10 e 20, 0,10% depois): https://www.gov.br/tesouronacional/pt-br/noticias/conheca-o-renda-aposentadoria-extra-o-novo-titulo-do-tesouro-direto [ok];
  Educa+ (60 prestações, cerca de R$ 30): https://www.gov.br/fazenda/pt-br/assuntos/noticias/2023/agosto/novo-titulo-tesouro-educa-comecou-nesta-terca-feira-1o-8-a-ser-negociado-na-b3 [ok;
  reconferir valores e datas de lançamento na página do Tesouro, que bloqueou o fetch].
- **Prioridade média:** produto do Tesouro Direto atual, simples de ensinar, e conecta renda fixa ao objetivo de
  vida; vale se o catálogo ganhar o título.

### N10 · "Previdência privada: PGBL x VGBL" — MÉDIA

- **Objetivo:** o aluno decide entre PGBL e VGBL e entre tabela regressiva e progressiva.
- **Pré-req:** 1.5 (IR regressivo), N6 (taxas), N7 (fundos, pois a previdência investe em fundos). **Posição:**
  Trilha 3, antes do desafio final.
- **Cartões-chave:** (1) Previdência é um fundo com regra tributária própria. (2) PGBL: deduz até 12% da renda
  bruta anual (quem faz declaração completa); IR incide sobre tudo no resgate. VGBL: sem dedução; IR só sobre o
  ganho. (3) Tabela regressiva: 35% até 2 anos, caindo 5 pontos a cada 2 anos até 10% (após 10 anos). Progressiva:
  retém 15% e acerta na declaração (0 a 27,5%). (4) Taxa de administração e carregamento mudam muito o resultado.
  (5) Portabilidade existe (pode trocar de plano sem perder).
- **Widget `pgbl-vgbl-simulator`:** entradas = renda bruta anual, aporte, prazo, rentabilidade, tipo de
  declaração; saídas = IR economizado no PGBL, valor líquido de cada tabela, ponto de equilíbrio.
- **Esforço:** G.
- **Fatos regulatórios:** dedução de 12% (Receita):
  https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/deducoes/despesa-de-previdencia-privada [ok];
  PGBL/VGBL e tabelas (SUSEP): http://www.susep.gov.br/setores-susep/seger/coate/perguntas-mais-frequentes-sobre-planos-por-sobrevivencia-pgbl-e-vgbl [ok]; Anbima:
  https://comoinvestir.anbima.com.br/noticia/entenda-os-regimes-de-tributacao-da-previdencia/ [ok]. Atenção: a
  reforma/regras de tributação de previdência (inclusive VGBL em debate em 2025) devem ser checadas
  [reconferir mudanças legais em 2025-2026 antes de gravar].
- **Prioridade média:** relevante para o adulto brasileiro e muito vendida por bancos (com taxas altas); alto
  potencial de funcionalidade, mas conteúdo denso e dependente de renda tributária (declaração completa).

### N11 · "FGTS: o investimento que você não escolheu" — MÉDIA

- **Objetivo:** o aluno entende o que é o FGTS, quanto ele rende, quando pode sacar e que opção de saque escolher.
- **Pré-req:** 0.4 (real x nominal), 0.5 (poupança). **Posição:** Trilha 0 (fim) ou na trilha de finanças pessoais.
- **Cartões-chave:** (1) O empregador deposita 8% do salário por mês numa conta em seu nome. (2) Rende TR + 3% a.a.
  mais distribuição de lucro, quase sempre perto ou abaixo da inflação em termos reais. (3) Saque-rescisão (padrão:
  demissão sem justa causa saca tudo + multa) x saque-aniversário (saca uma parte por ano, mas perde o saque total
  na demissão). (4) Pode usar para moradia (financiamento). (5) Antecipar o saque-aniversário é crédito caro.
- **Widget `fgts-vs-alternatives`:** entradas = saldo, tempo, TR e inflação assumidas; saídas = FGTS x poupança x
  Tesouro Selic, real e nominal.
- **Esforço:** P/M.
- **Fatos regulatórios:** rendimento TR + 3% a.a. + distribuição de resultados (6,05% em 2024; 6,90% em 2025);
  modalidades de saque: https://www.caixa.gov.br/beneficios-trabalhador/fgts/saque-FGTS/Paginas/default.aspx [ok];
  Ministério do Trabalho https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2025/dezembro/saiba-como-funciona-o-saque-aniversario
  [ok]. Regras do saque-aniversário mudaram por MP em 2025: [reconferir regra vigente em fgts.gov.br].
  Alíquota de 8%: [reconferir em fonte oficial].
- **Prioridade média:** 100% brasileiro, todo CLT tem; relação direta com juros reais. Menos prioritária que reserva
  e dívida.

### N12 · "Aposentadoria: o plano em três pilares" — MÉDIA

- **Objetivo:** o aluno estima quanto precisa acumular para ter uma renda e quais ferramentas existem.
- **Pré-req:** 0.4, N10 (previdência), N9 (RendA+), 3.1. **Posição:** Trilha 3, perto do fim.
- **Cartões-chave:** (1) Três pilares: INSS (teto e regras próprias), previdência privada, patrimônio próprio. (2)
  O INSS não cobre o padrão de vida acima do teto. (3) Conta de renda: patrimônio x retirada sustentável com retorno
  real. (4) Tempo vale mais que valor: começar cedo dobra o resultado. (5) Inflação corrói a renda: pensar em real.
- **Widget `retirement-calculator`:** entradas = renda desejada em R$ de hoje, idade, aporte, retorno real;
  saídas = patrimônio-alvo, aporte necessário, ano de independência; compara começar agora x 10 anos depois.
- **Esforço:** M.
- **Fatos regulatórios:** regras do INSS (idade mínima, teto) mudaram na reforma e são específicas; **não afirmar
  números do INSS sem fonte** [reconferir em https://www.gov.br/inss e Ministério da Previdência
  https://www.gov.br/previdencia]. Panorama de previdência complementar:
  https://www.gov.br/previdencia/pt-br/assuntos/previdencia-complementar/mais-informacoes/perguntas-frequentes-de-previdencia-complementar [ok].
- **Prioridade média:** o objetivo final de longo prazo do iniciante; amarra N9, N10, N11. Depende de decisões do
  autor sobre usar INSS como conteúdo.

### N13 · "Lendo um gráfico: análise técnica sem mistério" — MÉDIA

- **Objetivo:** o aluno lê candlestick, tendência, suporte e resistência, e entende o que a análise técnica
  promete e o que não promete.
- **Pré-req:** 2.5 (oferta e demanda), 2.6.x (para contrastar com fundamentalista). **Posição:** Trilha 2, depois da
  2.6.5/2.8 (setores) como lição eletiva.
- **Cartões-chave:** (1) Gráfico de candle: abertura, máxima, mínima, fechamento. (2) Tendência de alta, baixa e
  lateral. (3) Suporte e resistência: preços onde o mercado tende a reagir. (4) Fundamentalista olha a empresa;
  técnica olha o preço; muita gente combina. (5) Limite: padrão não é garantia (autoprofecia, vieses).
- **Widgets:** `candle-reader` (mostra uma vela; arrastar para identificar abertura/fechamento/sombras) e
  `support-resistance-marker` (o aluno marca linhas num gráfico sintético; o sistema mostra onde a reação
  aconteceu).
- **Esforço:** M/G (gráfico interativo).
- **Fatos regulatórios:** definições da B3: https://borainvestir.b3.com.br/objetivos-financeiros/o-que-e-a-analise-tecnica-ou-grafista/ [ok]; CPA-20 da Anbima inclui o tema no programa:
  https://www.anbima.com.br/data/files/DF/B3/58/FD/EBE569104D404569B82BA2A8/PD%20CPA-20_versao%2010.9%20_vigencia%2003.03.2025_%20Marcacoes.pdf [ok]. Nenhum número regulatório.
- **Prioridade média:** engaja pelo visual e conecta com o gráfico do app e com o arquétipo Chartista dos bots do
  motor; risco é ensinar "previsão". Ensinar com ceticismo.

### N14 · "Cabeça de investidor: vieses e emoção" — MÉDIA

- **Objetivo:** o aluno reconhece vieses comuns (manada, aversão à perda, excesso de confiança) e cria regras para
  não agir no impulso.
- **Pré-req:** 3.1 (risco), 2.4 (notícias). **Posição:** Trilha 3, antes do desafio final.
- **Cartões-chave:** (1) Perder dói mais do que ganhar alegra, e leva a vender no fundo. (2) Efeito manada: comprar
  porque todos compram (topo de bolha). (3) Excesso de confiança: operar demais reduz resultado. (4) Regras prévias
  (plano de alocação, rebalancear no calendário). (5) Pergunta: o que fazer quando a carteira cai 20%?
- **Widget `behavior-bias-quiz`:** cenários curtos com 3 reações; o sistema mostra o viés e o custo simulado.
  **Aplicável ao jogo:** usar a queda de um evento macro como caso real.
- **Esforço:** M.
- **Fatos regulatórios:** nenhum número. Conferir material sobre finanças comportamentais do Portal do Investidor
  (cadernos e guias em https://www.gov.br/investidor/pt-br/educacional/publicacoes-educacionais) [reconferir: não
  localizei na pesquisa o guia específico; achar antes de citar].
- **Prioridade média:** forte para engajamento e retenção de aprendizado; baixo custo; depende de achar fonte
  primária.

---

### Lições de prioridade baixa (versão compacta; todos os campos exigidos)

#### N15 · "Dólar e câmbio" — BAIXA (adiar)

- **Objetivo:** entender o que move o dólar e como ele afeta preços e investimentos. **Pré-req:** 0.3, RC.4.1.
  **Posição:** Trilha 3 (eletiva) ou depois de a plataforma ter ativo em dólar. **Esforço:** M.
- **Cartões:** (1) Câmbio = preço de uma moeda em outra. (2) Juros altos tendem a atrair dólar para o Brasil e
  valorizar o real. (3) Dólar alto encarece importados e pressiona a inflação. (4) Como investir: ETF/fundo cambial
  (sem imposto de renda diferente dos outros). (5) Risco: oscilação.
- **Widget:** `fx-converter-shock` (entrada: preço em dólar, câmbio; saída: preço em reais, efeito de +10% no
  câmbio).
- **Fatos:** fundo cambial exige 80% do patrimônio em ativos cambiais: https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos/fundos-de-investimentos [ok]; IOF-câmbio e regras de remessa [reconferir em fonte da Receita/Banco Central]. Acesso 2026-10-03.
- **Prioridade baixa:** sem ativo cambial na plataforma; tema macro importante mas conceito difícil; adiar.
- **Gancho:** ativo dólar e ETF cambial; evento macro de câmbio no mercado ao vivo.

#### N16 · "Ouro" — BAIXA (cortar como lição; virar cartão em diversificação)

- **Objetivo:** saber que ouro é reserva de valor e como investir via ativo financeiro ou ETF. **Pré-req:** 3.1.
  **Posição:** cartão "saiba mais" na 3.1. **Esforço:** P (cartão).
- **Cartões:** (1) Não rende juros; vale pela procura. (2) Funciona como proteção em crises, mas oscila. (3) No
  Brasil: ouro ativo financeiro e ETFs de ouro. (4) Ganho tributado (15%) e IOF de 1% em certas operações.
- **Widget:** nenhum (usar `risk-return-scatter` da 3.1).
- **Fatos:** ouro ativo financeiro com IOF 1% e isenção de R$ 20 mil/mês junto com ações: Lei 7.766/1989
  https://www.planalto.gov.br/ccivil_03/leis/l7766.htm e B3 https://atendimento.b3.com.br/sys_attachment.do?sys_id=d4d48fcb9724ee905649fe46f053af83 [reconferir ambos: o resumo cita IOF 1% e isenção mas é preciso
  abrir o texto]. Acesso 2026-10-03.
- **Prioridade baixa:** poucos investidores iniciantes compram ouro; cabe num cartão.
- **Gancho:** ativo "ouro" sintético para teste de diversificação.

#### N17 · "Criptoativos: risco, regulação e golpes" — BAIXA (adiar; conteúdo mínimo dentro de N3)

- **Objetivo:** entender o que são, quem regula e por que a maioria das promessas é golpe. **Pré-req:** N3, 3.1.
  **Posição:** módulo dentro de N3 (cartão 6); lição própria só se o autor quiser. **Esforço:** M.
- **Cartões:** (1) Criptoativo não é moeda do Banco Central nem investimento garantido. (2) Volatilidade extrema.
  (3) Marco legal (Lei 14.478/2022) e regras do Banco Central para prestadoras de serviços de ativos virtuais, em
  vigor desde 2 de fevereiro de 2026. (4) Golpes: pirâmides, falsas exchanges, influenciadores falsos. (5) Se for
  investir: só em plataforma autorizada, valor que pode perder.
- **Widget:** `volatility-replay` (gráfico sintético muito volátil x Tesouro Selic, lado a lado).
- **Fatos:** Resoluções BCB 519, 520 e 521/2025 (vigência 2026-02-02; informação obrigatória ao BC a partir de
  2026-05-04): https://normativos.bcb.gov.br (buscar as resoluções) [reconferir: a vigência veio de imprensa;
  confirmar no normativo]; Lei 14.478/2022 no Planalto [reconferir]; alerta CVM
  https://www.gov.br/investidor/pt-br/educacional/publicacoes-educacionais/alertas/alerta_cvm_criptoativos_10052018.pdf [ok, 2018]. Tributação de cripto (ganho de capital; isenção de R$ 35 mil/mês) [reconferir em Receita Federal;
  não vi fonte oficial na pesquisa]. Acesso 2026-10-03.
- **Prioridade baixa:** risco regulatório e de reputação (parecer recomendação), tema em mudança rápida, sem ativo no
  catálogo; só vale o ângulo de proteção.
- **Gancho:** sandbox de ativo volátil com aviso de risco.

#### N18 · "COE: o produto estruturado que o banco oferece" — BAIXA (cortar/adiar)

- **Objetivo:** reconhecer um COE, seu cenário de ganho/perda e que ele não tem FGC. **Pré-req:** 1.8, 1.11.
  **Posição:** cartão "saiba mais" em 1.6 ou 1.11. **Esforço:** P (cartão) ou M.
- **Cartões:** (1) Combina renda fixa com uma aposta (ex.: bolsa). (2) Pode ter capital protegido ou em risco. (3)
  Depende do risco de crédito do banco emissor. (4) Não tem FGC. (5) Leia a lâmina (DIE).
- **Widget:** `payoff-diagram` (gráfico de resultado por cenário; opcional).
- **Fatos:** COE não é garantido pelo FGC e depende do risco do emissor; o documento de informações essenciais
  (DIE) traz o alerta: Anbima https://comoinvestir.anbima.com.br/noticia/coe-como-funciona-esse-investimento/ [ok]; Resolução CMN 4.263/2013
  https://normativos.bcb.gov.br/Lists/Normativos/Attachments/48877/Res_4263_v3_L.pdf [ok]. Acesso 2026-10-03.
- **Prioridade baixa:** produto complexo, vendido em agência, pouca relevância para o iniciante; entra melhor como
  cartão em "produtos que o banco oferece" (junto de N3 e N7).
- **Gancho:** "alerta de produto complexo" no futuro catálogo.

#### N19 · "Open Finance: seus dados, sua decisão" — BAIXA (adiar)

- **Objetivo:** entender o que é o compartilhamento de dados e como gerenciar o consentimento. **Pré-req:** N3.
  **Posição:** cartão em N3 ou lição na Trilha 3. **Esforço:** P.
- **Cartões:** (1) Você autoriza instituições a trocar seus dados. (2) Consentimento tem finalidade e prazo (até 12
  meses); você pode revogar. (3) Uso: comparar ofertas de crédito e consolidar contas. (4) Segurança: só pelo app
  oficial, nunca por link recebido.
- **Widget:** `consent-simulator` (tela de consentimento fictícia: escolha dados, prazo e destino).
- **Fatos:** Resolução Conjunta nº 1/2020 (consentimento válido por até 12 meses, revogável):
  https://normativos.bcb.gov.br/Lists/Normativos/Attachments/51028/Res_Conj_0001_v7_L.pdf [ok]; https://openfinancebrasil.org.br/ [ok]. Acesso 2026-10-03.
- **Prioridade baixa:** útil, mas distante do núcleo de investimentos.
- **Gancho:** importação de carteira real em modo leitura (futuro distante).

#### N20 · "Investimento sustentável (ESG)" — BAIXA (adiar)

- **Objetivo:** entender o que significa ESG/ASG, títulos verdes e o selo IS. **Pré-req:** N7, 2.9. **Posição:**
  cartão em N7 ou 2.9. **Esforço:** P.
- **Cartões:** (1) ASG = ambiental, social, governança. (2) Título verde financia projeto ambiental. (3) Fundos IS
  (Anbima) têm regras para usar o selo. (4) Cuidado com "greenwashing".
- **Widget:** nenhum.
- **Fatos:** regras Anbima para fundos IS (sufixo "IS" desde 2022): https://www.anbima.com.br/data/files/40/31/C5/25/AA40C710E480CEB76B2BA2A8/10.%20Regras_procedimentos_Fundos%20IS_AP.pdf [ok]; ESG Anbima:
  https://comoinvestir.anbima.com.br/noticia/esg-investir-em-sustentabilidade-deixou-de-ser-so-mais-uma-ideia/ [ok]. Acesso 2026-10-03.
- **Prioridade baixa:** tema de nicho para o iniciante; cartão basta.
- **Gancho:** selo IS em fundos/ETFs sintéticos; filtro "sustentável".

#### N21 · "Seguros: proteger o que você construiu" — BAIXA (adiar; validar fonte)

- **Objetivo:** entender seguros de vida, auto e residencial como proteção, e por que vêm antes de investir mais.
  **Pré-req:** N4. **Posição:** Trilha de finanças pessoais, depois de N4. **Esforço:** M.
- **Cartões:** (1) Seguro troca um risco grande por um custo pequeno e certo. (2) Quem depende da sua renda precisa
  de proteção. (3) Cobertura, franquia, carência, exclusões. (4) Não confundir seguro com investimento
  (capitalização).
- **Widget:** `premium-vs-loss` (prêmio x perda possível x probabilidade).
- **Fatos:** a SUSEP, regulador de seguros (https://www.gov.br/susep/pt-br/assuntos/meu-futuro-seguro/acoes-educacionais): [reconferir; não pesquisei o conteúdo em profundidade; tema listado na ENEF
  (previdência e seguros)]. Acesso 2026-10-03.
- **Prioridade baixa:** fora do foco de investimentos; incluir só se o autor quiser abranger a ENEF completa.
- **Gancho:** item "proteção" no checklist de planejamento.

## 3. O que cortar ou adiar, e por quê

| Item | Recomendação | Motivo |
|---|---|---|
| Cripto como lição própria | **Adiar**; manter só cartões dentro de N3 (golpes) | Marco regulatório mudou em 2026 (resoluções do Banco Central em vigor desde 2026-02-02), tributação não confirmada em fonte primária, nenhum ativo no catálogo, risco de parecer endosso. A proteção contra golpe é o que mais importa |
| Ouro | **Cortar** como lição; cartão "saiba mais" na 3.1 | Conceito simples, uma ideia (reserva de valor); sem ativo no jogo |
| Câmbio e dólar | **Adiar** até existir ativo cambial ou evento de câmbio no motor | Conceito macro difícil de tornar interativo sem um ativo na plataforma |
| COE | **Cortar** como lição; cartão em "produtos que o banco oferece" | Produto complexo, alta variedade de estruturas, pouco útil ao iniciante; vale o alerta (sem FGC, risco do emissor) |
| Open Finance | **Adiar** | Fora do foco de investir; vale quando houver importação de carteira real |
| ESG | **Adiar** | Cartão em N7 basta |
| Seguros | **Adiar** (decisão do autor se quer a ENEF completa) | Fora do foco de investimentos; não pesquisado a fundo |
| Derivativos (opções, futuros) | **Cortar** | Risco alto para iniciante, sem ativo; só aviso |
| Day trade | **Cartão dentro de N5** | Ensinar a tributação e o risco (Caderno CVM nº 15), não a prática |
| N12 Aposentadoria | **Adiar o INSS** (regras específicas); manter só o conceito de patrimônio-alvo | Evitar afirmar regra do INSS sem fonte primária conferida |

Princípio: cortar o que exige ativo que a plataforma não tem e o que muda rápido de regra sem fonte primária
estável. Tudo adiado fica registrado como ideia, sem tarefa.

## 4. Ordem sugerida de implementação

Considerando dependências (RC.1.3 antes de qualquer fato, RC.3.1/3.4 antes de widget), valor para o iniciante e
reaproveitamento de widgets:

1. **Onda 1 (alta, resolve lacunas óbvias):** RC.4.1 (Selic/CDI/TR) e RC.4.2 (B3/ordens), já previstas; **N4
   Reserva de emergência** (cumpre a promessa da 1.1/1.2); **N3 Golpes**; **N2 Dívida e crédito**; **N1 Orçamento**.
   Widgets novos pequenos (`budget-split`, `debt-snowball`, `scam-or-legit`, `emergency-fund-calculator`).
2. **Onda 2 (alta/média, ligada ao que o aluno já faz no jogo):** **N5 Imposto em renda variável** (precisa de
   RC.4.2 e de RC.1.3 com isenção, 15%/20%, dedo-duro, Lei 15.270), **N6 Custos** (reaproveita
   `compound-growth`), **N11 FGTS**.
3. **Onda 3 (média, produtos):** **N7 Fundos** (come-cotas), **N8 Debêntures**, **N9 RendA+/Educa+**, **N10
   Previdência**, **N12 Aposentadoria**, **N13 Análise técnica**, **N14 Vieses**.
4. **Onda 4 (baixa, só se o autor quiser):** N15 a N21; cartões de cripto/ouro/COE/ESG/Open Finance entram dentro de
   N3, 3.1, N7 sem lição própria.

Regra de corte de volume: com a onda 1 e 2 o currículo vai de 35 para 37 (RC.4.1/4.2) + 9 = 46 lições; com a onda
3, 53. Cada lição deve caber em poucos minutos (Princípio 0). Se o autor achar volume demais, fundir N6 em N7 e
N12 em N10, reduzindo para 51.

## 5. Impacto na estrutura de trilhas (precisa de trilha nova?)

**Sim, recomendo duas mudanças estruturais** (decisão do autor):

1. **Nova trilha "Finanças do dia a dia" (Trilha F, paralela e não bloqueante):** N1 Orçamento, N2 Dívida, N3
   Golpes, N4 Reserva de emergência (aqui no lugar da posição na Trilha 1), N11 FGTS (e N21 Seguros se entrar).
   Justificativa: são pré-requisitos de vida real, não de produto de investimento; hoje as Trilhas 0-3 são todas
   sobre investir. Esta trilha **não desbloqueia ativo** (sem `unlocksKeys`), então não trava o progresso de
   quem já está na Trilha 1 ou 2; usa a progressão com dispensa (N.24) e `stableKey` próprio. Pode abrir em
   paralelo à Trilha 0 (a pessoa escolhe a ordem), com selo "recomendado primeiro" para N1 e N4. Se o autor preferir
   não criar trilha, N1/N2/N3 entram no fim da Trilha 0 e N4 após a 1.2, mas a Trilha 0 passa de 5 para 8 lições
   (acima do tamanho médio das outras).
2. **Ampliar a Trilha 3 (hoje 4 lições sobre estratégia/tributação) ou criar a "Trilha 4: Produtos e longo
   prazo":** N7 Fundos, N8 Debêntures (poderia ficar na 1), N9 RendA+/Educa+, N10 Previdência, N12 Aposentadoria,
   N14 Vieses. A Trilha 3 atual vira "Estratégia" (diversificação, perfil, comparação, desafio final). Justificativa:
   evita uma Trilha 3 com 10+ lições e dá um destino claro (planejar uma vida financeira) após o desafio final. O
   desafio final da Trilha 3 continua marcando a conclusão da trilha guiada; a Trilha 4 vira aprofundamento
   opcional (sem novo desbloqueio de ativo, só conquistas).

Mapa final proposto (rascunho): F (5-6) | 0 (6 com RC.4.1) | 1 (11 + N8 + N9 = 13) | 2 (15 + RC.4.2 + N5 + N6 + N7 + N13 = 20)
| 3 (4) | 4 (N10, N12, N14 = 3).

Riscos a tratar: (a) renumeração visual do Mapa da Trilha (RC.7.x) e do texto "35 lições" em spec/inventário
(RC.8.2); (b) contador de conquistas e missões que dependem do número de lições; (c) lições eletivas (N13, N14)
precisam do conceito de "não bloqueante" no player; (d) lint de termos (RC.1.2) precisa incluir os termos novos
(DARF, come-cotas, rotativo, PGBL, VGBL, debênture, rating, candle).

## 6. Pontos para decisão do autor (resumo)

1. Criar a Trilha F (finanças do dia a dia) e/ou Trilha 4? (seção 5)
2. Aprovar as ondas 1 e 2 (N1-N6, N11) agora? Quais da onda 3?
3. N6 como lição própria ou fundida em N7?
4. Cripto: só cartões em N3 (recomendado) ou lição própria?
5. Seguros e INSS: dentro ou fora do escopo?
6. Registrar em RC.1.3 os novos fatos acima, com **[reconferir]** resolvidos em página oficial aberta (Tesouro
   Direto, Receita, FGTS, normativo do Banco Central para ativos virtuais, Lei 14.754, MP 1.303).
