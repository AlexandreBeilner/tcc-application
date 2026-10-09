# Auditoria das lições 2.1–2.5 e 2.6.1–2.6.6 (Trilha 2, Renda Variável)

Fonte lida: `backend/src/db/seedLessons.ts` (linhas 699–1100), `frontend/src/pages/Lesson/index.tsx`, `frontend/src/features/lessons/glossary`, `splitIntoCards`, `components/organisms/EquityIndicatorsPanel`.
Validação web: Lei 15.270/2025 (dividendos), lote padrão/fracionário/sufixos B3 (ver "Fontes" no fim). Onde marquei **[verificar]** o fato é de memória/hedge e deve ser conferido na B3/CVM antes de virar texto.

---------------------------------------------------------------------
## 0. Achados transversais (valem para as 11 lições)

### 0.1 Mecânica da lição (frontend)
- Estrutura fixa de 4 passos: Cenário, Micro-decisão (1 pergunta com 2–3 opções), Revelação, Desbloqueio. Cada passo é texto em cartões (`\n\n`). Nenhuma lição 2.x usa `[revelar]`, então o "Ver resultado" ruim (item 5 do autor) não ocorre aqui; o problema aqui é outro: **não há nenhuma interação além de 1 clique em opção**.
- Widgets embutidos existem só para `growth_calculator` e `fixed_income_comparison` (`EMBEDDED_WIDGET_TYPES`). Para `live_indicator` (2.6.1–2.6.6) o único "visual" é o `EquityIndicatorsPanel` (grade de 9 números) mostrado na Revelação, idêntico nas 6 lições.
- **Bug de coerência 2.6.1**: o texto promete "o painel calculado ao vivo" dos seis números (Receita, EBIT, Lucro Líquido, PL, Dívida Bruta, Caixa), mas `EquityIndicatorsPanel` só exibe P/L, P/VP, LPA, VPA, ROE, Margem EBIT, Margem Líquida, Dívida Líquida/EBIT e DY. Os seis valores-base nunca aparecem. Além disso, se a empresa ainda não tem relatório, o painel retorna `null` e o texto continua dizendo "veja abaixo".
- Erro não bloqueia: o clique em "Continuar" envia `selectedOption`, o servidor devolve acerto/erro e a lição avança de qualquer forma. Uma tentativa só, sem dica, sem retry. Alinha com o item 7 do autor: precisa de "tentar de novo com dica" (ver 0.5).
- Glossário (`glossary/index.ts`) tem só 6 termos (FGC, marcação a mercado, deságio, taxa bruta equivalente, EBIT, Dividend Yield). Nenhum termo da Trilha 2 além de EBIT/DY. `{{EBIT}}` é usado em 2.6.5 mas o termo só aparece 1 vez no texto e é definido no mesmo cartão (2.6.1) que já o define entre parênteses, ou seja, redundância sem ganho; `{{Dividend Yield}}` não é usado em 2.6.6 (o título é o próprio termo).

### 0.2 Menções proibidas (TCC/spec/plataforma) em texto visível, escopo desta auditoria
| Onde | Trecho | Visível ao aluno? |
|---|---|---|
| 2.5 `centralConcept` (l.854) | "Formação de preço no livro de ofertas (TCC cap. 2.3.3)" | Provável (centralConcept aparece no mapa/trilha; conferir `TrackHub`). Remover de qualquer forma. |
| 2.6.5 `revelationText` (l.1056) | "mais sensível a mudanças na Selic (spec 3.2.2)" | **Sim, Revelação.** |
| 2.5 `revelationText` | "o motor de pareamento", "toda ação, ETF e FII desta plataforma" | Sim |
| 2.2 `revelationText` | "o Mercado ao vivo desta plataforma simula" | Sim |
| 2.3 `revelationText` | "Esta plataforma não tem unit negociável no catálogo" | Sim |
| 2.4 `revelationText` | "Por isso esta lição vem logo depois de você já poder operar... (lição 2.3)", "libera o painel de notícias" | Sim (meta-pedagogia + produto) |
| 2.6.1 `scenarioText` | "o motor de simulação gera um relatório financeiro dela a cada ciclo" | Sim |
| 2.6.6 `revelationText` | "tela de Detalhe do Ativo", "o último dos 9 indicadores fundamentalistas do currículo" | Sim |
| Comentários do seed (cabeçalho, `TCC cap. 2.1.1` na 0.2) | só código | Não visível (fora do escopo, mas varrer a 0.2 e demais). |

Varredura recomendada (CI): `grep -niE "TCC|spec |cap\. [0-9]|plataforma|simula|motor|ciclo|currículo|Mercado ao vivo|desta tela" seedLessons.ts` e falhar se o match estiver em string de campo de conteúdo (não comentário). Cuidado: "plataforma" pode ser legítimo na seção "como é na plataforma".

### 0.3 Padrão proposto para o contraste real x plataforma
Hoje a lição fala da plataforma como se fosse o mundo. Proposta: toda lição ganha, na Revelação, um cartão final padronizado (componente `RealVsPlatform`, visual de duas colunas, mobile empilhado):
- **No Brasil real**: como é (com fonte/órgão: B3, CVM, Receita).
- **Aqui no app**: como é simulado.
- **Por quê**: razão da simplificação (dados sintéticos, ritmo acelerado, empresa fictícia).
Isso desloca todas as frases "o motor", "esta plataforma", "o feed" para um lugar rotulado e some do corpo da lição. Empresas fictícias (VALR3, BNDD3/4) continuam como laboratório, mas cada conceito é ensinado primeiro com **exemplo real arredondado e datado** (ex: "Em 2024, uma grande mineradora...") marcado "ilustrativo"; evitar números reais exatos sem data de fonte.

### 0.4 Ordem de introdução de termos (mapa global)
| Termo | Onde é USADO primeiro (2.x) | Onde é INTRODUZIDO de fato | Ação |
|---|---|---|---|
| ação/sócio | 2.1 | 2.1 | ok |
| dividendos | 2.1 (entre parênteses, 1 linha) | 2.7 (aula própria, depois do DY 2.6.6) | DY (2.6.6) antes de dividendos (2.7): inverter ou fundir |
| ticker (conceito) | 2.1 ("VALR3") e 2.2 ("VALR3 ou BNDD4") | 2.3 | mover 2.3 antes da 2.2 ou definir inline em 2.1 |
| ON/PN | 2.3 pergunta | 2.3 revelação (a pergunta exige conhecer a regra do final 3/4, que só é dada depois da resposta) | ensinar regra antes de perguntar |
| mercado primário/secundário | 2.2 prompt ("ações novas") | 2.2 revelação | definir antes da pergunta |
| Selic | 2.4, 2.6.5 | 1.3 (ok) | ok |
| evento macro, setor, Agronegócio | 2.4 | setor só em 2.8 (depois) | definir "macro" e "setor" inline em 2.4 |
| livro de ofertas/ordem passiva/pareamento | 2.5 | 2.5 (ordem passiva usada na revelação sem definir) | definir ou omitir |
| ordem a mercado x limitada, bid/ask, spread, liquidez | em lugar nenhum de 2.x | não introduzido | faltando: criar na 2.5 |
| Receita Líquida, EBIT, LL, PL, Dívida Bruta, Caixa | 2.6.1 | 2.6.1 (ok, 1 frase cada) | aprofundar (ver lição) |
| margem | 2.6.2 | 2.6.2 | ok |
| alavancagem | 2.6.5 `centralConcept` | nunca definida | definir em 2.6.3/2.6.5 |
| LPA, VPA | 2.6.4 revelação | 2.6.4 | ok, mas a pergunta já fala "Lucro por ação" |
| payout, JCP, data com/ex, proventos | 2.6.6 ("proventos") | 2.7 | introduzir antes do DY |
| valor de mercado (market cap), nº de ações | 2.6.4 implícito | nunca | adicionar |
| ITR/DFP/fato relevante/CVM/RI | nenhum | nunca | adicionar em 2.6.1 / 2.4 |

