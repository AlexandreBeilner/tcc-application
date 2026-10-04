# Auditoria das lições 1.1 a 1.6 (Trilha 1: Renda Fixa)

Data: 2026-10-03. Somente leitura. Fontes de código: `backend/src/db/seedLessons.ts` (linhas 271-508), `frontend/src/pages/Lesson/index.tsx`, `features/lessons/{glossary,splitIntoCards}`, `components/organisms/{FixedIncomeComparisonForm,GrowthCalculatorForm,IndicatorSummaryCards}`, `features/market/nextCopomDay`.

## 0. Como a lição é renderizada hoje (limites estruturais que explicam os sintomas)

- 4 passos fixos: Cenário, Micro-decisão, Revelação, Desbloqueio. Cada texto (`scenarioText`, `microDecisionPrompt`, `revelationText`) é quebrado em "cartões" por `\n\n`; cada cartão é um parágrafo `<p>`. NÃO existe cartão com visual: a única mídia possível são os 5 `microDecisionType` (`reflection`, `growth_calculator`, `fixed_income_comparison`, `live_indicator`, `live_macro_indicator`), todos renderizados só no último cartão do passo 2 (ou 3 para os `live_*`).
- Uma única pergunta por lição (passo 2). Pela leitura de `handleAdvance`/`canAdvanceMicroDecision`, ERRAR NÃO TRAVA: o servidor devolve `microDecisionCorrect` e a UI mostra o selo "Quase. A resposta certa era: X" e segue. O pedido do autor (item 7: errar não avança, tentativas ilimitadas) é portanto mudança de comportamento (frontend + `advanceLesson` no backend, que hoje aceita o avanço independentemente do acerto).
- O botão "Ver resultado" (`[revelar]`, componente `CardBody`) só esconde um parágrafo de texto atrás de um clique. Não calcula nada. Usado apenas na 1.6.
- Glossário (`features/lessons/glossary`): 6 termos (FGC, marcação a mercado, deságio, taxa bruta equivalente, EBIT, Dividend Yield). É um popover de uma frase. NÃO tem Selic, CDI, TR, IPCA, IR, IOF, pós-fixado, prefixado, liquidez, carência, LFT, emissor.
- `{{ref:X.Y}}` rende "já visto na lição X.Y" (link). Serve para voltar, não para avisar "isto só será explicado na lição N".
- `centralConcept` NÃO é renderizado em nenhuma tela (grep em tsx não acha uso fora de comentário), mas vive na API/DB. Mesmo assim contém "(TCC cap. 2.1.1)" na 0.2 e "(TCC cap. 2.3.3)" na 2.4 (fora do meu escopo, apenas sinalizo).

## 1. Varredura global: menções a TCC/spec/plataforma/simulação

Texto VISÍVEL ao aluno (todo o seed, não só 1.x):

| Local | Trecho | Ação |
|---|---|---|
| 1.2 revelationText | "a spec do TCC (cap. 3) o trata como o 'porto seguro' da renda fixa" | Remover. Reescrever como afirmação do mundo real (ver 1.2). |
| 1.3 scenarioText | "reunido a cada 21 dias simulados nesta plataforma" | Factualmente errado para o mundo real; reescrever (ver 1.3). |
| 2.? (linha 1056) | "(spec 3.2.2)" dentro de texto de lição | Remover (fora do escopo 1.x, mas é o mesmo defeito). |
| 0.4 revelationText | "Todo indicador de investimento nesta plataforma é nominal" | Reescrever para o mundo real. |
| 0.5 | "Com a Selic simulada nesta plataforma rodando acima de 8,5%" | Reescrever. |
| 0.1 | "Nesta plataforma, cada trilha... desbloqueia" | Metatexto de produto; mover para tooltip de UI, não para lição. |

Comentários de código mencionando spec/TCC (linhas 39, 145, 310, 854) não aparecem ao aluno; ficam, mas as duas `centralConcept` com "TCC cap." devem ser limpas porque saem em `GET /lessons`.

Também aparecem na UI da lição 1.3 componentes com rótulos de simulação: `IndicatorSummaryCards` ("Próximo Copom simulado", "Dia N", "Aguardando primeiro tick"). Isso é UI da plataforma dentro da lição; ver proposta 1.3.

## 2. Onde cada termo é de fato apresentado hoje (e quem o usa antes)

| Termo | Primeiro USO | Primeira DEFINIÇÃO real | Observação |
|---|---|---|---|
| Inflação | 0.3 | 0.3 (ok) | |
| IPCA | 0.4 (cenário) | 2.? "O que é o IPCA" (lição 1.9 no código: sortOrder após 1.8, 'O que é o IPCA', linha ~591) | Usado em 0.4, 1.3 antes de ser definido. A 1.3 chega a falar "IPCA acima da meta" 6 lições antes. |
| CDB | 0.4 (cenário) | 1.4 | |
| Selic | 0.5 (scenarioText, sem definição) | 1.3 (de forma parcial; 1.2 já diz "taxa Selic") | Cinco lições de uso antes da definição (0.5, 1.1, 1.2 antes de 1.3). Nunca se diz que é a taxa básica de juros da economia no sentido de "preço do dinheiro". |
| CDI | 0.5 ("o CDI, que a acompanha"), 1.1 | 1.4 (uma frase entre parênteses: "taxa que acompanha de perto a Selic") | Definição rasa. Falta explicar que é a taxa dos empréstimos entre bancos (DI), diária, ~Selic menos 0,10 p.p. |
| Tesouro Selic / LFT | 0.5 | 1.2 | |
| TR | 0.5 ("+ TR") | NUNCA | |
| Poupança (regra) | 0.5 | 0.5 | |
| pós-fixado / prefixado | 1.1 revelação, 1.2 | 1.7 (prefixado), pós-fixado explicado nunca | |
| marcação a mercado | 1.2 revelação | 1.8 | Usado na 1.2 com glossário de uma frase. |
| risco de crédito | 1.2 (microdecisão 1.4 também) | NUNCA (só mencionado) | |
| liquidez | 1.2 | NUNCA | |
| emissor | 1.1 | 1.1 (inline, ok) | |
| FGC | 1.4 | 1.4 (glossário) | |
| IR / alíquota | 1.4? (não) 1.5 | 1.5 | ok, mas "retido na fonte" e "come-cotas" não existem. |
| IOF | NUNCA | NUNCA | Relevante para Tesouro Selic/CDB < 30 dias. |
| carência / prazo mínimo (LCI/LCA) | NUNCA | NUNCA | Ver 1.6. |
| CRI/CRA, renda variável | 1.1, 1.5 | 1.10(CRI/CRA), Trilha 2 | Aparecem como lista sem explicar, aceitável como "teaser" se marcado. |

Conclusão de ordenação: o encadeamento natural correto é Inflação, IPCA, Selic/CDI/Copom, Tesouro Selic, CDB, IR, LCI/LCA. Hoje temos Tesouro Selic (1.2) ANTES de Selic (1.3), e CDI (1.4) depois de Selic mas definido em meia frase.

