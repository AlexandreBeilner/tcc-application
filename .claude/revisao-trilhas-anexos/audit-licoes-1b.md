# Auditoria das lições 1.7 a 1.11 (Trilha 1, Renda Fixa)

Escopo: backend/src/db/seedLessons.ts (linhas 510-698), renderização em frontend/src/pages/Lesson/index.tsx, glossário em frontend/src/features/lessons/glossary/index.ts. Somente leitura. Data de referência: 2026-10-03.

## 0. Infraestrutura atual (o que as lições podem usar hoje)

- Cada lição tem 4 passos fixos: Cenário, Micro-decisão, Revelação, Desbloqueio. Texto é fatiado em cartões por `\n\n`; cartão com prefixo `[revelar] ` fica atrás do botão "Ver resultado" (CardBody).
- Widgets embutidos hoje: só `growth_calculator` (GrowthCalculatorForm) e `fixed_income_comparison` (FixedIncomeComparisonForm: valor, dias, 2 produtos, IR via motor). O seletor é um `if` por `microDecisionType` em Lesson/index.tsx (linhas ~245-246). Revelação só embute `EquityIndicatorsPanel` (live_indicator) e `IndicatorSummaryCards` (live_macro_indicator: números simulados).
- Nenhum widget novo é possível sem: novo valor no enum `microDecisionType` (backend domain + migration/schema) OU um mecanismo genérico `[widget:nome]` no markup do cartão (recomendado: estender `parseLessonMarkup`, como `{{termo}}` e `{{ref:X.Y}}`, para `{{widget:gangorra}}`). Cada widget novo em `components/organisms/<Nome>/` (atomic design, CLAUDE.md), responsivo nos 3 breakpoints.
- Glossário: só 6 termos (FGC, marcação a mercado, deságio, taxa bruta equivalente, EBIT, Dividend Yield). Faltam: valor de face/nominal, título público, Selic, Copom, CDI, indexador, pré/pós-fixado, VNA, IPCA, inflação, dia útil/252, vencimento, securitizadora, recebível, rating, liquidez, risco de crédito, alíquota, rendimento real/nominal, curva de juros.
- Todas as 5 lições são `microDecisionType: 'reflection'` (1.9 é `live_macro_indicator`), com UMA pergunta de 2-3 opções e checkbox/botão; errar não bloqueia? (ver seção 7: o servidor devolve veredito e a lição avança mesmo errando. Requisito do autor: errar não avança, tentativas ilimitadas, hoje NÃO atendido em nenhuma das 5).

## 1. Problemas transversais (valem para as 5 lições)

1. Texto sobre a plataforma no lugar do mundo real. Menções encontradas (todas devem ser reescritas para "como é no real; como é na plataforma; por quê"):
   - 1.8 cenário: "o Copom (simulado nesta plataforma a cada 21 dias reais) subiu a taxa..."; revelação: "ativo de prática (Sandbox) disponível no Mercado".
   - 1.9 cenário: "Nesta plataforma, o IPCA mensal simulado varia pouco em torno de uma meta, mês a mês, sem depender do valor do mês anterior"; revelação: "alimenta duas coisas nesta plataforma... Selic simulada... VNA", "Veja abaixo o IPCA mensal e o acumulado em 12 meses simulados até agora" (os números mostrados são simulados, não o IPCA real do IBGE).
   - 1.10 cenário: "corrigido mês a mês pelo IPCA simulado"; prompt: "inflação simulada nesta plataforma".
   - 1.7/1.11: nomes fictícios tratados como produtos (LTN2027, NTNB2035, "CRI Securitizadora X 2028") sem dizer que são fictícios/equivalentes a títulos reais; taxas 11,75%, 6,00%, 11,00%, 10,50% são da plataforma, não do mercado de hoje (ver seção de fatos).
   - Nenhuma das 5 lições cita "TCC" ou "spec". A menção proibida mais próxima está FORA do escopo mas é vizinha e visível: 1.2 revelação linha 342 ("a spec do TCC (cap. 3) o trata como porto seguro"); 0.2 `centralConcept` "(TCC cap. 2.1.1)" (linha 145, não renderizado em tela hoje, mas está no banco/API); 2.x linha 854 centralConcept "(TCC cap. 2.3.3)" e linha 1056 "(spec 3.2.2)" visível na revelação de uma lição de Trilha 2. Varrer com `grep -n "TCC\|spec " seedLessons.ts`.
   - Comentários de código com "spec/TCC" são aceitáveis (não visíveis).
2. Referências cruzadas a lições por número ("lição 1.3", "lição 0.4", "lição 0.2") sem link; `{{ref:X.Y}}` existe (tarefa C.2) e não é usado nas lições 1.7-1.11. Trocar por `{{ref:1.3}}` etc.
3. Valores fictícios sem rótulo: o aluno de verdade pode achar que 11,75% é a taxa do Tesouro hoje. Selic real hoje (set/2026): 13,75% a.a. após corte de 0,25 p.p. em 16/09/2026; IPCA 12m 4,72% (fonte: notícias do Copom/Focus de set/2026 listadas na seção 8). Proposta: cada lição abre com faixa "Como é no Brasil hoje" (dado real, com data e fonte) e só então "Na plataforma" (rotulado, com o porquê da diferença: dados sintéticos, prazo comprimido, etc.).
4. Falta de contas interativas: nenhuma das lições tem calculadora. Todas pedem à aluna aceitar números pré-calculados (800,76 etc.).

## 2. Grafo de pré-requisitos (conceitos introduzidos e usados)

Onde cada termo é de fato introduzido na trilha (ordem atual por sortOrder):

| Termo | Introduzido em | Usado antes? |
|---|---|---|
| inflação, poder de compra | 0.3 (definição implícita, sem citar IBGE/IPCA) | ok |
| IPCA | citado em 0.4 (sem definir), definido de verdade só na 1.9 | 1.3 já usa "IPCA acumulado vs meta" 6 lições antes de 1.9 definir; 1.8 não usa |
| rendimento real/nominal, Fisher | 0.4 | ok (1.10 depende) |
| Selic | 0.5/1.2 (1.2 diz "taxa Selic" sem definir; 1.3 explica formação) | 1.7 depende só implicitamente |
| Copom | 1.3 | 1.8 usa; ok mas ver "21 dias simulados" |
| CDI | 1.4 (definição de uma linha) | LCI/CDB em 1.6 ok |
| FGC | 1.4 (glossário popover) | 1.11 reusa; faltam teto global e conglomerado |
| IR regressivo | 1.5 | 1.7-1.11 não retomam; 1.11 diz "isentos" |
| LCI/LCA, taxa bruta equivalente | 1.6 | 1.11 reusa |
| valor de face / valor nominal | NUNCA definido antes da 1.7 ("promete pagar R$1.000,00" é a primeira aparição) | 1.7 |
| deságio | 1.7 (definido inline no cenário); glossário | 1.8 usa via popover |
| dia útil / base 252 | 1.7 (fórmula "DU/252" sem explicar) | 1.7 |
| marcação a mercado | citada em 1.2 (revelação) via popover ANTES de existir lição; "definida" em 1.8 | 1.2 usa 6 lições antes |
| VNA | 1.9 menciona, 1.10 define de passagem | 1.9 usa antes da 1.10 |
| securitizadora, recebível, rating | 1.11 (securitizadora/recebível definidos inline; rating "classificação de risco" sem explicar escala) | - |
| indexador pós/pré-fixado | 1.1 revelação | ok |

