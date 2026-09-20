# Calibração de fundamentos por setor — pesquisa (tarefa K.1)

Pesquisa pedida pela tarefa `K.1` de `.claude/backlog-motor-mercado-realista.md` (proposta
`.claude/proposta-motor-mercado-realista.md`, seção 7): levantamento de margens/alavancagem
médias reais e públicas pros 6 setores fixos da spec 3.3.2 (Mineração, Agronegócio,
Bancário/Financeiro, Varejo, Energia, Tecnologia), pra substituir os coeficientes hoje
"ilustrativos" e genéricos de `fundamentals.go` (margem líquida 10%, margem EBIT 18%,
patrimônio = 1.2×receita, dívida = 0.4×patrimônio, caixa = 15%×receita, sensibilidade à Selic
0.02/0.06 por `risk_class`).

Esta tarefa é só pesquisa — a aplicação em código é a `K.2`, ainda não feita.

## Método

Cada setor é ancorado em empresas reais listadas na B3 usadas como referência (a mesma
combinação real+sintético já usada pra fundamentar o motor de bot na proposta seção 2.3.1),
cruzadas com relatórios setoriais quando disponíveis (PwC, Banco Central, InfoMoney/imprensa
especializada). Fonte citada por número na tabela de cada setor. Nenhuma calibração de
`crescimento_base`/ruído — a proposta seção 7 e o backlog `K.1` só pedem os 6 coeficientes já
existentes em `fundamentals.go` (margem líquida, margem EBIT, patrimônio/receita,
dívida/patrimônio, caixa/receita, sensibilidade à Selic); `DefaultBaseGrowth`/`DefaultNoiseStdDev`
continuam fora de escopo.

**Faixa, não só valor único.** O autor pediu explicitamente pra não tratar a média setorial como
um valor fixo aplicado a toda empresa do setor — no mundo real, dentro do mesmo setor há empresa
acima e abaixo da média (ex: Renner com margem líquida de 8,6% vs. Magalu com margem líquida
inferior a 2%, ambas "Varejo"). Por isso cada coeficiente abaixo vem como **valor central
(calibração proposta) + faixa plausível de variação entre empresas do mesmo setor**, não um número
único. Como aplicar essa faixa por empresa é decisão de implementação da `K.2` (ver seção
"Recomendação de implementação para a K.2" no fim deste documento) — este documento só entrega os
números e a faixa, não o mecanismo de sorteio.

## Tabela por setor

### Mineração (`catalog.SectorMineracao`)

| Coeficiente | Valor central proposto | Faixa entre empresas | Hoje (genérico) |
|---|---|---|---|
| Margem líquida | 15% | 5%–25% | 10% |
| Margem EBIT | 24% | 15%–35% | 18% |
| Patrimônio / Receita | 1,3× | 1,0×–1,8× | 1,2× |
| Dívida bruta / Patrimônio | 0,45× | 0,25×–0,70× | 0,4× |
| Caixa / Receita | 15% | 8%–25% | 15% |
| Sensibilidade à Selic | 0,02 | 0,01–0,03 | 0,02 (Conservador) |

**Fontes:** Vale S.A., release 1T25 (margem EBITDA ajustada 29,7%, lucro líquido R$8,16bi sobre
receita líquida R$47,4bi ⇒ margem líquida ≈17,2%); PwC Brasil, "Mineração 2025"; panorama global
de mineração 2024 (40 maiores mineradoras ex-ouro, margem EBITDA setorial caindo de 24% em 2023
para 22% em 2024, ano desafiador de preço de commodity) — usado pra ancorar a ponta inferior da
faixa, já que 2024 foi um ano fraco pro setor.

**Justificativa da sensibilidade baixa à Selic:** diferente dos outros 5 setores, mineração de
larga escala (Vale sendo a referência) tem receita majoritariamente dolarizada/exportadora — o
preço do minério de ferro no mercado internacional pesa mais no resultado do que o custo de
crédito doméstico. Por isso a sensibilidade proposta continua próxima do coeficiente
"Conservador" já existente (0,02), não da média do setor de commodities em geral.

### Agronegócio (`catalog.SectorAgronegocio`)

| Coeficiente | Valor central proposto | Faixa entre empresas | Hoje (genérico) |
|---|---|---|---|
| Margem líquida | 7% | 2%–14% | 10% |
| Margem EBIT | 12% | 6%–20% | 18% |
| Patrimônio / Receita | 1,0× | 0,7×–1,4× | 1,2× |
| Dívida bruta / Patrimônio | 1,0× | 0,6×–1,5× | 0,4× |
| Caixa / Receita | 8% | 4%–15% | 15% |
| Sensibilidade à Selic | 0,05 | 0,04–0,07 | — |

