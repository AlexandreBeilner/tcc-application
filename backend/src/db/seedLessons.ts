import { randomUUID } from 'node:crypto'
import { and, eq, gte, inArray, isNotNull, ne, notInArray, or, sql } from 'drizzle-orm'
import { createDb, type Database } from './client'
import { lessons, userLessonProgress } from './schema'
import { PARALLEL_TRACK_NUMBERS, type MicroDecisionType } from '../modules/lessons/domain/lesson'
import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'
import { BLOCKS_0_1, BLOCKS_0_2, BLOCKS_0_3, BLOCKS_0_4 } from './lessonContentTrilha0a'
import { BLOCKS_JUROS_SELIC_CDI_TR, BLOCKS_POUPANCA } from './lessonContentTrilha0b'
import {
  BLOCKS_1_1,
  BLOCKS_1_2,
  BLOCKS_1_3,
  BLOCKS_1_7,
  BLOCKS_1_8,
  BLOCKS_1_9,
  BLOCKS_1_10,
  BLOCKS_1_11,
  BLOCKS_RESERVA,
} from './lessonContentTrilha1b'
import { BLOCKS_1_4, BLOCKS_1_5, BLOCKS_1_6 } from './lessonContentTrilha1a'
import {
  BLOCKS_2_1,
  BLOCKS_2_2,
  BLOCKS_2_3,
  BLOCKS_2_4,
  BLOCKS_2_5,
  BLOCKS_B3_CORRETORA_ORDENS,
} from './lessonContentTrilha2'
import {
  BLOCKS_2_7_1,
  BLOCKS_2_7_2,
  BLOCKS_2_7_3,
  BLOCKS_2_7_4,
  BLOCKS_2_7_5,
  BLOCKS_2_7_7,
  BLOCKS_2_8,
  BLOCKS_2_9,
  BLOCKS_CUSTOS,
  BLOCKS_IMPOSTO,
} from './lessonContentTrilha2Empresa'
import { BLOCKS_DIVIDA, BLOCKS_ORCAMENTO } from './lessonContentTrilhaF'
import { BLOCKS_2_7_6, BLOCKS_2_10 } from './lessonContentTrilha2Proventos'
import {
  BLOCKS_3_1,
  BLOCKS_3_2,
  BLOCKS_3_3,
  BLOCKS_3_4,
  BLOCKS_VIESES,
} from './lessonContentTrilha3'
import { legacyText } from './lessonText'

export interface LessonSeed {
  // Chave de upsert do seed (tarefa M.6, achado 010) — atribuída uma vez e
  // nunca mais alterada, mesmo que `code` mude numa renumeração futura do
  // currículo. Hoje coincide com `code` porque é o primeiro valor atribuído
  // (snapshot do `code` vigente no momento em que a coluna nasceu); a partir
  // daqui os dois só continuam iguais por coincidência de uma lição nunca
  // ter sido renumerada.
  stableKey: string
  code: string
  trackNumber: number
  trackName: string
  sortOrder: number
  title: string
  centralConcept: string
  // Conteúdo pedagógico real por passo (tarefa 7.0.2) — string vazia/
  // 'reflection' pra lição ainda não autorada (autoria é a 7.1), não é
  // placeholder: é literalmente o default da migration 0010.
  scenarioText: string
  microDecisionPrompt: string
  microDecisionType: MicroDecisionType
  microDecisionAssetTicker: string | null
  // Aposta com acerto/erro real (backlog engajamento B.1/B.4) — preenchidos
  // só nas lições elegíveis (auditoria abaixo, antes de LESSON_SEEDS). `null`
  // nos dois: widget embutido já é a interação (0.2/3.3) ou pergunta aberta
  // de propósito sem resposta certa objetiva (0.1).
  microDecisionOptions: string[] | null
  microDecisionCorrectOption: number | null
  revelationText: string
  unlocksDescription: string | null
  unlocksKeys: string[]
  unlocksAssetTicker: string | null
  // Conteúdo visual por fase (RC.3.1), validado por `lessonBlocksSchema` em
  // `seedLessons.test.ts`. Omitido = player usa os textos acima.
  blocks?: LessonBlocks | null
}