Grafo proposto (A -> B = A antes de B):
- 0.3 -> 0.4 -> 1.9' (IPCA) -> 1.10 (IPCA+)
- 1.2 (Selic) -> 1.3 (Copom) -> 1.8 (MtM)
- 1.7 (prefixado/PU) -> 1.8 (MtM) -> 1.10 (IPCA+ também marca a mercado)
- 1.5 (IR) + 1.6 (LCI/taxa bruta equivalente) -> 1.11 (CRI/CRA isentos)
- 1.4 (FGC) -> 1.11 (sem FGC)
Reordenação sugerida: mover o IPCA (atual 1.9) para antes da 1.3 (ou logo depois da 0.4), porque 1.3 já exige IPCA vs meta. Ordem: ... 1.2, IPCA (novo 1.3), Copom/Selic (1.4), ..., 1.7 Prefixado, 1.8 MtM, 1.9 IPCA+, 1.10 CRI/CRA. Atenção: renumeração exige `stableKey` imutável (já tratado pela M.6), mas `{{ref:}}` e unlocksKeys/`sortOrder` precisam ser conferidos; alternativa menos invasiva: manter o `code`, trocar só `sortOrder`.

## 3. Fatos do Brasil real (com fonte) usados na auditoria

- Tesouro Prefixado = LTN (valor de face R$1.000 no vencimento, sem cupom); Tesouro Prefixado com Juros Semestrais = NTN-F (cupons); Tesouro IPCA+ = NTN-B Principal; Tesouro IPCA+ com Juros Semestrais = NTN-B. A lição só fala dos sem cupom e nunca diz que existem os com cupom. Fonte: Tesouro Direto / material de mercado (seção 8).
- Preço da LTN = 1000 / (1+taxa)^(DU/252), DU = dias úteis. Conferido: 1000/1,1175² = 800,76 (correto).
- Custódia B3: 0,20% a.a. sobre o valor dos títulos (Tesouro Selic isento até R$10 mil, regra não citada na lição). A lição 1.7 omite custos: o ganho "R$199,24 exatamente a sua rentabilidade" é BRUTO de IR (22,5%-15%) e de custódia. Erro de simplificação: "exatamente a sua rentabilidade contratada" só vale antes de IR e taxa da B3; e também ignora IOF (títulos com menos de 30 dias; regressivo).
- IR de renda fixa: 22,5% (até 180 dias), 20% (181-360), 17,5% (361-720), 15% (acima de 720). Correto na 1.5. Isenções: Lei 11.033/2004 para LCI, LCA, CRI, CRA (pessoa física).
- Isenção LCI/LCA/CRI/CRA mantida em 2026: a MP 1.303/2025, que propunha 5% de IR, caducou em out/2025; texto da lição "isentos" está correto. Vale citar a ameaça (a isenção é lei ordinária e pode mudar) para dar profundidade.
- FGC: R$250.000 por CPF ou CNPJ e por instituição ou CONGLOMERADO financeiro; limite global de R$1.000.000 por CPF em janela móvel de 4 anos quando há liquidação de mais de uma instituição associada; a contagem de 4 anos começa na data da liquidação/intervenção. Lição 1.4 e 1.11 só dizem "250k por CPF e por instituição" (impreciso: conglomerado, e omite o teto global). CRI/CRA, debêntures, ações, fundos, Tesouro: sem FGC. Tesouro: garantia soberana (risco da União), não FGC.
- IPCA: IBGE, famílias com renda de 1 a 40 salários mínimos, áreas urbanas das regiões do SNIPC (hoje 16 áreas); pesos da POF 2017-2018; divulgação mensal entre os dias 10 e 15; IPCA-15 é prévia. A lição 1.9 diz "cesta representativa do consumo das famílias brasileiras" (genérico/impreciso: é urbano, faixa de renda).
- Meta de inflação: sistema de meta contínua de 3,00% com tolerância de 1,5 p.p. (descumprida se 6 meses consecutivos fora do intervalo). A lição não cita o valor da meta real (3%). Selic atual 13,75% (corte de 0,25 p.p. em 16/09/2026), IPCA 12m 4,72%, Focus 2026 ~4,9%, próxima reunião 3-4/nov/2026 (fontes na seção 8). Copom real: 8 reuniões por ano (~45 dias), não "21 dias".
- VNA do Tesouro IPCA+: base 15/07/2000 = R$1.000,00; atualizado pela variação do IPCA, com defasagem (usa IPCA divulgado, mais projeção pro rata na data); a lição diz "corrigido mês a mês pelo IPCA" sem defasagem nem pro rata.
- Marcação a mercado afeta TODOS os prefixados e o IPCA+ (também a NTN-B oscila pela taxa real). Só o Tesouro Selic tem marcação desprezível.

## 4. Lição 1.7, Tesouro Prefixado

**Resumo atual.** Cenário: LTN2027 paga R$1.000 no vencimento, compra com deságio, taxa 11,75% a.a. travada. Micro-decisão: com 504 DU até o vencimento, preço acima ou abaixo de R$1.000? (correta: abaixo). Revelação: fórmula PU = VN/(1+i)^(DU/252) = R$800,76; diferença R$199,24 é a rentabilidade; avisa que MtM virá na próxima lição. Desbloqueia LTN2027.

