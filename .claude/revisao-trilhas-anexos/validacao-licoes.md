# Validação factual das 35 lições atuais (RC.1.7)

Data: 2026-10-04. Escopo: afirmação por afirmação de `scenarioText`, `microDecisionPrompt`, opções e gabarito,
`revelationText`, `centralConcept` e `unlocksDescription` das 35 lições do seed, contra fonte primária e contra o
código do engine. Os anexos `audit-licoes-*.md` foram o ponto de partida; onde a checagem em fonte oficial os
contradisse, está marcado **corrige a auditoria**.

## Como ler

- **Veredito:** `correto`, `impreciso` (verdade parcial ou simplificada demais), `errado`, `desatualizado`,
  `plataforma` (descreve o produto, não o Brasil; vira bloco "Na plataforma" ou sai).
- **Fonte:** só primária (Planalto, Banco Central, B3, CVM, FGC, IBGE, Receita). `[fato:id]` aponta para
  `backend/src/modules/lessons/domain/regulatoryFacts.ts` (RC.1.3). Todo número regulatório de lição nova deve vir
  de um fato.
- **Acesso às fontes:** textos de lei lidos por `curl` no Planalto em 2026-10-04 (o `WebFetch` falhava). Onde a
  página oficial não abriu (BCB e IBGE exigem JavaScript, Tesouro Direto devolve 403), o fato ficou com
  `check: 'trecho-de-busca'` e a regra abaixo vale.
- **Regra para o que não foi confirmado em fonte primária:** a afirmação **não entra** na lição reescrita. Quem
  escrever a lição da Fase 5 ou reabre a fonte no navegador e promove o fato para `pagina-oficial`, ou corta a
  frase. A RC.8.1 reconfere.
- **Coerência com o motor:** conferida no código do engine em 2026-10-04 (`selic/copom.go`, `dividend/dividend.go`,
  `fundamentals/reportcycle.go`, `cmd/seed/main.go`).

## Achados transversais (valem para várias lições)

| # | Achado | Evidência | Efeito |
|---|---|---|---|
| T1 | Copom da plataforma é a cada **45 dias simulados**, não 21 | `CopomMeetingIntervalDays = 45` em `engine/internal/domain/selic/copom.go`; lições 1.3 e 1.8 dizem 21 ("simulados" na 1.3, "reais" na 1.8, e nem as duas batem entre si) | Erro de dado interno; some junto com o bloco "Na plataforma" |
| T2 | Ciclo de relatório e dividendo de ações é **91 dias simulados**, FII paga a cada **30**, pagamento **5 dias** depois | `DefaultReportFrequencyDays = 91`, `FIIPayoutIntervalDays = 30`, `DefaultPaymentLagDays = 5`; a 2.7 diz 14 dias | Erro de dado interno na 2.7 |
| T3 | Taxas citadas nas lições **não são as do catálogo** | Catálogo: CDB 110% do CDI, LCI/LCA 90%, CRI 115%, CRA 112%, LTN spread 1,75 p.p., NTNB 0,50 p.p. (`cmd/seed/main.go`). Lições: CDB 12,00% a.a., LCI 9,50%, LTN 11,75%, NTNB 6,00%, CRI 11,00%, CRA 10,50% | Números pedagógicos soltos; nas lições novas usar "% do CDI" ou widget com número vivo |
| T4 | A composição do SINT11 na 2.9 está errada | Seed: VALR3 40%, **BNDD3 20%**, TJLO11 25%, PAPL11 15%. Lição: Mineradora 40%, Banco 35%, outras 25% | Erro de dado interno |
| T5 | Cálculo do audit 1b para 5 anos está errado | 1000 ÷ 1,1175⁵ = **573,80** (o anexo diz 575,77); 1000 ÷ 1,14⁵ = 519,37 está certo | **Corrige a auditoria**; recalcular no widget, nunca copiar |
| T6 | **Dividendo obrigatório**: a regra supletiva é a metade do lucro líquido ajustado; 25% é o piso do §2º | Lei 6.404/1976, art. 202, caput e §2º (texto lido) | **Corrige a auditoria** ("25% se o estatuto for omisso") |
| T7 | **JCP é 17,5%** desde 2026 | LC 224/2025, art. 8º e art. 14, III (texto lido) [fato:jcp-aliquota] | **Corrige a auditoria 2b** ("15% vigente") e o backlog |
| T8 | **Prazo mínimo de LCI é 6 meses** (36 se indexada a preço) | Res. CMN 4.410, art. 4º, redação da Res. 5.215/2025 (texto consolidado lido) [fato:lci-lca-prazo-minimo] | Resgate em 60 dias (1.6) é impossível; **a RC.1.3 dizia 12/9 meses, valores de 02/2024: corrigido** |
| T9 | Liquidação de ações na B3 é **D+2**, não D+1 | Glossário da B3 (trecho de busca) [fato:b3-liquidacao-acoes] | **Corrige a auditoria 2b** |
| T10 | `EquityIndicatorsPanel` mostra 9 indicadores, mas a 2.6.1 promete os 6 valores-base | Leitura do componente na auditoria 2a | Bug de app, não de fato; tratar na Fase 5/RC.3.4 |
| T11 | `centralConcept` e `unlocksDescription` também são texto de lição | 0.2, 2.4/2.5 têm "TCC cap."; 2.10 tem "com onde crescer" | Tratados no veredito de cada lição |

