# Proposta — engajamento e gamificação das lições

> **Status: proposta, não é decisão fechada.** Nasceu de duas sessões de estudo pedidas pelo autor
> depois da autoria das 33 lições (tarefas 7.1.1–7.1.6): a primeira mostrou que o conteúdo virou
> bloco de texto grande demais; a segunda, com o cronograma adiantado, aprofundou em mecânica de
> gamificação/engajamento de verdade, não só formatação. Nada deste documento foi implementado.
> Antes de qualquer item virar tarefa de backlog, precisa da aprovação do autor (regra 5 do
> `CLAUDE.md` — decisão de produto fora dos três documentos fechados exige parar e perguntar).
>
> Versões completas, com mockup visual (octógono, cartões antes/depois, barras comparativas),
> publicadas como artifact durante a sessão de estudo: *Trilha Fatiada* (frente A, formatação) e
> *Oito Impulsos* (frente B, mecânica de jogo). Este arquivo é o resumo executável dos dois, pra
> não depender do link do artifact em sessões futuras.
>
> **Atualização:** o autor confirmou que vai avançar nessa ideia. As 9 fases (A-I, a última
> descoberta só na conversão pra backlog — teatro de recompensa em tempo real, hoje inexistente)
> foram destrinchadas em 23 tarefas executáveis em `.claude/backlog-engajamento-gamificacao.md`.
> Este arquivo continua valendo como o "porquê" por trás de cada fase; o backlog é o "como" e o
> "o que muda no código".

## 1. Diagnóstico — o tamanho do bloco, em números reais

Contagem direta das 33 lições em `backend/src/db/seedLessons.ts` (n=33 cada campo):

| Campo | Média de palavras | Máximo |
|---|---|---|
| `scenarioText` (Cenário) | 54,4 | 93 |
| `microDecisionPrompt` (Micro-decisão) | 33,5 | 46 |
| `revelationText` (Revelação) | **100,2** | 153 |

O passo Revelação (`frontend/src/pages/Lesson/index.tsx`, `step === 2`) renderiza esse texto como
um único `<p>`, sem nenhuma pausa interativa no meio. Exemplo real (lição 1.5, LCI e LCA, 129
palavras num parágrafo só): duas contas, dois vereditos opostos (LCI vence no prazo curto, CDB
vence no prazo longo) e uma generalização, todos empilhados sem respiro.

**Por que isso cansa** (mecanismos de aprendizagem, não impressão):
- **Carga cognitiva** — cada fato novo compete pela mesma working memory; juntar 4 ideias num
  parágrafo obriga a mente a manter tudo em suspenso até o ponto final.
- **Sem "curiosity gap" dentro do próprio passo** — a estrutura de 4 fases (spec 5.2) já cria
  suspense entre Micro-decisão e Revelação, mas dentro da Revelação o veredito costuma vir na
  primeira frase, matando o suspense que a estrutura externa criou.
- **Microlearning** — todo padrão de trilha gamificada bem-sucedida entrega uma ideia nova por
  toque de tela. A lição já fatia em 4 fases; falta fatiar o conteúdo *dentro* de cada fase do
  mesmo jeito.

**Ponto central:** não mudar *o que* está escrito (o conteúdo já foi revisado e está correto), só
*como* ele é entregue — de parágrafo único pra sequência de cartões pequenos.

## 2. Frente A — fatiar o conteúdo que já existe

Nove técnicas, cada uma resolvendo um sintoma diferente:

| Técnica | O que muda | Custo |
|---|---|---|
| Fatiamento por ideia | 1 parágrafo → N cartões de até ~45 palavras, 1 ideia nova cada | Conteúdo só, zero schema |
| Revelação progressiva | Reordenar o parágrafo pra nunca abrir com o veredito — mostrar a fórmula antes do resultado | Zero schema, é ordem de exibição |
| Aposta com acerto/erro real | Trocar o checkbox "já pensei" por 2 botões de escolha nas lições `reflection` com resposta objetiva; Revelação abre confirmando/corrigindo | Muda `Lesson/index.tsx`, sem migration |
| Comparação vira barra, não fração | Toda comparação de 2 números (12,26% vs 12,00%, EBIT vs Lucro Líquido) vira 2 barras lado a lado, reaproveitando o padrão já usado em `EquityIndicatorsPanel` | Zero componente novo |
| Glossário inline | Termos recorrentes (FGC, deságio, marcação a mercado) ganham popover de definição em vez de reexplicação por extenso a cada lição | Componente novo pequeno |
| Elenco recorrente | VALR3/BNDD4 tratados como personagens com continuidade entre lições da Trilha 2, não reintroduzidos do zero a cada vez | Conteúdo só |
| XP fracionado por cartão | Micro-feedback visual (não XP real ainda) a cada acerto de aposta, não só ao fim da lição | Ver Fase D (schema) |
| Orçamento de palavras por cartão | Regra de redação: nenhum cartão passa de ~45 palavras nem introduz mais de 1 número novo | Regra de revisão, sem código |
| Tratamento por tipo de lição | Conceitual pura (2-3 cartões) vs produto com CTA (cartão extra "veja ao vivo") vs indicador (isolar fórmula do resultado) | Regra por `microDecisionType`, já existente |