**Erros/imprecisões.**
- "R$199,24 é exatamente a sua rentabilidade contratada": bruta, sem IR (15% a 22,5% sobre os R$199,24 => líquido ~R$169,35 a 15%), sem custódia B3 (0,20% a.a.). Mostrar bruto vs líquido.
- "Tesouro Prefixado 2027" sem dizer que o nome real é LTN (e que existe NTN-F com cupom). O aluno que abrir o app do Tesouro Direto verá "Tesouro Prefixado 2027" e "Tesouro Prefixado com Juros Semestrais 2027/2033", e a lição não prepara.
- "A taxa travada" é verdade só se segurar até o vencimento (a própria 1.8 diz); aqui soa absoluto. "Diferente do Tesouro Selic, essa taxa fica travada: se a Selic subir ou cair depois da compra, o valor recebido no vencimento não muda" correto mas deveria dizer que isso é uma aposta (custo de oportunidade: se a Selic subir, você ficou com taxa menor).
- Fórmula com "DU/252" sem explicar 252 (dias úteis por ano, convenção do mercado) nem por que não 365; 504 DU = 2 anos é conveniência didática (real: ~2 anos = ~504 DU, ok).
- Vencimento: LTN real vence em 1º de janeiro; "Prefixado 2027" = 01/01/2027. Hoje (out/2026) faltam ~60 DU, não 504. A pergunta hipotética "supondo que faltem 504 DU" conflita com um título que vence em 3 meses de data real; esclarecer ("imagine que estamos em 2025").
- Taxa 11,75% é pouco representativa do real hoje (Selic 13,75%; prefixados longos pagam taxas na faixa próxima da curva DI); marcar como número didático. Verificar taxa vigente no site do Tesouro Direto antes de citar.
- Mínimo: Tesouro Direto permite comprar fração (a partir de ~R$30); plataforma usa R$30 (seed). Não mencionado.

**Plataforma/simulação/TCC.** Sem "plataforma" explícito. Ticker "LTN2027" e a lógica de "compra real no Mercado" no desbloqueio. Sem TCC/spec.

**Termos usados antes de introduzidos.** valor de face/nominal ("promete pagar R$1.000"), dia útil e base 252, taxa a.a. efetiva, "vencimento", "Selic" (1.2 apenas), deságio (definido na hora, ok). Propor `{{valor de face}}`, `{{dia útil}}` no glossário.

**Lacunas.** (1) Por que o governo vende "com desconto": juros embutidos no preço, não pagos depois. (2) Bruto vs líquido (IR, custódia). (3) Quando prefixado compensa: aposta de que a taxa cairá ou de que a Selic média ficará abaixo da taxa travada; comparar com Selic. (4) LTN vs NTN-F. (5) Liquidez diária com recompra pelo Tesouro (mas ao preço do dia).

**Widget proposto W1.7 "Preço do título" (calculadora + régua).**
- Entradas: taxa contratada (slider 6-18% a.a., passo 0,25), prazo em anos (0,25-10; calcula DU = anos×252) com chips "Tesouro 2027 (3 meses)", "2 anos"; valor investido (R$30-R$100.000).
- Saídas: PU = 1000/(1+i)^(DU/252); deságio R$ e %; quantidade de títulos = valor/PU; bruto no vencimento; IR pela tabela regressiva (alíquota por dias corridos ~ anos×365, reutilizando `useFixedIncomeTaxRateQuery`); custódia B3 0,20% a.a. aproximada; líquido final e rentabilidade líquida a.a.
- Visual: barra horizontal "R$1.000 no vencimento" com um bloco colorido de preço pago (ex.: 800,76) e a fatia do deságio hachurada; abaixo, linha do tempo (hoje -> vencimento) com a seta crescendo de 800,76 até 1.000 em curva composta (reutilizar `GrowthChart`), tracejado = projeção (convenção sólido/tracejado de identidade-visual-padroes).
- Comportamento: arrastar o prazo muda o preço em tempo real; aluno vê que prazo maior => preço menor com a mesma taxa (prepara a gangorra da 1.8).
- Substitui o "Ver resultado" nos cartões de 800,76: o aluno digita/arrasta e o resultado aparece; botão só como fallback de acessibilidade.

**Perguntas intermediárias propostas (tentativa ilimitada, feedback imediato; errar não avança).**
1. (antes da fórmula) "Um título promete R$1.000 em 2 anos. Você paga hoje: (a) R$1.000 (b) menos (c) mais?" -> menos; explicar por quê.
2. (após widget) "Com a mesma taxa, dobrando o prazo, o preço de hoje: sobe/desce/igual?" -> desce.
3. Numérica: "Taxa 10%, 1 ano (252 DU). Qual o preço?" (R$909,09), campo numérico com tolerância ±0,05.
4. "O R$199,24 que aparece na tela é líquido ou bruto?" -> bruto; arrastar "IR" e "custódia" para subtrair.
5. V/F: "O Tesouro Prefixado garante que você nunca ganhará menos que a Selic." -> falso.
6. Cenário: "Selic vai a 16%. Você tinha comprado a 11,75%. Seu valor no vencimento: muda?" -> não (mas custo de oportunidade).
7. Reconhecimento: dado um print do app do Tesouro ("Tesouro Prefixado 2029 11,60%"), identificar taxa e preço unitário.

**Esforço:** M (widget novo W1.7 + reescrita de texto + glossário + 7 perguntas; a mecânica de "múltiplas perguntas por lição" é G e comum a todas, ver seção 7).

## 5. Lição 1.8, Marcação a mercado

**Resumo atual.** Cenário: comprou LTN2027 a 11,75%, imprevisto força resgate; "o Copom (simulado... a cada 21 dias reais) subiu a taxa de mercado pra 14%"; preço de venda muda. Pergunta: preço de revenda acima ou abaixo (correta: abaixo). Revelação: preço recalculado diariamente com a taxa de mercado; taxa maior => preço menor; vice-versa; segurar até o vencimento paga a contratada; sugere simular no Sandbox.

