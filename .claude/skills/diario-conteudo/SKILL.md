---
name: diario-conteudo
description: Cria e confere conteúdo do Diário Selucra (palavras do Termo, perguntas do dia e eventos da Linha do tempo) com fonte primária verificada e validação mecânica, pronto para ir ao ar sem revisão manual no painel. Use quando o autor pedir mais conteúdo do Diário, "criar diários", reforçar o estoque, ou corrigir/trocar um item. Argumento opcional: quantos itens ou dias criar (ex: "30 dias").
---

# Skill: conteúdo do Diário Selucra

O painel admin **não tem mais etapa de revisão** (decisão de 2026-10-18): tudo que está no banco já pode ir ao ar.
Por isso a garantia de qualidade mora **aqui**. Nada entra no código sem passar pelo roteiro abaixo, e o que não for
confirmado em fonte primária é **descartado e relatado**, nunca "aproveitado do jeito que dá".

Documentos de apoio (leia só o que precisar): `.claude/backlog-diario.md` (seções 3.1 a 3.6 e DI.1.4) e
`.docs/backend/daily.md`. Não redecida o que está lá.

## Regras que não mudam

1. **Fonte primária ou nada.** Banco Central, CVM, B3, Tesouro, IBGE, legislação (planalto.gov.br), documento da época
   ou site oficial da instituição. Data, número e fato são conferidos **na fonte**, não em memória, não em blog, não em
   Wikipédia (Wikipédia serve só para achar a fonte primária).
2. **Duas confirmações.** Cada fato precisa aparecer na fonte primária **e** ser conferido de novo por uma busca
   independente (outra página ou outro órgão). Se as duas não batem, o item cai.
3. **Foco no Brasil.** Mercado, instituições, planos econômicos, crises, produtos e regras do Brasil. Fato de fora só
   quando afetou o Brasil, **com a frase que explica o efeito** na explicação. Marcador `scope`: `brasil` ou `fora`.
   Mantenha mais de 70% de cada banco em `brasil`.
4. **Sem opinião política nem julgamento de governo**: só fatos e efeitos.
5. **Sem travessão (`—`) em nenhum texto.** Use vírgula, dois-pontos ou ponto.
6. **Nunca invente.** Se a busca não achar, o item não entra. Dizer "não consegui confirmar" é resultado válido.
7. **Não toque no que já existe**: nem nas chaves estáveis (`key`), nem em itens já publicados, a menos que o autor peça
   uma correção específica. Itens novos só **acrescentam**.
8. **Não publique, não agende estreia, não mexa em banco de produção.** Publicar e agendar é do autor, no painel.
   Esta skill só altera arquivos do repositório e roda checagens locais.

## Onde o conteúdo vive (todos em `backend/src/modules/daily/content/`)

| Arquivo | O que é | Como acrescentar |
|---|---|---|
| `words.ts` | Palavras-resposta do Termo | Nova entrada `['EXIBIÇÃO', 'definição']` num bloco de `MAIS_TERMOS` (par categoria + lista). Palavra do Brasil é o padrão; as de fora entram no conjunto `FORA` no fim do arquivo |
| `questions.ts` | Perguntas do cartão `trivia` | Novo objeto em `QUESTION_SEEDS` |
| `events.ts` | Eventos da Linha do tempo | Novo objeto em `EVENT_SEEDS` |
| `extraAcceptedWords.ts` | Siglas e termos que o dicionário VERO não tem | Só quando a palavra-resposta não estiver no VERO |
| `categories.ts` | Lista fechada de categorias | Não mexa |

Categorias válidas (12, lista fechada em `categories.ts`):