### Exemplo concreto — lição 1.5 fatiada em 5 cartões

Texto hoje (1 parágrafo, 129 palavras — citado inteiro na seção 1). Proposta:

1. **A pergunta certa** — isenção de IR não decide sozinha; é preciso trazer LCI e CDB pra uma
   régua única.
2. **A régua** — `taxa bruta equivalente = taxa isenta ÷ (1 − alíquota de IR)`.
3. **Resgate em 90 dias (IR 22,5%)** — LCI2026 equivale a 12,26% bruto vs 12,00% do CDB2027 →
   **LCI vence**.
4. **Resgate em 720+ dias (IR 15%)** — a mesma conta dá 11,18% vs 12,00% → **CDB vence**.
5. **O que fica** — mesma taxa anunciada, dois vencedores diferentes; a resposta certa depende do
   prazo, não só do número na etiqueta.

Nenhum número novo, nenhuma fórmula removida — só a ordem de revelação e a unidade de exibição.

### Nova arquitetura de passos (proposta, não decidida)

Hoje `TOTAL_STEPS = 4` trata cada fase como atômica. Proposta: manter as 4 fases da spec 5.2
(RF11 continua valendo), mas permitir que cada fase tenha de 1 a N sub-passos internos — barra de
progresso fina dentro da fase, sem mudar a barra grande de 4 segmentos. Custo real: `LessonView`
passa a guardar `subStep` além de `step`; o campo de texto de cada fase deixa de ser uma `string`
solta e vira lista de blocos tipados (texto curto/fórmula/comparação/glossário) — migration nova
em `lessons`, não é gratuito (ver Fase D).

## 3. Frente B — os 8 impulsos do Octalysis (spec seção 6, TCC cap. 3.3.2)

A spec (linha 298) já reconhece, pro app inteiro: *"o produto concentra-se nos impulsos de
Desenvolvimento/Realização (2) e Perda/Prevenção (8) [...] hoje pouco explorado [o impulso 5]"*.
Dentro da tela de lição especificamente, o desequilíbrio é mais extremo — quase todo peso de
engajamento está no Impulso 2 (XP flat, `LESSON_XP_REWARD = 50`).

Estimativa qualitativa (leitura de código, não telemetria — a plataforma não instrumenta nenhum
desses sinais ainda), escala 0-10, avaliada só dentro da experiência de lição:

| # | Impulso (Octalysis) | Hoje | Proposta | Técnica principal |
|---|---|---|---|---|
| 1 | Significado épico | 2 | 7 | Arco narrativo por trilha — "porquê" maior plantado na 1ª lição, pago no desafio final (lição 3.4-style) |
| 2 | Desenvolvimento e realização | 8 | 9 | XP variável por desempenho (não só flat por conclusão) + barra de maestria por trilha |
| 3 | Empoderamento e feedback | 2 | 7 | Checkbox genérico → escolha real com acerto/erro, variando o widget por `microDecisionType` |
| 4 | Posse e propriedade | 1 | 6 | Sala de conquistas no Perfil, emblema visual próprio por trilha (não badge genérico igual pra todas) |
| 5 | Influência social | 2 | 6 | Feed de amizade celebrando "amigo completou a Trilha X" — sem rentabilidade nem patrimônio |
| 6 | Escassez e impaciência | 1 | 5 | Bônus por acertar de primeira (não por velocidade/timer) — proposta deliberadamente moderada |
| 7 | Imprevisibilidade e curiosidade | 3 | 8 | Revelação progressiva (frente A) + "resumo surpresa" só no desafio final de cada trilha |
| 8 | Perda e aversão | 5 | 7 | Missão diária de revisão de lição antiga — convite, nunca penalidade |

### Limite ético — nem todo impulso serve igual num produto de educação financeira

Octalysis separa Impulsos 1-4 (White Hat, motivação intrínseca) de 5-8 (mais fáceis de virar
pressão). Isso importa mais aqui do que em qualquer outro produto: **gamificar escassez e urgência
(Impulso 6) e medo de perda (Impulso 8) é exatamente o gatilho psicológico que produtos financeiros
predatórios usam de propósito** — usar demais contradiz o próprio objetivo de ensinar comportamento
financeiro saudável. Por isso os dois ficam com a proposta mais moderada da tabela acima (5 e 7).
Regra prática: nunca cronômetro real, nunca perda de XP/nível por inatividade, nunca "última
chance" — só convite.

### Extensão de catálogo — achievements/missions hoje só medem volume

Os 4 valores de `achievement_criteria_type` (`backend/src/db/schema.ts`) — `net_worth`,
`streak_days`, `lessons_completed`, `trades_executed` — são todos contadores de quantidade;
nenhum mede qualidade de aprendizado. Candidatos a estender o enum (dependem das técnicas dos
Impulsos 3/7/8 existirem primeiro):