**Erros/imprecisões.**
- Conflação Copom x taxa de mercado: a taxa do título prefixado é a taxa de mercado do vértice (derivada da curva de juros futuros/DI e das expectativas), não a Selic nem sobe "quando o Copom sobe". Frequentemente os prefixados já subiram ANTES da reunião (preço antecipa expectativa). O texto "o Copom subiu a taxa de juros de mercado pra 14%" mistura Selic e taxa de mercado do título. Corrigir: "a taxa que o mercado exige para esse prazo passou de 11,75% para 14%", com causas reais: expectativa de Selic, inflação, risco fiscal, prêmio de risco.
- "21 dias reais" é detalhe da plataforma; real são 8 reuniões/ano.
- "o preço de qualquer prefixado é recalculado todo dia útil": correto para o Tesouro Direto (preço e taxa de compra/venda publicados diariamente; resgate antecipado possível em dias úteis ao preço do dia, com spread entre compra e venda e janela de ~5 dias de indisponibilidade em instabilidade). Faltam: não há multa, perda só é realizada se vender; no extrato do Tesouro Direto o valor "bruto atual" já aparece marcado.
- Omite que a sensibilidade depende do PRAZO (duration): a mesma alta de 2,25 p.p. derruba bem mais um título de 10 anos que um de 1 ano. É a lacuna mais importante.
- Omite que ESSA marcação também atinge o Tesouro IPCA+ (taxa real) e que Tesouro Selic é quase imune; liga com 1.2.
- "ganho extraordinário": nomear como "ganho de marcação a mercado", e dizer que não é a regra (o contratado é o piso de previsibilidade só no vencimento).
- Custo de oportunidade e IR do resgate antecipado (alíquota por dias corridos) ausentes.
- Sem números: nada mostra quanto o preço cai. Cálculo: 2 anos restantes, 11,75% => R$800,76; a 14% => 1000/1,14² = R$769,47 (queda de 3,9%); a 10% => R$826,45 (alta de 3,2%). Com 5 anos (1.260 DU): 11,75% => R$575,77 (1000/1,1175^5); 14% => R$519,37 (queda de 9,8%). (Cálculos feitos na auditoria; checar com a função do motor.)

**Plataforma/simulação/TCC.** "Copom (simulado nesta plataforma a cada 21 dias reais)"; "ativo de prática (Sandbox) disponível no Mercado". Remover ou rotular ("na plataforma o Copom simulado se reúne a cada 21 dias reais para que você veja o efeito sem esperar 45 dias; no Brasil são 8 reuniões por ano").

**Termos antes de introduzidos.** "taxa de mercado" (vs taxa contratada), "Copom" (1.3 ok), "resgate antecipado", "prazo/duration". "Marcação a mercado" já usada em 1.2 como popover; mover a definição.

**Lacunas.** duration/sensibilidade ao prazo; efeito nos três indexadores; vender vs segurar; por que o preço cai (quem compra hoje pega taxa maior: ninguém paga o mesmo preço por título que rende menos); resgate antecipado no Tesouro Direto na prática (preço de recompra, IR, custódia).

**Widget principal W1.8 "Gangorra da marcação a mercado" (ideia do autor).**
- Estrutura: gangorra horizontal com apoio central. Lado esquerdo = "Taxa de mercado" (peso/seta sobe-desce). Lado direito = "Preço do seu título" (sobe-desce em sentido oposto). Arrastar a taxa de 6% a 20% (passo 0,25; marca "sua taxa contratada" 11,75% como ponto de equilíbrio; gangorra nivelada quando taxa de mercado = contratada).
- Entradas: slider taxa de mercado; slider prazo restante (0,25 a 10 anos) que altera o "comprimento do braço" (prazo maior = braço mais longo => alavanca maior = mais sensibilidade, metáfora de duration); seletor de título (Prefixado / IPCA+ real / Selic) para mostrar que no Selic a gangorra quase não se mexe.
- Saídas ao vivo: preço atual = 1000/(1+t)^(DU/252); variação % vs preço de compra (verde/vermelho); "se vender hoje" valor bruto e líquido (IR conforme dias corridos desde a compra); "se segurar até o vencimento": R$1.000 (linha tracejada fixa); rentabilidade anualizada realizada se vender hoje.
- Comportamento: sliders com ressalto (spring) na gangorra; um traço "ponto de equilíbrio" em cada lado; mini-gráfico (gráfico preço x taxa, curva convexa) com o ponto percorrendo; botões de cenários "Copom surpreende (+1,0 p.p.)", "Banco Central corta", "Choque fiscal (+2,5 p.p.)" que animam a gangorra; reduce-motion: trocar animação por troca instantânea.
- Missão embutida: "Leve o preço abaixo de R$780 só mexendo na taxa" (valida pergunta dentro do widget; cada interação libera a próxima pergunta).
- Componente: `MarkToMarketSeesaw` em organisms/, SVG puro, tokens da identidade visual, versão mobile com gangorra vertical-compacta e tabela de 3 linhas.

**Widget complementar W1.8b "Mesma alta, prazos diferentes":** barras lado a lado para prazos 1, 2, 5, 10 anos, queda % do preço quando a taxa sobe +2,25 p.p.; entrada = tamanho do choque; mostra que a barra do prazo longo é muito maior.

**Perguntas intermediárias propostas.**
1. Na gangorra: "Taxa de mercado sobe. O preço do seu título: sobe/desce?" (ação: arrastar e ver, depois responder).
2. "Você precisa vender depois de uma ALTA de juros. Quem sai prejudicado: quem vende antes do vencimento ou quem segura até o fim?"
3. "Dois títulos mesma taxa, prazos 1 e 10 anos. Juros sobem 2 p.p.: qual cai mais?" -> o de 10.
4. Numérica: preço a 14% com 2 anos (769,47) com tolerância.
5. "Se você segurar até o vencimento, a oscilação do preço no meio do caminho muda quanto você recebe?" -> não.
6. "Qual título é menos afetado: Prefixado 2035, IPCA+ 2045, Selic 2029?" -> Selic.
7. V/F: "O Copom elevar a Selic hoje garante que prefixados vão cair hoje" -> falso (expectativa já estava no preço).

**Esforço:** G (gangorra interativa + animação + cenários + a11y + testes), a peça mais valiosa do lote.

## 6. Lição 1.9, O que é o IPCA

**Resumo atual.** Cenário: IPCA é calculado pelo IBGE, cesta representativa do consumo; referência do BC para a Selic (lição 1.3); na plataforma o IPCA simulado varia em torno da meta sem memória. Pergunta: acumulado 12m é soma ou produto composto (correta: produto, `live_macro_indicator`). Revelação: fórmula do acumulado, alimenta Selic simulada e VNA; mostra IPCA mensal e acumulado simulados (IndicatorSummaryCards).