| Categoria | O que entra |
|---|---|
| `planos-e-moeda` | Planos econômicos, URV e Plano Real, trocas de moeda, regimes cambiais antigos |
| `juros-e-inflacao` | Inflação e índices, Copom, metas, ciclos da Selic, juros e seus efeitos |
| `instituicoes` | Banco Central, CMN, CVM, B3 e Bovespa, FGC, Tesouro, Anbima, Susep, BNDES |
| `crises-e-choques` | Crises **domésticas** (recessões, circuit breakers, moratória, greves com efeito econômico) |
| `produtos-e-regras` | Poupança, CDB, LCI/LCA, Tesouro Direto, FII, ETF, previdência, tributação, Novo Mercado |
| `bolsa-e-acoes` | Bolsa, ações, IPOs, Ibovespa, dividendos e JCP, BDRs, privatizações |
| `risco-e-analise` | Risco, retorno, marcação a mercado, duration, rating, diversificação, liquidez |
| `economia-geral` | Conceitos gerais de economia e finanças |
| `politica-fiscal` | Responsabilidade fiscal, teto e arcabouço fiscal, resultado primário, dívida pública, reformas tributária e da Previdência, leilões do Tesouro |
| `cambio-e-setor-externo` | Reservas, balança comercial, transações correntes, regimes cambiais, swaps, fluxo de capital estrangeiro, risco-país |
| `eventos-globais` | Choques **de fora** que bateram no Brasil: petróleo, dívida dos anos 80, México, Ásia, Rússia, 2008, taper tantrum, guerra comercial, pandemia, Ucrânia, política do Fed. Sempre com o efeito no Brasil na explicação (`scope: fora`) |
| `commodities-e-setores` | Ciclo do minério, petróleo e Petrobras, agronegócio, bancos, energia e privatizações, efeito das commodities no real e na bolsa |

Regra de desempate: crise **dentro** do Brasil é `crises-e-choques`; choque **vindo de fora** é `eventos-globais`.

### Formato de cada tipo

**Palavra** (`words.ts`): de 4 a 9 letras depois de normalizada (maiúscula, sem acento), **precisa estar na lista aceita**
(VERO ou `extraAcceptedWords.ts`), fora da lista de ofensivas. A definição é **uma frase curta**, sem termo que ela
mesma não explique, no estilo dos cartões das lições (`.claude/diretrizes-redacao-licoes.md`). Não repita palavra já
existente (a chave é a forma normalizada).

**Pergunta** (`questions.ts`):
```ts
{
  key: 'quem-define-a-selic',            // kebab-case, único, para sempre
  question: 'Qual órgão decide a meta da taxa Selic a cada reunião?',
  options: ['Tesouro Nacional', 'Copom', 'CVM', 'Ministério da Fazenda'],   // exatamente 4, sem repetir
  correctIndex: 1,                       // varie a posição; hoje o 3 é raro
  explanation: '...até 280 caracteres, sem termo que ela não explique.',
  source: 'Banco Central do Brasil, Copom (bcb.gov.br/controleinflacao/copom).',
  category: 'instituicoes',
  scope: 'brasil',
}
```
Enunciado **não entrega a resposta**; as erradas são **plausíveis** (não absurdas); sem pegadinha de redação.

**Evento** (`events.ts`):
```ts
{
  key: 'plano-real-1994',                // kebab-case com o ano, único, para sempre
  year: 1994,
  label: 'Lançamento do Plano Real',     // até 80 caracteres e NÃO pode conter o ano
  explanation: '...até 280 caracteres.',
  source: 'Lei nº 8.880, de 27/05/1994 (planalto.gov.br).',
  category: 'planos-e-moeda',
  scope: 'brasil',
}
```
O `label` aparece **antes** de o jogador ordenar, então não pode dar a pista do ano nem da ordem. O ano é o do **fato
principal**, conferido na fonte (decreto/lei: data da publicação; crise: data do evento, não do fim).

## Roteiro

### 1. Diagnosticar

```
cd backend && npm run daily:report
```
Leia o estoque, os dias sem repetir, as categorias vazias, a posição dos gabaritos, as décadas dos eventos e as
possíveis duplicatas. **Meta de cobertura:** pelo menos 30 dias seguidos sem repetir palavra e pergunta, e eventos
suficientes para a janela de 14 dias sem repetir (56 no mínimo; mais que isso dá variedade de décadas). Se o autor
passou uma quantidade, ela manda; senão, mire a maior lacuna do relatório.

### 2. Planejar o lote

Antes de pesquisar, escreva (para o autor e para você) a **lista de temas** do lote: quantos itens de cada tipo, em quais
categorias, quais décadas (eventos), quantos `fora`. Preencha as categorias vazias e as décadas ralas primeiro.
Confira que cada tema **ainda não existe** no banco (busque no código por palavra-chave, não só pela chave).