| Candidato | Mede | Impulso |
|---|---|---|
| `micro_decisions_streak` | Sequência de acertos seguidos na micro-decisão | 3, 6 |
| `track_completed_no_errors` | Trilha inteira concluída sem nenhum erro na aposta | 2, 3 |
| `lesson_reviewed` | Revisitar voluntariamente uma lição já concluída | 7, 8 |

Duas missões diárias candidatas a `MISSION_SEEDS`: "acerte 3 apostas seguidas hoje" e "revise uma
lição concluída há mais de 14 dias".

## 4. Roteiro proposto — 8 fases, A a H

Nenhuma decidida. Sequência sugerida por dependência (schema muda só na D e H), não por
obrigatoriedade de fazer todas.

| Fase | Nome | Frente/Impulso | Risco | Toca schema? |
|---|---|---|---|---|
| A | Fatiar o texto que já existe | Frente A | Baixo | Não |
| B | Aposta com acerto/erro real | Frente A / Impulso 3 | Médio | Não (`Lesson/index.tsx` só) |
| C | Glossário inline e elenco recorrente | Frente A / Impulso 4-5 | Médio | Não |
| D | Blocos tipados + XP fracionado | Frente A / Impulso 2 | **Alto** | Sim (`lessons`, curva de XP 5.1) |
| E | Arco narrativo por trilha | Impulso 1 | Baixo | Não |
| F | Sala de conquistas no Perfil | Impulso 4 | Médio | Não (UI nova) |
| G | Feed social de aprendizado | Impulso 5 | Médio | Não (novo tipo de evento) |
| H | Missão de revisão + XP variável | Impulso 3/6/7/8 | **Alto** | Sim (`achievement_criteria_type`, `daily_missions`) |

**Recomendação de ordem, se aprovado:** A → B → E (baixo risco, conteúdo/UI, sem tocar schema) →
C/F/G (médio risco, UI nova sem schema financeiro) → D/H só depois de A-C/E-G mostrarem sinal de
que engajar funciona — reforma de schema sem esse sinal é risco sem validação.

## 5. O que não fazer

- Nenhuma técnica acima exige gamificação pesada (mini-jogo, moeda própria, animação elaborada) —
  contradiz o próprio objetivo do autor ("cada conteúdo tem que ser absorvido"): quanto mais camada
  decorativa entre o usuário e o número real, mais chance de o número virar ruído de fundo.
- Não começar pela Fase D/H (schema) antes de validar que A-C/E-G já resolvem a queixa original —
  A é reversível e testável em 1 sessão, D/H não são.
- Nunca perda de XP/nível por inatividade, nunca cronômetro real, nunca "última chance" (seção 3,
  limite ético).

## 6. Como validar

| Sinal | O que observar |
|---|---|
| Tempo por lição | Não deveria dobrar — se dobrar, o fatiamento virou fricção, não absorção |
| Conclusão Trilha 2 (15 lições) vs Trilha 0 (5) | Hoje não instrumentado — pré-requisito antes de medir qualquer fase |
| Acerto na aposta (Fase B) por tipo de lição | Perto de 100% = pergunta óbvia demais; muito baixo = Cenário não deu munição |
| Retorno voluntário ao Perfil/replay de trilha | Sinal de Impulsos 1/2/4 (Épico/Realização/Posse) |
| Aceite da missão de revisão vs. abandono da trilha | Se abandono subir depois da Fase H, o convite virou pressão — recuar |

## 7. Checklist antes de transformar uma fase em tarefa de backlog

- [ ] Fase escolhida não contradiz nenhuma regra crítica do `CLAUDE.md` (capital fixo, janela de
      ranking, RNF09 — valor absoluto nunca exposto, etc.).
- [ ] Se mexer em schema (`lessons`, `achievements`, `daily_missions`), a tarefa segue o checklist
      de migration do `CLAUDE.md` (backend) — inclusive `onConflictDoUpdate` se reescrever seed
      existente, mesmo padrão da 7.1.
- [ ] Conteúdo reescrito/fatiado continua batendo com os números reais das fórmulas do TCC cap. 2
      — fatiar não pode alterar nenhum valor numérico já correto.
- [ ] Critério de aceite e referência de spec/RF adicionados na entrada do backlog, mesmo padrão
      das tarefas 7.1.x.
- [ ] Esta sessão de estudo citada como origem da decisão na entrada do backlog, pra
      rastreabilidade (mesmo padrão do bloco "Revisão desta sessão" da Semana 7).
- [ ] Se a fase virar decisão fechada, mover a menção correspondente deste arquivo (ou o arquivo
      inteiro) pra dentro do documento certo (`especificacao-plataforma-investimentos.md` se mudar
      requisito formal, `backlog-plataforma-investimentos.md` quando virar tarefa) — este arquivo é
      proposta, não deveria acumular decisões já fechadas indefinidamente.