**Erros/imprecisões.**
- "Cesta de bens e serviços representativa do consumo das famílias brasileiras": impreciso. IPCA mede famílias com renda de 1 a 40 salários mínimos em áreas urbanas de 16 regiões metropolitanas/municípios (SNIPC); pesos da POF 2017-18; 9 grupos; coleta de preços mensal. O INPC (1 a 5 SM) é o outro índice e é o que reajusta o salário mínimo (parte da regra), e o IGP-M (FGV) é usado em aluguéis. Nenhum desses é comentado; "o termômetro oficial" ok.
- "referência que o Banco Central usa pra decidir a Selic": é o IPCA 12m e, principalmente, as EXPECTATIVAS (Boletim Focus) para o horizonte relevante (~18 meses), não só o IPCA passado; a lição 1.3 simulada olha só o acumulado. Hoje (set/2026): IPCA 12m 4,72% contra meta 3% com teto de tolerância 4,5%, Selic cortada para 13,75% mesmo acima da meta (mostra que o BC reage a expectativa/medidas subjacentes).
- Meta real não é citada: 3,00% (contínua, tolerância +-1,5 p.p.). A lição fala em "meta" sem número.
- "Sem depender do valor do mês anterior" e "varia pouco em torno de uma meta": atributo da simulação, não do real (IPCA real tem sazonalidade e persistência/choques: 2021-22 chegou a ~12% a.a.). Rótulo e porquê ("para ensinar sem exigir 20 anos de histórico").
- A fórmula do acumulado está correta; faltou exemplo numérico (0,5% por 12 meses: soma 6,00% vs composto 6,17%); mensal 0,83% ~ 10,5% a.a.
- O resultado mostrado no fim são números SIMULADOS, enquanto o aluno acabou de ouvir que IPCA é do IBGE; confunde. Mostrar a série REAL (BCB SGS 433 / IBGE SIDRA tabela 1737) estática no front, e depois (opcional) a simulada rotulada.

**Plataforma/simulação/TCC.** 4 menções (cenário e revelação) listadas na seção 1. Sem TCC/spec.

**Termos antes de introduzidos.** "meta de inflação" (primeira vez aqui, mas já usada em 1.3), "acumulado em 12 meses", "IBGE" (nunca apresentado), "VNA" (aparece na revelação sem definição), "Valor Nominal Atualizado", "Selic simulada". Inflação e poder de compra vêm da 0.3 (ok). Reordenar: IPCA antes da 1.3.

**Lacunas.** Como se mede (cesta, pesos, coleta); IPCA vs INPC vs IGP-M vs IPCA-15; meta de inflação e o que acontece ao estourar (carta aberta do presidente do BC); inflação de alimentos vs serviços; por que o IPCA importa para quem investe: define o piso de rentabilidade real (ligação direta com 0.4 e 1.10); IPCA é divulgado com ~10-15 dias de atraso, e o VNA usa esse número (liga com 1.10).

**Widgets propostos.**
- W1.9a "Acumulado de 12 meses": 12 campos/sliders de IPCA mensal (preenchidos por padrão com série real recente, editáveis) e dois resultados lado a lado, Soma vs Composto, com barra da diferença; botão "usar série real de 2021", "de 2024". Fórmula: acum = Π(1+m_i) − 1. Saída também: IPCA anualizado a partir de 1 mês (m=0,5% => 6,17%). Efeito: a pergunta de soma/produto vira descoberta.
- W1.9b "Gráfico da inflação real": linha do IPCA 12m dos últimos 10 anos (dados estáticos do BCB SGS 433 empacotados), com faixa da meta (3% +-1,5) sombreada e marcação das épocas fora da faixa; passar o mouse mostra mês e valor; ao lado, "Quanto R$100 de 2016 valem hoje" (aplicação do índice, ligação com 0.3).
- W1.9c "Cesta do IPCA": rosca/treemap dos 9 grupos com pesos (Alimentação e bebidas, Habitação, Artigos de residência, Vestuário, Transportes, Saúde e cuidados pessoais, Despesas pessoais, Educação, Comunicação) e tooltip com a fatia de cada; pesos devem ser conferidos no IBGE (POF 2017-18) antes de publicar. Entrada: "sua cesta" (3 sliders de gastos) para comparar com a cesta média (inflação pessoal); saída: inflação da sua cesta com os mesmos reajustes por grupo.
- Rotular o painel simulado final: "Na plataforma, para acelerar o aprendizado, o IPCA é simulado assim...".

**Perguntas intermediárias propostas.**
1. "Quem calcula o IPCA?" (IBGE / Banco Central / Tesouro / FGV) -> IBGE. (Evita confundir com IGP-M/FGV.)
2. "Inflação de 1% em janeiro e 1% em fevereiro: o acumulado é 2%, mais que 2% ou menos?" -> 2,01%.
3. Numérica: acumulado de 12 meses de 0,5% ao mês (6,17%), tolerância 0,02.
4. "Meta 3%, IPCA 12m 4,72%: está dentro da tolerância?" -> não (limite 4,5%), mas por pouco.
5. "O que o Banco Central tende a fazer com a Selic quando a inflação e as expectativas estão acima da meta?" -> manter/elevar (liga com 1.3).
6. "Seu salário subiu 4% e o IPCA foi 4,72%: poder de compra" -> caiu (ligação 0.4).
7. "IPCA e INPC são o mesmo índice?" -> não, faixas de renda diferentes.

**Esforço:** M (W1.9a e W1.9b são P-M cada; W1.9c M; dados reais estáticos empacotados no front exigem fonte e data de atualização).

## 7. Lição 1.10, Tesouro IPCA+

**Resumo atual.** Cenário: NTNB2035 promete 6,00% a.a. acima da inflação; VNA corrigido mês a mês pelo IPCA simulado, e a taxa de 6% incide sobre o VNA já atualizado. Pergunta: se a inflação rodar mais alta que o previsto, o valor final aumenta/diminui/igual (correta: aumenta). Revelação: contraste com prefixado (R$1.000 fixo); rendimento real garantido por contrato (liga com 0.4).

