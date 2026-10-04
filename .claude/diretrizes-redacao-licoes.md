# Diretrizes de redação: conteúdo das lições

Guia pra quem (humano ou uma sessão do Claude Code) for **escrever ou reescrever uma lição** do currículo (`backend/src/db/seedLessons.ts`, hoje 35 lições, 43 ao fim da Fase 4 do backlog de revisão). Nasceu da tarefa RC.1.6 de `backlog-revisao-trilhas-e-ux.md` e vale como checklist de toda tarefa da Fase 5 e de RC.4.x. No molde de `diretrizes-redacao-eventos-macro.md`: sem esta diretriz, cada sessão reinventa tom e formato, e as correções da revisão voltam.

Complementos: o **porquê** de cada regra está nos Princípios 0 a 9 do backlog de revisão; o que as regras proíbem de verdade é aplicado por teste (seção 9), não por disciplina.

## 1. Objetivo: leve, visual e real

A lição ensina **como as coisas funcionam no Brasil** e é **leve**. Profundidade vem de visual, widget interativo, exemplo com número e pergunta curta, nunca de parágrafo. Se uma lição ficou mais correta e mais pesada de ler, ela falhou. Cada lição deve poder ser concluída em poucos minutos.

## 2. Leveza: o cartão

- **Alvo de ~280 caracteres por cartão, teto duro de 420** (o teto é testado em `backend/src/content/visibleContent.test.ts`). Exceção só em bloco "saiba mais" recolhido, nunca no caminho principal.
- **Uma ideia por cartão e no máximo um conceito novo por vez.**
- Antes de escrever um segundo parágrafo, troque por: tabela, exemplo com números, widget ou pergunta.
- **Pergunta curta a cada 2 ou 3 cartões.**
- Frase curta, voz ativa, sem oração subordinada em cadeia. Fale com "você".

| Ruim | Bom |
|---|---|
| Três parágrafos explicando marcação a mercado, depois "calcule o preço". | Um cartão com a ideia da gangorra (taxa sobe, preço cai), o widget `mtm-seesaw` e uma pergunta. |
| "O CDB rende 12% ao ano, então em 2 anos você terá R$ 1.254, descontado o IR de 17,5% sobre o ganho, que é calculado assim: ..." | Cartão curto com a ideia, e a conta feita pelo widget com os números do usuário. |

## 3. O Brasil real e o bloco "Na plataforma"

- O texto da lição descreve o **mundo real**: Copom, B3, Tesouro Direto, FGC como existem.
- Quando a plataforma difere do real, a diferença vai **num bloco padronizado "Na plataforma"** com três linhas: **No Brasil**, **Aqui**, **Por quê**. Ssempre separado, nunca misturado ao texto principal.
- Proibido o texto do tipo "na reunião X isso acontece" como se fosse o conteúdo. Exemplo real: a 1.3 diz que o Copom se reúne a cada 21 dias; no Brasil são 8 reuniões por ano e na plataforma o intervalo é de 45 dias simulados. O certo é ensinar as 8 reuniões e mandar os 45 dias para o bloco.
- Os números do catálogo (taxas, composição de ETF, intervalos do motor) não entram no texto principal. Ou viram "% do CDI", ou aparecem num widget com o valor vivo. Número solto que não bate com o catálogo é erro, não simplificação.

## 4. Termos: nada antes da apresentação

- Todo termo técnico foi **definido numa lição anterior** ou tem **definição inline com `{{termo}}`** (entrada do glossário, ver `frontend/src/features/lessons/glossary`).
- A tabela de termos e a lição que cada um depende está em `backend/src/modules/lessons/domain/termPrerequisites.ts`; ao introduzir um termo novo, acrescente a linha. O teste `termPrerequisites.test.ts` acusa o uso antes da definição.
- Sigla sempre por extenso na primeira vez (Certificado de Depósito Interbancário, CDI).
- Uma lição que usa Selic, CDI, TR, IPCA, ticker ou ON/PN sem que a lição definidora exista ainda **não está pronta** (RC.4.1 e RC.4.2 criam essas definições).

## 5. Fatos regulatórios: fonte e data

