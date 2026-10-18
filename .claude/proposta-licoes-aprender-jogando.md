# Proposta: lições que ensinam jogando

> **Status: proposta, não é decisão fechada** (2026-10-17). Pedido do autor: varrer todas as lições e
> propor melhorias criativas para que aprender não seja cansativo. Complementa, sem redecidir,
> `proposta-engajamento-licoes.md` (fatiamento, aposta, glossário, Octalysis) e o
> `backlog-engajamento-gamificacao.md`, quase todo concluído. O limite ético daquele documento
> continua valendo: nunca cronômetro, nunca perda de XP por inatividade, nunca "última chance".
> A D.2 (XP variável por desempenho) segue em aberto lá e não é decidida aqui.
>
> **Atualização (2026-10-17):** o autor aprovou os Lotes 1 a 3, convertidos em
> `backlog-licoes-aprender-jogando.md`, e depois pediu que tudo o que melhora a experiência entre
> agora: os itens 4.2 a 4.4 entraram no Lote 5 do backlog, junto com ideias novas. Só o personagem
> (4.1) espera o teste do autor num gerador externo.

## 1. Diagnóstico, com números do banco (43 lições)

Contagem feita direto de `lessons.blocks` no banco local, depois das revisões de 2026-10-17.

| Medida | Valor |
|---|---|
| Cartões por lição | de 8 a 21; sete lições passam de 15 (2.4, 2.12, F.2, 1.11, 1.12, 2.7.6, 2.10) |
| Onde está o conteúdo | a Revelação concentra de 60% a 75% dos cartões (até 15 numa fase) |
| Formatos de pergunta | só dois: `single` (118) e `true_false` (46) |
| Bloco "Na plataforma" | em 34 das 43 lições, quase sempre como último cartão |
| Tipo de micro-decisão | 41 de 43 são `reflection` |
| Sequência de texto sem interação | até 5 cartões seguidos (0.4, 2.7.1, 2.7.3, 2.7.5) |

O que isso produz na prática:

1. **Toda lição tem a mesma forma.** Cenário, uma pergunta, e depois uma Revelação longa que
   alterna texto, pergunta e widget. Na décima lição o formato já é previsível, e o previsível
   cansa (a curiosidade, Impulso 7 do Octalysis, morre).
2. **A Revelação vira aula expositiva.** A aposta da micro-decisão cria suspense, mas o que vem
   depois é uma sequência de 8 a 15 cartões de leitura. É o oposto do "problema primeiro" do
   Brilliant: lá a pessoa descobre a regra mexendo, aqui ela lê a regra e depois confirma.