### 0.5 Perguntas intermediárias, mecânica proposta
- Cada lição passa a ter 3–5 "checkpoints" intercalados entre os cartões de explicação (não só 1 antes da revelação): tipos: múltipla escolha, verdadeiro/falso, numérica (campo com tolerância), arrastar-e-soltar, classificar.
- Regras: erro não avança; mostra dica graduada (1ª tentativa: dica leve; 2ª: dica forte; 3ª: revela a resposta com explicação e o item volta mais tarde como revisão); tentativas ilimitadas; XP só decai na 3ª tentativa, nunca bloqueia. Requer mudança de contrato (`microDecisionOptions` vira lista de `checkpoints` com `afterCardIndex`). Fora do escopo desta auditoria detalhar API.

### 0.6 Grafo de pré-requisitos (proposto)
Atual (ordem sortOrder 17–27): 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6.1 → 2.6.2 → 2.6.3 → 2.6.4 → 2.6.5 → 2.6.6 → 2.7.
Dependências conceituais reais:
```
1.x (juros, Selic, IPCA, renda fixa, IR) ─┐
2.1 Ação ──┬─> 2.3 Tickers ──> 2.2 IPO (usa ticker; primário/secundário)
           │                     │
           │                     └─> (NOVA) Mercado secundário, B3, corretora, ordens ─> 2.5 Oferta e demanda ─> 2.4 Notícias
           │
           └─> 2.6.1 Balanço/DRE ──> 2.6.2 Margens ──> 2.6.3 ROE ──┐
                                  └─> 2.6.5 Endividamento ──────────┤
2.5 (preço) + 2.6.1 (LL, PL, nº de ações) ──> 2.6.4 P/L, P/VP ──────┤
2.7 Dividendos/data com/JCP/payout ──> 2.6.6 Dividend Yield ────────┘ ──> 2.8 Setores
```
Reordenação sugerida: **2.1, 2.3 (tickers), 2.2 (IPO), [nova: Como a ação é negociada: B3, corretora, ordens, mercado primário x secundário], 2.5 (oferta e demanda), 2.4 (notícias), 2.6.1, 2.6.2, 2.6.5 (endividamento), 2.6.3 (ROE, já com alavancagem), 2.6.4 (P/L, P/VP), 2.7 (dividendos), 2.6.6 → renomear 2.7b (DY) logo depois da 2.7.** Justificativa: notícias só fazem sentido depois de entender como o preço reage (oferta e demanda); DY só depois de dividendos; ROE precisa de alavancagem para não induzir erro.
Nota: manter `stableKey`/`code` existentes; reordenar muda `sortOrder`/`code` (cuidado com a renumeração: achado 010 e M.6 já cobrem isso via `stableKey`).

---------------------------------------------------------------------
## Lição 2.1 — O que é uma ação

**Conteúdo atual**: Cenário: comprar VALR3 (fictícia) não é emprestar, é virar sócio; esta trilha trata do resto do patrimônio. Micro-decisão: "retorno é conhecido de antemão?" (Sim/Não, correta: Não). Revelação: retorno depende da empresa e do preço; valorização + dividendos; sem garantia de capital nem vencimento. 3 parágrafos curtos.

**Erros/imprecisões factuais**
- Nenhum erro grave, mas "dona de uma parte proporcional do que ela vale e do que ela lucra" confunde: o acionista tem direito a participar de lucros **distribuídos** (dividendos) e a voto (se ON), não a uma "parte do lucro" automática; o lucro retido valoriza a empresa, não vai ao bolso.
- "Sem prazo de vencimento" correto. Falta contrapor que **a ação é de empresa de capital aberto (S.A.) registrada na CVM**, negociada na B3.
- Pergunta é retórica (a resposta está dada no contraste do cenário) e tem alternativa implausível.

**Menções plataforma/TCC**: "Trilhas 0 e 1", "Mercado" (aba do app) no Desbloqueio; VALR3 é fictícia sem aviso de que é ilustrativa.

**Termos antes de introduzidos**: "ticker/VALR3" (2.3), "dividendos" (só 1 linha aqui; aula na 2.7), "renda variável" (definida só no fim).

**Lacunas de profundidade (o que o iniciante brasileiro precisa)**
- Capital social dividido em ações; companhia aberta x fechada; B3 (Brasil, Bolsa, Balcão); papel da CVM.
- Direitos do acionista: voto (ON), dividendos (mínimo obrigatório de 25% do lucro líquido ajustado, Lei 6.404/76 art. 202, salvo estatuto diferente), tag along (resumo), preferência na subscrição.
- **Responsabilidade limitada**: perde no máximo o investido, não responde por dívida da empresa.
- Duas fontes de retorno (valorização e proventos) com números ilustrativos; risco: preço oscila diariamente, é possível perder tudo (empresa falida: acionista é o último na fila, atrás de credores).
- Ação x empresa: preço da ação não é "valor da empresa"; valor de mercado = preço x nº de ações.
- Comparação honesta com renda fixa: "Selic é o benchmark, a ação precisa compensar o risco".
- Custos e impostos básicos de PF: corretagem (muitas zeradas), emolumentos B3; IR 15% sobre ganho em swing trade, **isenção em vendas de até R$20 mil no mês (ações)**, day trade 20%; dividendos: ver 2.6.6/2.7. **[verificar]** regras vigentes antes de escrever (houve MP 1.303/2025 propondo mudanças que perdeu validade; confirmar status).
- Lote padrão 100 e fracionário (ticker + "F", 1 a 99 ações): validado na web (Serasa/Suno/Inter). Falta dizer se a plataforma permite fração.

**Proposta de visual/widget: "Seja sócio" (calculadora de participação)**
- Entradas: nº de ações da empresa (total), preço da ação, quanto o aluno investe (R$), lucro anual da empresa, % distribuído (payout, slider 0–100%).
- Saídas: ações compradas, % do capital que possui (barra "pizza" com a fatia do aluno), valor de mercado (preço x nº ações), LPA, dividendo que recebe = LPA x suas ações x payout, e comparação lado a lado com CDB/Tesouro Selic do mesmo valor (usa taxa real da Selic atual).
- Fórmula: `ações = floor(R$ / preço)`; `participação = ações / total`; `dividendo = participação x lucro x payout`.
- Cenário do botão "e se o lucro cair 50%?": mostra dividendo caindo e preço tipicamente reagindo (seta). Linha do tempo de 12 meses de preço sintético mostrando oscilação (sparkline) para contrastar com linha reta da renda fixa.