### 3. Pesquisar e escrever

Para cada item:
1. Busque a fonte primária (WebSearch e WebFetch). Anote URL/norma, data e o trecho que sustenta o fato.
2. Confira o fato em uma **segunda** fonte independente.
3. Só então escreva o item, citando a fonte **no campo `source`** (instituição, norma ou documento, com número e data, e
   o endereço quando for página).
4. Aplique o checklist da seção abaixo.

Palavras: ao propor uma palavra, confira que ela é termo real do mercado/economia brasileira e que está no VERO ou
acrescente à lista extra. Para saber se está no VERO: `grep -x PALAVRA backend/src/modules/daily/content/acceptedWords.vero.txt`
(maiúscula, sem acento).

### 4. Verificação independente

Depois de escrever, **chame um subagente de contexto limpo** (Agent, tipo `general-purpose`) para auditar o lote. Ele
recebe só: o texto de cada item (enunciado, alternativas **sem o gabarito**, explicação, ano, fonte) e a instrução de
**refazer a pesquisa do zero** e dizer, por item, `CONFIRMADO` (fonte e valores batem), `DIVERGE` (o que difere) ou
`NÃO ENCONTRADO`. Para perguntas, ele deve responder qual alternativa é a correta **sem saber a que está marcada**; se a
resposta dele diverge do `correctIndex`, o item é suspeito.
Todo item `DIVERGE`/`NÃO ENCONTRADO`, ou em que a resposta do verificador difere do gabarito, é **corrigido com nova
pesquisa ou removido**. Nada entra "porque provavelmente está certo".

### 5. Validar mecanicamente

```
cd backend
npm run daily:report          # sem ERRO, sem categoria nova vazia, sem possível duplicata que seja o mesmo fato
npx vitest run src/modules/daily/content
npm run lint
npx prettier --check src/modules/daily
```
Todos precisam passar. Os testes de `dailyContent.test.ts` exigem, entre outras coisas: respostas aceitas, fonte presente,
explicação até 280, sem travessão, mais de 70% Brasil, 4 posições de gabarito usadas, 30 dias sem aviso e sem repetição
de palavra/pergunta, e Linha do tempo com 4 anos distintos e 3 décadas ou mais. Se um teste falhar, **conserte o
conteúdo**, não o teste.

### 6. Entregar

Resuma ao autor, numa tabela curta: item, categoria, `scope`, fonte, resultado das duas confirmações e do verificador.
Liste separadamente o que foi **descartado** e por quê. Não faça commit sem o autor pedir.

Como o conteúdo chega ao ar (para explicar, não para executar):
1. commit e deploy normais;
2. no servidor, `node dist/db/seedDaily.js` (importa **só o que falta**, por chave estável, e nunca sobrescreve o que o
   painel editou);
3. o agendador diário materializa os próximos dias com o conteúdo novo e, com o Diário no ar, **já os publica**.

## Checklist de cada item (todos precisam ser "sim")

1. Fonte primária registrada no campo `source`?
2. Data e número conferidos na fonte, e confirmados por uma segunda busca?
3. Se é fato de fora, a explicação diz o efeito no Brasil?
4. O enunciado/nome não entrega a resposta (nem o ano, nos eventos)? As alternativas erradas são plausíveis?
5. Explicação com até ~280 caracteres, sem termo que ela mesma não explique?
6. Sem `—`, sem opinião política, só fatos e efeitos?
7. A palavra está no VERO ou na lista extra, e não é ofensiva?
8. É um tema que ainda não existe no banco (nem com outro nome)?
9. Categoria da lista fechada e `scope` coerente com o conteúdo?
10. `key` nova, em kebab-case, única?

## Correção de um item existente

Só a pedido do autor. Corrija o texto no arquivo de conteúdo (a chave **não muda**) e rode as mesmas validações. Lembre
que o seed **nunca sobrescreve** item já importado: no banco, a correção entra pelo painel (`/admin/diario/conteudo`) ou
por um script aditivo e idempotente, como os `apply*` de lições. Diga isso ao autor.