### Reordenação / soluções propostas

1. **Mover 1.3 (Selic/Copom) para ANTES de 1.2 (Tesouro Selic)**, com título "O que é a Selic e quem a decide". Renumerar com cuidado (`stableKey` já protege progresso, ver M.6 no comentário do seed). Alternativa mais barata: inserir uma lição nova 1.1b ou trazer a definição de Selic/CDI para a Trilha 0 (0.5 já exige Selic; ideal: nova lição 0.5 "Taxa de juros, Selic e CDI" antes de "Por que a poupança perde", que passa a 0.6). Recomendo esta: Selic é pré-requisito já da 0.5.
2. **Definição inline (glossário)** para todo termo de uso antes da lição de origem: ampliar o catálogo com Selic, CDI, TR, IPCA, pós-fixado, prefixado, liquidez, risco de crédito, carência, IOF, LFT. Padrão: `{{Selic}}` com definição de 1 a 2 frases + link "ver lição 0.5" (`{{ref:}}` ja existe).
3. **Regra de autoria**: um termo só pode ser usado sem `{{}}` se a lição que o define já foi concluída (lint de seed: script de teste que percorre as lições em `sortOrder`, mantém um conjunto de termos "apresentados" e falha se um termo do glossário aparece sem `{{}}` antes da sua lição de origem).
4. **Glossário vivo**: página/gaveta "Glossário" listando só os termos já vistos, com link para a lição de origem.

## 3. Grafo de pré-requisitos de conceitos

```
Inflação (0.3) -> Rendimento real (0.4) ---------------------------+
        |                                                           |
        v                                                           v
   IPCA (hoje 1.9; deve vir antes)                        Comparar produtos (1.6)
        |                                                           ^
        v                                                           |
Juros/taxa de juros -> Selic (hoje 1.3) -> Copom/meta de inflação   |
        |                     |                                     |
        |                     +-> CDI (hoje 1.4) --> CDB (1.4) ---+ |
        |                     |                        |          | |
        |                     +-> Poupança+TR (0.5)    +-> FGC --+ | |
        |                     +-> Tesouro Selic/LFT (1.2)          | |
Renda fixa (1.1): emissor, remuneração, pós x prefixado x híbrido    |
        |                                                           |
        +-> Liquidez, risco de crédito, prazo --------------------+ |
Juros compostos (0.2) -> Tributação regressiva (1.5) -> Taxa bruta equivalente (1.6)
LCI/LCA (1.6) depende de: IR (1.5), CDB (1.4), FGC (1.4), CDI (1.4), carência.
```

Ordem recomendada: 0.3 Inflação, 0.4 Real, (novo) IPCA como o termômetro oficial, (novo) Juros e Selic/CDI, 0.5 Poupança+TR, 1.1 Renda fixa, 1.2 Tesouro Selic, (Copom como aprofundamento opcional da Selic), 1.4 CDB, 1.5 IR/IOF, 1.6 LCI/LCA.

---

## Lição 1.1: O que é renda fixa

**Conteúdo atual.** Cenário: analogia do empréstimo de R$1.000 a um amigo; renda fixa = emprestar a emissor (governo, banco, empresa) com regra combinada. Menciona reserva de emergência e "o mesmo bônus da 0.1". Micro-decisão: "um título que acompanha a Selic todo dia ainda é renda fixa?" (Sim/Não, correta Sim). Revelação: nome vem da regra conhecida (pós-fixada / prefixada), diferença para renda variável; anuncia emissores (Tesouro, CDB/LCI/LCA, CRI/CRA) e "a taxa real de cada produto".

**Erros factuais / imprecisões.**
- Correto no essencial. Falta o terceiro tipo de remuneração: **híbrida** (prefixada + IPCA, ex: Tesouro IPCA+). A revelação só lista pós e pré, e "a regra de remuneração conhecida" é verdadeira também para IPCA+.
- "O mesmo bônus da lição 0.1" é referência interna de plataforma; na vida real ninguém ganha o bônus. Remover.
- "taxa real de cada produto" é ambíguo (confunde com rendimento real da 0.4).
- A pergunta é fraca: a resposta "Sim" é por definição e quase todo aluno acerta chutando.

**A remover/reescrever (plataforma/TCC).** "o mesmo tipo de bônus da lição 0.1, agora com destino definido". Tudo mais é mundo real.

**Termos antes de introduzidos.** Selic e CDI (revelação, "acompanhando um indexador como a Selic ou o CDI"), pós-fixada/prefixada (aparecem como parentético), "renda variável", CRI/CRA. Solução: `{{Selic}}`, `{{CDI}}` com definição curta; usar o widget de linha do tempo (abaixo) para explicar pós/pré/híbrido com valores.

**Lacunas.** Os 3 modos de remuneração; os 3 riscos que tornam um emissor diferente (crédito, mercado/taxa, liquidez); o mapa "quem emite o quê" (Tesouro/bancos/empresas) com o risco que isso implica; que "fixa" não elimina risco (o Banco Master / Letras de câmbio 2025-2026 é bom exemplo de risco de crédito, verificar caso atual antes de citar); diferença de nome renda fixa x renda variável; valor mínimo baixo para começar.

**Visuais / widgets propostos.**
1. **"Tipos de remuneração" (3 cartões lado a lado + mini-gráfico)**. Entrada: toggle Pré / Pós / Híbrido e slider de "o que acontece com a Selic/IPCA no período" (queda, estável, alta). Saída: gráfico de linha do valor ao longo de 3 anos para o título escolhido, com banda tracejada = "o que você sabia na compra" (convenção sólido/tracejado do doc de padrões). Prefixado: linha reta fixa independente do slider; pós: curva que se mexe com a Selic; híbrido: curva que acompanha IPCA mais um piso.
2. **Mapa "Quem pega seu dinheiro emprestado"**: 3 emissores (Governo, Banco, Empresa) em escada de risco de crédito com selo "Garantia: nenhuma/FGC até R$250 mil/nenhuma", clicável para ver exemplos (Tesouro Selic, CDB, debênture).
3. **Cartão comparativo "renda fixa x renda variável"** com duas trajetórias sintéticas: uma previsível (linha) e uma oscilante (nuvem), usando o mesmo capital.