**Perguntas intermediárias propostas**
1. (V/F) "Se a empresa quebrar, o acionista responde pelas dívidas com seu patrimônio pessoal." F: responsabilidade limitada.
2. (Numérica) Empresa com 1 milhão de ações; você compra 10 mil. Que % você possui? (1%).
3. (Múltipla) Qual NÃO é um direito de acionista? (garantia de retorno mínimo).
4. (Classificar) Fontes de ganho: valorização, dividendos, juros contratados (esta última é renda fixa).
5. (Numérica no widget) Com lucro R$ 100 mi, payout 40%, 2% do capital: quanto de dividendo você recebe? (R$ 800 mil).

**Esforço**: M (conteúdo reescrito + widget de participação, sem backend novo se usar taxa Selic já existente).

---------------------------------------------------------------------
## Lição 2.2 — IPO

**Conteúdo atual**: Cenário: antes de comprar VALR3/BNDD4 elas abriram capital em IPO (Initial Public Offering). Micro-decisão: quando você compra meses depois de outro investidor, o dinheiro vai para o caixa? (Não). Revelação: IPO = mercado primário (empresa emite ações novas e capitaliza); depois, mercado secundário entre investidores; é o secundário que o "Mercado ao vivo desta plataforma" simula.

**Erros/imprecisões factuais**
- Afirmação "o IPO acontece no mercado primário: a empresa emite ações novas e capitaliza o caixa" é **incompleta**: ofertas podem ser **primárias** (ações novas, dinheiro para a companhia), **secundárias** (sócios vendem ações já existentes, dinheiro vai para os vendedores) ou mistas; é comum a mista. O texto sugere que todo IPO é primário.
- Falta o termo **follow-on** (oferta subsequente) como outra operação do mercado primário (o enunciado diz "depois disso, tudo é secundário", mas empresas listadas voltam ao primário em follow-ons).
- "deixar de ser propriedade de um grupo fechado de donos": o fundador normalmente mantém o controle; omitir isso passa ideia errada de "perder a empresa".
- Não explica que a oferta é regulada pela CVM (Resolução CVM 160/2022 é a norma de ofertas públicas **[verificar número]**), exige prospecto e registro.

**Menções plataforma/TCC**: "Mercado ao vivo desta plataforma", "como você vai ver na lição de oferta e demanda" (meta).

**Termos antes de introduzidos**: ticker (VALR3, BNDD4); "capital", "emitir", "mercado primário" (aparece em pergunta antes de definido); "caixa".

**Lacunas**
- Por que uma empresa abre capital (captar sem dívida, liquidez para sócios, visibilidade, governança), custos e obrigações (balanços trimestrais ITR, DFP anual, fatos relevantes, governança, segmentos de listagem: Novo Mercado, Nível 1/2, Básico).
- Fases: contratação de coordenadores (bancos), registro na CVM, prospecto, **roadshow**, **bookbuilding** (coleta de intenções de investimento que define o preço por ação), faixa indicativa de preço, reserva do pequeno investidor, **lock-up** (sócios impedidos de vender por período), estabilização, primeiro dia de negociação, estreia e risco de IPO (fila, "pop" e queda posterior).
- Preço do IPO x preço de estreia; participação PF via corretora (reserva), rateio.
- Mercado primário x secundário como conceito central do mercado de capitais (aula curta própria).
- Fechamento de capital e delisting (menção).

**Proposta de visual/widget: "Simulador de bookbuilding"**
- Entradas: nº de ações ofertadas, % primária x secundária (slider), faixa de preço (mín–máx), lista de ordens de investidores (nome, quantidade, preço máximo que aceita; 8–10 ordens pré-prontas, o aluno edita 1–2).
- Saída: gráfico de demanda acumulada (escada decrescente por preço); linha de oferta; **preço de corte** = maior preço em que a demanda acumulada cobre a oferta; "oferta coberta N vezes"; caixa que entra na companhia = ações primárias x preço; dinheiro dos vendedores = secundárias x preço; valor de mercado pós-IPO; % de diluição dos sócios antigos.
- Fórmula: `preçoCorte = max{p : Σ qtd(ordens com limite ≥ p) ≥ ofertadas}`; `caixaEmpresa = primárias x preçoCorte`; `diluição = novas / (antigas+novas)`.
- Faixa de cores: dentro/ fora da faixa; mostra "cobertura > 1" como sinal de demanda.
- Segundo painel: linha do tempo horizontal clicável (decisão do IPO → registro CVM → roadshow → bookbuilding → liquidação → estreia).

**Perguntas intermediárias**
1. (V/F) "No IPO sempre há emissão de ações novas." F (pode ser só secundária).
2. (Classificar) Para onde vai o dinheiro? (oferta primária: empresa; secundária: sócios vendedores; compra na bolsa dia seguinte: o vendedor da ordem).
3. (Numérica no simulador) Oferta de 10 mi de ações a R$ 20, 100% primária: quanto entra no caixa? (R$ 200 mi).
4. (Múltipla) O que é lock-up?
5. (Ordenar) Fases de um IPO.

**Esforço**: M a G (simulador de demanda acumulada com gráfico é o maior item; versão P: só tabela estática + quiz).

---------------------------------------------------------------------
## Lição 2.3 — Nomenclatura de tickers

**Conteúdo atual**: Cenário: BNDD3/BNDD4, 4 letras do emissor + número. Micro-decisão: "BNDD3 vota, BNDD4 tem prioridade em dividendos sem voto; qual é ON e qual é PN?" Revelação: 3 = ON (voto), 4 = PN (sem voto, prioridade em dividendos e capital na liquidação); final 11 = ETF/FII/unit (ex. SANB11); "esta plataforma não tem unit"; desbloqueia primeira compra real (VALR3) e `asset:acao`.

**Erros/imprecisões factuais**
- Estrutura correta (4 letras + número). Falta o resto da convenção B3: **3 = ON, 4 = PN, 5/6/7/8 = PNA/PNB/PNC/PND (classes de preferenciais)**, **11 = units, ETFs e FIIs/Fiagros etc.**, **32–35 (e 39) = BDRs** (validado em fontes de tickers; **[verificar]** detalhe de cada número de BDR na B3), sufixo **F = mercado fracionário** (validado: ex. BIDI4F).
- A pergunta pede para adivinhar ON x PN a partir de uma descrição que só se resolve conhecendo a regra do final 3/4. A resposta correta só aparece depois: **pergunta sem informação suficiente**, aprendizado por adivinhação.
- "PN prioridade em dividendos": real: dividendo mínimo prioritário (ao menos 3% do valor do PL da ação, ou 10% maior que o da ON, conforme estatuto, Lei 6.404 art. 17) e prioridade no reembolso de capital. PN geralmente sem voto, com exceções. Limite legal de PN: até 50% do capital total das companhias abertas (Lei 6.404 art. 15 §2º; **[verificar]**).
- Não menciona **tag along** (ON no Novo Mercado 100%; minoritários PN podem ter 80% do ON conforme segmento) nem o movimento do mercado de unificar classes (Novo Mercado só tem ON).
- "As quatro letras identificam o emissor": derivam do nome de pregão (ex: PETR, VALE, ITUB) e podem ser distintas da razão social; um mesmo emissor pode ter mais de um prefixo (raro).

