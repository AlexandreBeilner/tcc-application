# Auditoria das licoes 2.7, 2.8, 2.9, 2.10 (Trilha 2)

Fontes lidas: backend/src/db/seedLessons.ts (linhas 1102-1267; licoes anteriores 2.1-2.6.6 para checar ordem de termos), frontend/src/pages/Lesson/index.tsx, frontend/src/features/lessons/glossary/index.ts, engine/internal/domain/{dividend,fii,fundamentals,catalog,tick,etf}.

Web (validar antes de publicar; so consultei buscas, nao a norma primaria): Lei 15.270/2025 (vigencia 01/2026): retencao de 10% de IRRF sobre lucros/dividendos pagos por uma mesma PJ a uma mesma PF residente acima de R$ 50 mil no mes (ha ainda o IR minimo para altas rendas, > R$ 600 mil/ano); resultados apurados ate 2025 e aprovados ate 31/12/2025 ficam isentos. JCP: 15% retido na fonte, dedutivel para a empresa (MP 1303 que subiria para 17,5% caducou; reconferir). FII: rendimentos mensais isentos de IR para PF se cotas negociadas em bolsa/balcao organizado, fundo com no minimo 100 cotistas e a PF com menos de 10% das cotas; ganho de capital na venda de cotas: 20% sem a isencao dos R$ 20 mil. ETF de renda variavel: 15% sobre o ganho, sem isencao de R$ 20 mil/mes (diferente de acoes), sem come-cotas, DARF pelo investidor.

## Achados transversais (valem para as 4 licoes)

1. Descompasso motor x licao 2.7: o motor usa ciclo de relatorio de **91 dias** (fundamentals.DefaultReportFrequencyDays = 91, migration 000033, tarefa S.2). A 2.7 diz "a cada 14 dias simulados" (valor antigo, pre-S.2). **Erro de dado interno.**
2. Motor, acoes: dividendo = 50% do lucro liquido do trimestre (DefaultEquityPayoutRatio), gerado **no mesmo dia para todas as empresas** (ciclo global unico, spec 3.3.1; companies.report_frequency_days existe por empresa mas e 91 para todas). Data ex = dia do relatorio; pagamento = ex + 5 dias simulados (DefaultPaymentLagDays), igual para todos. Sem data com separada de data ex. Sem JCP. Sem IR sobre dividendo (credito bruto no saldo). Sem pagamento de frequencia variavel (anual/semestral). PN paga 10% a mais por acao que ON (piso do art. 17 da Lei 6.404, companies.pn_dividend_premium_pct) - isso bate com o real, mas nenhuma licao mostra.
3. Motor, FIIs: provento **mensal** (FIIPayoutIntervalDays = 30, tarefa S.2), por cota = VP-base x taxa por segmento (alvo de DY 13,2% a.a.), todos os FIIs no mesmo dia (IsReportDay(dayIndex, 30)), ex + 5 dias, sem IR (coerente com a isencao real da PF, mas isso nao e dito). O dente de serra de preco pos data-ex existe (FIIPriceEffectPct) e e fiel ao real. **A 2.7 diz que o ciclo e o de relatorio (14d) e "vale tanto para acoes quanto FIIs" como se fossem identicos: errado para o motor (30d vs 91d) e para o real.**
4. Motor, ETF: o fundo recebe os proventos das empresas da cesta e distribui no dia de relatorio (91d) aos cotistas (etfDividends), com taxa de administracao acumulada diaria e quitada no relatorio. Real: a maioria dos ETFs de acoes brasileiros (BOVA11, IVVB11 etc.) **nao distribui**, reinveste os dividendos na cota (ha excecoes, ex.: DIVO11, que distribui). A 2.9 afirma "distribui aos cotistas" sem ressalva.
5. Datas: o real tem **data com** (ultimo dia para comprar e ter direito), **data ex** (primeiro dia sem direito, = data com + 1 dia util, a acao desconta o provento), **data de pagamento** (definida pela companhia, dias a semanas depois). No real liquidacao e D+1 (B3, desde 2023), entao quem compra no dia da data com liquida a tempo. A 2.7 funde "data ex" com "dia do relatorio" e define data ex como "o dia em que a plataforma registra quem tem direito": isso descreve a data com/record date, e o gabarito ("vender depois da data ex mantem direito") esta **correto no efeito mas com base errada**: quem vende NO dia da data ex ou depois ja manteve o direito pois comprou ate a data com; quem COMPRA na data ex ou depois nao tem direito. Terminologia do enunciado ("um dia depois da data ex") confunde: a posicao relevante e a do fim do dia da data com.
6. Nenhuma das 4 menciona TCC/spec no texto visivel (grep das linhas 1102-1267: limpo). Mas todas falam em "a plataforma", "simulado", "ciclo de relatorio", "perfil Conservador/Sofisticado" (conceito da plataforma, nao do mercado) e usam ativos ficticios (VALR3, BNDD4, SINT11, TJLO11, PAPL11) sem ancora no mundo real. Fora das 4 licoes mas no mesmo arquivo: linhas 145, 310, 342 citam TCC/spec (para outro auditor).
7. UI/widgets existentes que podem ser reaproveitados: lesson `microDecisionType` suporta `reflection`, `live_indicator`, `live_macro_indicator`, `growth_calculator` (GrowthCalculatorForm), `fixed_income_comparison` (FixedIncomeComparisonForm) (frontend/src/pages/Lesson/index.tsx l.39,247-248). Organismos prontos: DividendHistoryList, EtfCompositionPanel, FiiIndicatorsPanel, EquityIndicatorsPanel, MarketCalendarPanel, QuarterGrid, CalendarDayStrip, PriceChart, DistributionChart, IndicatorSummaryCards, GlossaryTerm. Glossario (glossary/index.ts) tem so 6 termos (FGC, marcacao a mercado, desagio, taxa bruta equivalente, EBIT, Dividend Yield). Conflito: `desagio` no glossario = titulo prefixado; a 2.9 usa "desagio" com sentido de ETF (preco < NAV), sem {{ }}.
8. Em todas, so 1 pergunta, binaria (50% de acerto no chute), e a 2.9 tem 3-4 conceitos densos na revelacao sem verificacao.