// Currículo (tarefa 7.1, spec seção 5.1) — 35 lições no total (33 originais
// + as 2 da tarefa M.5, `1.3`/`1.9` abaixo), autoradas bloco a bloco (7.1.1
// a 7.1.6, depois M.5). `onConflictDoUpdate` abaixo garante que completar um
// bloco novo também *atualiza* o conteúdo de lições já seedadas em sessões
// anteriores (ex: 0.1–0.5/1.1 vinham só com `centralConcept`/
// `unlocksDescription` da 5.6), não só insere as que faltam. `1.2` (Tesouro
// Selic) foi a exceção deliberada da tarefa 7.0.2: conteúdo pedagógico
// completo, escrito pra provar o pipeline schema→API→tela
// (scenarioText/microDecisionPrompt/revelationText reais +
// unlocksAssetTicker/"Comprar agora") ponta a ponta antes da autoria em
// massa — mantido aqui como está.
//
// Renumeração da tarefa M.5 (Trilha 1 passa de 9 para 11 lições): o `code`
// de 7 lições existentes (`1.3`–`1.9` originais) mudou pra abrir espaço pras
// 2 lições novas, deslocando o conteúdo de cada uma pro `code` seguinte
// (`1.3`→`1.4`, `1.4`→`1.5`, ..., `1.9`→`1.11`). Na época, isso causou o
// achado 010 (`.claude/pontos-em-aberto-decisao-produto.md`, resolvido pela
// tarefa M.6 logo abaixo): o upsert casava por `code`, que nunca entrava no
// `set` — então um reseed reaproveitava a linha física antiga em vez de
// criar linha nova, arrastando `user_lesson_progress` de quem já tinha
// progresso real pra um conteúdo diferente do que ele viu. A M.6 trocou a
// chave de casamento pra `stableKey` (imutável, ver campo acima) e passou a
// incluir `code` no `set` — o cenário deste parágrafo não se repete em
// nenhuma renumeração futura.
//
// Auditoria de aposta com acerto/erro real (backlog engajamento B.4): das 33
// lições originais, 3 ficaram sem opções reais (microDecisionOptions/
// microDecisionCorrectOption = null, mantêm o checkbox "já pensei" de hoje)
// e 30 ganharam. O critério de elegibilidade não é "microDecisionType =
// reflection" (como o texto original da tarefa supunha) e sim "o passo
// Micro-decisão hoje mostra o checkbox" — que também vale pras 6 lições
// `live_indicator` (2.6.1–2.6.6) e, desde a M.5, pras 2 `live_macro_indicator`
// (1.3/1.9) abaixo, já que `EMBEDDED_WIDGET_TYPES`
// (`frontend/src/pages/Lesson/index.tsx`) só cobre `growth_calculator`/
// `fixed_income_comparison`. Achado de auditoria corrigindo a suposição
// original da B.4.
//
// Fora (3, justificativa por linha):
//   0.1    — pergunta é sobre motivação pessoal ("o que te faria escolher"),
//            não fato verificável; forçar múltipla escolha destruiria o
//            propósito deliberado da pergunta aberta (citado no texto
//            original desta tarefa como o exemplo a preservar).
//   0.2    — `growth_calculator`: o widget embutido já é a interação real.
//   3.3    — `fixed_income_comparison`: mesmo motivo da 0.2.
//
// Dentro (32 — 30 originais + as 2 novas da M.5) — índice da opção correta
// entre colchetes, conferido contra o veredito de `revelationText` de cada
// lição, já nos códigos renumerados pela M.5:
//   0.3 [2] 0.4 [0] 0.5 [1] 1.1 [0] 1.2 [0] 1.3 [0] 1.4 [0] 1.5 [0] 1.6 [0]
//   1.7 [1] 1.8 [1] 1.9 [1] 1.10 [0] 1.11 [1] 2.1 [1] 2.2 [1] 2.3 [0] 2.4 [1]
//   2.5 [0] 2.6.1 [0] 2.6.2 [1] 2.6.3 [0] 2.6.4 [0] 2.6.5 [1] 2.6.6 [1]
//   2.7 [0] 2.8 [1] 2.9 [1] 2.10 [1] 3.1 [0] 3.2 [0] 3.4 [3]
// A maioria (yes/no, maior/menor, sobe/desce/igual) reaproveita literalmente
// as alternativas que o próprio `microDecisionPrompt` já enumera em texto —
// não inventa vocabulário novo. Exceções que combinam duas leituras numa
// opção só: 2.3 (ON/PN de BNDD3 e BNDD4 juntos, pergunta original já pede os
// dois), 3.4 (efeito nos fundamentos + o que acontece com o Tesouro Selic,
// desafio final da trilha sintetizando 2.8+3.2 — 4 combinações possíveis,
// só uma bate com o texto de `revelationText`).
export const LESSON_SEEDS: LessonSeed[] = [
  {
    stableKey: '0.1',
    code: '0.1',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 1,
    title: 'O que é investir',
    centralConcept: 'Investir vs poupar; capital trabalhando para você',
    scenarioText: legacyText(BLOCKS_0_1, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_0_1, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    revelationText: legacyText(BLOCKS_0_1, 'revelation'),
    blocks: BLOCKS_0_1,
    unlocksDescription: 'Acesso ao Portfólio',
    unlocksKeys: ['portfolio'],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.2',
    code: '0.2',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 2,
    title: 'Juros simples vs compostos',
    centralConcept: 'Crescimento linear vs exponencial',
    scenarioText: legacyText(BLOCKS_0_2, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_0_2, 'microDecision'),
    microDecisionType: 'growth_calculator',
    microDecisionAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    revelationText: legacyText(BLOCKS_0_2, 'revelation'),
    blocks: BLOCKS_0_2,
    unlocksDescription: 'Calculadora Financeira',
    unlocksKeys: ['calculator'],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.3',
    code: '0.3',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 3,
    title: 'Inflação e poder de compra',
    centralConcept: 'Por que R$100 hoje ≠ R$100 amanhã',
    scenarioText: legacyText(BLOCKS_0_3, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_0_3, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['R$ 5', 'R$ 105', 'R$ 95', 'R$ 100'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_0_3, 'revelation'),
    blocks: BLOCKS_0_3,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.4',
    code: '0.4',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 4,
    title: 'Rendimento nominal vs real',
    centralConcept: 'Descontar a inflação do retorno',
    scenarioText: legacyText(BLOCKS_0_4, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_0_4, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Perto de 14%', 'Perto de 2%', 'Exatamente 8%', 'Perto de 6%'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_0_4, 'revelation'),
    blocks: BLOCKS_0_4,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    // Lição inserida no meio da Trilha 0 (RC.4.1): `stableKey` próprio e `code`
    // 0.5; a poupança (stableKey '0.5') passou a `code` 0.6. Quem já tinha
    // passado da posição recebe a dispensa na hora do seed
    // (`insertLessonInMiddle`), então ninguém é bloqueado.
    stableKey: 'juros-selic-cdi-tr',
    code: '0.5',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 5,
    title: 'Juros, Selic, CDI e TR',
    centralConcept: 'A taxa básica de juros e as taxas que andam com ela',
    scenarioText: legacyText(BLOCKS_JUROS_SELIC_CDI_TR, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_JUROS_SELIC_CDI_TR, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sobe junto', 'Cai', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText: legacyText(BLOCKS_JUROS_SELIC_CDI_TR, 'revelation'),
    blocks: BLOCKS_JUROS_SELIC_CDI_TR,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.5',
    code: '0.6',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 6,
    title: 'Poupança: quando ela perde e quando não',
    centralConcept: 'Comparar a poupança com a renda fixa pelo rendimento líquido',
    scenarioText: legacyText(BLOCKS_POUPANCA, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_POUPANCA, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Maior', 'Menor', 'Igual'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_POUPANCA, 'revelation'),
    blocks: BLOCKS_POUPANCA,
    unlocksDescription: 'Acesso à Trilha 1 (Renda Fixa)',
    // Chave vazia de propósito: o acesso à Trilha 1 já funciona via
    // sortOrder (5.6), não é uma chave de unlocksKeys — ver vocabulário
    // fixo da 7.0.1 (só feature/produto, não lição/trilha).
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.1',
    code: '1.1',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 7,
    title: 'O que é renda fixa',
    centralConcept: 'Emprestar dinheiro a um emissor',
    scenarioText: legacyText(BLOCKS_1_1, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_1, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Não', 'Sim'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_1, 'revelation'),
    blocks: BLOCKS_1_1,
    unlocksDescription: 'Tesouro Selic',
    // `asset:tesouro_selic` pertence de fato à lição 1.2 (spec 5.1, ver
    // backlog 7.0.1). 1.1 é só conceitual, unlocksDescription acima é
    // decorativo.
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.2',
    code: '1.2',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 8,
    title: 'Tesouro Selic',
    centralConcept: 'Emprestar dinheiro ao governo, com alta liquidez e baixa oscilação de preço',
    scenarioText: legacyText(BLOCKS_1_2, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_2, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Rende menos por dia', 'Rende mais por dia', 'Rende igual'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_2, 'revelation'),
    blocks: BLOCKS_1_2,
    unlocksDescription: 'Compra real de Tesouro Selic (LFT2029) no Mercado',
    unlocksKeys: ['asset:tesouro_selic'],
    // Ticker canônico real do catálogo (engine/cmd/seed/main.go, tarefa 3.9)
    // — usado pelo CTA "Comprar agora" do passo Desbloqueio.
    unlocksAssetTicker: 'LFT2029',
  },
  {
    // Lição inserida no meio da Trilha 1 (RC.4.6), logo depois do Tesouro
    // Selic: `stableKey` próprio e `code` 1.3. As lições seguintes da trilha
    // ganharam um `code` a mais (1.3 passou a 1.4 e assim por diante, o
    // `stableKey` de cada uma não muda, então o progresso fica). Quem já tinha
    // passado da posição recebe a dispensa na hora do seed.
    stableKey: 'reserva-emergencia',
    code: '1.3',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 9,
    title: 'Reserva de emergência: quanto e onde',
    centralConcept: 'Quanto guardar para imprevistos e em que tipo de aplicação',
    scenarioText: legacyText(BLOCKS_RESERVA, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_RESERVA, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['R$ 3.000', 'De R$ 9.000 a R$ 18.000', 'R$ 60.000'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_RESERVA, 'revelation'),
    blocks: BLOCKS_RESERVA,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.3',
    code: '1.4',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 10,
    title: 'Como a Selic é formada',
    centralConcept: 'Copom reagindo à inflação frente à meta',
    scenarioText: legacyText(BLOCKS_1_3, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_3, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Reduzir', 'Elevar', 'Manter'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_3, 'revelation'),
    blocks: BLOCKS_1_3,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.4',
    code: '1.5',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 11,
    title: 'CDB e o CDI',
    centralConcept: 'Remuneração bancária atrelada ao CDI, com garantia do FGC',
    scenarioText: legacyText(BLOCKS_1_4, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_4, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'Nada: o investidor perde todo o valor investido',
      'O FGC (Fundo Garantidor de Créditos), dentro de um limite',
      'O Banco Central devolve o valor automaticamente',
    ],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_4, 'revelation'),
    blocks: BLOCKS_1_4,
    unlocksDescription: 'Compra de CDB (CDB2027) no Mercado',
    unlocksKeys: ['asset:cdb'],
    unlocksAssetTicker: 'CDB2027',
  },
  {
    stableKey: '1.5',
    code: '1.6',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 12,
    title: 'Tributação regressiva de IR',
    centralConcept: 'Tabela regressiva de Imposto de Renda: quanto mais tempo, menor a alíquota',
    scenarioText: legacyText(BLOCKS_1_5, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_5, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Menor', 'Maior'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_5, 'revelation'),
    blocks: BLOCKS_1_5,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.6',
    code: '1.7',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 13,
    title: 'LCI e LCA',
    centralConcept: 'Isenção de IR, comparação de retorno líquido entre produtos',
    scenarioText: legacyText(BLOCKS_1_6, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_6, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['O CDB (com IR, 110% do CDI)', 'A LCI (isenta, 90% do CDI)'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_6, 'revelation'),
    blocks: BLOCKS_1_6,
    unlocksDescription: 'Compra de LCI (LCI2026) e LCA (LCA2026) no Mercado',
    unlocksKeys: ['asset:lci', 'asset:lca'],
    unlocksAssetTicker: 'LCI2026',
  },
  {
    stableKey: '1.7',
    code: '1.8',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 14,
    title: 'Tesouro Prefixado',
    centralConcept: 'Deságio: preço menor que o valor de face, taxa travada na compra',
    scenarioText: legacyText(BLOCKS_1_7, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_7, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Maior que R$ 1.000', 'Menor que R$ 1.000', 'Igual a R$ 1.000'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_7, 'revelation'),
    blocks: BLOCKS_1_7,
    unlocksDescription: 'Compra de Tesouro Prefixado (LTN2027) no Mercado',
    unlocksKeys: ['asset:tesouro_prefixado'],
    unlocksAssetTicker: 'LTN2027',
  },
  {
    stableKey: '1.8',
    code: '1.9',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 15,
    title: 'Marcação a mercado',
    centralConcept: 'Risco de vender um título prefixado antes do vencimento',
    scenarioText: legacyText(BLOCKS_1_8, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_8, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Acima', 'Abaixo', 'Igual'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_8, 'revelation'),
    blocks: BLOCKS_1_8,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.9',
    code: '1.10',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 16,
    title: 'O que é o IPCA',
    centralConcept: 'Índice de preços ao consumidor (IBGE), referência da meta de inflação',
    scenarioText: legacyText(BLOCKS_1_9, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_9, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Menos de 2%', 'Mais de 2%', 'Exatamente 2%'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_9, 'revelation'),
    blocks: BLOCKS_1_9,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.10',
    code: '1.11',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 17,
    title: 'Tesouro IPCA+',
    centralConcept: 'Proteção contra inflação: rendimento real garantido acima do IPCA',
    scenarioText: legacyText(BLOCKS_1_10, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_10, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Diminui', 'Aumenta', 'Fica igual'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_10, 'revelation'),
    blocks: BLOCKS_1_10,
    unlocksDescription: 'Compra de Tesouro IPCA+ (NTNB2035) no Mercado',
    unlocksKeys: ['asset:tesouro_ipca'],
    unlocksAssetTicker: 'NTNB2035',
  },
  {
    stableKey: '1.11',
    code: '1.12',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 18,
    title: 'CRI e CRA',
    centralConcept: 'Risco de crédito privado sem FGC, compensado por maior remuneração',
    scenarioText: legacyText(BLOCKS_1_11, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_1_11, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_1_11, 'revelation'),
    blocks: BLOCKS_1_11,
    unlocksDescription: 'Compra de CRI e CRA no Mercado, acesso à Trilha 2 (Renda Variável)',
    unlocksKeys: ['asset:cri', 'asset:cra'],
    unlocksAssetTicker: 'CRI2028',
  },
  {
    stableKey: '2.1',
    code: '2.1',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 19,
    title: 'O que é uma ação',
    centralConcept: 'Comprar uma ação é se tornar sócio de uma empresa',
    scenarioText: legacyText(BLOCKS_2_1, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_1, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'Sim, 1% do lucro sempre é seu',
      'Só se a empresa distribuir parte do lucro',
      'Nunca recebe nada',
    ],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_1, 'revelation'),
    blocks: BLOCKS_2_1,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.3',
    code: '2.2',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 20,
    title: 'Nomenclatura de tickers',
    centralConcept: 'Final 3 (ON) e final 4 (PN) da mesma empresa; final 11 é fundo ou ETF',
    scenarioText: legacyText(BLOCKS_2_3, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_3, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['BNDD4', 'BNDD3', 'Tanto faz, as duas votam igual'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_3, 'revelation'),
    blocks: BLOCKS_2_3,
    unlocksDescription: 'Primeira compra de ações (VALR3) no Mercado',
    unlocksKeys: ['asset:acao'],
    unlocksAssetTicker: 'VALR3',
  },
  {
    stableKey: '2.2',
    code: '2.3',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 21,
    title: 'IPO',
    centralConcept: 'Como uma empresa vai à bolsa',
    scenarioText: legacyText(BLOCKS_2_2, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_2, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim, sempre', 'Só o das ações novas', 'Nunca'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_2, 'revelation'),
    blocks: BLOCKS_2_2,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    // Lição inserida no meio da Trilha 2 (RC.4.2), depois de IPO e ticker e antes
    // de "Oferta e demanda"; a RC.4.3 reordenou a trilha e ela é a 2.4. O `stableKey`
    // de cada lição não muda, então o progresso fica. Quem já tinha passado da
    // posição recebe a dispensa na hora do seed.
    stableKey: 'b3-corretora-ordens',
    code: '2.4',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 22,
    title: 'Como a ação é negociada: B3, corretora e ordens',
    centralConcept: 'Corretora, B3, ordem a mercado e limite, spread e liquidez',
    scenarioText: legacyText(BLOCKS_B3_CORRETORA_ORDENS, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_B3_CORRETORA_ORDENS, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'Sim, sempre o melhor preço',
      'Não, pode pagar mais',
      'Paga menos que o melhor preço',
    ],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_B3_CORRETORA_ORDENS, 'revelation'),
    blocks: BLOCKS_B3_CORRETORA_ORDENS,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.5',
    code: '2.5',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 23,
    title: 'Oferta e demanda',
    centralConcept: 'Formação de preço no livro de ofertas',
    scenarioText: legacyText(BLOCKS_2_5, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_5, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Cair', 'Subir', 'Ficar igual, porque o valor da empresa não mudou'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_5, 'revelation'),
    blocks: BLOCKS_2_5,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.4',
    code: '2.6',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 24,
    title: 'Lendo notícias de mercado',
    centralConcept: 'Como interpretar um evento macro e decidir',
    scenarioText: legacyText(BLOCKS_2_4, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_4, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'Subir, porque houve lucro',
      'Cair, porque ficou abaixo do esperado',
      'Ficar igual',
    ],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_4, 'revelation'),
    blocks: BLOCKS_2_4,
    unlocksDescription: 'Área de notícias do mercado',
    unlocksKeys: ['news_feed'],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.1',
    code: '2.7.1',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 25,
    title: 'Lendo um balanço',
    centralConcept:
      'Peças básicas: Receita, EBIT, Lucro Líquido, Patrimônio Líquido, Dívida Bruta, Caixa',
    scenarioText: legacyText(BLOCKS_2_7_1, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_7_1, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'Sim, é o valor de mercado',
      'Não, é o valor contábil',
      'Só se a empresa não tiver dívida',
    ],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_7_1, 'revelation'),
    blocks: BLOCKS_2_7_1,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.2',
    code: '2.7.2',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 26,
    title: 'Margens de rentabilidade',
    centralConcept: 'O que é EBIT na prática, diferença para lucro líquido',
    scenarioText: legacyText(BLOCKS_2_7_2, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_7_2, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Empresa A', 'Empresa B', 'Empatam'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_7_2, 'revelation'),
    blocks: BLOCKS_2_7_2,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.5',
    code: '2.7.3',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 27,
    title: 'Endividamento',
    centralConcept: 'Risco de alavancagem',
    scenarioText: legacyText(BLOCKS_2_7_3, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_7_3, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Alta', 'Baixa'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_7_3, 'revelation'),
    blocks: BLOCKS_2_7_3,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.3',
    code: '2.7.4',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 28,
    title: 'Retorno sobre patrimônio (ROE)',
    centralConcept: 'Quão bem a empresa usa o capital dos sócios',
    scenarioText: legacyText(BLOCKS_2_7_4, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_7_4, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Empresa A', 'Empresa B', 'Empatam'],
    microDecisionCorrectOption: 0,
    revelationText: legacyText(BLOCKS_2_7_4, 'revelation'),
    blocks: BLOCKS_2_7_4,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.4',
    code: '2.7.5',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 29,
    title: 'Indicadores de preço (P/L e P/VP)',
    centralConcept: 'Ação "cara" ou "barata" frente ao que a empresa entrega',
    scenarioText: legacyText(BLOCKS_2_7_5, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_7_5, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sobe', 'Desce', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText: legacyText(BLOCKS_2_7_5, 'revelation'),
    blocks: BLOCKS_2_7_5,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.7',
    code: '2.7.6',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 30,
    title: 'Dividendos, JCP e data ex',
    centralConcept: 'Como e quando o acionista recebe, e o imposto',
    scenarioText: legacyText(BLOCKS_2_7_6, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_7_6, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_7_6, 'revelation'),
    blocks: BLOCKS_2_7_6,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.6',
    code: '2.7.7',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 31,
    title: 'Dividend Yield',
    centralConcept: 'Quanto a ação "paga" em relação ao preço',
    scenarioText: legacyText(BLOCKS_2_7_7, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_7_7, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sobe', 'Desce', 'Fica igual'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_7_7, 'revelation'),
    blocks: BLOCKS_2_7_7,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.8',
    code: '2.8',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 32,
    title: 'Setores e ciclicidade',
    centralConcept: 'Setores cíclicos e defensivos reagem diferente à economia e aos juros',
    scenarioText: legacyText(BLOCKS_2_8, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_8, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['VALR3', 'TNVA3', 'Sentem igual'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_8, 'revelation'),
    blocks: BLOCKS_2_8,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.9',
    code: '2.9',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 33,
    title: 'ETFs',
    centralConcept: 'Diversificação automática via índice',
    scenarioText: legacyText(BLOCKS_2_9, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_9, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['20%', '8%', '40%'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_9, 'revelation'),
    blocks: BLOCKS_2_9,
    unlocksDescription: 'Compra de ETF (SINT11) no Mercado',
    unlocksKeys: ['asset:etf'],
    unlocksAssetTicker: 'SINT11',
  },
  {
    stableKey: '2.10',
    code: '2.10',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 34,
    title: 'FIIs',
    centralConcept: 'Fundos imobiliários: tijolo, papel e rendimento mensal',
    scenarioText: legacyText(BLOCKS_2_10, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_2_10, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim, faz sentido', 'Não faz sentido'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_2_10, 'revelation'),
    blocks: BLOCKS_2_10,
    unlocksDescription:
      'Compra de FIIs (TJLO11 e PAPL11) no Mercado e acesso à Trilha 3 (Estratégia e Tributação)',
    unlocksKeys: ['asset:fii'],
    unlocksAssetTicker: 'TJLO11',
  },
  {
    stableKey: 'custos-de-investir',
    code: '2.11',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 35,
    title: 'O que custa investir',
    centralConcept:
      'Corretagem, custódia, taxas de fundo e spread: pequenas taxas, grande diferença',
    scenarioText: legacyText(BLOCKS_CUSTOS, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_CUSTOS, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Perto de 98%', 'Perto de 80%', 'Perto de 70%'],
    microDecisionCorrectOption: 2,
    revelationText: legacyText(BLOCKS_CUSTOS, 'revelation'),
    blocks: BLOCKS_CUSTOS,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: 'imposto-renda-variavel',
    code: '2.12',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 36,
    title: 'Imposto em renda variável',
    centralConcept: 'Swing trade, day trade, isenção de R$ 20 mil, DARF e declaração',
    scenarioText: legacyText(BLOCKS_IMPOSTO, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_IMPOSTO, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['R$ 300', 'R$ 200', 'Nada'],
    microDecisionCorrectOption: 2,
    revelationText: legacyText(BLOCKS_IMPOSTO, 'revelation'),
    blocks: BLOCKS_IMPOSTO,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.1',
    code: '3.1',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 37,
    title: 'Diversificação',
    centralConcept: 'Como espalhar o risco sem eliminá-lo',
    scenarioText: legacyText(BLOCKS_3_1, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_3_1, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['50%', '10%', '20%'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_3_1, 'revelation'),
    blocks: BLOCKS_3_1,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.2',
    code: '3.2',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 38,
    title: 'Perfil de risco',
    centralConcept: 'Perfil do investidor, prazo e risco',
    scenarioText: legacyText(BLOCKS_3_2, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_3_2, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'O que precisa do dinheiro em 6 meses',
      'O que só vai usar daqui a 20 anos',
    ],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_3_2, 'revelation'),
    blocks: BLOCKS_3_2,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.3',
    code: '3.3',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 39,
    title: 'Comparando produtos na prática',
    centralConcept: 'CDB e LCI: o que sobra no bolso',
    scenarioText: legacyText(BLOCKS_3_3, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_3_3, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['CDB', 'LCI'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_3_3, 'revelation'),
    blocks: BLOCKS_3_3,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: 'vieses-e-emocao',
    code: '3.4',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 40,
    title: 'Cabeça de investidor',
    centralConcept: 'Vieses e emoção: o que a mente faz com o seu dinheiro',
    scenarioText: legacyText(BLOCKS_VIESES, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_VIESES, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'Vender cedo o que ganha e segurar o que perde',
      'Comprar sempre na baixa',
      'Diversificar mais',
    ],
    microDecisionCorrectOption: 0,
    revelationText: legacyText(BLOCKS_VIESES, 'revelation'),
    blocks: BLOCKS_VIESES,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.4',
    code: '3.5',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 41,
    title: 'Desafio final da trilha',
    centralConcept: 'Uma carteira diante de uma alta de juros',
    scenarioText: legacyText(BLOCKS_3_4, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_3_4, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sobe', 'Cai', 'Não muda'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_3_4, 'revelation'),
    blocks: BLOCKS_3_4,
    unlocksDescription: 'Trilha guiada concluída e Mercado liberado por completo',
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: 'orcamento-para-onde-vai',
    code: 'F.1',
    trackNumber: 4,
    trackName: 'Trilha F: Finanças do dia a dia',
    sortOrder: 42,
    title: 'Para onde vai seu dinheiro',
    centralConcept: 'Orçamento: renda menos gastos é o que sobra para investir',
    scenarioText: legacyText(BLOCKS_ORCAMENTO, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_ORCAMENTO, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['R$ 400', 'R$ 600', 'R$ 700'],
    microDecisionCorrectOption: 1,
    revelationText: legacyText(BLOCKS_ORCAMENTO, 'revelation'),
    blocks: BLOCKS_ORCAMENTO,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: 'divida-os-juros-do-outro-lado',
    code: 'F.2',
    trackNumber: 4,
    trackName: 'Trilha F: Finanças do dia a dia',
    sortOrder: 43,
    title: 'Dívida: os juros do outro lado',
    centralConcept:
      'Juros compostos contra você: rotativo, cheque especial, consignado e quitar primeiro',
    scenarioText: legacyText(BLOCKS_DIVIDA, 'scenario'),
    microDecisionPrompt: legacyText(BLOCKS_DIVIDA, 'microDecision'),
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Perto de R$ 1.100', 'Perto de R$ 1.960', 'Perto de R$ 2.520'],
    microDecisionCorrectOption: 2,
    revelationText: legacyText(BLOCKS_DIVIDA, 'revelation'),
    blocks: BLOCKS_DIVIDA,
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
]

// `onConflictDoUpdate` (não só `onConflictDoNothing`): a autoria de conteúdo
// por bloco (7.1.1–7.1.6) precisa *atualizar* lições já seedadas em sessões
// anteriores com o conteúdo pedagógico novo, não só inserir as que ainda não
// existem — decisão da introdução da 7.1. `target: lessons.stableKey` (não
// `code`, desde a M.6/achado 010): `stableKey` é a única coluna garantida
// imutável por lição, então é a única que casa a linha física certa numa
// renumeração de `code`. `id`/`stableKey` nunca mudam num conflito — `code`
// agora entra no `set` de propósito, já que ele passou a ser mutável.
export async function upsertLessonSeed(db: Database, seed: LessonSeed) {
  const [row] = await db
    .insert(lessons)
    .values({ id: randomUUID(), ...seed, blocks: seed.blocks ?? null })
    .onConflictDoUpdate({
      target: lessons.stableKey,
      set: {
        code: seed.code,
        trackNumber: seed.trackNumber,
        trackName: seed.trackName,
        sortOrder: seed.sortOrder,
        title: seed.title,
        centralConcept: seed.centralConcept,
        scenarioText: seed.scenarioText,
        microDecisionPrompt: seed.microDecisionPrompt,
        microDecisionType: seed.microDecisionType,
        microDecisionAssetTicker: seed.microDecisionAssetTicker,
        microDecisionOptions: seed.microDecisionOptions,
        microDecisionCorrectOption: seed.microDecisionCorrectOption,
        revelationText: seed.revelationText,
        unlocksDescription: seed.unlocksDescription,
        unlocksKeys: seed.unlocksKeys,
        unlocksAssetTicker: seed.unlocksAssetTicker,
        blocks: seed.blocks ?? null,
      },
    })
    .returning()
  return row
}

// Lição nova no meio do currículo (RC.4.1, regra da N.24): `sortOrder` e `code`
// são únicos, então o `upsert` simples não consegue abrir espaço. Numa única
// transação: (1) a lição que hoje ocupa o `code` da nova ganha um código
// provisório (o `upsert` seguinte grava o definitivo); (2) as lições da posição
// em diante sobem uma casa, passando por valores negativos para não bater na
// restrição de unicidade no meio do UPDATE; (3) a nova é inserida; (4) quem já
// satisfez (concluiu ou foi dispensado de) `position` lições ou mais recebe a
// dispensa dela, porque já passou daquele ponto; quem ainda não chegou lá é
// bloqueado por ela normalmente (a conta ignora a Trilha F, paralela). `position` é 1-based e igual a `seed.sortOrder`.
//
// `allSeeds` (RC.4.6): quando a inserção também renumera o `code` das lições
// seguintes (1.3 vira 1.4, 1.4 vira 1.5...), o `code` é único e a renumeração em
// cadeia colidiria no `upsert`. Então, dentro da mesma transação, toda lição cujo
// `code` do banco difere do seed vai a um código provisório e, no fim, recebe o
// código definitivo (todos livres a essa altura).
export async function insertLessonInMiddle(
  db: Database,
  seed: LessonSeed,
  allSeeds: LessonSeed[] = [],
) {
  return db.transaction(async (tx) => {
    await tx
      .update(lessons)
      .set({ code: sql`'tmp-' || ${lessons.stableKey}` })
      .where(and(sql`${lessons.code} = ${seed.code}`, ne(lessons.stableKey, seed.stableKey)))
    const renumbered = allSeeds.filter((other) => other.stableKey !== seed.stableKey)
    for (const other of renumbered) {
      await tx
        .update(lessons)
        .set({ code: sql`'tmp-' || ${lessons.stableKey}` })
        .where(and(sql`${lessons.stableKey} = ${other.stableKey}`, ne(lessons.code, other.code)))
    }
    await tx
      .update(lessons)
      .set({ sortOrder: sql`-(${lessons.sortOrder} + 1)` })
      .where(gte(lessons.sortOrder, seed.sortOrder))
    await tx
      .update(lessons)
      .set({ sortOrder: sql`-${lessons.sortOrder}` })
      .where(sql`${lessons.sortOrder} < 0`)

    const [row] = await tx
      .insert(lessons)
      .values({ id: randomUUID(), ...seed, blocks: seed.blocks ?? null })
      .returning()

    for (const other of renumbered) {
      await tx
        .update(lessons)
        .set({ code: other.code })
        .where(sql`${lessons.stableKey} = ${other.stableKey} and ${lessons.code} like 'tmp-%'`)
    }

    const passed = await tx
      .select({ userId: userLessonProgress.userId })
      .from(userLessonProgress)
      .innerJoin(lessons, eq(lessons.id, userLessonProgress.lessonId))
      .where(
        and(
          or(isNotNull(userLessonProgress.completedAt), isNotNull(userLessonProgress.waivedAt)),
          // Trilha paralela (RC.4.4) fora da corrente: não conta como "já passou daquele ponto".
          notInArray(lessons.trackNumber, [...PARALLEL_TRACK_NUMBERS]),
        ),
      )
      .groupBy(userLessonProgress.userId)
      .having(sql`count(*) >= ${seed.sortOrder}`)
    if (passed.length > 0) {
      await tx
        .insert(userLessonProgress)
        .values(passed.map(({ userId }) => ({ userId, lessonId: row.id, waivedAt: new Date() })))
    }
    return { lesson: row, waivedUsers: passed.length }
  })
}

// Reordenação de lições existentes (RC.4.3): `code` e `sortOrder` são únicos,
// então trocar a ordem com o `upsert` simples bate na restrição no meio do
// caminho. Numa transação, toda lição já existente cuja posição ou código difere
// do seed vai para valores provisórios (`tmp-` e `sortOrder` negativo, que não
// colidem com nenhuma posição real) e depois recebe os definitivos. `id`,
// `stableKey` e o progresso de ninguém mudam. Não precisa de dispensa (N.24): as
// lições que sobem de posição (ticker antes de IPO, endividamento antes de ROE)
// só exigem algo que o usuário já teria feito ou que continua disponível, e as
// que descem (notícias depois de oferta e demanda, DY depois de dividendos) só
// adiam o que ele já concluiu. Devolve quantas lições mudaram de lugar.
export async function reorderExistingLessons(db: Database, seeds: LessonSeed[]) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ stableKey: lessons.stableKey, code: lessons.code, sortOrder: lessons.sortOrder })
      .from(lessons)
      .where(
        inArray(
          lessons.stableKey,
          seeds.map((seed) => seed.stableKey),
        ),
      )
    const bySeed = new Map(seeds.map((seed) => [seed.stableKey, seed]))
    const moved = rows.filter((row) => {
      const seed = bySeed.get(row.stableKey)
      return seed !== undefined && (seed.code !== row.code || seed.sortOrder !== row.sortOrder)
    })
    for (const row of moved) {
      await tx
        .update(lessons)
        .set({ code: `tmp-${row.stableKey}`, sortOrder: -(row.sortOrder + 1) })
        .where(sql`${lessons.stableKey} = ${row.stableKey}`)
    }
    for (const row of moved) {
      const seed = bySeed.get(row.stableKey)!
      await tx
        .update(lessons)
        .set({ code: seed.code, sortOrder: seed.sortOrder })
        .where(sql`${lessons.stableKey} = ${row.stableKey}`)
    }
    return moved.length
  })
}

// Seeds que ainda não existem no banco e entram antes de alguma lição que já
// existe (no fim da trilha o `upsert` simples basta). Em ordem de posição, para
// que cada inserção veja o resultado da anterior.
export async function findMiddleInsertions(db: Database, seeds: LessonSeed[]) {
  const existing = await db
    .select({ stableKey: lessons.stableKey })
    .from(lessons)
    .where(
      inArray(
        lessons.stableKey,
        seeds.map((seed) => seed.stableKey),
      ),
    )
  const known = new Set(existing.map((row) => row.stableKey))
  if (known.size === 0) return []
  const lastExistingOrder = Math.max(
    ...seeds.filter((seed) => known.has(seed.stableKey)).map((seed) => seed.sortOrder),
  )
  return seeds
    .filter((seed) => !known.has(seed.stableKey) && seed.sortOrder < lastExistingOrder)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// Idempotente: DATABASE_URL=... npm run db:seed:lessons
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  for (const seed of await findMiddleInsertions(db, LESSON_SEEDS)) {
    const { waivedUsers } = await insertLessonInMiddle(db, seed, LESSON_SEEDS)
    console.log(
      `lição ${seed.code} inserida no meio da trilha (${waivedUsers} usuário(s) dispensado(s))`,
    )
  }
  const reordered = await reorderExistingLessons(db, LESSON_SEEDS)
  if (reordered > 0) console.log(`${reordered} lição(ões) reordenada(s) ou renumerada(s)`)
  for (const seed of LESSON_SEEDS) {
    const row = await upsertLessonSeed(db, seed)
    console.log(row ? `lição ${seed.code} criada/atualizada` : `lição ${seed.code} sem alteração`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao rodar seed de lições:', err)
    process.exit(1)
  })
}