**Fontes:** SLC Agrícola, resultado 2024 (lucro líquido R$481,7mi, queda de 48,6% a/a — evidência
direta da volatilidade de margem do setor por clima/preço de commodity agrícola; dívida bruta
R$5,6bi vs. patrimônio líquido R$5,42bi ⇒ dívida/patrimônio ≈1,03×; relação dívida líquida/EBITDA
subindo de 1,06× para 1,8× no ano); nota de risco de crédito Santander/BB-BI sobre SLC Agrícola
(2025) — usada pra confirmar a leitura de alavancagem elevada como padrão do setor, não só de uma
empresa isolada.

**Justificativa da sensibilidade alta à Selic:** agronegócio depende estruturalmente de crédito
rural (Plano Safra, financiamento de insumo/safra) — custo de capital tem efeito direto sobre a
margem, mais parecido com o setor Sofisticado hoje (0,06) do que com o Conservador.

### Bancário/Financeiro (`catalog.SectorBancario`)

| Coeficiente | Valor central proposto | Faixa entre empresas | Hoje (genérico) |
|---|---|---|---|
| Margem líquida | 22% | 15%–30% | 10% |
| Margem EBIT | 30% | 22%–38% | 18% |
| Patrimônio / Receita | 2,2× | 1,5×–3,0× | 1,2× |
| Dívida bruta / Patrimônio | 1,5× | 1,0×–2,5× | 0,4× |
| Caixa / Receita | 30% | 20%–45% | 15% |
| Sensibilidade à Selic | 0,05 | 0,04–0,07 | 0,06 (Sofisticado) |

**Fontes:** Banco Central do Brasil, ROE do sistema bancário 15,6% (acumulado 2024) e 16,76%
(2025); Índice de Basileia médio do Sistema Financeiro Nacional 17,24% (dez/2025), individual
Itaú 15,13%/Banco do Brasil 15,7%/Bradesco 15,5%/Santander 13,5% — usados só pra confirmar que o
setor opera confortavelmente acima do mínimo regulatório (11%), não como insumo direto de nenhum
coeficiente da tabela.

**Ressalva importante — banco não é uma empresa industrial:** os 6 coeficientes de
`fundamentals.go` foram desenhados pensando numa demonstração de resultado tradicional
(receita → margem → patrimônio → dívida). Banco não tem "dívida bruta" no sentido de
financiamento de terceiros pra operação — captação (depósitos) **é** o próprio negócio, e alavancagem
bancária de verdade é medida por Basileia (patrimônio de referência / ativos ponderados pelo
risco), não por dívida/patrimônio convencional. Os valores de "Patrimônio/Receita" e "Dívida
bruta/Patrimônio" acima são um **proxy simplificado** pra manter o setor bancário dentro do mesmo
modelo de 6 coeficientes usado por todos os outros setores (patrimônio grande relativo à receita
líquida de intermediação, "dívida" numericamente mais alta refletindo a natureza mais alavancada
do negócio) — não uma leitura literal do balanço de um banco real. Isso é uma simplificação
deliberada do motor sintético, não um erro de pesquisa; registrar como tal se a `K.2` (ou uma
revisão futura) achar que o proxy não está gerando um preço-justo plausível pra `BNDD4`/futuros
bancos do currículo.

### Varejo (`catalog.SectorVarejo`)

| Coeficiente | Valor central proposto | Faixa entre empresas | Hoje (genérico) |
|---|---|---|---|
| Margem líquida | 5% | 1%–9% | 10% |
| Margem EBIT | 9% | 4%–14% | 18% |
| Patrimônio / Receita | 0,6× | 0,4×–0,9× | 1,2× |
| Dívida bruta / Patrimônio | 0,9× | 0,5×–1,4× | 0,4× |
| Caixa / Receita | 8% | 4%–15% | 15% |
| Sensibilidade à Selic | 0,06 | 0,05–0,08 | 0,06 (Sofisticado) |

**Fontes:** Lojas Renner, release 3T24 (margem líquida 8,6%, alta de 2 p.p. a/a — ponta superior
da faixa, varejo de moda com margem bruta >56%); Magazine Luiza, release 3T24 (margem EBITDA
ajustada de 8%, lucro líquido de R$102,4mi sobre receita da ordem de bilhões — margem líquida
inferior a 2%, ponta inferior da faixa, varejo eletrônico/marketplace de margem mais fina);
InfoMoney, "Investir ou correr? Os três setores que vão mal em ciclos de alta da Selic" — varejo
citado explicitamente como um dos setores mais cíclicos/sensíveis a juros no mercado brasileiro.