---

## 2.7 Dividendos e data ex  (seed l.1102-1137)

**Resumo atual:** cenario VALR3 fecha ciclo "a cada 14 dias simulados", distribui lucro; "a plataforma registra quem tem direito: e a data ex". Pergunta Sim/Nao: vender 1 dia apos a data ex mas antes do pagamento ainda recebe? Revelacao: sim; defasagem fixa de 5 dias simulados; vender depois nao tira direito, comprar depois nao da direito; valor por acao credita direto no saldo e vale para acoes e FIIs.

**Erros/desatualizacoes**
- 14 dias vs motor 91 (achado 1).
- Data ex definida errada (achado 5): falta data com e data de pagamento real; confundir data ex com "dia de relatorio".
- "Defasagem fixa de 5 dias" so existe na plataforma; no real e definida por empresa/aviso aos acionistas.
- "Credita direto no saldo": omite IR. Real: dividendo PF isento ate 2025; **de 2026, retencao de 10% na fonte se > R$ 50 mil/mes da mesma empresa** (Lei 15.270/2025) + IR minimo de altas rendas. JCP (15% na fonte) nem aparece, e e metade da politica de remuneracao das empresas BR.
- "Vale tanto para acoes quanto FIIs" - mistura mecanicas (achado 3).
- Dividend Yield: glossario diz "soma 12 meses / preco" (ok), mas a revelacao chama de "o mesmo que forma o DY", sem explicar payout, nem que dividendo reduz o preco na data ex.

**Menções a plataforma/simulacao:** "plataforma registra", "dias simulados", "ciclo de relatorio", "5 dias simulados". Deve virar: real primeiro; plataforma em caixa "Como e aqui" com o porque (calendario comprimido e unico para todos para o aluno ver varios eventos).

**Termos antes de introduzidos:** "data ex", "dividendo" (2.6.6 usa DY antes; dividendo so definido de fato na 2.7), "provento", "ciclo de relatorio" (introduzido onde? 2.6.x usa relatorio; checar), "Dividend Yield" (ok, 2.6.6). **Nunca introduzidos antes: data com, JCP, payout, "ex-dividendos", "proventos".** Sugerir: definir inline com {{termo}} + entradas de glossario para data com, data ex, data de pagamento, provento, JCP, payout.