**Menções plataforma/TCC**: "Esta plataforma não tem unit negociável no catálogo"; BNDD é fictícia sem aviso; "Primeira compra real de ações (VALR3) no Mercado" (unlock).

**Termos antes de introduzidos**: ON/PN (usados na pergunta), "unit", "ETF", "FII" (lições 2.9/2.10 citadas por número).

**Lacunas**
- Decodificador completo do ticker, com tabela de sufixos. Exemplos reais: PETR3/PETR4, ITUB4, WEGE3, VALE3, SANB11 (unit), BOVA11 (ETF), HGLG11 (FII), AAPL34 (BDR).
- Onde ver o ticker (corretora, B3, Status Invest), segmentos de listagem.
- Mercado fracionário (ticker + F) e lote padrão de 100.
- Eventos que mudam o ticker (fusão, conversão PN→ON, grupamento/desdobramento: **desdobramento/grupamento** merece menção: preço da ação cai/sobe sem mudar valor da empresa).

**Proposta de widget: "Decodificador de ticker"**
- Entrada: campo de texto (autocompletar com exemplos). Saída: card que separa visualmente as partes (`PETR` | `4` | `F`), mostrando emissor, classe (ON/PN/Unit/ETF/FII/BDR), direito a voto, prioridade de dividendos, lote (padrão/fracionário).
- Modo jogo: sorteia 6 tickers reais; o aluno arrasta cada um para a classe correta; feedback imediato; erro volta ao fim da fila.
- Tabela fixa ao lado: sufixo | significado | exemplo.

**Perguntas intermediárias**
1. Classifique PETR3, PETR4, SANB11, HGLG11, BOVA11, AAPL34, VALE3F.
2. (Múltipla) Que direito a PN geralmente NÃO tem? (voto) e qual tem a mais? (prioridade em dividendos).
3. (V/F) "BNDD3 e BNDD4 são empresas diferentes." F.
4. (Texto/múltipla) Ticker terminado em F: o que significa?
5. (Cenário) "Quer comprar 30 ações: ordem lote padrão ou fracionário?"

**Esforço**: M (widget decodificador + jogo de arrastar). Reescrever o fluxo para ensinar antes de perguntar.

---------------------------------------------------------------------
## Lição 2.4 — Lendo notícias de mercado

**Conteúdo atual**: Cenário: agora que você pode comprar ações, o preço se move por notícias (Selic, setor de mineração/bancário). Micro-decisão: notícia "quebra de safra afeta o Agronegócio" pesa igual para VALR3 e BNDD4? (Não, depende de quem o evento afeta). Revelação: feed reporta eventos macro, alguns de mercado inteiro, outros setoriais; identificar quem afeta; desbloqueia painel de notícias.

**Erros/imprecisões factuais**
- "Mudança na Selic afeta o mercado inteiro" é simplista: afeta setores de modo **diferente** (alta de juros tende a pressionar empresas endividadas, construção, varejo, e o valuation de ações em geral por encarecer o custo de capital; bancos podem ter spread maior mas inadimplência maior). Contradiz o texto da 2.6.5 que diz que o banco é mais sensível.
- A pergunta é trivial (resposta óbvia) e escolhe um evento (agro) sem relação clara com mineradora; para o banco, o impacto indireto via crédito rural existe, e o texto diz "sem impactar diretamente".
- Ignora o princípio central de leitura de notícia: **o preço já embute expectativas**; o que move é a **surpresa** (consenso x resultado). "Comprar no boato, vender no fato".

**Menções plataforma/TCC**: "feed de notícias reporta eventos macro", "painel de notícias", "essas notícias passam a valer pra você", "lição vem logo depois da 2.3" (meta). Todos precisam virar contraste real x plataforma.

**Termos antes de introduzidos**: "evento macro" (macroeconomia), "setor", "Selic" (ok, 1.3), "perspectivas".

**Lacunas**
- Tipos de informação no Brasil: **Fato Relevante** e **Comunicado ao Mercado** (obrigações de divulgação da CVM; Resolução CVM 44), **ITR/DFP** (balanços trimestral e anual), calendário de resultados, ata do Copom e decisão da Selic (8 reuniões por ano), IPCA (IBGE, mensal), PIB, câmbio, commodities, política fiscal, Boletim Focus (BC). **[verificar]** prazos: ITR 45 dias após trimestre, DFP 3 meses após exercício (Res. CVM 80).
- Fonte primária (RI da empresa, CVM, B3, BC) x fonte secundária (portais) x ruído (redes sociais, "dicas"); golpes e "pump and dump"; ler a notícia inteira vs manchete.
- Impacto por canal: receita, custo, juros, câmbio, regulatório; exemplos reais por setor (petróleo e dólar, bancos e Selic, varejo e juros/consumo, exportadoras e câmbio).
- Horizonte: ruído de curto prazo x tese de longo prazo; não operar por manchete.

**Proposta de visual/widget: "Triagem de notícias"**
- Tela com 5–6 manchetes (reais/ilustrativas, rotuladas "exemplo"). Para cada, o aluno marca (a) setores afetados (chips), (b) direção (↑/↓/neutro) para 3 empresas-exemplo, (c) se é "surpresa" ou "já esperado" (usa tabela esperado x divulgado). Feedback comparando com gabarito e explicando o canal de transmissão.
- Segundo widget "Esperado x divulgado": entradas: lucro por ação esperado (consenso), lucro divulgado; saída: surpresa % e seta de reação típica no preço (lógica didática: surpresa positiva tende a subir; igual ao esperado tende a ficar estável), com aviso de que mercado real pode reagir ao contrário (guidance).
- Linha do tempo de um dia de Copom (decisão às 18h30 **[verificar]**).

**Perguntas intermediárias**
1. (Classificar) Fato relevante, comunicado ao mercado, balanço, postagem de rede social: qual é fonte primária?
2. (Múltipla) Selic sobe 0,5 p.p.: quem tende a sofrer mais? (empresa muito endividada).
3. (Cenário) Empresa divulga lucro de R$ 1,00/ação; consenso esperava R$ 1,20; que reação provável? (negativa).
4. (V/F) "Se a notícia é boa, o preço sempre sobe." F.
5. (Associar) Manchete -> setor afetado.

**Esforço**: M (conteúdo + triagem de manchetes com gabarito estático); G se ligar ao feed real da plataforma.

---------------------------------------------------------------------
## Lição 2.5 — Oferta e demanda

**Conteúdo atual**: Cenário: preço de VALR3 nasce do livro de ofertas (ordens de compra do maior ao menor; de venda do menor ao maior). Micro-decisão: muito mais compra do que venda, preço sobe/cai/fica igual? (Sobe). Revelação: motor de pareamento, negócio no preço da ordem passiva, ofertas de venda baratas se esgotam, preço sobe; mecanismo forma preço em tempo real de toda ação, ETF e FII "desta plataforma"; próxima lição: indicadores fundamentalistas.