---

## Trilha 0: Fundamentos

### 0.1 O que é investir

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| "Investir é ceder o uso do seu capital a alguém (governo, banco, empresa) em troca de remuneração" | impreciso | Vale para renda fixa; ação é participação societária (lição 2.1 ensina o oposto). Reescrever: investir é abrir mão do dinheiro hoje esperando mais dele depois, por empréstimo ou sociedade |
| "Guardar preserva o valor nominal; investir gera retorno que se soma" | impreciso | Nominal sim, poder de compra não (lição 0.3). Dinheiro parado perde para a inflação |
| "A poupança geralmente deixa valor na mesa" | impreciso | Depende da Selic e do prazo (ver 0.5). Cortar o "geralmente"/prometer menos |
| "Libera seu Portfólio de verdade, com R$ 10.000" | errado | O dinheiro é simulado. Capital inicial fixo é regra do produto (RNF06), não do Brasil: vai para "Na plataforma" |
| "Nesta plataforma, cada trilha desbloqueia..." | plataforma | Tirar do corpo da lição |

Fatos para gravar: nenhum. `centralConcept` limpo. Pergunta aberta, sem gabarito.

### 0.2 Juros simples vs compostos

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| M = C × (1 + i × n) e M = C × (1 + i)ⁿ | correto | Fórmulas padrão. R$ 1.000 a 10% por 20 anos: simples R$ 3.000,00, composto R$ 6.727,50 (recalculado) |
| "Todo investimento real (Tesouro, CDB, ações) trabalha no regime composto" | impreciso | Renda fixa capitaliza juros compostos; ação não tem juros (retorno é preço mais proventos). Dizer "a renda fixa" |
| "No curto prazo a diferença é pequena" | impreciso | Depende de taxa e prazo; em taxa alta (cartão, rotativo) a diferença aparece em meses |
| `centralConcept`: "(TCC cap. 2.1.1)" | errado | Referência proibida (RC.1.4) |
| Widget: capital, aporte, taxa, prazo, modo | plataforma | Aporte com "juros simples" não tem definição de mercado; é convenção do widget |

### 0.3 Inflação e poder de compra

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| R$ 100 com inflação de 5% viram R$ 105 | correto | 100 × 1,05 = 105. Distratores R$ 95 e R$ 110 sem função pedagógica; trocar por R$ 5 (confunde % com R$) |
| "O valor nominal continua R$ 100, o poder de compra caiu" | correto | Conceito padrão |
| "Retorno nominal positivo pode ser perda de poder de compra" | correto | Fisher, lição 0.4 |

Lacuna a preencher na reescrita: quem mede (IBGE, IPCA) e o que é meta, com [fato:meta-inflacao] e [fato:ipca-abrangencia].

### 0.4 Rendimento nominal vs real

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| 8% nominal, 6% de inflação: real "perto de 2%" | correto | (1,08 ÷ 1,06) − 1 = 1,887% |
| "≈ 1,89%, sempre um pouco menor que a aproximação" | correto | Para real positivo a diferença é (n − π) × π ÷ (1 + π) > 0; cresce com π, como o texto diz |
| "Todo indicador de investimento nesta plataforma é nominal" | plataforma | Sair do corpo da lição |
| CDB usado como exemplo antes da lição 1.4; IPCA usado sem definição | impreciso | Falha de pré-requisito (RC.1.2); IPCA entra na 0.3 |

Omissão relevante: o IR incide sobre o ganho **nominal**, então o ganho real líquido é menor [fato:ir-renda-fixa-regressivo].

### 0.5 Por que a poupança geralmente perde

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Selic > 8,5% a.a.: 0,5% a.m. + TR; abaixo: 70% da Selic + TR | correto | Lei 12.703/2012 (texto lido): a referência é a **meta** da Selic, "mensalizada, vigente na data de início do período de rendimento" [fato:poupanca-regra] |
| "A regra da poupança é fixa" | impreciso | A regra muda conforme a Selic; vale para depósitos desde 04/05/2012, saldos anteriores mantêm a regra antiga (Lei 12.703, art. 2º) |
| 0,5% a.m. "cerca de 6,17% ao ano" | correto | 1,005¹² − 1 = 6,168% |
| Tesouro Selic "~100% da Selic" | impreciso | Bruto; líquido paga IR regressivo e custódia B3 [fato:tesouro-custodia-b3]. Comparação justa é líquida |
| "Regra desenhada para ficar sempre um pouco atrás" | errado | Opinião sem fonte; com Selic baixa e IR sobre renda fixa o resultado líquido pode se aproximar. Reescrever como "com a Selic alta, perde" |
| Poupança isenta de IR para pessoa física | correto (indireto) | Lei 9.250/1995, art. 16-A, §1º, IV (incluído pela Lei 15.270) deduz rendimentos de poupança da base do imposto mínimo; a norma específica de isenção não foi aberta. Dizer só o que a fonte sustenta |
| "Selic simulada nesta plataforma" | plataforma | Sair do enunciado |
| TR, Selic, CDI usados sem definição | impreciso | Falha de pré-requisito; resolvido por RC.4.1 |