**Lacunas:** JCP (o que e, 15% retido, por que empresas usam: deducao de IR/CSLL); dividendo x JCP x bonificacao x subscricao; politica de payout (minimo obrigatorio 25% do lucro liquido ajustado, Lei 6.404 art. 202, se o estatuto for omisso); frequencia real variavel (trimestral, semestral, anual; empresas como Taesa/bancos trimestrais, outras so anual); preco cai pelo valor do provento na data ex (nao e "dinheiro gratis"); dividend trap (DY alto por preco caindo); tributacao 2026 e IR minimo; acoes PN pagam mais (liga com 2.3).

**Proposta de reescrita (real primeiro):**
1. Cena: o aluno detem VALR3. Linha do tempo real: anuncio -> data com -> data ex (D+1 util) -> data de pagamento. Cada marco com 1 frase.
2. Pergunta 1 (multipla escolha): "Voce comprou ontem, ultimo dia com direito (data com). Hoje e data ex. Recebe?" (sim). Pergunta 2: "Comprou na propria data ex?" (nao). Pergunta 3: "O que acontece com o preco da acao na data ex?" (cai ~valor do provento). Pergunta 4: quanto liquido de R$ 1.000 em dividendos de uma empresa em 2026 (R$ 1.000, isento) e de JCP (R$ 850).
3. Caixa "Na plataforma": todas as empresas distribuem no mesmo dia (relatorio trimestral de 91 dias simulados), pagamento 5 dias depois, sem JCP e sem IR. Por que: simplificar o calendario para voce ver varios ciclos em pouco tempo; no real as datas variam por empresa.
4. Se for implementar diversidade de calendario no motor (ponto extra do autor): ver secao final.

**Visuais/widgets**
- Linha do tempo interativa de 4 marcos arrastavel (componente novo `DividendTimeline`): usuario escolhe dia da compra/venda e ve "recebe/nao recebe" (substitui o Sim/Nao). Esforco M.
- Mini-grafico de preco com degrau na data ex (PriceChart reaproveitado, dado ilustrativo). P/M.
- Calculadora "Quanto vou receber liquido?" (novo `DividendNetCalculator`): quantidade, valor por acao, tipo (dividendo/JCP), total mensal da mesma empresa -> bruto, IR retido, liquido, regra aplicada. Elimina a conta fora da tela. M.
- Tabela comparativa dividendo x JCP (tributo, quem paga, base). P.
- Reaproveitar DividendHistoryList e MarketCalendarPanel com o proprio historico de VALR3. P.

**Esforco: G** (reescrita de conteudo + 2 widgets novos + glossario; mais dependencia da decisao de calendario do motor).

---

## 2.8 Setores e ciclicidade  (seed l.1138-1177)

**Resumo atual:** "a Selic entra na simulacao dos fundamentos de toda empresa", compara VALR3 (Mineracao, perfil Conservador) vs BNDD4 (Bancario, perfil Sofisticado) numa alta de Selic; gabarito: BNDD4 sente mais. Revelacao liga a diversificacao.

**Erros factuais / problemas**
- O titulo promete setores e ciclicidade, mas o conteudo nao define cíclico vs defensivo (o termo "cíclico" so aparece na pergunta; `centralConcept` fala "defensivo vs ciclico" mas nada o explica) e usa "perfil Conservador/Sofisticado" (conceito do app) como se fosse categoria de mercado.
- **Factualmente fragil/errado no real:** bancos NAO sao em geral prejudicados por Selic alta - tendem a ganhar spread/margem (NII) numa Selic alta, embora tenham mais inadimplencia e menos credito. Mineradoras (ex. Vale) sao ciclicas por commodity e cambio, nao "estaveis"; e exportam em dolar. Setores mais sensiveis a juros no real: varejo, construcao civil/incorporadoras, imobiliario, empresas alavancadas; defensivos: utilities (energia eletrica, saneamento), alimentos, saude, bancos grandes (parcialmente). O gabarito "banco sente mais" reflete uma regra interna do motor (CoefficientsBySector), nao o mundo real. Verificar fundamentals.CoefficientsBySector e alinhar ou deixar explicito.
- Afirmacao final "numa alta de juros, um portfolio concentrado em ciclicos sofre mais" correta, mas generica.