**Erros/imprecisões factuais**
- O mecanismo (prioridade preço-tempo; execução no preço da ordem que estava no livro) é correto para a B3. Mas descreve só o motor da plataforma ("o motor de pareamento").
- Falta distinguir que, no real, o investidor envia a ordem à corretora, que roteia à B3; o aluno não negocia com a B3 diretamente.
- Falta: tipos de ordem (a mercado x limitada, stop), **spread** (diferença entre melhor compra e melhor venda), **liquidez**, **formador de mercado** (market maker), leilões de abertura/fechamento, tick de R$ 0,01, **cotação = último negócio**, volatilidade, circuit breaker (**[verificar]** gatilhos atuais).
- Afirma que "excesso de venda faz o caminho inverso" sem exemplo numérico; pergunta com opção "fica igual" não-didática.
- Confunde ao fim "preço formado assim" com caro/barato; preço != valor (ponte conceitual para 2.6).

**Menções plataforma/TCC**: "TCC cap. 2.3.3" no `centralConcept`; "motor de pareamento"; "desta plataforma"; "tempo real".

**Termos antes de introduzidos**: "order book/livro de ofertas" (definido inline: ok), "ordem passiva" (não definida), "pareamento", "ETF" e "FII" (aulas 2.9/2.10).

**Lacunas**
Ver acima + exemplos numéricos: livro com 3 níveis de compra e 3 de venda; compra a mercado de 1.500 ações consome 3 níveis (preço médio sobe: **slippage**). Diferença entre "preço" (último negócio) e "preço que consigo executar". Liquidez e papéis ilíquidos (spread largo). Por que ações ilíquidas são perigosas. Efeito de notícias na oferta e demanda (liga com 2.4).
Real x plataforma: no real, bilhões de ordens, HFT, formadores de mercado dão liquidez; na plataforma, bots/usuários populam o livro (é o que o redesenho do motor propõe).

**Proposta de visual/widget: "Livro de ofertas interativo"** (maior ganho de todas as lições)
- Painel com duas colunas (compra em verde, venda em vermelho) com níveis de preço/quantidade, spread destacado no meio e último negócio.
- O aluno envia: tipo (a mercado / limitada), lado, quantidade, preço (se limitada). Saídas: execução parcial/total, preço médio, ordens consumidas (animação), novo spread, novo último negócio; fila de ordens limitadas que ficaram no livro.
- Botões de cenário "chega onda de compradores" / "chega onda de vendedores" para ver o livro se deslocar.
- Gráfico de profundidade (depth chart, áreas acumuladas) opcional.
- Fórmula: execução percorre níveis opostos em ordem de preço até esgotar a quantidade; `precoMedio = Σ(qtd_i x preço_i)/Σ qtd_i`; `slippage = precoMedio − melhorPreço`.

**Perguntas intermediárias**
1. (Numérica) Melhor compra R$ 10,00, melhor venda R$ 10,05: qual o spread? (R$ 0,05).
2. (Interativa) Compre 500 a mercado: qual preço médio pago?
3. (Múltipla) Ordem limitada de compra a R$ 9,50 com melhor venda R$ 10,05: executa agora? (não; fica no livro).
4. (V/F) "O preço de uma ação é decidido pela empresa." F.
5. (Múltipla) Por que ação ilíquida pode ser perigosa? (spread largo, difícil vender).

**Esforço**: G (widget de livro de ordens didático; pode rodar 100% no frontend com dados estáticos, sem tocar o motor real).

---------------------------------------------------------------------
## Lição 2.6.1 — Lendo um balanço

**Conteúdo atual**: Cenário: por trás de VALR3 há uma empresa real, a Mineradora Vale do Rio, e o "motor de simulação gera relatório a cada ciclo" com seis números (Receita Líquida, EBIT, Lucro Líquido, PL, Dívida Bruta, Caixa). Micro-decisão (live_indicator): EBIT é maior ou menor que o LL? (Maior). Revelação: EBIT vem antes de juros e impostos, costuma ser maior; PL não é caixa; dívida bruta e caixa sozinhos não dizem endividamento (2.6.5); "veja abaixo o painel calculado ao vivo".

**Erros/imprecisões factuais**
- Título "Lendo um balanço" mas os seis números misturam **DRE** (Receita, EBIT, Lucro) e **Balanço Patrimonial** (PL, Dívida, Caixa). Nunca se diz que são demonstrações diferentes (DRE, Balanço Patrimonial, DFC) nem se explica a equação Ativo = Passivo + PL.
- "Patrimônio Líquido (o que a empresa vale, descontadas as dívidas)": **valor contábil**, não o que a empresa vale no mercado; confundido com valor de mercado. A revelação ("diferença entre tudo que tem e deve, acumulada") ajuda mas contradiz o cenário.
- "EBIT (antes de juros e impostos)": mais exato: antes do resultado financeiro e do IR/CSLL. Apesar de o EBIT ser "costuma ser maior que LL", **nem sempre**: empresa com muito caixa e receita financeira, ou com benefício fiscal, pode ter LL > EBIT; o mesmo vale para equivalência patrimonial. A questão-quiz com resposta absoluta "Maior" é imprecisa; reformular como "em geral".
- "Receita Líquida" é receita bruta menos deduções (impostos sobre vendas, devoluções, abatimentos); não definida.
- "Lucro Líquido: o que sobra depois de tudo": no Brasil o número que importa para indicadores é o **atribuível aos controladores** (exclui minoritários); detalhe avançado.
- Falta EBITDA, o indicador operacional **mais usado no Brasil** (EBIT + depreciação e amortização); o currículo só tem EBIT (decisão de produto fechada; apenas registrar a lacuna).
- Realidade: empresas abertas publicam **ITR (trimestral)** e **DFP (anual)** na CVM e no site de RI; texto fala em "ciclo".

**Menções plataforma/TCC**: "o motor de simulação gera um relatório financeiro a cada ciclo"; "painel calculado ao vivo" (que não mostra os seis números, bug).

**Termos antes de introduzidos**: "juros" (ok), "dívida" (ok), "capital dos sócios" (2.6.3), "alavancagem" (nunca). Os seis termos são definidos em uma linha, sem exemplo.

**Lacunas**
- Onde encontrar o balanço real (RI da empresa, site da CVM "Dados e Documentos (DFP/ITR)", B3, Status Invest/Fundamentus), como ler (consolidado x individual, em R$ mil), periodicidade, auditor independente, parecer.
- Estrutura da DRE completa (Receita Bruta -> deduções -> Receita Líquida -> CPV -> Lucro Bruto -> despesas operacionais -> EBIT -> resultado financeiro -> LAIR -> IR/CSLL -> Lucro Líquido).
- Estrutura do Balanço (Ativo circulante/não circulante; Passivo circulante/não circulante; PL).
- Lucro contábil não é caixa (DFC, citar).
- Diferença entre empresa lucrativa e geradora de caixa.