### Resumo da Trilha 0

Sem erro numérico. Erros de redação: 0.1 ("de verdade"), 0.5 ("sempre atrás"). Pré-requisitos: IPCA, Selic, CDI, TR.

---

## Trilha 1: Renda Fixa

### 1.1 O que é renda fixa

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| "Renda fixa é regra de remuneração conhecida de antemão, pós-fixada ou prefixada" | impreciso | Falta a **híbrida** (prefixada + IPCA), justamente o Tesouro IPCA+ da 1.10 |
| Gabarito "Sim" (título que acompanha a Selic ainda é renda fixa) | correto | |
| "O mesmo tipo de bônus da lição 0.1" | plataforma | Sair |
| "A taxa real de cada produto" | impreciso | Ambíguo com "rendimento real" da 0.4; trocar por "a taxa" |
| "Reserva de emergência de verdade" | plataforma | Promessa da trilha; ver RC.4.6 |

### 1.2 Tesouro Selic

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| LFT é título público pós-fixado, rende a Selic | correto | |
| "O mais líquido" | impreciso | Resgate em D+1 útil; poupança e conta remunerada têm liquidez imediata. Dizer "alta liquidez" |
| Pergunta: Selic sobe, o preço unitário "sobe" | impreciso | O PU do Tesouro Selic sobe todos os dias úteis, qualquer que seja a trajetória da Selic; a alta só acelera a subida. A pergunta confunde preço com ritmo de rendimento; reformular para "o que rende por dia" |
| "Marcação a mercado negativa com mais frequência no Prefixado/IPCA+" | correto | Ver 1.8 |
| "Resgate diário sem perda relevante" | impreciso | Faltam IOF abaixo de 30 dias [fato:iof-renda-fixa-30-dias], IR regressivo [fato:ir-renda-fixa-regressivo] e custódia [fato:tesouro-custodia-b3] |
| "A spec do TCC (cap. 3) o trata como porto seguro" | errado | Referência proibida e opinião; trocar por "baixa oscilação de preço" |
| Vencimento LFT2029 | não verificado | Não afirmar data de vencimento do título fictício; sem fonte primária lida |

### 1.3 Como a Selic é formada

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Selic é decidida pelo Copom do Banco Central | correto | |
| "Reunido a cada 21 dias simulados" | errado | Real: 8 reuniões por ano, em geral dois dias seguidos, decisão a partir das 18h30 [fato:copom-reunioes]. Motor: 45 dias simulados (T1) |
| "Reage principalmente à inflação (IPCA) acima ou abaixo da meta" | impreciso | O Copom persegue a meta, mas decide olhando expectativas e cenário; "principalmente" é simplificação. A meta é 3,00% ±1,5 p.p., medida pelo IPCA [fato:meta-inflacao] |
| Regra de Taylor, reversão à taxa neutra, ruído | plataforma | É o modelo interno; o Copom real não aplica fórmula. Vai para "Na plataforma" ou sai |
| "Arredondado para múltiplo de 0,25 p.p., o mesmo passo do Copom real" | impreciso | Na prática a meta da Selic é expressa em múltiplos de 0,25 p.p., mas não é regra legal; sem fonte primária lida, não afirmar como regra |
| "Selic simulada nunca fica negativa" | plataforma | |
| Selic efetiva (over) vs meta | omissão | O texto mistura os dois; a decisão do Copom é a **meta** (Lei 12.703 também fala em "meta") |

### 1.4 CDB e o CDI

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| CDB é empréstimo ao banco, remunerado em geral por % do CDI | correto | |
| CDI "taxa que acompanha de perto a Selic" | impreciso | Correto na ideia; faltam: taxa dos empréstimos de um dia entre bancos, ~0,10 p.p. abaixo da Selic. Sem fonte primária lida para o diferencial; dizer "acompanha de perto" |
| FGC cobre CDB, LCI e LCA até R$ 250 mil por CPF e por instituição | impreciso | Correto como limite, incompleto: é **por conglomerado**, e há **teto de R$ 1 milhão por CPF em 4 anos** [fato:fgc-limite-por-cpf] [fato:fgc-teto-global] [fato:fgc-produtos] |
| "Praticamente tão seguro quanto o Tesouro Direto até o limite" | errado | Título público não tem teto e é risco soberano; FGC é associação privada com limite. Cortar |
| "Mesmo que o banco quebre" | impreciso | Aciona na liquidação/intervenção decretada pelo Banco Central; o pagamento não é imediato. Sem texto lido sobre o processo, dizer só "se o banco for liquidado" |
| "CDB2027 paga 12,00% a.a." | plataforma | T3: o catálogo é 110% do CDI |
| "Bancos menores pagam mais" | correto | Tendência de prêmio de risco |