**Plataforma/simulacao:** "ela tambem entra na simulacao dos fundamentos", "Selic simulada", "reagem de forma diferente", "perfil... da Trilha 1 para renda fixa" (mistura: perfil Conservador/Sofisticado da 1.x e perfil de risco do investidor; "perfil" de empresa na 2.8 e outra coisa). Deve explicar o setor real; depois "na plataforma modelamos 6 setores: Mineracao, Bancario/Financeiro, Varejo, Energia, Tecnologia e ... (catalog.SectorX), com coeficientes de sensibilidade ilustrativos".

**Termos antes de introduzidos:** ciclico, defensivo, alavancado (so aparece aqui), "setor" (lista de 6 setores nunca mostrada antes), "fundamentos" (2.6.x ok), "perfil Sofisticado" (de 2.1/2.3 - verificar se `Sofisticado` aparece antes: grep nao encontrou antes da linha 1100! `Sofisticado` so existe a partir da 2.8, entao "o mesmo perfil que voce viu na Trilha 1" e **falso**, ou a Trilha 1 usa outro nome).

**Lacunas:** definicao de setor (classificacao setorial B3: ~11 setores economicos), ciclicidade (acompanha o ciclo economico) vs defensivo (demanda inelastica), sensibilidade a juros, cambio e commodities (nao so Selic); correlacao entre setores e diversificacao setorial (carteira de 5 acoes do mesmo setor nao diversifica); setores sensiveis a juros no BR (varejo, construcao), beneficiados (bancos, seguradoras, em parte); exemplos reais (PETR4, VALE3 ciclicas por commodity; SBSP3, EQTL3, TAEE11 defensivas; ITUB4 resiliente; MGLU3/CVC sensiveis a credito/juros).

**Perguntas intermediarias (multipla escolha, com feedback imediato):**
1. Classifique 6 setores em ciclico/defensivo (arrastar).
2. "Selic sobe de 10% para 14%: qual setor sofre mais, incorporadoras ou saneamento?"
3. "Por que um banco pode lucrar mais com Selic alta?" (spread).
4. "5 acoes de varejo diversificam bem?" (nao, mesmo setor).

**Visuais/widgets:**
- Mapa setorial 2 eixos (sensibilidade a juros x sensibilidade ao ciclo), cada bolha = setor; clicar abre exemplos. Esforco M (novo componente SVG simples).
- Slider de Selic que move um grafico de barras "impacto relativo por setor" (reaproveita `live_macro_indicator` para trazer a Selic atual da plataforma). M.
- Cards de "defensivo vs ciclico" com icones. P.
- Heatmap de correlacao simplificado. G (opcional).

**Esforco: M/G** (reescrita conceitual + 1 widget + decisao de alinhar coeficientes do motor).

---

## 2.9 ETFs  (seed l.1178-1223)

**Resumo atual:** SINT11 = cesta VALR3 40%, BNDD4 35%, outras 25%; pergunta: se a VALR3 cair forte, o ETF cai na mesma proporcao ou menos? Gabarito: menos. Revelacao: media ponderada; diversificacao; NAV, agio/desagio, participante autorizado (creation/redemption), ETF recebe dividendos e distribui, cobra taxa de administracao; completar libera compra do SINT11.

**Erros/imprecisoes**
- Gabarito "menos" correto, mas a conta nao e feita: queda de X% em ativo de peso 40% derruba o ETF em 0,4X% - dado numerico direto, ideal para calculadora.
- "Replicado por amostragem representativa": termo tecnico nao explicado (real: replicacao fisica total x por amostragem x sintetica).
- "Diversificacao automatica" ok, mas nao diz que 2 empresas + "outras posicoes agregadas" = pouca diversificacao; confunde.
- **Tributacao omitida:** ETF de RV: 15% sobre o lucro na venda, **sem isencao de R$ 20 mil/mes** das acoes, apuracao e DARF mensal pelo investidor (nao ha retencao na fonte), sem come-cotas (diferente de fundos abertos). Isso e obrigatorio para uma licao que ensina a investir no BR. Tambem nao diz que ETFs de renda fixa (IMAB11, B5P211, IRFM11) existem.
- Ticker "11" explicado na 2.3, ok.
- "Participante autorizado... criando cotas" - mecanismo real correto em essencia (creation/redemption com a cesta), mas introduzido sem contexto; a maioria dos investidores nunca interage com isso: dizer que o investidor comum so compra/vende cotas na bolsa.
- Distribuicao de dividendos: ver achado 4 (real: maioria reinveste; ETFs que distribuem sao excecao; BOVA11 reinveste). Taxa de administracao real: BOVA11 0,10% a.a. - dizer ordem de grandeza; "pequena" e vago.
- NAV: "valor da cesta/numero de cotas" ok; real tambem tem iNAV (valor intradiario).
- "Agio/desagio": use sem {{ }}; conflita com glossario de prefixado (achado 7).