**Proposta de visual/widget: "DRE em cascata + balança do balanço"**
- (a) **Waterfall** (cascata) da DRE: barras de Receita Bruta, deduções, Receita Líquida, custos, Lucro Bruto, despesas, EBIT, resultado financeiro, IR, Lucro Líquido. Sliders: custo %, despesa %, juros (R$), alíquota efetiva (IR+CSLL, padrão 34% sobre o lucro tributável, mostrar efetiva). O aluno muda e vê cada degrau. Fórmulas: `RL = RB − deduções`; `EBIT = RL − custos − despesas`; `LAIR = EBIT + resultado financeiro`; `LL = LAIR − IR`.
- (b) **Balança** Ativo = Passivo + PL: três blocos com sliders (caixa, imobilizado, dívida, outros passivos); PL é calculado e muda de cor se negativo; botão "empresa pega mais dívida e compra máquina": ativo e passivo crescem, PL fixo.
- (c) Linha para "exemplo real": cartão ilustrativo de uma empresa conhecida com valores arredondados e data (mostrar "ILUSTRATIVO").
- Corrigir `EquityIndicatorsPanel` ou criar painel de 6 valores-base com os mesmos dados da API (verificar se `equity` já traz esses campos; senão backend precisa expor).

**Perguntas intermediárias**
1. (Classificar) Receita, Caixa, Lucro Líquido, Dívida: DRE ou Balanço?
2. (Numérica) Ativo R$ 500, Passivo R$ 320: PL? (R$ 180).
3. (V/F) "Patrimônio líquido é o que a empresa vale na bolsa." F.
4. (Numérica na cascata) Receita líquida 1.000, custos+despesas 700, juros 100, IR 34%: LL? (EBIT 300; LAIR 200; LL 132).
5. (V/F) "Lucro alto significa sempre mais caixa." F.
6. (Múltipla) Onde achar o balanço oficial? (RI/CVM).

**Esforço**: G (cascata + balança + corrigir o painel de seis números).

---------------------------------------------------------------------
## Lição 2.6.2 — Margens de rentabilidade

**Conteúdo atual**: Duas empresas faturam o mesmo mas sobra diferente; margem = lucro / receita. Pergunta: Margem Líquida maior ou menor que Margem EBIT? (Menor). Revelação: fórmulas, diferença mostra o que se perde para dívida e impostos; painel ao vivo.

**Erros/imprecisões**
- "Margem Líquida costuma ser menor" é uma regra geral válida, mas não universal (mesmo ponto de 2.6.1).
- Falta **Margem Bruta**, **Margem EBITDA** (a mais usada no Brasil) e as comparações; margem tem sentido **dentro do setor** (varejo trabalha com margem líquida de poucos %, mineração/software muito maiores; dê ordens de grandeza com ressalva **[verificar]**).
- "Mostra quanto do resultado operacional a empresa perde para dívida e impostos": também vão para equivalência patrimonial, minoritários, receitas financeiras; simplificação.
- A pergunta repete a 2.6.1 (EBIT x LL): redundante.

**Menções plataforma/TCC**: "calculadas ao vivo" (painel); VALR3 fictícia.

**Termos antes de introduzidos**: "margem" (ok), "etapa do resultado". Nenhum grave.

**Lacunas**: margem bruta, EBITDA, tendência de margem (série histórica), comparação entre pares, margem x giro (varejo x indústria), e poder de preço; sazonalidade; lucro extraordinário (venda de ativo infla LL do trimestre: "lucro não recorrente").

**Proposta de widget: "Comparador de margens"**
- Entradas: receita líquida, custos, despesas, juros, imposto (reuso da cascata de 2.6.1, estado compartilhado) para **duas empresas A e B**.
- Saídas: barras horizontais agrupadas com Margem Bruta / EBIT / Líquida de A e B; "quem converte melhor?"; gráfico de linha com 8 trimestres onde o aluno arrasta um ponto para ver tendência (margem caindo = alerta).
- Fórmulas: `margemX = X / RL`.
- Mostrar linha de referência do setor (valor ilustrativo).

**Perguntas intermediárias**
1. (Numérica) EBIT 200 sobre RL 1.000: margem EBIT? (20%).
2. (Comparar) A: RL 1.000, LL 50; B: RL 200, LL 40. Qual tem melhor margem líquida? (B, 20% x 5%).
3. (V/F) "Margem alta sempre indica a melhor empresa." F (setor, cíclico, não recorrente).
4. (Cenário) Margem EBIT estável e margem líquida caindo: o que mudou? (juros/impostos).
5. (Interativa) Ajuste os custos para a margem EBIT chegar a 25%.

**Esforço**: M (reaproveita a cascata da 2.6.1).

---------------------------------------------------------------------
## Lição 2.6.3 — ROE

**Conteúdo atual**: Cenário: duas empresas, mesmo lucro, PL diferente. Pergunta: VALR3 e BNDD4 com mesmo LL, VALR3 com PL menor: qual usa melhor o capital? (VALR3). Revelação: ROE = LL / PL; ROE alto = boa gestão do capital próprio; painel ao vivo.

**Erros/imprecisões factuais**
- "ROE alto é lido como sinal de boa gestão" é **incompleto e perigoso**: ROE pode ser alto por **alavancagem** (muita dívida reduz o PL), por PL pequeno/negativo (recompras, prejuízos acumulados) ou por lucro extraordinário. Decomposição **DuPont**: ROE = margem líquida x giro do ativo x alavancagem. Sem isso o aluno aprende a caçar ROE alto.
- Pergunta é tautológica (mesmo LL, menor PL => maior ROE é aritmética, não aprendizado).
- Mistura VALR3 (mineradora) com BNDD4 (banco) como se comparável: ROE de bancos x indústria tem natureza diferente (bancos são naturalmente alavancados). Comparar só dentro do setor.
- ROE costuma usar **PL médio** do período e lucro dos últimos 12 meses; plataformas (Status Invest) usam o PL do fim do período; dizer qual.
- Falta referência: comparar ROE com o **custo do capital próprio / Selic** (ROE de 10% com Selic em dois dígitos pode não compensar o risco).

**Menções plataforma/TCC**: "calculado ao vivo".

**Termos antes de introduzidos**: "capital dos sócios" (PL, ok), "alavancagem" (nunca), "boa gestão".

**Lacunas**: DuPont, ROIC (retorno sobre capital investido, que isola a alavancagem), PL negativo (ROE sem sentido), ROE sustentável por anos (consistência), retorno retido (reinvestimento).

**Proposta de widget: "Laboratório de ROE (DuPont)"**
- Entradas: receita, lucro líquido, ativo total, PL (ou dívida, derivando PL = ativo − passivo), Selic atual (referência).
- Saídas: ROE; decomposição em três fatores (barra empilhada/ tríptico: margem x giro x alavancagem); aviso se alavancagem > limiar; linha tracejada com Selic para comparar.
- Experimento guiado: "duas empresas com ROE 20%": A com alavancagem 1,2x e B com 4x; o aluno aumenta a dívida de A e vê o ROE subir enquanto o risco (cobertura de juros) piora.
- Fórmula: `ROE = LL / PL = (LL/RL) x (RL/Ativo) x (Ativo/PL)`.