**Nota:** o próprio setor já demonstra na prática a instrução do autor sobre variação
intra-setorial — Renner e Magalu são as duas pontas da mesma faixa, não uma média artificial.

### Energia (`catalog.SectorEnergia`)

| Coeficiente | Valor central proposto | Faixa entre empresas | Hoje (genérico) |
|---|---|---|---|
| Margem líquida | 12% | 6%–20% | 10% |
| Margem EBIT | 22% | 15%–30% | 18% |
| Patrimônio / Receita | 1,4× | 1,0×–2,0× | 1,2× |
| Dívida bruta / Patrimônio | 1,2× | 0,8×–1,8× | 0,4× |
| Caixa / Receita | 15% | 8%–25% | 15% |
| Sensibilidade à Selic | 0,025 | 0,015–0,035 | — |

**Fontes:** Equatorial Energia, release 4T24 (dívida líquida R$42,5bi, EBITDA ajustado R$10,9bi,
relação dívida líquida/EBITDA 3,3× — evidência de setor estruturalmente alavancado por natureza
regulatória/capex de longo prazo, não por dificuldade financeira); Energisa, releases 4T25/1T26
(margem EBITDA regulatória de transmissão 87%, evidenciando a ponta superior de margem do setor
— segmento de transmissão — bem acima da geração/distribuição); classificação corrente do
mercado (Daycoval, "Ações defensivas"; MaisRetorno, "Setores defensivos x cíclicos") descrevendo
concessionárias de energia como setor defensivo, de receita regulada e previsível, historicamente
menos sensível a ciclo econômico doméstico.

**Justificativa da sensibilidade baixa à Selic:** apesar da alavancagem elevada (dívida cara em
teoria seria muito sensível a juros), a receita é regulada/contratada de longo prazo (tarifa,
reajuste por índice), o que reduz a transmissão do ciclo de juros pro resultado operacional —
mesmo racional qualitativo que já classifica o setor como "defensivo" na imprensa especializada.

### Tecnologia (`catalog.SectorTecnologia`)

| Coeficiente | Valor central proposto | Faixa entre empresas | Hoje (genérico) |
|---|---|---|---|
| Margem líquida | 15% | 8%–22% | 10% |
| Margem EBIT | 22% | 13%–30% | 18% |
| Patrimônio / Receita | 0,9× | 0,6×–1,3× | 1,2× |
| Dívida bruta / Patrimônio | 0,35× | 0,15×–0,60× | 0,4× |
| Caixa / Receita | 25% | 15%–40% | 15% |
| Sensibilidade à Selic | 0,07 | 0,05–0,09 | 0,06 (Sofisticado) |

**Fontes:** TOTVS, release 4T25 (margem líquida ajustada 15,8% no ano, alta de 100 p.b. a/a;
margem EBITDA ajustada 26,2%; segmentos RD Station/Techfin com margem EBITDA setorial de
13,4%–13,5%, evidenciando a ponta inferior da faixa dentro da própria companhia).

**Justificativa da sensibilidade mais alta entre os 6 setores:** é o único setor onde a proposta
recomenda um coeficiente acima do "Sofisticado" genérico atual (0,06) — empresas de tecnologia
têm fluxo de caixa concentrado no longo prazo (crescimento futuro pesa mais que resultado
corrente no preço justo), o que as torna, na literatura de finanças, o setor classicamente mais
sensível a mudanças na taxa de desconto/juros — mesmo racional qualitativo global (não uma fonte
brasileira específica) usado só pra justificar a direção relativa, não o valor numérico exato.

## Síntese comparativa (visão rápida)

| Setor | Margem líquida | Margem EBIT | Patr./Receita | Dívida/Patr. | Caixa/Receita | Sensib. Selic |
|---|---|---|---|---|---|---|
| Mineração | 15% | 24% | 1,3× | 0,45× | 15% | 0,02 |
| Agronegócio | 7% | 12% | 1,0× | 1,0× | 8% | 0,05 |
| Bancário/Financeiro | 22% | 30% | 2,2× | 1,5× | 30% | 0,05 |
| Varejo | 5% | 9% | 0,6× | 0,9× | 8% | 0,06 |
| Energia | 12% | 22% | 1,4× | 1,2× | 15% | 0,025 |
| Tecnologia | 15% | 22% | 0,9× | 0,35× | 25% | 0,07 |
| *(genérico atual)* | *10%* | *18%* | *1,2×* | *0,4×* | *15%* | *0,02 / 0,06* |