### 1.5 Tributação regressiva de IR

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| 22,5% até 180, 20% de 181 a 360, 17,5% de 361 a 720, 15% acima de 720 dias | correto | Lei 11.033/2004, art. 1º, I a IV (texto lido) [fato:ir-renda-fixa-regressivo] |
| 90 dias paga alíquota maior que 800 dias | correto | 22,5% > 15% |
| "Imposto só sobre o lucro" | correto | |
| "Vale para todo produto de renda fixa tributado (Tesouro e CDB)" | impreciso | Fundos de renda fixa têm come-cotas (não tratado); dizer "títulos como Tesouro e CDB" |
| "LCI, LCA, CRI e CRA são isentos" | impreciso | Correto só para **pessoa física**: Lei 11.033, art. 3º, II e IV (texto lido) [fato:lci-lca-isencao-pf] |
| Omissão: IOF nos primeiros 29 dias | omissão | Decreto 6.306, art. 32 e Anexo: 96% do rendimento no dia 1 até 0% no dia 30 [fato:iof-renda-fixa-30-dias] |
| Retenção na fonte | omissão | Lei 11.033, art. 1º: "imposto de renda na fonte"; o investidor não paga DARF |

### 1.6 LCI e LCA

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| LCI financia imobiliário, LCA agronegócio, ambas com FGC | correto | [fato:fgc-produtos] |
| Taxa bruta equivalente = isenta ÷ (1 − alíquota): 9,50 ÷ 0,775 = 12,258 e 9,50 ÷ 0,85 = 11,176 | correto | Recalculado |
| Resgate com 60 dias | errado | Prazo mínimo de LCI é 6 meses (36 se indexada a preço) e o emissor não pode recomprar antes [fato:lci-lca-prazo-minimo]; o exemplo de 60 dias não existe na emissão primária |
| LCI2026 9,50% vs CDB2027 12,00% | plataforma | T3; também vencimentos diferentes (2026 x 2027) |
| "Isentos de IR" | impreciso | Só pessoa física [fato:lci-lca-isencao-pf]; a MP 1.303/2025 que previa tributar caducou |
| "Ver resultado" que só esconde texto | plataforma | Problema de UX (RC.5.5) |

### 1.7 Tesouro Prefixado

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| PU = 1.000 ÷ (1,1175)^(504/252) = R$ 800,76 | correto | Recalculado; diferença R$ 199,24 |
| "Exatamente a sua rentabilidade contratada" | impreciso | Bruta: não desconta IR [fato:ir-renda-fixa-regressivo], custódia [fato:tesouro-custodia-b3] |
| Base de 252 dias úteis | correto (convenção) | Convenção do mercado (Caderno de Fórmulas do Tesouro); não explicada na lição; fonte do Tesouro não abriu, tratar como convenção |
| "Taxa travada" | impreciso | Só vale segurando até o vencimento (a 1.8 desfaz) |
| Valor de face R$ 1.000 | correto | Convenção da LTN |
| LTN2027 11,75% a.a. | plataforma | T3 (catálogo: spread 1,75 p.p.) |
| "Faltem exatamente 504 dias úteis" para um título "2027" | impreciso | Hipotético; o título real vence em data fixa. Dizer "imagine" |

### 1.8 Marcação a mercado

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Taxa de mercado sobe de 11,75% para 14%, preço de revenda fica **abaixo** | correto | 1.000 ÷ 1,14² = R$ 769,47 contra R$ 800,76 (queda de 3,9%) |
| "O Copom subiu a taxa de juros de mercado pra 14%" | errado | A taxa do título é a de mercado para aquele prazo, não a Selic; reage a expectativas e já se move antes da reunião |
| "Copom simulado a cada 21 dias reais" | errado | T1 |
| Preço de qualquer prefixado é recalculado todo dia útil | correto (conceito) | Prefixados e IPCA+ marcam a mercado; Tesouro Selic quase nada |
| Omissão: sensibilidade ao prazo (duration) | omissão | Mesmo choque derruba mais um título longo. 5 anos: R$ 573,80 a 11,75% e R$ 519,37 a 14% (queda de 9,5%); **corrige a auditoria** (T5) |
| "Ativo de prática (Sandbox)" | plataforma | |