**Perguntas intermediárias propostas (cada uma com feedback no erro).**
1. Enunciado: "Você compra um título que paga 12% ao ano fixo por 2 anos. É renda fixa?" Opções: Sim, regra definida na compra / Não, porque o valor final varia / Só se for do governo. Erro "Não...": "Renda fixa não quer dizer valor final fixo e sim regra de remuneração definida. Aqui o juro é prefixado: 12% a.a. conhecido hoje." Erro "Só governo": "Bancos e empresas também emitem renda fixa; muda o emissor e o risco de crédito, não a natureza do título."
2. Enunciado: "Qual destes títulos você só descobre quanto rendeu depois que o prazo acaba?" Opções: Prefixado / Pós-fixado (Selic) / Híbrido (IPCA+) / Nenhum, em renda fixa todos são conhecidos. Correta: Pós-fixado e Híbrido aproximam; tornar a resposta única: "Pós-fixado: você conhece a regra (100% da Selic), mas não o valor final, porque a Selic varia." Erro: explicar que a taxa é conhecida só no prefixado e o piso real no IPCA+.
3. Enunciado: "Qual risco é o maior quando você empresta a um banco pequeno, e não ao governo?" Opções: Risco de crédito (o banco não pagar) / Risco de a Selic cair / Risco de inflação. Explicação do erro vinculada a cada opção.

**Esforço:** M (conteúdo + 2 widgets simples; mapa de emissores é estático).

---

## Lição 1.2: Tesouro Selic

**Conteúdo atual.** Cenário: emprestar R$1.000 ao Tesouro, corrigido pela Selic todo dia útil; LFT, pós-fixado, o mais líquido, indicado para reserva de emergência. Micro-decisão: "Se a Selic sobe, o preço unitário (PU) do Tesouro Selic sobe, cai ou fica igual?" (correta: Sobe). Revelação: PU sobe quase todo dia, baixa volatilidade; contrasta com Prefixado/IPCA+ ("marcação a mercado negativa com mais frequência"); frase "a spec do TCC (cap. 3) o trata como o porto seguro". CTA "Comprar agora" LFT2029.

**Erros factuais / imprecisões.**
- A pergunta é mal formulada. O PU do Tesouro Selic (LFT) sobe praticamente todo dia útil por acréscimo da Selic acumulada, QUALQUER que seja a trajetória da Selic. O que a Selic mais alta causa é um aumento da velocidade de subida (o rendimento diário). Marcação a mercado existe na LFT, mas é pequena (variação do ágio/deságio, quase zero porque o prazo de reprecificação é diário). A pergunta confunde "PU" com "taxa de rendimento". Sugestão: reformular para "Se a Selic sobe de 14% para 15%, o que acontece com o que o Tesouro Selic rende por dia?".
- "Resgate diário sem perda relevante de valor": correto na prática, mas faltam as ressalvas reais: o resgate acontece em D+1 útil; **IOF regressivo** nos primeiros 29 dias (96% do rendimento no dia 1 até 0% no dia 30); **taxa de custódia B3 de 0,20% a.a.** sobre o valor aplicado (isenta nos primeiros R$10 mil? Essa isenção existe para Tesouro Selic até R$10 mil; confirmar no site do Tesouro Direto antes de citar) e **taxa da corretora/agente de custódia** (geralmente zero); **IR regressivo** (lição 1.5); **valor mínimo** de fração de 1% do título; vencimento do LFT2029 é uma data real do papel: um título Selic tem vencimento (ex: 01/03/2029) e pode ser vendido antes ao preço de mercado.
- "O mais líquido": o Tesouro Selic é um dos de maior liquidez, mas a poupança e a conta remunerada têm liquidez imediata. Dizer "alta liquidez (D+1 útil)".
- "Risco de crédito mínimo": correto, é o risco soberano brasileiro (não zero); explicar "o governo emite a moeda em que a dívida é paga, por isso a chance de calote em reais é considerada a menor do país". Não afirmar "livre de risco".
- Rendimento: LFT paga a taxa Selic (meta definida pelo Copom, acumulada pela Selic over diária) sobre o VNA (Valor Nominal Atualizado) mais/menos um ágio/deságio de compra. Dizer "100% da Selic" é aproximação; a rentabilidade líquida cai com custódia e IR.
- "Selic" definida só na 1.3 (depois). 

**A remover/reescrever (plataforma/TCC).** Frase da spec do TCC (cap. 3). Substituir por: "É o título que o mercado usa como referência de baixo risco: o preço oscila muito pouco, e resgatar antes do vencimento raramente causa perda relevante de valor." "Compra real de Tesouro Selic (LFT2029) no Mercado" em `unlocksDescription` é aceitável (é descrição de desbloqueio da plataforma, não conteúdo), mas deve ficar claramente separado: no mundo real, compra-se pelo site Tesouro Direto ou pela corretora; na plataforma, pelo Mercado simulado (explicar uma vez: "aqui você pratica com dinheiro fictício").

**Termos antes de introduzidos.** Selic (definida na 1.3), pós-fixado, líquido/liquidez, risco de crédito, PU, "marcação a mercado negativa", Prefixado e IPCA+ (lições 1.7/1.8/1.10), LFT.

**Lacunas.** O que é o Tesouro Nacional e o Tesouro Direto (programa do Tesouro com B3; investir a partir de ~R$30, fração de 1%); como a LFT calcula o rendimento (VNA = valor inicial R$1.000 em 2000 corrigido pela Selic); custos (B3 0,20% a.a., IOF dos 30 primeiros dias, IR regressivo); exemplo numérico real de 1 ano (R$1.000 com Selic a 14,x% menos IR = ~?); para quem serve (reserva de emergência, prazo indeterminado); quando NÃO usar (objetivo longo prazo que busca superar inflação; compare com IPCA+).

**Visuais / widgets propostos.**
1. **Gráfico do PU do Tesouro Selic x tempo** (linha quase reta e sempre ascendente) sobreposto a uma linha de Tesouro Prefixado que oscila (zigue-zague); entrada: seletor de cenário de Selic (sobe/estável/desce) que muda a inclinação da LFT, mas não faz a linha descer. Ensina visualmente "pós-fixado sobe sempre, só muda a velocidade".
2. **Simulador "Quanto rende meu Tesouro Selic"**: entradas: valor (R$), prazo (dias corridos), Selic anual (slider/valor preenchido com a Selic atual da plataforma e botão "usar a Selic real de hoje"); saídas (cartões em cascata): bruto, IOF (se <30 dias), IR (tabela da 1.5), taxa B3, líquido. Fórmula: bruto = V × [(1+Selic)^(d/252) − 1] (dias úteis ~ d×252/365); IR = alíquota(d) × bruto; custódia = 0,20% × V × d/365.
3. **Cadeia de resgate**: pílula visual "D+0 pedido, D+1 dinheiro na conta" com ícone de calendário.

**Perguntas intermediárias propostas.**
1. "Hoje você aplica R$10.000 no Tesouro Selic. Daqui a 1 semana, a Selic sobe 0,25 p.p. Seu dinheiro...?" Opções: Continua crescendo todos os dias, um pouco mais rápido / Cai de valor temporariamente / Fica parado até o próximo Copom. Erro "Cai": "No Tesouro Selic o valor não cai por causa de alta na Selic. A marcação a mercado existe, mas é minúscula. Quem cai de valor é o prefixado, quando a taxa de mercado sobe."
2. "Você precisa do dinheiro 10 dias depois da compra. Qual custo extra você paga?" Opções: IOF sobre o rendimento + IR de 22,5% / Só IR / Nenhum. Explicação do erro: IOF regressivo nos primeiros 29 dias.
3. "Qual a principal razão de o Tesouro Selic ser usado em reserva de emergência?" Opções: baixo risco e resgate em 1 dia útil / sempre rende mais do que a inflação / não paga imposto.
4. Verdadeiro ou falso: "O Tesouro Selic é totalmente isento de risco." Feedback: há risco soberano, risco de marcação (pequeno), risco de reinvestimento.