**Perguntas intermediárias**
1. (Numérica) LL R$ 30 mi, PL R$ 200 mi: ROE? (15%).
2. (Múltipla) Empresa dobra a dívida e recompra ações, lucro igual: ROE sobe ou cai? (sobe; risco também).
3. (V/F) "Todo ROE alto é sinal de boa gestão." F.
4. (Múltipla) Qual comparação é válida? (banco x banco).
5. (Numérica) ROE 12% e Selic a 10,5%: o prêmio sobre a renda fixa? (1,5 p.p.; pequeno para o risco).

**Esforço**: M a G (DuPont com 3 sliders é M; ROIC extra G).

---------------------------------------------------------------------
## Lição 2.6.4 — P/L e P/VP

**Conteúdo atual**: Cenário: preço sozinho não diz se é caro/barato; trazer LL e PL para base "por ação". Pergunta: preço triplica com LPA igual: P/L sobe/desce/igual? (Sobe). Revelação: LPA = LL / nº ações; P/L = Preço / LPA; mesma ideia para VPA e P/VP; painel ao vivo com os quatro.

**Erros/imprecisões factuais**
- Sem erro de fórmula, mas é **superficial e perigosamente simplista**: "caro/barato" por P/L sem contexto. Falta: P/L negativo ou sem sentido com prejuízo; P/L baixo pode ser **armadilha de valor** (lucro não recorrente ou em queda); compara-se dentro do setor e com o histórico; lucro dos últimos 12 meses (LTM) x projetado; P/L = anos para o lucro "pagar" o preço (payback) e earnings yield = 1/P/L para comparar com Selic.
- P/VP: bancos e financeiras costumam ser analisados por P/VP; <1 não significa automaticamente barato; empresas intensivas em ativos intangíveis têm P/VP alto.
- Pergunta quase tautológica (denominador constante).
- "Nº de ações": usar total de ações (ON+PN), não por classe; não explicado.

**Menções plataforma/TCC**: "calculados ao vivo".

**Termos antes de introduzidos**: "LPA", "VPA" (definidos na revelação), "valor de mercado" (nunca), "caro/barato" (conceito de valuation).

**Lacunas**: valor de mercado = preço x nº de ações; múltiplos como comparação relativa; EV/EBITDA (mais usado no Brasil, só citar); Graham (P/L x P/VP <22,5, citar como regra didática com ressalva); preço-alvo; valuation x preço; armadilhas (efeito de eventos extraordinários).

**Proposta de widget: "Calculadora de múltiplos"**
- Entradas (editáveis): preço, lucro líquido 12 meses, patrimônio líquido, nº de ações, Selic.
- Saídas: LPA, VPA, P/L, P/VP, valor de mercado, "anos para o lucro pagar o preço" (= P/L), earnings yield (1/PL) ao lado da Selic.
- Slider de preço de R$ 5 a R$ 60 com ponteiro mostrando P/L e P/VP (gauge) e faixa "setor (ilustrativa)".
- Segundo modo: tabela de 5 empresas fictícias do mesmo setor; o aluno ordena do mais caro ao mais barato por P/L e depois descobre a que tem lucro não recorrente.
- Fórmulas: `LPA=LL/N`; `VPA=PL/N`; `P/L=P/LPA`; `P/VP=P/VPA`; `EY=LPA/P`.

**Perguntas intermediárias**
1. (Numérica) LL R$ 120 mi, 60 mi ações, preço R$ 24: P/L? (LPA 2,00; P/L 12).
2. (V/F) "P/L baixo sempre significa ação barata." F.
3. (Numérica) PL R$ 300 mi, 100 mi ações, preço R$ 2,40: P/VP? (0,8).
4. (Múltipla) Empresa com prejuízo: P/L? (não faz sentido/negativo).
5. (Comparar) P/L 8 x earnings yield 12,5% contra Selic 15%: compensa? (reflexão).

**Esforço**: M.

---------------------------------------------------------------------
## Lição 2.6.5 — Endividamento

**Conteúdo atual**: Cenário: dívida bruta alta assusta mas não conta a história inteira; Caixa importa. Pergunta: dívida bruta alta e caixa mais alto, dívida líquida alta ou baixa? (Baixa). Revelação: DL = DB − Caixa (pode ser negativa); DL/EBIT = anos para quitar; pesa mais em banco "sofisticado" (BNDD4) mais sensível à Selic (spec 3.2.2); painel ao vivo.

**Erros/imprecisões factuais**
- **Erro conceitual**: aplicar Dívida Líquida/EBIT a **banco**. Em instituições financeiras a dívida/captação é a matéria-prima do negócio; não se usa dívida líquida/EBIT nem EBIT/margem EBIT para bancos (usam-se Basileia, inadimplência, ROE, índice de eficiência, NIM). O texto diz que o indicador "pesa ainda mais" no banco: **errado**.
- "Banco de perfil sofisticado" é jargão vazio.
- Usa EBIT; no mercado brasileiro a convenção é **Dívida Líquida/EBITDA** (limites de covenants ~ 2–3x; acima de ~4x costuma preocupar, **[verificar]** faixas) e **cobertura de juros** (EBIT / despesa financeira). Registrar a lacuna (decisão do produto de usar EBIT já tomada).
- "Anos de EBIT para quitar a dívida se todo o resultado fosse usado" é leitura correta mas ignora impostos, investimentos (capex) e juros; é aproximação.
- Dívida Bruta no real inclui empréstimos, financiamentos, debêntures, arrendamento (IFRS 16) e pode ter parcela em moeda estrangeira (risco cambial); Caixa = caixa e equivalentes + aplicações financeiras.
- Perfil do endividamento: curto prazo x longo prazo (vencimentos), pós-fixada (CDI) x prefixada, moeda.
- O texto cita a Selic mas não conecta com o aluno o que aprendeu em 1.x (dívida pós-fixada ao CDI fica mais cara quando a Selic sobe).

**Menções plataforma/TCC**: "spec 3.2.2" (proibido), "{{EBIT}}", "calculada ao vivo".

**Termos antes de introduzidos**: "alavancagem" (central concept), "Dívida Líquida" (definida na pergunta), "Caixa" (2.6.1), "covenant" (não usado, mas ausente).

**Lacunas**: DL/EBITDA, cobertura de juros, vencimentos, dívida em dólar, empresa com caixa líquido, setores naturalmente alavancados (energia, saneamento, imóveis) e outros não (software), empresa alavancada em Selic alta (casos reais: varejo e construção em 2022–2025 **[verificar]**), recuperação judicial como risco extremo.

**Proposta de widget: "Termômetro de endividamento + choque de Selic"**
- Entradas: dívida bruta, caixa, EBIT, despesa financeira anual atual, % da dívida indexada ao CDI (slider), Selic atual (editável).
- Saídas: dívida líquida, DL/EBIT (barra tipo termômetro com faixas verde/amarela/vermelha), cobertura de juros = EBIT / despesa financeira, "anos para quitar".
- Botão "e se a Selic subir 3 p.p.?": recalcula despesa financeira = dívida CDI x acréscimo; cobertura cai; mostra EBIT livre restante.
- Fórmulas: `DL = DB − Caixa`; `DL/EBIT`; `cobertura = EBIT / desp_fin`; `Δdesp = DB x %CDI x ΔSelic`.
- Barra de composição da dívida (curto/longo prazo) opcional.