- Número de lei, alíquota, teto, prazo ou data **vive em `backend/src/modules/lessons/domain/regulatoryFacts.ts`** com `value`, `source` (URL oficial) e `verifiedAt`, e só então entra no texto.
- **Fonte aceita:** primária e oficial (Banco Central, Receita Federal, Planalto, Tesouro Direto, B3, CVM, FGC, IBGE, Anbima). Notícia e blog servem para achar a fonte, nunca são a fonte registrada.
- **Nunca confie na auditoria nem na memória.** A validação da RC.1.7 corrigiu a própria auditoria em 5 pontos (dividendo obrigatório, D+2, JCP 17,5%, prazo mínimo de LCI, conta do título de 5 anos). Pesquise a fonte antes de escrever o número.
- Item marcado *[reconferir]* ou *[verificar]* nos anexos não vira texto até ser aberto em fonte primária. A lista do que ainda não foi aberto está em "Itens sem fonte primária" de `revisao-trilhas-anexos/validacao-licoes.md`.
- Número com data de validade (taxa vigente, teto atual) é rotulado como exemplo datado.

## 6. Contas: sempre dentro da plataforma

Nenhum texto manda calcular fora. Toda conta que a lição pede é feita por **widget interativo** (taxa bruta equivalente, IR regressivo, preço do título, VNA etc.), e o widget tem resumo textual e teste da fórmula. Proibido "calcule" sem widget na mesma fase e botão "Ver resultado" solto (se sobrar, rótulo contextual).

## 7. Perguntas intermediárias (checkpoints)

De 3 a 7 por lição, curtas, em cima do cartão que acabou de ser lido.

- **Errar não avança.** Tentativas ilimitadas. A cada erro a alternativa errada é **desativada** (some das opções), **sem dica**.
- **O gabarito e a explicação só aparecem ao acertar.** A explicação cobre por que a certa é certa e, quando ajuda, por que as outras não são.
- Alternativas plausíveis e do mesmo tamanho; nada de "todas as anteriores"; a certa não é sempre a mais longa nem sempre a mesma posição.
- Pergunta testa entendimento, não leitura: use um caso com número ("você tem R$ 1.000 a 110% do CDI, o que acontece se...").

## 8. Tom e texto de UI

- pt-BR direto, caloroso sem infantilizar, sem promessa de ganho e sem recomendação de compra. Educação financeira, não aconselhamento.
- **Nada de travessão (—) como pontuação** em texto visível. Use ponto, vírgula ou dois-pontos. O placeholder de dado ("—") é permitido.
- Nunca citar nada de desenvolvimento: TCC, spec, capítulo, backlog, motor, tick, temporizador, número de lição ou de tarefa, nome de coluna, ticker de teste. Pra dizer "lição anterior", use o nome dela.
- "Sandbox" e "simulado" não aparecem no texto de aprendizado; o que é próprio da plataforma vai pro bloco "Na plataforma" (seção 3).
- Ativos de exemplo são os do catálogo da plataforma (VALR3 e afins), não tickers reais de empresa nem de teste.

## 9. O que os testes já barram

| Teste | Barra |
|---|---|
| `backend/src/content/visibleContent.test.ts` | 12 padrões proibidos (TCC, spec, capítulo, backlog, motor, "nesta plataforma", simulado, travessão, snake_case, número de lição, sandbox, jargão técnico) e cartão acima do teto. Mesmos padrões no frontend e no engine. |
| `backend/src/content/termPrerequisites.test.ts` | Termo usado antes da lição que o define (modo aviso até a Fase 4 fechar). |
| `regulatoryFacts.test.ts` | Fato sem fonte oficial ou com `verifiedAt` de mais de 12 meses. |

Os três têm baseline ou modo aviso enquanto a Fase 5 não termina: **não aumente o baseline**. Violação nova falha, e a violação resolvida também falha até o baseline encolher (regrave com `UPDATE_CONTENT_BASELINE=1`).

## 10. Checklist antes de dar uma lição por pronta

1. Li a seção da lição em `revisao-trilhas-anexos/validacao-licoes.md` e a lista de correções virou cartão, widget ou checkpoint, não parágrafo.
2. Todo número regulatório vem de um fato em `regulatoryFacts.ts`, com fonte aberta por mim, não copiada da auditoria.
3. Nenhum cartão passa de ~280 caracteres (teto 420) e há pergunta a cada 2 ou 3 cartões.
4. Nenhum termo aparece antes de definido; os novos estão em `termPrerequisites.ts` e no glossário.
5. Onde a plataforma difere do real, há bloco "Na plataforma" com No Brasil, Aqui, Por quê.
6. Nenhuma conta fora da plataforma; cada widget tem resumo textual e teste da fórmula.
7. De 3 a 7 checkpoints, erro desativa a alternativa, explicação só após o acerto.
8. Sem travessão, sem vazamento de desenvolvimento, sem número de lição.
9. Progresso de quem já está na trilha não é perdido (seed só aditivo, N.23/N.24).
10. Os testes da seção 9 passam sem crescer baseline.