**Esforço:** G (simulador novo com IOF/IR/custódia, gráfico pré x pós; reordenar com Selic).

---

## Lição 1.3: Como a Selic é formada

**Conteúdo atual.** Cenário: Selic decidida pelo Copom, "reunido a cada 21 dias simulados nesta plataforma"; reage à inflação vs meta. Micro-decisão (`live_macro_indicator`): "Se o IPCA acumulado estiver acima da meta numa reunião do Copom simulado, Selic sobe/desce/igual?" (Sobe). Revelação: "regra de reação simulada (versão simplificada da regra de Taylor)" soma reversão à neutra, termo de desvio do IPCA e ruído; arredondamento para 0,25 p.p. "o mesmo passo do Copom real"; selic só muda nos dias de reunião. Widget: 4 cartões (Selic meta, IPCA mensal, IPCA 12m, "Próximo Copom simulado: Dia N").

**Erros factuais.** (Fontes ao final.)
- **"Reunido a cada 21 dias simulados"**: no mundo real o Copom faz **8 reuniões por ano**, cada uma em 2 dias (terça e quarta), intervalo médio de ~45 dias (6 a 7 semanas). Em 2026 as datas: 27-28 jan (15,00%), 17-18 mar (14,75%), 28-29 abr (14,50%), 16-17 jun (14,25%), 4 nov, etc. (calendário publicado pelo BC; conferir cada data antes de colar no app). Decisão anunciada ao fim do segundo dia (por volta das 18h30).
- A taxa decidida é a **meta** da Selic. A **Selic efetiva (Selic over)** é a média diária das operações compromissadas com títulos públicos e fica 0,10 p.p. abaixo da meta, em geral. O texto mistura ("Selic meta" no cartão, "Selic" no texto).
- "Comitê de Política Monetária do Banco Central": correto (9 membros: presidente e 8 diretores).
- "Reage principalmente ao desvio do IPCA frente à meta": verdade parcial. O Copom olha **expectativas de inflação (Boletim Focus)** para os horizontes relevantes (hoje o horizonte relevante ~ 6 trimestres à frente), atividade econômica, câmbio, cenário externo, política fiscal. Regra de Taylor é um modelo acadêmico; o Copom não aplica fórmula.
- **Meta de inflação**: não é citada. Real: **meta contínua de 3,0% a.a. com intervalo de tolerância de ±1,5 p.p. (1,5% a 4,5%)**, desde jan/2025 (CMN). Considera-se descumprimento quando a inflação fica fora do intervalo por 6 meses consecutivos (medida em 12 meses). A frase "acima da meta" fica solta.
- "Passos de 0,25 como no Copom real": hoje o Copom decide em múltiplos de 0,25 p.p. mas não é regra (já decidiu 0,50, 0,75, 1,00 p.p.). Ajustar: "costuma mexer em múltiplos de 0,25 p.p.; em crises, em saltos maiores".
- "Selic nunca fica negativa": em modelo ok, mas fora de lugar numa lição de mundo real.
- Também deve explicar o contrário: Selic sobe, o crédito fica mais caro, consumo e investimento esfriam, inflação cai; e o efeito em renda fixa (pós-fixados rendem mais, prefixados antigos desvalorizam).

**A remover/reescrever (plataforma/simulação).**
Toda a lição está contaminada: "nesta plataforma", "Copom simulado", "regra de reação simulada", "versão simplificada da regra de Taylor", "Selic simulada", "valor atual da Selic simulada", "em quantos dias sai a próxima decisão" e os rótulos "Próximo Copom simulado/Dia N/Aguardando primeiro tick" do `IndicatorSummaryCards` quando usado dentro da lição.
Regra do autor aplicada: contar o mundo real e, num bloco separado marcado "Na plataforma", explicar a diferença e o porquê. Texto sugerido:
- Mundo real: "O Copom se reúne 8 vezes por ano, com intervalo de cerca de 45 dias. A decisão (meta da Selic) vale até a reunião seguinte."
- Na plataforma: "Para você ver as decisões acontecendo sem esperar meses, o mercado simulado compacta o calendário: o Copom simulado decide mais vezes. Aqui os ritmos são acelerados; a lógica de reação é a mesma da vida real." (e o por quê: tempo de aula). O número (21 dias) NÃO precisa aparecer no texto; se for preciso, o chip dinâmico do app mostra o dado.
- Substituir o widget `IndicatorSummaryCards` por um painel "Selic hoje no mundo real" (valor + data da última decisão), preferencialmente com dado estático versionado + link para o site do Banco Central, e manter os cartões simulados só na área "Mercado/Indicadores", não em lição.

**Termos antes de introduzidos.** Selic (aqui sim é a lição certa, mas vem depois da 1.2), IPCA (definido só em 1.9), "meta de inflação", "Copom", "regra de Taylor", "taxa neutra". Recomendação: tirar Taylor/taxa neutra do texto de lição (jargão acadêmico que não ajuda a investir); IPCA precisa de definição inline: "índice oficial de inflação, medido pelo IBGE".

**Lacunas.** Cadeia de transmissão da política monetária; a diferença meta x over; a Selic como piso do mercado (CDI, Tesouro Selic, poupança, financiamento, cartão); o trade-off juros altos x crescimento; efeito sobre renda fixa e bolsa (relaciona com 1.8); quem decide, quando, e onde acompanhar (calendário do BC, Boletim Focus); metas de inflação e histórico (2015: 10,67%).

**Visuais / widgets propostos.**
1. **Gangorra "Inflação x Selic"**: entrada: slider "IPCA 12 meses" (0% a 12%) com a faixa da meta (1,5% a 4,5%, centro 3%) sombreada. Saída: ponteiro/seta indicando a tendência do Copom (cortar / manter / elevar) e uma faixa de Selic típica; ao mover o slider acima do teto, a gangorra pende para "elevar juros". Regra didática (não é a regra de Taylor, é a intuição): se IPCA > teto → pressão de alta; < piso → pressão de baixa; dentro → manter. Mostra 3 etapas da cadeia: Selic sobe → crédito caro → consumo cai → inflação cai.
2. **Linha do tempo das 8 reuniões do ano** (barra horizontal, 8 marcadores, hoje = bolinha, decisão = valor Selic em cada marcador). Dado estático do BC.
3. **Gráfico de linha Selic x IPCA 12m** dos últimos 10 anos (dados reais estáticos, referência SGS 432 e IPCA série do IBGE) com a faixa da meta; permite ver o ciclo 2015-2016 (14,25%), 2020 (2,00%), 2022-2023 (13,75%), 2025 (15%). Anotações clicáveis nos pontos.
4. Manter o painel ao vivo da plataforma só no ambiente de simulação, não em lição.