**Perguntas intermediárias**
1. (Numérica) DB 800, Caixa 300, EBIT 250: DL e DL/EBIT? (500; 2,0x).
2. (V/F) "DL negativa significa que a empresa tem mais caixa que dívida." V.
3. (Cenário) Dívida toda em CDI, Selic sobe: despesa financeira sobe ou cai?
4. (Múltipla) Qual indicador NÃO se aplica a banco? (DL/EBIT).
5. (Comparar) A: DL/EBIT 1,0x, cobertura 8x; B: 4,0x e 1,5x: qual mais arriscada?

**Esforço**: M. Corrigir o texto do banco é urgente (P).

---------------------------------------------------------------------
## Lição 2.6.6 — Dividend Yield

**Conteúdo atual**: Cenário: dividendos/proventos distribuídos em dinheiro; DY resume quanto representam frente ao preço. Pergunta: preço dobra com dividendos iguais: DY sobe/desce/igual? (Desce). Revelação: DY = dividendos por ação nos últimos 12 meses / preço atual; DY alto pode ser armadilha por queda de preço; consulte o histórico completo na tela Detalhe do Ativo; painel ao vivo; "próxima lição explica como o pagamento chega".

**Erros/imprecisões factuais**
- Fórmula coerente com Status Invest (proventos 12 meses / preço; inclui JCP bruto na prática de mercado, **[verificar]** metodologia). Falta citar que **proventos** = dividendos + **JCP (juros sobre capital próprio)** + rendimentos, e que JCP tem **15% de IR retido na fonte** (continua vigente após Lei 15.270).
- Defasagem: **a lição não menciona tributação**. Fato novo (validado web, Lei 15.270/2025, sancionada em 27/11/2025, vigência 01/01/2026): dividendos continuam isentos para o investidor PF **abaixo de R$ 50.000 por mês por mesma fonte pagadora**; acima disso, retenção de 10% de IRRF **sobre o total** pago no mês por essa fonte. Também houve regra para lucros apurados até 2025 e aprovados até 31/12/2025 (isentos) **[verificar detalhes]**. Isso muda o cálculo de DY líquido; precisa constar em 2.6.6/2.7.
- Pergunta quase tautológica (denominador dobra).
- "Nunca leia esse número sozinho" ok, mas sem as ferramentas: **payout** (dividendos/lucro), sustentabilidade (geração de caixa, dívida), recorrência (dividendo extraordinário infla o DY), histórico de 5–10 anos, DY forward x trailing.
- DY na renda fixa: o aluno veio de CDB/Tesouro; falta comparar DY líquido com a taxa líquida de renda fixa (Selic) e lembrar que DY não inclui valorização.

**Menções plataforma/TCC**: "tela de Detalhe do Ativo", "o último dos 9 indicadores fundamentalistas do currículo", "painel calculado ao vivo".

**Termos antes de introduzidos**: "proventos" (JCP nunca explicado), "payout", "data com/ex" (2.7), "dividendos" (2.7 vem depois do DY: inversão de ordem).

**Lacunas**: payout, JCP, extraordinário x recorrente, tributação 2026, DY x taxa Selic, "dividend trap", reinvestimento dos dividendos (juros compostos, ligação à 0.2), retorno total = valorização + proventos.

**Proposta de widget: "Simulador de dividendos"**
- Entradas: preço, dividendos pagos em cada um dos últimos 4 trimestres (4 campos ou gráfico de barras arrastável), LPA 12m, valor investido, tipo de provento (dividendo isento/ JCP 15%), toggle "imposto 2026" (limite de R$ 50 mil/mês por fonte pagadora), Selic atual.
- Saídas: DY bruto; payout = dividendos/LPA; renda anual em R$ para o valor investido; DY líquido; comparação em barras com Tesouro Selic líquido (IR regressivo de 1.x); alerta de "armadilha" se o preço caiu >30% em 12 meses (gráfico de preço com marcador).
- Slider "preço" para mostrar o DY mover inversamente (o ponto da pergunta, agora visual).
- Fórmulas: `DY = Σ proventos12m / preço`; `payout = dividendo por ação / LPA`; `DYlíq (JCP) = DY x 0,85`; `renda = investido x DY`.

**Perguntas intermediárias**
1. (Numérica) Dividendos 12m R$ 1,50, preço R$ 25: DY? (6%).
2. (Numérica) LPA R$ 3, dividendo R$ 1,20: payout? (40%).
3. (V/F) "DY de 15% é sempre excelente." F.
4. (Múltipla) JCP: IR na fonte? (15%).
5. (Cenário) Dividendo extraordinário único: usar DY como recorrente? Não.
6. (Comparar) DY líquido de 7% x Tesouro Selic líquido de X%: o prêmio compensa o risco?

**Esforço**: M (widget) + P (atualizar texto para tributação 2026). Reordenar com a 2.7.

---------------------------------------------------------------------
## Resumo de prioridades

| Prioridade | Item |
|---|---|
| P1 (erro) | 2.6.5: remover afirmação errada sobre banco e DL/EBIT; remover "spec 3.2.2"; 2.5 `centralConcept` "TCC cap. 2.3.3" |
| P1 (erro) | 2.6.1: painel promete os 6 números e mostra os 9 indicadores |
| P1 (fato) | 2.2: IPO primário x secundário; 2.6.6/2.7: Lei 15.270/2025, JCP 15% |
| P2 | Reordenação do grafo (2.3 antes de 2.2; 2.5 antes de 2.4; 2.7 antes do DY; 2.6.5 antes do ROE) |
| P2 | Padrão "Real x Plataforma" e remoção de meta-linguagem (motor, feed, painel, lição vem depois) |
| P3 | Widgets: livro de ofertas (G), cascata DRE+balança (G), bookbuilding (M/G), demais (M/P) |
| P3 | Checkpoints intermediários com tentativas ilimitadas e dicas (mudança de contrato) |

Esforço total estimado: 2.1 M, 2.2 M/G, 2.3 M, 2.4 M, 2.5 G, 2.6.1 G, 2.6.2 M, 2.6.3 M/G, 2.6.4 M, 2.6.5 M, 2.6.6 M.

## Fontes consultadas
- Lei 15.270/2025: https://renovainvest.com.br/blog/tributacao-de-dividendos/ ; https://jornalcontabil.com.br/noticia/lei-15-270-define-regras-para-taxacao-de-lucros-e-dividendos-a-partir-de-2026/ ; https://crcmg.org.br/wp-content/uploads/2025/12/Cafe-com-o-Contabilista-Lei-n.-15.270-e-a-tributacao-de-dividendos-e-de-altas-rendas-16dez2025.pdf
- Lote padrão/fracionário/sufixos: https://www.serasa.com.br/blog/como-comprar-fracoes-de-acoes/ ; https://www.suno.com.br/artigos/lote-padrao/amp/ ; https://blog.inter.co/como-comprar-lote-fracionado-de-acoes/ ; https://investnews.com.br/guias/ticker-codigos-das-acoes/
- Itens marcados **[verificar]** vêm de conhecimento geral (Lei 6.404/76, Res. CVM 44/80/160, B3) e não foram reconfirmados nesta sessão.