Os 6 setores deixam de convergir pra um único conjunto de números — cada um tem margem/alavancagem
coerente com o que a pesquisa encontrou de real e público, preservando os invariantes qualitativos
que a spec 3.2.2 já exige (Sofisticado mais sensível à Selic que Conservador — Tecnologia e Varejo,
os dois com sensibilidade mais alta, seriam ambos "Sofisticado" numa leitura de `risk_class`;
Mineração e Energia, os dois mais baixos, seriam "Conservador").

## Recomendação de implementação para a K.2 (não decidido aqui, só sinalizado)

Estas são observações de quem pesquisou os números, não decisões — a `K.2` é quem aplica e decide
os detalhes finos de código:

1. **Sensibilidade à Selic migra de `risk_class` (2 valores) pra setor (6 valores).** Hoje
   `SensitivityByRiskClass` é indexado por `equity.RiskClass`; a pesquisa acima já produz um valor
   por `catalog.Sector`. `K.2` precisa decidir se substitui o mapa por `risk_class` por um mapa por
   `Sector`, ou se mantém os dois (setor calibra o "quanto", `risk_class` continua calibrando
   volatilidade/drift do GBM em `equity/gbm.go`, que é uma preocupação diferente — preço, não
   fundamentos — e não faz parte do escopo desta pesquisa).
2. **`DeriveFinancials`/`BootstrapFinancialsForTargetPrice` hoje leem as 5 constantes globais
   diretamente** (`DefaultNetMarginPct` etc.), não um `Config` passado por parâmetro — `K.2`
   precisa threading o setor da empresa (`catalog.Sector`) até essas duas funções pra escolher o
   conjunto de coeficientes certo.
3. **Faixa entre empresas do mesmo setor precisa de um mecanismo de sorteio determinístico por
   empresa** (mesmo padrão RNF08 já usado por `NextGrowth`/`GrowthSeries` — seed determinístico,
   nunca aleatoriedade não reprodutível), decidido uma única vez na criação da empresa (não
   re-sorteado a cada ciclo de relatório, pra manter a identidade da empresa estável ao longo do
   tempo — do contrário a mesma empresa oscilaria entre "acima" e "abaixo" da média a cada
   trimestre, o que não é o que o autor pediu). Duas formas óbvias de fazer isso, a decidir na
   sessão da `K.2`: (a) sortear um coeficiente por empresa dentro da faixa no momento do seed
   (mesmo padrão de `BootstrapFinancialsForTargetPrice`, que já roda uma vez por empresa nova); ou
   (b) guardar um "desvio" percentual fixo por empresa (ex: campo novo em `companies` ou derivado
   determinicamente do `company_id`) aplicado sobre o valor central do setor.
4. **Bancário/Financeiro é o setor com maior risco de gerar um preço-justo pouco plausível** se o
   proxy simplificado (ressalva na seção do setor acima) não se comportar bem dentro da fórmula de
   Justified Price-to-Book que `bot.FundamentalistFairPrice`/`BootstrapFinancialsForTargetPrice`
   já usam — vale rodar esse setor primeiro no teste table-driven da `K.2` e validar visualmente o
   preço-justo resultante antes de fechar a tarefa.

## Fontes (lista consolidada)

- Vale S.A., Release de Resultados 1T25.
- PwC Brasil, "Mineração 2025" (pwc.com.br).
- Panorama setorial de mineração global 2024 (40 maiores mineradoras ex-ouro).
- SLC Agrícola, divulgação de resultados 2024; nota de risco de crédito Santander/BB-BI (2025).
- Banco Central do Brasil, dados de ROE do sistema bancário (2024/2025) e Índice de Basileia do
  Sistema Financeiro Nacional (dez/2025).
- Lojas Renner S.A., Release de Resultados 3T24.
- Magazine Luiza S.A., Release de Resultados 3T24.
- InfoMoney, "Investir ou correr? Os três setores que vão mal em ciclos de alta da Selic".
- Equatorial Energia S.A., Release de Resultados 4T24.
- Energisa S.A., Releases de Resultados 4T25/1T26.
- Daycoval, "Ações defensivas"; MaisRetorno, "Setores defensivos x setores cíclicos no mercado de
  ações".
- TOTVS S.A., Release de Resultados 4T25.