**Erros/imprecisões.**
- "Rendimento real garantido ... em vez de precisar ser calculado": só vale se segurar até o vencimento. Antes disso há marcação a mercado pela taxa real: se a taxa real de mercado subir de 6% para 8%, o preço cai (a gangorra da 1.8 também vale aqui). A lição não menciona; criar risco de achar que é "seguro como poupança". Fato histórico útil: em 2021-22 e na crise de 2015 e 2024-25 Tesouro IPCA+ longo teve quedas relevantes de preço marcado.
- "6,00% acima da inflação": é (1+IPCA)*(1+6%) − 1, composto, não IPCA + 6 somado. Ex.: IPCA 5%: retorno nominal 11,30% (e não 11,00%). Mostrar fórmula (Fisher, liga com 0.4).
- IR incide sobre TODO o ganho nominal (inclusive a parte que só recompõe a inflação): rendimento real LÍQUIDO é menor que o 6% anunciado (tabela regressiva 15% a partir de 720 dias). Omitido. Exemplo: 5 anos, IPCA 5%, taxa 6%: bruto 11,30% a.a.; IR 15% sobre o ganho; líquido ~9,9% a.a.; real líquido ~4,6%.
- Nome: o real chama "Tesouro IPCA+" (NTN-B Principal) e "Tesouro IPCA+ com Juros Semestrais" (NTN-B), vencimentos típicos 2029, 2035, 2045 (principal) e 2032, 2040, 2055 (semestrais). "NTNB2035" ok. Hoje (set/2026) taxas IPCA+ 2035 estão próximas de 7,5%-8% (a verificar no site do Tesouro Direto; não consegui confirmar o número do dia); 6,00% é abaixo do mercado real; rotular como número didático.
- VNA: base 15/07/2000 = R$1.000,00; atualização mensal pelo IPCA com defasagem (IPCA divulgado pelo IBGE entre os dias 10 e 15; o VNA do dia 15 usa o IPCA do mês anterior e pro rata para dias intermediários, com projeção). A lição diz "mês a mês pelo IPCA" sem defasagem. Hoje o VNA está na casa de R$4.700-5.000 (a conferir: verificar no site do Tesouro/ANBIMA), por isso o "valor de face R$1.000" não existe nesse título: o aluno que abrir o app não verá R$1.000.
- "O que quer que ela seja no período": existe risco de deflação (VNA não cai? na regra do Tesouro, IPCA negativo reduz o VNA; nunca fica sem proteção no principal no vencimento? Na verdade o principal é protegido: no vencimento paga VNA, mas a regra permite VNA cair em deflação. Confirmar com o regulamento do Tesouro Direto antes de afirmar.)
- Questão: "inflação mais alta que o previsto => valor final aumenta": correto. Mas faltou diferença entre "o que foi previsto" (inflação implícita da curva) e o que ocorre; o risco do prefixado está justamente em perder para a inflação, e o do IPCA+ em a taxa real subir no meio do caminho.

**Plataforma/simulação/TCC.** "IPCA simulado" (cenário e pergunta), "nesta plataforma". Sem TCC/spec.

**Termos antes de introduzidos.** VNA (só tangencial na 1.9), "rendimento real" (0.4, ok), "taxa real", "indexador/IPCA+", "Tesouro IPCA+ com Juros Semestrais", "cupom". "Valor Nominal" aqui diferente de "valor de face" da 1.7 (confunde: aqui o nominal é atualizado).

**Lacunas.** composição matemática (Fisher); IR sobre ganho nominal; marcação a mercado de IPCA+ e prazo (títulos longos oscilam muito); NTN-B Principal vs com juros semestrais; inflação implícita (breakeven) = prefixado vs IPCA+: "qual vale mais?"; quando IPCA+ vence prefixado; Tesouro Renda+/Educa+ derivados do IPCA+ (mencionar?).

**Widgets propostos.**
- W1.10a "Simulador IPCA+ ano a ano": entradas = valor investido, taxa real (slider 3-9%), prazo (1-20 anos), cenário de IPCA (slider constante 2-10% ou 3 presets "calmo 3%", "meta 4,5%", "crise 8%"); saída = tabela e gráfico em barras empilhadas por ano: principal, correção do IPCA, juros reais; linha tracejada = valor que o prefixado (taxa digitável) pagaria; saída final bruta e líquida de IR (15%), e rendimento real líquido (Fisher). Resposta à pergunta da lição é descobrir ao mexer no IPCA.
- W1.10b "Qual vale mais: prefixado ou IPCA+?" (inflação implícita): entradas = taxa prefixada (ex.: 12,5%) e taxa real IPCA+ (ex.: 7,5%); saída = inflação de equilíbrio = (1+pre)/(1+real) − 1 (11,63% vs 7,5% => 4,65%); slider "inflação que eu espero" mostra quem ganha, com régua verde/vermelha. Ligação com Focus/meta.
- W1.10c reuso da gangorra (W1.8) com seletor "IPCA+": mostra o preço marcado do IPCA+ ao variar a taxa real.

**Perguntas intermediárias propostas.**
1. "IPCA 5%, taxa 6%: o retorno nominal é 11%, mais ou menos?" -> 11,30% (mais).
2. "O VNA do Tesouro IPCA+ é corrigido por qual índice?" (IPCA / Selic / CDI / IGP-M).
3. "Você vende o IPCA+ 2045 antes do vencimento após as taxas reais subirem: pode ter prejuízo?" -> sim.
4. Numérica: valor final de R$1.000 em 2 anos, IPCA 4% a.a., 6% real => 1000*1,04²*1,06² = R$1.215,2 (calcular e aceitar tolerância).
5. "IR incide sobre: só os juros reais/todo o ganho nominal" -> todo o ganho.
6. "Com IPCA esperado de 3% e prefixado pagando 13% vs IPCA+ pagando 7%: o que escolhe quem acha que a inflação será maior que 5,6%?" (IPCA+), com o widget.
7. V/F: "Tesouro IPCA+ é livre de risco em qualquer data de resgate." -> falso.

**Esforço:** G (W1.10a+b são M cada; precisam validar regra de deflação e VNA com Tesouro).

## 8. Lição 1.11, CRI e CRA

**Resumo atual.** Cenário: CRI/CRA emitidos por securitizadoras, que compram recebíveis e os transformam em título negociável; CRI2028 11,00% rating AA, CRA2028 10,50% rating A. Pergunta: CRI/CRA têm FGC? (correta: não). Revelação: não têm; pagam mais; trazem rating; isentos de IR como LCI/LCA; libera compra de CRI/CRA e encerra a Trilha 1.