**Plataforma:** "cesta sintetica", "Indice Sintetico", "plataforma"/"completar libera compra do SINT11" (gamificacao no meio do conteudo), "participante autorizado" (na plataforma e um bot mecanico). Caixa "Na plataforma": o indice e ficticio, nao ha ETFs reais (BOVA11, IVVB11, SMAL11); o fundo distribui proventos no dia de relatorio (91d) porque esse e o jeito mais simples de o aluno ver o efeito; no real a maioria reinveste.

**Termos antes de introduzidos:** ETF (usado na 2.3 sem definicao propria: so o ticker), NAV, agio, desagio (existe na renda fixa), participante autorizado, amostragem, indice de referencia, constituinte, taxa de administracao, "cesta", "cota", dividendos do fundo. Sugerir ordem: (1) o que e fundo/cota, (2) o que e indice (Ibovespa), (3) ETF = fundo que copia indice e e negociado como acao, (4) taxa, (5) NAV/agio (mover para licao final opcional "para curiosos", ou caixa expansivel), (6) tributacao.

**Lacunas:** indice (Ibovespa: ~80-90 ativos, ponderado por liquidez/valor de mercado flutuante); exemplos reais (BOVA11, SMAL11, IVVB11 que replica o S&P 500 em reais, HASH11 cripto, ETFs de RF); vantagens (custo baixo, liquidez em bolsa, minimo 1 cota ~R$ 100-150), riscos (risco de mercado do indice, tracking error, cambio em IVVB11); comparacao com fundo de investimento ativo (taxa 1-2% + desempenho); tributacao 15% sem isencao de 20k; diferenca vs ETF de dividendos (DIVO11).

**Perguntas intermediarias:**
1. Calculadora: o ETF tem 40% VALR3; se VALR3 cair 20%, quanto cai o ETF? (-8%).
2. "Voce precisa falar com a gestora para comprar cotas de ETF?" (nao, corretora/bolsa).
3. "Qual a diferenca entre comprar BOVA11 e uma acao?" (diversificacao).
4. Tributacao: lucro de R$ 1.000 vendendo ETF de RV (R$ 150 de IR via DARF; acao ate R$ 20k/mes de vendas: isento).
5. Agio/desagio: preco R$ 105, NAV R$ 100, e agio ou desagio?

**Visuais/widgets:**
- Donut/treemap da composicao com sliders de choque: usuario derruba uma acao e ve o efeito no ETF ponderado (EtfCompositionPanel + novo `EtfShockSimulator`). Esforco M.
- Diagrama do mecanismo creation/redemption (setas: AP <-> fundo <-> bolsa) - SVG animado leve. M.
- Barra NAV x preco com faixa de agio/desagio e arbitragem (reaproveitar PriceChart com duas series). M.
- Comparativo de custo: 0,10% x 2% a.a. em 20 anos (GrowthCalculatorForm reaproveitado com taxa). P (reuso).

**Esforco: G**.

---

## 2.10 FIIs  (seed l.1224-1267)

**Resumo atual:** FII tem ticker final 11 como ETF; investe em imoveis (tijolo) ou recebiveis (papel) e distribui resultado. TJLO11 (lajes, vacancia 5,2%) e PAPL11 (recebiveis CDI). Pergunta: vacancia faz sentido para o PAPL11? Nao. Revelacao: papel avaliado por indexador e valor da carteira; ambos compartilham DY; libera compra de FIIs e conclui a Trilha 2.