### 1.9 O que é o IPCA

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| IPCA é calculado pelo IBGE todo mês | correto | |
| "Cesta representativa do consumo das famílias brasileiras" | impreciso | Famílias **urbanas** com renda de 1 a 40 salários mínimos [fato:ipca-abrangencia] |
| "Referência que o BC usa pra decidir a Selic" | impreciso | O IPCA é o índice da meta (3,00% ±1,5 p.p., [fato:meta-inflacao]); a decisão olha expectativas |
| Acumulado de 12 meses é produto composto, não soma | correto | Ex.: 0,5% ao mês: soma 6,00%, composto 6,17% |
| "IPCA simulado varia pouco, sem memória" | plataforma | O IPCA real tem sazonalidade e persistência |
| IPCA divulgado entre os dias 10 e 15 | correto (indireto) | [fato:tesouro-vna-ipca] |
| Mostra IPCA simulado logo após falar do IBGE | plataforma | Confunde; rotular |

### 1.10 Tesouro IPCA+

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Retorno real de 6,00% "acima da inflação" | impreciso | O rendimento é **composto**: (1 + IPCA) × (1 + taxa). IPCA 5% e taxa 6% dão 11,30%, não 11%. Taxa de 6% é exemplo; catálogo é spread 0,50 p.p. sobre real implícito |
| VNA "corrigido mês a mês pelo IPCA" | impreciso | Base R$ 1.000 em 15/07/2000, atualização com IPCA divulgado entre os dias 10 e 15 e pro rata [fato:tesouro-vna-ipca] |
| Gabarito "aumenta" se a inflação for maior | correto | |
| "Rendimento real garantido por contrato" | impreciso | Só no vencimento: antes disso há marcação a mercado pela taxa real (ver 1.8) |
| Omissão: IR sobre o ganho nominal | omissão | [fato:ir-renda-fixa-regressivo] |
| Comportamento em deflação | não verificado | Regra do VNA com IPCA negativo não confirmada em fonte primária: **não afirmar** |
| "Inflação simulada nesta plataforma" | plataforma | |

### 1.11 CRI e CRA

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| CRI e CRA não têm FGC | correto | Página do FGC lista CRI entre os não cobertos; CRA não é citado nominalmente, mas não é título de instituição associada [fato:fgc-produtos] |
| "CDB, LCI e LCA têm FGC até R$ 250 mil" | impreciso | Mesmo complemento da 1.4 (conglomerado, teto de 4 anos) |
| "Risco de crédito recai inteiramente sobre a securitizadora" | impreciso | O risco está nos devedores dos recebíveis e nas garantias; a securitizadora é veículo. Sem texto de lei lido sobre regime fiduciário, não detalhar |
| CRI/CRA isentos de IR | impreciso | Só pessoa física: Lei 11.033, art. 3º, II e IV [fato:lci-lca-isencao-pf] |
| "Pagam mais (11,00% e 10,50%, acima da maioria dos CDBs)" | impreciso | T3 (catálogo 115% e 112% do CDI); parte do prêmio é a isenção e a falta de liquidez |
| Classificação AA e A | plataforma | Escala fictícia; no Brasil a escala nacional usa o prefixo "br" (não verificado em fonte primária: não citar) |
| `unlocksDescription`: "reserva de emergência com todas as opções (CRI/CRA)" | errado | CRI/CRA não servem para reserva (baixa liquidez e risco de crédito) |

### Resumo da Trilha 1

Erros: 1.3 e 1.8 (Copom 21 dias, e 45 no motor), 1.4 (overclaim FGC), 1.6 (resgate em 60 dias), 1.11 (reserva com CRI).
Imprecisões que viram fato: FGC completo, IOF, isenção só para PF, VNA, IPCA urbano. Taxas do texto não batem com o catálogo (T3).

---

## Trilha 2: Renda Variável

### 2.1 O que é uma ação

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Comprar ação é virar sócio, não emprestar | correto | |
| "Dono de uma parte proporcional do que ela vale **e do que ela lucra**" | impreciso | O direito é ao lucro **distribuído** (dividendos) e a voto (ON); o lucro retido valoriza a empresa. Dividendo obrigatório em [fato:dividendo-obrigatorio] |
| Retorno = valorização + dividendos, sem vencimento | correto | |
| "VALR3" sem aviso | plataforma | Empresa fictícia |

### 2.2 IPO

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| IPO é a primeira venda ao público, mercado primário | correto | |
| "A empresa emite ações novas e capitaliza o caixa" | impreciso | A oferta pode ser primária (caixa da empresa), secundária (dinheiro dos sócios vendedores) ou mista; sem fonte primária lida, dizer "pode" |
| Negociação posterior é mercado secundário, nada vai ao caixa | correto | |
| Resolução CVM 160 como norma de ofertas | não verificado | Não citar número de norma |
| "Mercado ao vivo desta plataforma" | plataforma | |

### 2.3 Nomenclatura de tickers

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| 4 letras do emissor + número; 3 ON, 4 PN | correto | [fato:b3-ticker-sufixos] |
| Final 11: fundos, ETFs e units | correto | [fato:b3-ticker-sufixos]; exemplo SANB11 não verificado, não citar |
| "BNDD4 sem voto, com prioridade em dividendos e no capital" | impreciso | Lei 6.404, art. 17: as preferências **podem** ser prioridade em dividendo fixo/mínimo e no reembolso de capital; "sem voto" é comum, não universal [fato:acoes-preferenciais-lei-6404] |
| Pergunta pede para adivinhar ON/PN antes da regra | impreciso | Ensinar a regra antes de perguntar |
| "Esta plataforma não tem unit" | plataforma | |