**Erros/imprecisões.**
- "CDB, LCI e LCA têm garantia do FGC até R$250.000,00" sem "por CPF, por instituição/conglomerado, e teto global de R$1 milhão em 4 anos" (1.4 e esta lição). O autor pediu visualização: ver W1.11a.
- "CRI e CRA... risco de crédito recai inteiramente sobre a capacidade de pagamento da securitizadora": impreciso e arriscado. A securitizadora é veículo (companhia securitizadora), normalmente com regime fiduciário e patrimônio separado: o risco real está nos DEVEDORES dos recebíveis (construtora, produtor rural, locatário, financiado) e nas garantias (alienação fiduciária de imóvel, aval, fiança, cessão fiduciária) e no agente fiduciário que representa os investidores. Falência da securitizadora normalmente não leva os recebíveis junto (patrimônio separado). Reescrever: "o risco é o de quem deve o dinheiro que paga o CRI".
- "pagam mais (acima da maioria dos CDBs)": generalização; o prêmio de CRI/CRA tem parte dele devido à ISENÇÃO (taxa bruta equivalente, lição 1.6) e à iliquidez e ao risco de crédito. Faltou calcular: CRI 11% isento a 15% IR equivale a 11/0,85 = 12,94% bruto; a 22,5%: 14,19%. Boa prática: comparar sempre pela taxa bruta equivalente, reuso do widget da 1.6.
- Faltam fatos do mercado real: (a) Normalmente indexados a IPCA+ ou %CDI, raro prefixado; (b) liquidez baixa: negociados no mercado secundário (B3 etc.) com spread; vencimentos de 2-15 anos e mínimo costuma ser alto (R$1.000 até 300k+, muitas ofertas só para investidor qualificado/profissional, regras da CVM 160/ICVM 600/Resolução CVM 60); (c) rating (S&P/Fitch/Moody's/Austin) em escala AAA..D, com símbolo "br" na escala nacional; "AA" e "A" sem contexto; (d) a isenção é por lei ordinária (Lei 11.033/2004 art. 3º I) e foi ameaçada pela MP 1.303/2025 (5% de IR), que caducou em out/2025, mantendo a isenção em 2026; vale contar para o aluno entender risco regulatório; (e) isenção é só para pessoa física; (f) existe ainda risco de inadimplência real (casos: CRIs da Gafisa/Brazil Realty?, não citar sem fonte; usar exemplo genérico "CRIs de empresas em recuperação judicial").
- Texto de desbloqueio: "Sua reserva de emergência com todas as opções na mesa (... CRI/CRA ...)": CRI/CRA NÃO são adequados para reserva de emergência (baixa liquidez, risco). Contradição pedagógica séria; trocar por "carteira de renda fixa para metas além da reserva".
- "Completar esta lição libera ... conclui a Trilha 1": linguagem de plataforma (ok se a lição for sobre a plataforma, mas o conteúdo desbloqueado precisa ser contextualizado).

**Plataforma/simulação/TCC.** Rótulos fictícios ("Securitizadora X", CRI2028). Mensagem final fala em liberar compra e abrir a Trilha 2 (meta-texto do produto). Sem TCC/spec.

**Termos antes de introduzidos.** securitizadora e recebível (definidos de forma curta no cenário), "classificação de risco/rating" (escala não explicada), "risco de crédito" (usado desde 1.2, definido só implicitamente), "FGC" (1.4), "isento" (1.6), "liquidez". Adicionar `{{rating}}`, `{{securitizadora}}`, `{{recebível}}`, `{{risco de crédito}}`, `{{liquidez}}`.

**Lacunas.** estrutura da securitização (fluxo: devedor -> securitizadora -> investidor); patrimônio separado e agente fiduciário; garantias; rating e escala; liquidez; indexadores; risco regulatório (isenção); como avaliar (taxa de retorno líquida x risco; concentração); diversificar além do FGC (Limite 250k vs 1MM).

**Widgets propostos.**
- W1.11a "Guarda-chuva do FGC" (visual pedido pelo autor): entradas = lista editável de aplicações (instituição, grupo/conglomerado selecionável, tipo [CDB/LCI/LCA/Tesouro/CRI/CRA/ações], valor); alternador "Cenário: um banco quebra" ou "vários bancos quebram em até 4 anos" (linha do tempo de 48 meses com marcadores de liquidação). Saídas = por instituição: barra com trecho coberto (verde, limite R$250k por CPF/conglomerado), trecho descoberto (vermelho hachurado); total coberto, total exposto; limite global de R$1.000.000 em janela móvel de 4 anos mostrado como "caixa" com contador que enche; aplicações sem FGC (Tesouro, CRI/CRA) em cinza "fora do FGC (outra proteção/risco)". Regras codificadas: min(valor por conglomerado, 250.000) somados sobre as instituições liquidadas na janela, limitado a 1.000.000; valor inclui principal e juros até a liquidação; também permitem dois bancos do mesmo conglomerado contarem como um (campo "mesmo conglomerado?").
  - Exemplo para quiz: R$600k em um banco (cobre 250k, descobre 350k); R$300k em 4 bancos diferentes, os 4 quebram em 4 anos => cobre 4x250k = 1M máx.
  - Apresentar também em 1.4; aqui como revisão com CRI/CRA fora do guarda-chuva.
- W1.11b "Fluxo da securitização" (diagrama animado em passos): construtora/produtor -> recebíveis (aluguéis/parcelas/duplicatas) -> securitizadora (cria CRI/CRA, regime fiduciário, patrimônio separado) -> investidores compram; fluxo do dinheiro e dos pagamentos de volta; botão "o devedor atrasa": mostra quem absorve (investidor, depois garantias, agente fiduciário). Clique em cada caixa abre `{{glossário}}`.
- W1.11c "Retorno ajustado: CRI vs CDB vs Tesouro" (reuso do FixedIncomeComparisonForm com 3 produtos): pré-preencher CRI 11% isento e CDB 12% tributado, prazo ajustável; coluna extra "risco" com rating, FGC (sim/não), liquidez (diária/baixa); entrega a tabela do trade-off retorno x risco x liquidez; pergunta: "quanto a mais precisa pagar o CRI para compensar a perda do FGC?".
- W1.11d "Escala de rating": régua AAA...D com divisão grau de investimento/especulativo e ponto onde AA e A caem.

**Perguntas intermediárias propostas.**
1. "O CRI é emitido por: banco / securitizadora / Tesouro / empresa listada" -> securitizadora.
2. "Em uma securitização, quem deve o dinheiro que paga o investidor?" -> os devedores dos recebíveis.
3. (W1.11a) "Você tem R$400k num único banco que quebra. Quanto o FGC cobre?" -> R$250k.
4. (W1.11a) "R$250k em cada um de 5 bancos diferentes, todos liquidados em 4 anos: cobertura total?" -> R$1M (limite global).
5. "Bancos do mesmo conglomerado contam como: uma só instituição / separadas" -> uma só.
6. Numérica: taxa bruta equivalente de CRI isento 11% a 15% de IR -> 12,94% (tolerância 0,02).
7. "CRI de R$1.000 por 8 anos; você precisa do dinheiro em 3 meses. O que pode acontecer?" -> vender no secundário com deságio ou não achar comprador (liquidez).
8. "CRI pode ser a reserva de emergência?" -> não, liquidez/risco.
9. V/F: "A isenção de IR de CRI/CRA está garantida para sempre." -> falso (Lei ordinária; MP 1.303 tentou revogar em 2025).

**Esforço:** G (W1.11a FGC é M-G pela regra de janela de 4 anos; W1.11b M; W1.11c P reuso; W1.11d P).

## 9. Requisito 7 (perguntas intermediárias e tentativas ilimitadas): estado atual e proposta

Estado atual: cada lição tem 1 única pergunta no passo Micro-decisão (`microDecisionOptions` + `microDecisionCorrectOption`), enviada via `selectedOption` em `advanceLesson`; o servidor devolve `microDecisionCorrect` e o front mostra badge "Você acertou" / "Quase. A resposta certa era: X" na Revelação, mas a lição AVANÇA mesmo errando (Lesson/index.tsx `handleAdvance`; `canAdvanceMicroDecision` só exige ter escolhido). O endpoint registra a resposta definitiva; isso entra em conflito com "errar não avança, tentativas ilimitadas".
Proposta transversal (afeta todas as lições; fora do escopo de conteúdo, mas necessária para as perguntas acima):
1. Novo tipo de cartão "pergunta" no markup (ex.: `[pergunta:id]` ou bloco estruturado em JSON `checkpoints[]` por lição) com campos: tipo (`single`, `numeric`, `truefalse`, `widget_goal`), enunciado, opções, resposta correta/tolerância, dica progressiva (1ª dica ao 1º erro), explicação.
2. Estados: erro mostra feedback imediato e dica, NÃO avança, permite nova tentativa ilimitada, sem punição de XP; acerto libera "Continuar". Opcional: registrar `attempts` para analytics; XP só pela 1ª tentativa certa ou reduzido.
3. Mudança de dados: coluna `checkpoints jsonb` em `lessons` (migration Drizzle; atenção ao journal `when`), `POST /lessons/:id/checkpoints/:cid/answer` retornando `{correct, hint?}` com validação Zod; a lição só avança quando todos os checkpoints obrigatórios foram acertados (decisão de produto: aprovar em `pontos-em-aberto-decisao-produto.md`).
4. Distribuição alvo por lição: 4-7 checkpoints entre cartões (1 a cada 1-2 cartões de conteúdo), ao menos 1 interativo no widget.
Esforço da infraestrutura: G (compartilhado entre todas as lições).

## 10. Resumo de esforço

| Lição | Reescrita de texto | Widgets | Perguntas | Esforço total |
|---|---|---|---|---|
| 1.7 | P | W1.7 calculadora de preço/deságio (M) | 7 | M |
| 1.8 | M | W1.8 gangorra (G) + W1.8b (P) | 7 | G |
| 1.9 | M | W1.9a (P), W1.9b (M, dados reais), W1.9c (M) | 7 | M-G |
| 1.10 | M | W1.10a (M), W1.10b (M), reuso W1.8 | 7 | G |
| 1.11 | M | W1.11a FGC (M-G), W1.11b fluxo (M), W1.11c reuso (P), W1.11d (P) | 9 | G |
| Infra transversal | - | mecanismo `{{widget:X}}` + checkpoints + glossário (+15 termos) | - | G |

Prioridade sugerida: (1) infra de checkpoints/tentativas e `{{widget}}`; (2) W1.8 gangorra (maior ganho, e W1.7 é pré-requisito visual dela); (3) W1.11a FGC (pedido explícito do autor, serve 1.4); (4) calculadora taxa bruta equivalente (também citada pelo autor; fica na 1.6, reusada em 1.11); (5) 1.9a/b e 1.10a.

## 11. Fontes web consultadas

- FGC (R$250 mil por CPF/CNPJ e por instituição ou conglomerado; R$1 milhão em janela de 4 anos; contagem a partir da liquidação): InfoMoney "Novas regras para o FGC" https://www.infomoney.com.br/onde-investir/novas-regras-para-o-fgc-veja-o-que-muda-na-garantia-dos-seus-investimentos/ ; comunicado anual FGC https://www.bocombbm.com.br/bbm-content./uploads/2025/05/comunicado-fgc-2025.pdf . Conferir texto oficial em fgc.org.br e Resolução CMN do estatuto do FGC antes de publicar.
- Isenção LCI/LCA/CRI/CRA em 2026 e caducidade da MP 1.303: https://www.adrianofreire.com.br/blog/lci-lca-isento-ir-pessoa-fisica-2026 ; https://www.nordinvestimentos.com.br/blog/mp-1303-tributacao-lci-lca-cri-cra-fii-fiagro/ . Confirmar na Receita Federal / Lei 11.033/2004, art. 3º.
- VNA (base 15/07/2000 = R$1.000; IPCA entre os dias 10 e 15): Tesouro Direto "Cálculo da rentabilidade do Tesouro IPCA" https://www.tesourodireto.com.br/data/files/7B/67/BC/64/53B2D610393A62D6894D49A8/Calculo_Rentabilidade_TesouroIPCA.pdf ; https://www.suno.com.br/artigos/vna
- IPCA (famílias de 1 a 40 SM, áreas urbanas do SNIPC, POF 2017-2018): IBGE https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9258-indice-nacional-de-precos-ao-consumidor/ ; https://ftp.ibge.gov.br/Precos_Indices_de_Precos_ao_Consumidor/INPC/Fasciculo_Indicadores_IBGE/ipca-inpc_202512caderno.pdf (número de áreas = 16 não confirmado nas páginas lidas; confirmar na nota técnica IBGE).
- Tesouro Direto (LTN, NTN-F, NTN-B, custódia B3 0,20%, IR regressivo, resgate antecipado): https://borainvestir.b3.com.br/glossario/tesouro-direto/ ; https://www.mercadopago.com.br/blog/tesouro-direto-como-funciona-investimento-seguro ; confirmar no site oficial tesourodireto.com.br.
- Selic 13,75% (16/09/2026), IPCA 12m 4,72%, próxima reunião 3-4/nov/2026, Focus: https://atlaspublico.com.br/bcb/noticias/copom-reduz-selic-para-13-75pct-ao-ano-em-decisao-unanime-87748 ; https://www.jornaldocomercio.com/economia/2026/09/1262567-selic-no-fim-de-2026-continua-em-1375-pela-quinta-semana-seguida-aponta-focus.html . Verificar no bcb.gov.br (a fonte secundária atlaspublico não é oficial).
- Itens NÃO verificados por fonte web nesta auditoria (marcar para conferência): meta de inflação 3% +-1,5 e regra de 6 meses (conhecimento do CMN, Res. 4.582/2017 e decreto 2025); pesos dos grupos do IPCA; taxa IPCA+ 2035 de mercado hoje; valor atual do VNA; regra do VNA em deflação; escala de rating; condições de oferta CVM 160; contagem de áreas do IPCA (16).
- Cálculos conferidos por mim (aritmética): 1000/1,1175² = 800,76; 1000/1,14² = 769,47; 1000/1,1175^5 = 575,77 e 1000/1,14^5 = 519,37 (calcular de novo no motor antes de usar); (1,04²)(1,06²)*1000 = 1.215,2; 11/0,85 = 12,94.