**Perguntas intermediárias propostas.**
1. "Quantas vezes por ano o Copom se reúne para decidir a Selic?" Opções: 4 / 8 / 12 / 24. Erro: "São 8 por ano, a cada ~45 dias. Doze seria mensal; o Copom não decide todo mês porque os efeitos dos juros demoram para chegar à inflação."
2. "A inflação está em 6%, acima do teto da meta (4,5%). O que o Copom tende a fazer?" Opções: elevar a Selic / reduzir / manter. Explicar o erro (usar a gangorra).
3. "A Selic subiu. Qual produto passa a render mais, quase imediatamente?" Opções: Tesouro Selic / Tesouro Prefixado comprado ontem / poupança com Selic < 8,5%. Erro: o prefixado é travado e ainda perde valor de mercado.
4. "A meta de inflação atual é...?" 3% com tolerância de 1,5 p.p. / 4,5% fixo / 2%.
5. "O que a Selic efetiva mede?" meta x efetiva (opcional).

**Esforço:** G (reescrita total do texto, gangorra, linha do tempo, gráfico histórico com dados reais; decisão de reordenação).

---

## Lição 1.4: CDB e o CDI

**Conteúdo atual.** Cenário: CDB como empréstimo ao banco, "geralmente um percentual do CDI (taxa que acompanha de perto a Selic)"; exemplo CDB2027 "paga 12,00% ao ano". Micro-decisão: o que protege se o banco quebrar? (FGC). Revelação: FGC cobre CDB, LCI e LCA até R$250.000 por CPF e por instituição; "praticamente tão seguro quanto o Tesouro Direto até esse limite"; bancos menores pagam mais; libera CDB2027.

**Erros factuais / imprecisões.**
- **FGC incompleto (item 4 do autor):** R$250.000 por CPF/CNPJ **por instituição financeira (conglomerado)**, E **teto global de R$1.000.000 por CPF em um período de 4 anos**, contado a partir do primeiro pagamento do FGC (se o FGC pagar por mais de uma intervenção/liquidação). Fonte: FGC. Detalhes que faltam: a cobertura é **por conglomerado** (bancos do mesmo grupo dividem os R$250 mil); soma principal + juros até a data da liquidação; vale para contas, poupança, CDB/RDB, LCI, LCA, LC, RDB; NÃO cobre fundos, ações, debêntures, CRI/CRA, Tesouro (não precisa), LIG, títulos de capitalização; o FGC paga após liquidação/intervenção (processo leva dias/semanas, nao é imediato); é uma associação privada sem fins lucrativos mantida pelos bancos, NÃO é o governo ("o Banco Central devolve" é a opção errada da pergunta, bom distrator).
- "Praticamente tão seguro quanto o Tesouro Direto até esse limite": **overclaim**. O Tesouro não tem limite; no CDB o investidor pode ficar sem acesso ao dinheiro durante o processo, e o FGC tem teto. Reescrever como "o risco de perder o capital fica coberto até o limite, mas o resgate pode demorar".
- "Mesmo que o banco quebre": tecnicamente, em caso de intervenção, liquidação ou falência. Não cobre "calote voluntário" ou fraude? (cobre insolvência declarada pelo BC). Usar "decretação de intervenção ou liquidação extrajudicial pelo Banco Central".
- Inconsistência interna: cenário diz que CDB paga "percentual do CDI", mas o produto de exemplo é prefixado "12,00% a.a.". O aluno vê um CDB prefixado sem saber que existem pré, pós (% do CDI) e IPCA+. 
- **CDI** definido em meia frase. Real: Certificado de Depósito Interfinanceiro; taxa média dos empréstimos de um dia entre bancos, divulgada diariamente pela B3 (CDI over); fica ~0,10 p.p. abaixo da Selic meta. "CDB 100% do CDI" = rende o CDI.
- O CDB não é obrigatoriamente "emprestar para o banco captar e emprestar a clientes" apenas; correto em geral. Liquidez: existem CDB com liquidez diária e CDB com carência até o vencimento; falta a explicação.
- "Bancos menores pagam mais": correto, mas o link com risco falta ("prêmio de risco").
- Falta mencionar que a decisão do investidor deve olhar o banco (patrimônio, índice de Basileia, etc.) mesmo com FGC.

**A remover/reescrever (plataforma).** "O CDB Banco Invest 2027 (CDB2027), por exemplo, paga 12,00% ao ano" é produto fictício da plataforma. Aceitável como exemplo se dito: "Na plataforma, o CDB fictício 'Banco Invest 2027' paga 12% a.a. Na vida real, CDBs pós-fixados pagam entre ~90% e ~120% do CDI (de grandes a pequenos bancos); com CDI em ~14%, 100% do CDI equivale a ~14% a.a." (confirmar CDI atual). Evitar dar cifras de mercado que envelheçam: usar dados atuais do BC com data.

**Termos antes de introduzidos.** Selic (se a 1.3 for movida, ok), FGC (glossário ok), risco de crédito, liquidez, "emissor", CDI (precisa de definição estendida), Tesouro Direto.

**Lacunas.** Os três formatos (pré, % do CDI, IPCA+); como ler "110% do CDI"; liquidez diária x no vencimento; marcação (CDB pré não marca no extrato como Tesouro, mas se vendido no secundário, sim); FGC com exemplo numérico (aplicou R$300 mil no mesmo banco: R$50 mil descobertos; dividir em 2 bancos); risco do banco; como comparar CDB com Tesouro Selic.

**Visuais / widgets propostos.**
1. **Medidor do FGC (barra de cobertura)**: entradas: lista editável de "instituições" com valor aplicado em cada (ex: Banco A R$300 mil, Banco B R$100 mil) e se são do mesmo conglomerado (checkbox); saídas: por instituição, valor coberto (verde) e descoberto (tracejado vermelho), total coberto e a nota do teto global R$1 mi/4 anos. Fórmula: cobertoᵢ = min(valorᵢ, 250.000) por conglomerado; coberto_total = min(Σcobertoᵢ, 1.000.000) para um único evento (explicar o teto global separadamente com ícone de relógio de 4 anos).
2. **Calculadora de "% do CDI"**: entradas: % do CDI (slider 80% a 130%), CDI anual atual (campo preenchido; botão "usar CDI de hoje"), prazo; saída: taxa anual bruta equivalente e valor final bruto/líquido (usa a tabela IR da 1.5). Fórmula: taxa = %CDI × CDI. Isso elimina contas fora da plataforma.
3. **Escada de "pré, pós, IPCA+"** com um exemplo de rótulo real de CDB ("CDB 110% do CDI", "CDB 12,5% a.a.", "CDB IPCA+ 7%").
4. **Mapa de calor risco x retorno de bancos** (grandes/médios/pequenos) com selo FGC.