### 2.4 Lendo notícias de mercado

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Notícia setorial não pesa igual para todas as empresas | correto | |
| "Mudança na Selic afeta o mercado inteiro" | impreciso | Afeta setores de formas diferentes (2.8) |
| `centralConcept` "(TCC cap. 2.3.3)" (na 2.5) e "feed", "painel de notícias" | plataforma | Sair |
| "O preço já embute expectativas" | omissão | Princípio central da leitura de notícia; sem fonte primária (conceito de mercado) |
| Fato Relevante e Comunicado ao Mercado como fontes oficiais | não verificado | Não citar norma; ITR/DFP: [fato:cvm-itr-dfp-prazos] |

### 2.5 Oferta e demanda

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Livro de ofertas: compra do preço mais alto ao mais baixo, venda do mais baixo ao mais alto | correto | Prioridade preço-tempo (conceito do mercado; fonte primária da B3 não lida) |
| Mais compra que venda empurra o preço para cima | correto | |
| Negócio no preço da ordem passiva | correto | |
| "Motor de pareamento", "desta plataforma" | plataforma | |
| Spread, liquidez, ordem a mercado e limitada | omissão | Conceitos ausentes; entram na lição nova RC.4.2 |
| `centralConcept` com "TCC cap. 2.3.3" | errado | RC.1.4 |

### 2.6.1 Lendo um balanço

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Os seis números são Receita, EBIT, Lucro, PL, Dívida e Caixa | correto | |
| "PL: o que a empresa vale, descontadas as dívidas" | impreciso | É valor **contábil**, não valor de mercado; a própria revelação corrige |
| "EBIT costuma ser maior que o lucro líquido" (gabarito "Maior") | impreciso | Em geral sim; com muita receita financeira ou crédito fiscal pode inverter. Perguntar "em geral" |
| "Relatório a cada ciclo" gerado pelo motor | plataforma | No Brasil: ITR trimestral e DFP anual na CVM [fato:cvm-itr-dfp-prazos] |
| Painel "calculado ao vivo" dos seis números | errado (app) | T10: o painel mostra 9 indicadores |

### 2.6.2 Margens de rentabilidade

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Margem EBIT = EBIT ÷ Receita; Líquida = Lucro ÷ Receita | correto | |
| Líquida "costuma ser menor" que EBIT | impreciso | Mesma ressalva da 2.6.1 |
| Pergunta repete a 2.6.1 | impreciso | Redundância |
| Margem só compara dentro do setor | omissão | |

### 2.6.3 Retorno sobre patrimônio (ROE)

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| ROE = Lucro Líquido ÷ Patrimônio Líquido | correto | |
| "ROE alto é sinal de boa gestão do capital" | impreciso | Pode vir de alavancagem ou PL pequeno; comparar dentro do setor. Banco e mineradora não se comparam |
| Gabarito VALR3 (mesmo lucro, menos PL) | correto | Aritmética, quase tautológica |

### 2.6.4 Indicadores de preço (P/L e P/VP)

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| LPA = Lucro ÷ nº de ações; P/L = Preço ÷ LPA; VPA e P/VP análogos | correto | |
| Preço triplica com LPA igual: P/L triplica | correto | |
| "Ação fica mais cara" por esse critério | impreciso | P/L baixo não é sinônimo de barato; prejuízo torna P/L sem sentido; valor de mercado não foi definido |

### 2.6.5 Endividamento

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Dívida Líquida = Dívida Bruta − Caixa, pode ser negativa | correto | |
| Dívida Líquida/EBIT = anos para quitar | impreciso | Aproximação: ignora impostos, investimento e juros |
| "Pesa ainda mais num banco (BNDD4)" | errado | Em banco, captação é a matéria-prima do negócio; dívida líquida/EBIT não se aplica. Sem fonte primária lida sobre indicadores bancários; basta **tirar** a frase |
| "(spec 3.2.2)" | errado | Referência proibida |
| Mercado brasileiro usa Dívida Líquida/EBITDA | não verificado | Não citar faixas |

### 2.6.6 Dividend Yield

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| DY = dividendos por ação dos últimos 12 meses ÷ preço | correto | Preço dobra, DY cai pela metade |
| "Dividendos (ou proventos)" | impreciso | Proventos incluem JCP, com IR de 17,5% [fato:jcp-aliquota] |
| Sem menção a imposto | desatualizado | Desde 2026, retenção de 10% acima de R$ 50 mil/mês por pagadora [fato:dividendos-retencao-lei-15270] |
| "Último dos 9 indicadores do currículo", "tela de Detalhe do Ativo" | plataforma | |
| Ordem: DY antes de dividendos (2.7) | impreciso | Pré-requisito invertido |