**Erros/lacunas factuais (centrais para o autor)**
- **Nenhuma mencao a:** distribuicao mensal obrigatoria (FII deve distribuir no minimo **95% do resultado semestral**, apurado em regime de caixa, pela Lei 8.668/93 art. 10 - pagamento mensal e pratica de mercado); **isencao de IR para PF** nos rendimentos (cotas em bolsa/balcao organizado, fundo com >= 100 cotistas, PF com < 10% das cotas; Lei 11.033/2004 art. 3, III e alteracoes); **ganho de capital** na venda de cotas: **20%** sobre o lucro, sem isencao de R$ 20 mil/mes, DARF no mes seguinte; rendimentos de aplicacoes financeiras do caixa do fundo sao tributados; regra nova 2026 pode mudar (Lei 15.270 nao alterou a isencao de FII, ver fonte; conferir MP/PL de 2025/2026 sobre FII/Fiagro).
- Data com/ex dos FIIs: costuma ser perto do fim do mes, com pagamento por volta do dia 10-15 do mes seguinte (varia por fundo; ex.: alguns pagam dia 8, outros dia 15, outros dia 25). Cada gestora define - **a plataforma paga todos no mesmo dia**.
- Tipos: faltam FoF (fundo de fundos), hibridos, desenvolvimento, agro (Fiagro), alem de tijolo/papel. Papel tem CRIs indexados a CDI **ou IPCA** (e high yield/high grade): a licao so cita CDI.
- Indicadores: P/VP (cotar acima/abaixo do valor patrimonial), vacancia fisica x financeira, DY, valor patrimonial por cota, liquidez diaria; a 2.10 so cita vacancia e indexador. P/VP e o indicador mais usado para FII e nao aparece.
- Riscos: vacancia, inadimplencia (papel), juros (FII sofre com Selic alta, ver 2.8), concentracao em um inquilino/imovel (monoativo), liquidez de cotas, alavancagem em CRI.
- "Distribui o resultado como dividendo": o termo correto e **rendimento** ou **provento**; "dividendo" e o termo de acoes. Pequeno, mas importante: ensinar o vocabulario do mercado.
- A frase "FII ... tambem tem ticker terminado em 11, igual ETF (lição 2.3)" referencia por numero; ok com {{ref}}, mas e interna.
- Revelacao tem frase quebrada: "Já que o resultado dele vem do que os devedores pagam..." inicia com "Já que" solto (erro de pontuacao, gramaticalmente fragmento).
- `unlocksDescription` tem texto truncado/estranho: "O resto do patrimonio com onde crescer (ações, ETFs, FIIs)..." (provavel erro de redacao - "com onde").
- Hoje o app mostra DY de FII calculado pela taxa por segmento (13,2% a.a. alvo, achado 027): numeros ilustrativos coerentes com o real (8-15%), mas a licao nao diz que e sintetico.

**Plataforma / motor x licao (ponto extra do autor):** a licao diz DY comum a ambos e que o FII "distribui resultado". O motor paga mensal (30d), **todos os FIIs no mesmo dia**, ex + 5 dias, sem IR (coerente com isencao real de PF, mas nao explicado). A 2.7 diz que o ciclo e o do relatorio. No real: mensal, datas por fundo, IR isento sob condicoes.

**Termos antes de introduzidos:** FII, tijolo, papel, recebiveis, CDI (existe na Trilha 1, ok), vacancia, indexador, "perfil tijolo/papel", "segmento (Lajes Corporativas)", cotista, valor patrimonial, P/VP (nunca), rendimento. FII so e definido aqui, mas 2.6.6 e 2.7 ja o citam ("o produto da lição 2.10"): referencia a frente. Sugerir mover a introducao de FII antes da 2.7 ou tornar a 2.7 so de acoes e levar a parte de FII para a 2.10.

**Perguntas intermediarias:**
1. "FII que tem 100 cotistas e voce com 2% das cotas: seu rendimento e isento?" (sim, se nas condicoes).
2. "Voce vendeu cotas com lucro de R$ 1.000: IR?" (R$ 200).
3. Classifique tijolo/papel/FoF por descricao.
4. "Vacancia sobe de 5% para 20%: o que acontece com o rendimento e com o preco da cota?"
5. "P/VP 0,8 significa?" (negocia 20% abaixo do patrimonio; pode ser oportunidade ou sinal de problema).
6. "Um FII paga R$ 1,00/mes e a cota custa R$ 100: qual o DY anual?" (12%).