**Perguntas intermediárias propostas.**
1. "Você tem R$400 mil em CDB no banco X. O banco é liquidado. Quanto o FGC cobre, no máximo?" Opções: R$400 mil / R$250 mil / R$1 milhão / Nada. Erro "R$400 mil": "O limite é R$250 mil por CPF por instituição."
2. "Você tem R$200 mil em CDBs do Banco A e R$200 mil do Banco B (conglomerados diferentes). Tudo coberto?" Sim / Não. Correta: Sim (cada instituição R$250 mil). Erro "Não": confundir limite global; explicar que o teto global de R$1 mi/4 anos só atua se houver mais de um evento.
3. "O que significa um CDB que paga 110% do CDI?" Rende 10% a mais do que o CDI do período / Rende 110% ao ano / Rende o CDI mais 10 p.p. Erro: explicar com exemplo numérico (CDI 14%: 110% = 15,4%).
4. "O FGC é mantido por..." Governo / Bancos associados / Banco Central. Erro: explica a natureza privada.
5. "Este investimento é garantido pelo FGC?" para CDB / debênture / ação / LCI (classificar).

**Esforço:** G (medidor FGC e calculadora %CDI são widgets novos, reescrita de texto).

---

## Lição 1.5: Tributação regressiva de IR

**Conteúdo atual.** Cenário: CDB rendeu R$1.000 de lucro, parte vai para o IR, alíquota depende do tempo em dias corridos. Micro-decisão: 90 dias vs 800 dias, alíquota maior ou menor? (Maior). Revelação: tabela 22,5% (até 180), 20% (181-360), 17,5% (361-720), 15% (acima de 720); imposto só sobre o lucro; vale para Tesouro e CDB; LCI/LCA/CRI/CRA isentos.

**Erros factuais.**
- Tabela e dias: **correto** (Lei 11.033/2004; 22,5% até 180 dias; 20% de 181 a 360; 17,5% de 361 a 720; 15% acima de 720). Conferido.
- Estado legal 2026: a MP 1.303/2025 propôs alíquota única de 17,5% e tributação (5%) de LCI/LCA/CRI/CRA/debêntures incentivadas e **perdeu a validade em out/2025 sem ser votada**, portanto a regra segue vigente. Como essa discussão volta, recomendo uma nota "regras podem mudar; sempre confira na Receita Federal" e uma fonte de atualização.
- "Vale para todo produto de renda fixa tributado (Tesouro Direto e CDB)": ok, e também LC, debêntures comuns (com regressiva); **fundos de renda fixa** têm come-cotas (maio/novembro), mas não é produto tratado agora. Evitar "todo".
- "Isentos e nunca pagam essa alíquota" para CRI/CRA: isenção vale apenas para **pessoa física**; para pessoa jurídica há tributação. LCI/LCA idem (isenção PF).
- Faltam: **retenção na fonte** (o IR é descontado automaticamente no resgate/vencimento ou cupom; o investidor não faz DARF); **IOF regressivo** nos 29 primeiros dias (96% do rendimento no dia 1; 0% no dia 30), que só incide até aí; o prazo conta da **aplicação** (data da compra), não de cada rendimento; **base de cálculo é o rendimento, não o valor aplicado** (já dito); em resgates parciais, o IR é proporcional.
- A pergunta (90 vs 800 dias) é trivial para quem leu a tabela; aluno vai chutar "maior".

**A remover/reescrever (plataforma).** Nenhuma menção direta. "como você vai ver nas próximas lições" ok. Porém a simulação deveria cobrir o conceito para que a lição "ensine a calcular o líquido": hoje o aluno não consegue ver o efeito composto de tempo + imposto.

**Termos antes de introduzidos.** IR/alíquota (explicar "imposto de renda sobre o lucro"), "isentos", "CRI/CRA" (1.10), dias corridos x úteis (conceito não explicado). Rendimento bruto x líquido (ainda não definidos: introduzir aqui).

**Lacunas.** Bruto x líquido; passo a passo da conta (rendimento bruto, IR, líquido); gráfico da alíquota por prazo ("escada"); combinação IOF+IR; por que a regra existe (incentivar prazo longo, previsibilidade); comparação "mesma taxa bruta, prazo diferente"; impacto no cenário (R$10.000 a 12% por 6, 12, 24 meses); prazo de 180/360/720 são "dias corridos", mas alguns aprendem "6 meses" etc.

**Visuais / widgets propostos.**
1. **Escada de alíquotas interativa (gráfico em degraus)**: eixo x = dias corridos (0 a 900), eixo y = alíquota; um cursor arrastável (ou input de dias) destaca o degrau atual e mostra "faltam N dias para cair para 20%". Entradas: dias; saídas: alíquota, e linha vertical tracejada nos limiares 180/360/720.
2. **Calculadora de líquido do resgate**: entradas: valor aplicado, taxa bruta anual (a.a.), prazo em dias. Saídas: rendimento bruto, IOF (se <30 dias), IR, **valor líquido** e **rentabilidade líquida a.a.**. Fórmulas: bruto = V × ((1+i)^(d/365) − 1); IOF = bruto × [(100 − d×(100/30))/100] para d<30 (tabela oficial IOF, dia 1 = 96% … dia 29 = 3%); IR = alíquota(d) × (bruto − IOF); líquido = V + bruto − IOF − IR. É a mesma calculadora do Mercado, embutida na lição (hoje `FixedIncomeComparisonForm` tem a lógica de IR via `useFixedIncomeTaxRateQuery`, que chama o motor; reaproveitar o hook com valores iniciais da lição).
3. **Barras empilhadas**: lucro bruto = parte do IR + parte líquida, 4 barras (180, 360, 720, 721+ dias).

**Perguntas intermediárias propostas.**
1. "Você aplicou R$10.000 num CDB e resgata com 400 dias. Qual a alíquota de IR sobre o lucro?" Opções: 22,5% / 20% / 17,5% / 15%. Erro por opção: "20% vale de 181 a 360 dias" etc.
2. "Falta 1 semana para completar 360 dias. Resgatar agora ou esperar? (lucro de R$2.000)" Resgatar agora paga 20%; esperar paga 17,5%; calcular: diferença R$50. Opções: resgatar / esperar. A explicação mostra o cálculo.
3. "O IR de renda fixa incide sobre..." valor total aplicado / lucro / lucro + capital. Erro explicado.
4. "O IOF aparece nos primeiros ... dias" 30 / 90 / 180.
5. "Quem recolhe o IR do seu CDB?" Você via DARF / A instituição financeira, na fonte / Ninguém.

**Esforço:** M (calculadora reaproveitando hooks; escada é gráfico simples).

---

## Lição 1.6: LCI e LCA