### 2.7 Dividendos e data ex

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Ciclo de relatório "a cada 14 dias simulados" | errado | T2: 91 dias no motor |
| "Data ex é o dia em que se registra quem tem direito" | errado | Esse dia é a **data com** (último dia com direito); a data ex é o dia seguinte, em que o papel negocia sem o direito [fato:b3-liquidacao-acoes] |
| Gabarito: vender um dia após a data ex mantém o direito | correto (efeito) | Quem tinha o papel na data com recebe; a justificativa do texto está errada |
| "Comprar depois da data ex não dá direito" | correto | |
| Defasagem de 5 dias simulados | plataforma | [T2]; no Brasil a data de pagamento é definida pela empresa |
| "Credita direto no saldo; vale para ações e FIIs" | impreciso | Sem IR é a regra abaixo de R$ 50 mil por mês [fato:dividendos-retencao-lei-15270]; JCP paga 17,5% [fato:jcp-aliquota]; FII é mensal, 30 dias no motor, e tem regra própria [fato:fii-isencao-rendimentos] |
| Liquidação das ações | omissão | D+2 [fato:b3-liquidacao-acoes] |

### 2.8 Setores e ciclicidade

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| "A Selic entra na simulação dos fundamentos" | plataforma | |
| Banco "Sofisticado" sente mais a alta de Selic | plataforma | Regra dos coeficientes do motor, não do Brasil; banco pode ganhar com spread (sem fonte primária lida: não afirmar o contrário). Deixar claro que é regra da plataforma |
| "O mesmo perfil que você viu na Trilha 1" | errado | O perfil Conservador/Sofisticado não aparece antes da 2.8 |
| "Cíclico" e "defensivo" sem definição | impreciso | Falha de pré-requisito (RC.1.2) |
| Diversificar entre setores reduz risco | correto | |

### 2.9 ETFs

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Gabarito "menos": queda de uma parte de peso 40% não derruba o fundo na mesma proporção | correto | Impacto = peso × queda (40% × 20% = 8%) |
| "Banco Nordeste Digital 35%, outras 25%" | errado | T4: banco 20%, FIIs 25% e 15% |
| "Replicado por amostragem representativa do índice de referência" | plataforma | O seed usa o nome "Ibovespa" como índice de uma cesta de 4 ativos fictícios com 2 FIIs |
| NAV, ágio, deságio, participante autorizado | correto (conceito) | Mecanismo de criação e resgate; fonte primária da B3 não lida, tratar como conceito |
| "O fundo recebe dividendos e **distribui** aos cotistas" | impreciso | O BOVA11 **reinveste** (site da gestora); alguns ETFs distribuem. Dizer "pode reinvestir ou distribuir" |
| Taxa de administração "pequena" | impreciso | BOVA11: 0,10% a.a. (site da gestora, 2026-10-04); dar ordem de grandeza com data |
| Omissão: IR do ETF | omissão | 15%, sem isenção de R$ 20 mil [fato:etf-ir] |
| "Ágio/deságio" ao lado do glossário de prefixado | impreciso | Mesmo termo, dois sentidos |

### 2.10 FIIs

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| FII investe em imóveis ou recebíveis e distribui o resultado | correto | |
| "Distribui como **dividendo**" | impreciso | Termo de FII é rendimento/provento |
| Vacância só faz sentido para FII de tijolo | correto | TJLO11 vacância 5,2% bate com o seed |
| Omissão: distribuição mínima | omissão | 95% do lucro em regime de caixa, semestral [fato:fii-distribuicao-minima]; mensal é prática |
| Omissão: IR | omissão | Rendimento isento para pessoa física sob 100 cotistas e <10% das cotas [fato:fii-isencao-rendimentos]; ganho na venda não aberto em texto |
| Omissão: P/VP | omissão | Principal indicador do FII; entra na reescrita |
| "Já que o resultado dele vem..." | errado (redação) | Frase quebrada |
| `unlocksDescription` "O resto do patrimônio com onde crescer" | errado (redação) | Reescrever |

### Resumo da Trilha 2

Erros: 2.7 (14 dias, data ex), 2.9 (peso do banco, distribuição), 2.6.5 (banco), 2.8 ("mesmo perfil da Trilha 1").
Fatos que faltam: JCP 17,5%, retenção de 10%, FII (95% e isenção), ETF 15%, ITR/DFP, D+2.

---

## Trilha 3: Estratégia e Tributação

### 3.1 Diversificação

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Concentrado perde mais num choque específico | correto | |
| "Reduz o risco específico" | impreciso | Falta nomear o risco que sobra (de mercado), senão parece que diversificar elimina perda |
| "Esta trilha fecha o arco... última lição" | plataforma | Meta-texto |
| Caso real (Americanas) | não verificado | Sem fonte primária lida: não citar |