**Visuais/widgets:**
- Calendario mensal de proventos (12 meses, barras de R$) de um FII, com marcadores data com / ex / pagamento (QuarterGrid/CalendarDayStrip + novo `FiiMonthlyIncome`). M.
- Calculadora "Renda mensal com FIIs": quanto investir para receber R$ X/mes dado DY e P/VP; mostra IR = 0 (renda) e 20% (ganho de capital). M (reaproveita GrowthCalculatorForm).
- Comparativo tijolo x papel: dois cartoes lado a lado com fluxo (inquilino -> aluguel -> fundo -> cotista; devedor -> CRI -> fundo -> cotista). SVG. M.
- Gauge de vacancia / P/VP com FiiIndicatorsPanel reaproveitado (dados ao vivo de TJLO11 e PAPL11 via `live_indicator`). P.
- Tabela renda variavel: tributacao lado a lado (acao / ETF / FII) - 15%/20% ganho de capital, isencoes, DARF. P (conteudo) - util para encaixar na ponte para a Trilha 3.

**Esforco: G**.

---

## Onde a plataforma diverge do real (lista exata, para caixas "Como e aqui")

| Tema | Real | Motor (engine) | Licao diz |
|---|---|---|---|
| Frequencia acoes | trimestral/semestral/anual, por empresa | trimestral global 91d, mesma data para todas | 2.7: "a cada 14 dias" (errado vs motor) |
| Datas | com, ex (com+1 dia util), pagamento variavel por empresa | data ex = dia do relatorio; pagamento = ex+5 (fixo) | 2.7: data ex = quando a plataforma registra os donos (correto so para motor; confunde com data com) |
| Valor | definido pela diretoria; payout minimo 25% | 50% do lucro liquido do trimestre | nao informado |
| JCP | existe, 15% retido | nao modelado | nao citado |
| IR dividendos | isento ate 2025; 2026: 10% na fonte se > R$ 50 mil/mes por PJ pagadora + IR minimo | nenhum, credito bruto | omitido |
| ON vs PN | PN >= 10% a mais (art. 17) | modelado (premium 10%) | 2.3 cita "prioridade"; nao mostra numero |
| FII frequencia | mensal (>= 95% do resultado semestral), datas por fundo | mensal 30d, mesmo dia para todos | 2.10 nao diz; 2.7 diz que e o mesmo ciclo |
| FII IR | rendimento isento PF sob condicoes; ganho de capital 20% | nenhum IR | omitido |
| ETF distribuicao | maioria reinveste; poucos distribuem | distribui no relatorio (91d) | 2.9 diz que distribui |
| ETF IR | 15% sobre ganho, sem isencao 20k | (verificar se o IR de vendas esta no Go; ha menção a IR em engine segundo memoria do projeto) | omitido |
| Setor x Selic | bancos tendem a se beneficiar do spread | banco e "Sofisticado", sofre mais | 2.8 afirma isso como regra |

## Proposta de estrategia para calendario diverso (ponto extra)

Se o autor quiser que o motor reflita o real: (a) tornar `report_frequency_days`/mes de pagamento por empresa (coluna ja existe em `companies`; hoje forcada a 91) com offsets (ex.: empresas A pagam em jan/abr/jul/out, B em fev/mai/ago/nov, C semestral, D anual); (b) adicionar `payment_frequency` e `payment_offset_days` por ativo (FII: dia do mes 5-25 por fundo; mensal), (c) separar data com / data ex / data de pagamento em `dividend_events`; (d) pagamento por tipo (dividendo/JCP) com IRRF 15% do JCP e regra de 10% > R$ 50 mil para dividendos; FII isento. Isso toca tick.dividendRecordsForCycle, o relatorio de fundamentos (hoje atrelado ao mesmo IsReportDay) e o `ListPendingDividendPayments`. Alternativa barata: manter o calendario simples e deixar a caixa "Como e aqui" explicando; o autor ja sinalizou que quer a divergencia explicada. Esforco do motor: G; da licao: independente.

## Sequencia sugerida e esforco consolidado
1. Corrigir na hora (P): 14 dias -> 91 (ou remover o numero), frase quebrada da 2.10, texto de `unlocksDescription`, `Sofisticado` inexistente antes, "desagio" glossario vs ETF.
2. Reescrever 2.7 e 2.10 em conjunto (G): vocabulario (provento/rendimento/dividendo/JCP), datas, tributacao, calculadora de liquido.
3. 2.9 (G): tributacao + calculadora de choque + mecanismo AP opcional.
4. 2.8 (M): conceito de setor/ciclicidade + alinhar coeficientes do motor ou assumir "na plataforma".
5. Glossario: +data com, data ex, data de pagamento, provento, JCP, payout, ETF, NAV, agio, FII, P/VP, vacancia, cíclico, defensivo, tracking error.