**Conteúdo atual.** Cenário: LCI e LCA financiam imobiliário/agro, com garantia do FGC como o CDB; LCI2026 paga 9,50% a.a. vs CDB2027 12,00% ("sempre melhor o CDB?"). Micro-decisão: com 60 dias corridos de aplicação, qual rende mais líquido (LCI isento 9,5% ou CDB 12% com 22,5% IR)? (LCI). Revelação: calcula taxa bruta equivalente = isenta ÷ (1 − alíquota): 9,50÷0,775 ≈ 12,26% (LCI vence com 22,5%); 9,50÷0,85 ≈ 11,18% (CDB vence com 15% ≥ 720 dias); conclusão depende do prazo. Cartões 3 e 4 com `[revelar]` ("Ver resultado").

**Erros factuais.**
- Aritmética: **correta** (9,5/0,775 = 12,258; 9,5/0,85 = 11,176).
- **Prazo mínimo (carência) de LCI/LCA ignorado, e o exemplo de 60 dias é irreal.** A regulamentação (Resolução CMN 5.118/2024) elevou os prazos mínimos e depois, a partir de maio/2025, ficou em **6 meses (pré/pós-fixados)**; para LCI indexada ao IPCA, 36 meses, e LCA IPCA, 12 meses (conferir a redação atual no BC/B3 antes de publicar). Resgatar uma LCI aos 60 dias não é possível pela emissão primária (somente venda no mercado secundário se houver liquidez). Hoje o exemplo ensina algo impossível. Mudar o dia do exemplo para 180 (limite da faixa 22,5%) e 360/720.
- O texto diz LCI2026 9,50% a.a. vs CDB2027 12%; os prazos são diferentes (LCI vence 2026, CDB 2027): comparação desigual. Alinhar vencimentos.
- "LCI e LCA têm garantia do FGC igual ao CDB": correto (sim, FGC cobre; mesmos limites R$250 mil/instituição e R$1 mi/4 anos, ver 1.4).
- "Isentos de IR": verdadeiro apenas para **pessoa física**. A isenção está vigente em 2026 (MP 1.303/2025 caducou em out/2025); alterações legislativas ainda podem retornar.
- Falta: a LCI financia crédito imobiliário (o banco usa os recursos para financiar imóveis e lastro em créditos imobiliários garantidos por hipoteca/alienação fiduciária), a LCA financia agro (lastro em direitos creditórios do agronegócio). Característica: **lastro**. Não explicado.
- "Compare taxa bruta equivalente" é uma conta que o aluno deveria poder fazer num widget (autor item 5): hoje o aluno precisa sair da plataforma para recalcular com outros números.
- Rótulo "sempre a escolha melhor?" no cenário é retórico e ok.
- Liquidez/carência: não há resgate antecipado como no Tesouro; liquidez no vencimento ou após carência.

**A remover/reescrever (plataforma).** Os nomes de produto fictícios (LCI2026, CDB2027) são ok se identificados como exemplos; porém "Compra real de LCI (LCI2026) e LCA (LCA2026) no Mercado" em `unlocksDescription` deve ser reescrito como "Você já pode comprar LCI e LCA no Mercado simulado" (evitar "real" que contradiz a simulação). Também: após o botão "Ver resultado", o aluno não calcula nada.

**Termos antes de introduzidos.** Taxa bruta equivalente (glossário, ok), isenção (IR, 1.5 ok), agronegócio/imobiliário ok, carência (não introduzido), lastro (não introduzido), pessoa física x jurídica.

**Lacunas.** Carência mínima de LCI/LCA; lastro e função econômica (crédito imobiliário e agro); isenção só PF; comparar sempre pelo líquido e pelo mesmo prazo/risco; breakeven (qual alíquota/prazo empata); % do CDI equivalente (LCI 90% CDI vs CDB 110% CDI, o mesmo exemplo de `DEFAULT_PRODUCTS` da calculadora); risco regulatório (mudança futura de regras); LCI/LCA com liquidez diária existem em alguns bancos digitais, mas com taxa menor.

**Visuais / widgets propostos.**
1. **Comparador "Líquido x Líquido" embutido na lição** (reuso de `FixedIncomeComparisonForm`, parametrizado pelo seed: produto A = LCI isenta 9,5%, produto B = CDB 12%, prazo inicial 180). Adicionar:
   - Entradas: taxa A (isenta/tributada, toggle), taxa B, valor, prazo (slider 60 a 1.080 dias, marcando 180/360/720 e carência).
   - Saídas: valor líquido de cada um, **vencedor destacado**, **taxa bruta equivalente calculada automaticamente** (isenta ÷ (1−alíquota)), e botão "usar a taxa de equilíbrio" que preenche B com a equivalente (elimina a necessidade de calcular fora).
   - Gráfico de linhas: valor líquido das duas opções ao longo do prazo, com o ponto de cruzamento marcado (breakeven por prazo); degraus marcados nos 180/360/720.
2. **Slider "Prazo" com a escada de alíquota** (reaproveita widget da 1.5); o aluno vê o breakeven mover.
3. **Tabela "taxa bruta equivalente" por faixa de IR**: 4 linhas (22,5/20/17,5/15%) para uma LCI informada pelo usuário; cada célula = isenta÷(1−alíquota). Elimina o botão "Ver resultado" por uma tabela que se atualiza ao digitar a taxa.
4. Ícones "Imóvel" e "Trator" para lastro, com 2 frases curtas.

O botão "Ver resultado" (reveal) deve ser substituído por interação: o aluno faz uma previsão (escolher A ou B) e em seguida move o slider de prazo para ver quando a previsão se inverte. O reveal não calcula nada e não tem estado compartilhado com o widget.

**Perguntas intermediárias propostas.**
1. "LCI paga 9,5% isento; CDB paga 12% bruto. Resgate em 12 meses (alíquota 20%). Qual rende mais líquido?" Opções: LCI / CDB / Empatam. Correta: CDB? Calcular: 9,5÷0,80 = 11,875% < 12%: CDB vence marginalmente. Erro: mostrar o cálculo; observação de que a margem é pequena.
2. "Para um prazo de 3 anos, a alíquota do CDB é 15%. Qual taxa bruta de CDB empata com uma LCI isenta de 10%?" Opções: 10,0% / 11,76% / 12,5% / 8,5%. Correta: 11,76% (10÷0,85). Erro: "Dividimos pela fração que sobra depois do imposto (1 − 0,15)".
3. "LCI e LCA têm FGC?" Sim, até R$250 mil por CPF por instituição / Não / Só a LCI. 
4. "Posso resgatar uma LCI no primeiro mês?" Sim, sempre / Não, existe carência mínima / Só com multa. Correta: não (carência mínima de 6 meses para pré e pós-fixadas; confirmar). Erro: explica regra CMN.
5. "A isenção de IR da LCI vale para quem?" Pessoa física / Qualquer investidor / Só quem investe há 2 anos.

**Esforço:** G (comparador com gráfico de breakeven; reaproveita a calculadora existente).

---

## 4. Problemas transversais (todas as 6 lições)