### 3.2 Perfil de risco

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Quem precisa do dinheiro em meses deve preferir o perfil Conservador | correto | |
| "Conservador/Sofisticado" como perfil de risco | plataforma | No Brasil o perfil (suitability) é do **investidor**, não do ativo; sem a norma da CVM lida, **não citar** número de resolução |
| "Sofisticado" | impreciso | Não é termo de perfil de investidor |
| Rating AA e A | plataforma | Escala fictícia |
| "Risco e retorno são uma troca" | impreciso | Mais risco não garante mais retorno |

### 3.3 Comparando produtos na prática

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| 365 dias: CDB R$ 10.907,50 e LCI R$ 10.900,00 | correto | 11% × (1 − 17,5%) = 9,075%; LCI 9% |
| 180 dias: CDB R$ 10.409,30 e LCI R$ 10.434,15 | correto | Recalculado com 365 dias corridos |
| "CDB 110% do CDI" e "LCI 90%" viram 11% e 9% | impreciso | Pressupõe CDI de 10% a.a., não dito; o mercado usa 252 dias úteis |
| "Em 180 dias a alíquota **sobe** pra 22,5%" | impreciso | 22,5% vale **até** 180 dias; é a menor permanência, não uma subida |
| LCI resgatada com 180 dias | impreciso | Prazo mínimo de LCI é 6 meses (~180 dias) na emissão primária [fato:lci-lca-prazo-minimo]; no limite |
| Omissões | omissão | IOF [fato:iof-renda-fixa-30-dias], FGC e liquidez |

### 3.4 Desafio final da trilha

| Afirmação | Veredito | Evidência e correção |
|---|---|---|
| Selic sobe, Tesouro Selic passa a render mais | correto | |
| "BNDD4 sente mais o efeito nos fundamentos" | plataforma | Regra do motor (ver 2.8), não do Brasil |
| "Testada contra um evento **real**" (`unlocksDescription`) e "choque especulativo do evento" | errado | O evento é simulado |
| "Mundo aberto liberado, sandbox e ao vivo" | plataforma | |
| "A parte em Tesouro Selic ganha quando a sofisticada sofre" | impreciso | Sugere proteção perfeita; correlação não é garantia |

---

## Itens sem fonte primária lida e decisão

| Item | Decisão |
|---|---|
| Horário e regras do Copom (BCB só abre com JavaScript) | Fato com `trecho-de-busca`; reabrir no navegador na RC.5.3 |
| IR de ETF (IN RFB 1.585), alíquotas de 15%/20% de ações | `trecho-de-busca`; reabrir antes de citar artigo |
| Ticker/sufixos e liquidação D+2 (glossário B3) | `trecho-de-busca`; dizer "em geral" e não afirmar prazo exato |
| ITR 45 dias e DFP 3 meses (CVM Res. 80) | `trecho-de-busca`; citar só se a lição precisar do número |
| VNA e IPCA (Tesouro, IBGE) | `trecho-de-busca`; não afirmar regra em deflação |
| LCA prazo mínimo (6 meses) | O consolidado aberto só mostra o prazo original; **não afirmar** o valor da LCA |
| Resolução CVM 160, CVM 30 (suitability), Fato Relevante, rating "br" | **Não citar**; se a lição precisar, abrir a fonte antes |
| Dívida Líquida/EBITDA, covenants, caso Americanas, vencimento do LFT2029, SANB11 | **Cortar** das lições |
| Comportamento de bancos com Selic alta | **Não afirmar** em nenhum sentido; manter só como regra da plataforma |

## Checklist de entrada por tarefa da Fase 5

- RC.5.1 (0.1 a 0.5): corrigir 0.1 ("de verdade"), 0.2 ("todo investimento real"), 0.5 ("sempre atrás", regra fixa), tirar "nesta plataforma" da 0.4.
- RC.5.2/5.3/5.4 (1.1 a 1.6): híbrida na 1.1; pergunta do PU na 1.2; Copom real (8/ano, meta 3% ±1,5) na 1.3; FGC completo na 1.4; IOF e PF na 1.5; prazo mínimo de LCI na 1.6.
- RC.5.5 (1.6/1.7): rótulo "bruto"; "Ver resultado" por widget.
- RC.5.6/5.7 (1.8 a 1.11): taxa de mercado ≠ Selic (1.8); IPCA urbano (1.9); composição (1+IPCA)(1+taxa) e VNA (1.10); risco nos devedores e CRI fora da reserva (1.11).
- RC.5.9 a RC.5.13 (Trilha 2): data com x data ex, 91 dias, JCP 17,5%, retenção (2.7); peso do banco e reinvestimento (2.9); banco fora de Dívida Líquida/EBIT (2.6.5); rendimento, 95%, isenção (2.10).
- RC.5.8 (Trilha 3): rótulo "plataforma" em 3.2 e 3.4; "alíquota até 180 dias" e CDI=10% explícitos na 3.3.
- Toda tarefa: nenhum número regulatório sem `[fato:id]`; nenhum item da tabela "sem fonte" vira texto sem passar por fonte aberta.