3. **Os widgets são playgrounds sem objetivo.** "Use a calculadora e compare" não tem ponto de
   chegada: a pessoa mexe dois controles e aperta Continuar. Um widget com missão ("ache a
   Selic em que a poupança empata com o Tesouro") é jogo; sem missão, é enfeite.
4. **A progressão é opaca.** A barra do topo tem 4 segmentos (as fases) e os pontinhos mostram
   só a fase atual. Numa Revelação de 15 cartões a pessoa não sabe quanto falta, e "quanto
   falta" é a pergunta que decide se ela continua.
5. **O fim da lição é seco.** "Lição concluída" e o texto do desbloqueio. Não há resumo do que
   foi aprendido, placar de acertos nem próximo passo prático no simulador (só algumas lições
   têm "Comprar agora").
6. **O bloco "Na plataforma" fecha 34 lições.** Ele é necessário (diretriz §3), mas como último
   cartão quebra o clímax: a lição termina num aviso, não numa conquista.
7. **Os rótulos são de pedagogo.** "Cenário", "Micro-decisão", "Pense antes de continuar",
   "Revelação", "Por que isso importa", iguais em todas as lições.
8. **Não há retomada do que já foi aprendido.** As perguntas testam o cartão que acabou de ser
   lido. Nada puxa de volta uma lição anterior, que é a prática com mais evidência de retenção
   (recuperação espaçada). A missão diária de revisão (H.2) existe, mas fica fora da lição.

## 2. O que o mercado faz (e o que a evidência sustenta)

| Referência | Prática | Como se traduz aqui |
|---|---|---|
| Duolingo | Lições de 2 a 3 minutos, muitos formatos de exercício, progresso sempre visível. A própria empresa relata que conteúdo mais difícil derrubava o engajamento e resolveu com camadas opcionais de profundidade. | Lição curta no caminho principal, profundidade em "Saiba mais" recolhido; barra contínua; mais formatos. |
| Brilliant | Problema primeiro: a pessoa decide (testa um padrão, escolhe uma estratégia) antes da explicação; dica no contexto sem resolver; depois a prática tira o apoio e traz a ideia em outro contexto. Tudo interativo, nada de vídeo. | Widget com missão antes do texto; "Relembra?" em contexto novo. |
| Zogo (finanças) | Ciclo curto: alguns conceitos e um quiz de 5 perguntas, com recompensa. | Placar no fim da lição; blocos menores. |
| Ciência da aprendizagem | Recuperação espaçada supera reler; intercalar ajuda a distinguir conceitos parecidos (ex.: LCI x CDB). | Uma pergunta de lição anterior no início; perguntas de comparação entre produtos. |

Fontes: [Duolingo Method](https://blog.duolingo.com/duolingo-teaching-method),
[TechCrunch sobre os níveis do Duolingo](https://techcrunch.com/2018/04/09/duolingo-adds-new-language-exercises-and-revamps-its-leveling-system),
[Como o Brilliant ensina](https://brilliant.org/resources/choosing-brilliant/how-brilliant-teaches-math/),
[Zogo em parceiro](https://www.clearviewfcu.org/tips-insights/financial-literacy/zogo-financial-literacy),
[Prática espaçada e intercalada, UMN](https://cei.umn.edu/teaching-resources/leveraging-learning-sciences/spaced-and-interleaved-practice-improves-recall).
O Duolingo e o Brilliant falam de si mesmos; tratar como prática de mercado, não como estudo.

## 3. Propostas

### Lote 1: ritmo do player (só frontend, vale para as 43 lições de uma vez)

| # | Proposta | Efeito |
|---|---|---|
| 1.1 | **Barra de progresso contínua** por cartão (todos os cartões da lição), no lugar dos 4 segmentos e dos pontinhos | A pessoa sempre sabe quanto falta |
| 1.2 | **Rótulos humanos**: tirar "Micro-decisão" e "Revelação"; o título do cartão vira o da lição, e a fase aparece como "Sua aposta" e "O que acontece" | Menos cara de apostila |
| 1.3 | **"Na plataforma" recolhido** como rodapé do cartão anterior ("Na plataforma ▸"), não cartão próprio | Menos 34 cartões no total; a lição termina no clímax |
| 1.4 | **Tela final com placar**: acertos de primeira (ex.: 4 de 5), XP ganho, os conceitos da lição em 2 ou 3 linhas e um próximo passo prático ("Ver o Tesouro Selic no Mercado") | Fecho de conquista, ponte com o simulador |
| 1.5 | **Sequência de acertos dentro da lição** ("3 de primeira seguidas"), só celebração visual, sem tirar nada de quem erra | Feedback imediato (Impulso 3) sem pressão |

O 1.4 não decide a D.2: mostra o XP que já existe e o placar, sem mudar quanto se ganha.

### Lote 2: perguntas que são jogo (backend + frontend, novos `kind` de checkpoint)

| # | Formato | Exemplo real |
|---|---|---|
| 2.1 | **Estimativa com controle deslizante** (`estimate`): a pessoa chuta e vê a distância do valor real | "Quanto viram R$ 1.000 a 10% ao ano em 20 anos?" (0.2): a maioria chuta perto de R$ 3.000 e descobre R$ 6.727. A surpresa ensina juros compostos melhor que a fórmula. |
| 2.2 | **Ordenar** (`order`) | Ordene do menos ao mais arriscado: Tesouro Selic, CDB de banco médio, ação (3.2); ordene as faixas do IR regressivo (1.6) |
| 2.3 | **Separar em grupos** (`categorize`) | Arraste para Renda fixa ou Renda variável (1.1); Isento ou Tributado: LCI, CDB, poupança, venda de FII (2.12) |
| 2.4 | **Ligar pares** (`match`) | Termo e definição: Selic, CDI, IPCA, TR (0.5) |
| 2.5 | **Enquete da comunidade** (sem resposta certa) | 0.1: "Com R$ 1.000 de bônus, você..." e a pessoa vê o que os outros escolheram (percentual agregado, nunca nomes; não fere a RNF09) |

Todos seguem a regra dos checkpoints (§7 da diretriz): errar não avança, gabarito só no acerto.
O 2.1 tem tolerância (acerta dentro da faixa) e, fora dela, mostra "mais alto" ou "mais baixo",
sem o valor.

### Lote 3: widgets com missão

| # | Proposta |
|---|---|
| 3.1 | Prop opcional `goal` nos widgets de conta: um alvo verificável ("deixe o rendimento real negativo", "ache a Selic em que a poupança empata") que, ao ser atingido, comemora e libera o Continuar. Começar por `savings-vs-selic` (0.6), `real-return` (0.4/0.5) e `growth-calculator` (0.2). |
| 3.2 | Inverter a ordem nas lições de fórmula: widget com missão **antes** do texto que explica a regra (o Brilliant faz isso: a pessoa descobre, depois lê o nome do que descobriu). |

### Lote 4: conteúdo e narrativa

| # | Proposta |
|---|---|
| 4.1 | **Personagem na Trilha 0**: uma pessoa com o primeiro salário cuja história atravessa as 6 lições (bônus de R$ 1.000 na 0.1, quanto vira na 0.2, a inflação come na 0.3, rendimento real na 0.4, Selic na 0.5, poupança x Tesouro na 0.6). O cenário de cada lição continua a anterior em vez de recomeçar. A Trilha 2 já tem elenco recorrente (C.2); a Trilha 0, que é a primeira impressão, não. |
| 4.2 | **"Relembra?"**: primeiro cartão de cada lição (a partir da segunda) é uma pergunta de uma lição anterior, em contexto novo. Recuperação espaçada dentro do fluxo, sem tela extra. |
| 4.3 | **Encurtar as 7 lições com mais de 15 cartões**: o caminho principal fica com até 12; o detalhe vai para "Saiba mais" recolhido (a diretriz §2 já permite). |
| 4.4 | **Gancho de curiosidade no primeiro cartão**: abrir com uma pergunta ou um número surpreendente, não com uma definição. |

## 4. Ordem sugerida

1. **Lote 1 inteiro**: maior efeito por esforço, só frontend, reversível, vale para todas as lições.
2. **2.1 (estimativa) e 3.1 (missão nos 3 widgets da Trilha 0)**: os dois formatos mais
   "jogo" e que melhoram a primeira impressão.
3. **4.1 e 4.2 na Trilha 0**: conteúdo, sem schema.
4. **2.2 a 2.5** e **4.3** no restante do currículo.

## 5. Como validar

| Sinal | O que observar |
|---|---|
| Conclusão por lição | Comparar antes e depois, a Trilha 0 primeiro (o painel de retenção RT ajuda) |
| Abandono no meio | Cartão em que a pessoa sai; lição com abandono concentrado ainda está longa |
| Acerto de primeira por formato | Perto de 100% é pergunta óbvia; muito baixo, o cartão não deu base |
| Tempo por lição | Não deve crescer; se crescer, o jogo virou fricção |