1. **Telas só de texto:** cada cartão é um parágrafo. Proposta de infraestrutura: novo `visualType` ou lista de `blocks` por cartão no seed (`{kind: 'text'|'chart'|'table'|'widget', ...}`), em vez de depender de um único `microDecisionType`. Mínimo viável: permitir um campo `scenarioWidget`/`revelationWidget` (enum) renderizado no último cartão do passo.
2. **Biblioteca de widgets reutilizáveis** (priorizar, o mesmo componente serve a várias lições): (a) `RateTypesChart` (pré/pós/híbrido), (b) `PuLineChart` (LFT x prefixado), (c) `NetReturnCalculator` (bruto, IOF, IR, custódia, líquido), (d) `TaxStaircase` (alíquota por prazo), (e) `FgcCoverageMeter`, (f) `CdiPercentCalculator`, (g) `InflationSelicSeesaw`, (h) `CopomCalendar` + histórico real Selic x IPCA, (i) `BreakevenComparator` (evolução do `FixedIncomeComparisonForm`). Cinco deles se apoiam em `computeFixedIncomeComparison` e `useFixedIncomeTaxRateQuery` que já existem.
3. **Mais perguntas por lição:** hoje 1 pergunta por lição, com a opção de "errar e continuar". Proposta: passo 2 vira lista de 2 a 4 perguntas (campo `microDecisions[]`), cada uma com `explanationByOption[]`; pergunta de tentativa ilimitada com bloqueio de avanço até acertar; XP somente na primeira tentativa (mantém a recompensa por acerto de primeira e evita que a repetição vire farm). Backend: `advanceLesson` precisa rejeitar avanço sem resposta correta no passo 2 (hoje aceita) e persistir tentativas; frontend: `canAdvanceMicroDecision` exige acerto; o selo de erro mostra a explicação da opção escolhida (não só a resposta certa).
4. **Bloco "No mundo real x Na plataforma":** componente `PlatformNote` no markup de lição (ex: `{{plat:...}}`), visualmente distinto, usado apenas quando a plataforma difere do real (calendário do Copom, produtos fictícios, escala de tempo). Regra: nunca misturar no mesmo parágrafo.
5. **Valores "vivos" do mundo real** (Selic meta, CDI, IPCA 12m, meta) nas lições devem vir de fonte oficial datada ("dado de 17/jun/2026, fonte BCB SGS"), não de números colados no texto que envelhecem. Sugestão: série estática atualizada por job mensal ou chamada à API SGS do Banco Central via backend (cache no Redis).
6. **Higiene do seed:** teste automatizado que falha em `TCC`, `spec`, `simulad` e `nesta plataforma` no texto visível fora de blocos `PlatformNote`; e o lint de termos da seção 2.
7. **Contas fora da plataforma:** a 1.6 pede para dividir manualmente por (1−alíquota); 1.5 pede para cruzar faixas de dias; 1.2 e 1.4 não oferecem como estimar rendimento. Todas resolvidas pelos widgets (c), (d), (f), (i).

## 5. Resumo de esforço

| Lição | Principais ações | Esforço |
|---|---|---|
| 1.1 | Adicionar híbrido; remover referência ao bônus; widget pré/pós/híbrido; 3 perguntas | M |
| 1.2 | Corrigir pergunta do PU; IOF/custódia/IR; remover frase da spec; simulador; reordenar após Selic | G |
| 1.3 | Reescrever (mundo real: 8/ano, ~45 dias, meta 3% ±1,5, meta x over); `PlatformNote`; gangorra, linha do tempo, gráfico histórico | G |
| 1.4 | FGC completo (R$1 mi/4 anos, conglomerado, o que não cobre); CDI melhor; % do CDI; medidor FGC | G |
| 1.5 | IOF, retenção na fonte, escopo da isenção; escada de alíquotas; calculadora de líquido | M |
| 1.6 | Carência de 6 meses (exemplo de 60 dias irreal); lastro; isenção só PF; comparador com breakeven; eliminar "Ver resultado" | G |

Total estimado: 4 G + 2 M; os widgets (c), (d), (i) compartilham código e valem fazer primeiro.

## 6. Fontes consultadas (web)

- FGC: R$250 mil por CPF/CNPJ por instituição, teto de R$1 milhão a cada 4 anos, coberturas e exclusões: https://www.fgc.org.br e resumos em https://statusinvest.com.br/noticias/fgc-o-que-e-o-fundo-garantidor-de-credito-e-como-ele-protege-seus-investimentos/amp/ e https://www.taxgroup.com.br/intelligence/fgc-o-que-e-e-como-funciona-a-protecao-do-seu-dinheiro/
- Copom: 8 reuniões/ano, decisão vale ~45 dias; calendário 2026 e decisões (jan 15,00%; mar 14,75%; abr 14,50%; jun 14,25%): https://renovainvest.com.br/blog/reuniao-do-copom-veja-o-calendario-completo-de-2023/ (conferir no site do BCB: https://www.bcb.gov.br/controleinflacao/calendarioreunioescopom). Os resultados de busca citaram Selic de 13,75% em set/2026; validar o valor atual no BCB antes de usar em texto.
- Meta de inflação contínua 3% com tolerância de 1,5 p.p. e descumprimento após 6 meses: https://www.bemparana.com.br/noticias/economia/cmn-fixa-meta-de-inflacao-em-300-para-2025-com-margem-de-15-pp-738/amp/ e https://acionista.com.br/ipca-de-junho-faz-brasil-estourar-novo-modelo-de-metas-de-inflacao/
- Poupança (Selic > 8,5%: 0,5% a.m. + TR; Selic <= 8,5%: 70% da Selic + TR; depósitos após 4/5/2012) e TR (calculada pelo Banco Central a partir das taxas de juros de mercado; hoje zerada): https://www.coad.com.br/home/noticias-detalhe/53001/com-aumento-da-taxa-selic-poupanca-volta-a-ter-rendimento-por-regra-antiga e https://investnews.com.br/guias/taxa-referencial-o-que-e/
- LCI/LCA: prazo mínimo 6 meses para pré/pós-fixados desde maio/2025, IPCA 36 meses (LCI) e 12 meses (LCA); MP 1.303/2025 (5% sobre emissões novas) caducou em out/2025, isenção de PF mantida: https://investnews.com.br/guias/lci-e-lca/ e https://conteudos.xpi.com.br/renda-fixa/relatorios/lcis-e-lcas-ainda-valem-a-pena-apos-a-nova-regra-do-cmn/
- Tabela regressiva de IR (Lei 11.033/2004), IOF regressivo dos 30 primeiros dias, taxa B3 de 0,20% a.a. do Tesouro Direto: conhecimento de domínio, NÃO verificado nesta rodada via fetch; confirmar em https://www.tesourodireto.com.br e https://www.gov.br/receitafederal antes de publicar.

Itens que exigem validação adicional antes de virarem texto: valores exatos de carência por tipo de LCI/LCA em vigor hoje, isenção de custódia B3 para Tesouro Selic, e a Selic/CDI atual.
