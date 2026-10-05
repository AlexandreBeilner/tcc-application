import { randomUUID } from 'node:crypto'
import { and, gte, inArray, isNotNull, ne, or, sql } from 'drizzle-orm'
import { createDb, type Database } from './client'
import { lessons, userLessonProgress } from './schema'
import type { MicroDecisionType } from '../modules/lessons/domain/lesson'
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
    stableKey: '2.2',
    code: '2.2',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 20,
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
    stableKey: '2.3',
    code: '2.3',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 21,
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
    stableKey: '2.4',
    code: '2.4',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 22,
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
    // Lição inserida no meio da Trilha 2 (RC.4.2), antes de "Oferta e demanda":
    // `stableKey` próprio e `code` 2.5. As lições seguintes da trilha ganharam um
    // `code` a mais (2.5 passou a 2.6, o grupo 2.6.x a 2.7.x e assim por diante, o
    // `stableKey` de cada uma não muda, então o progresso fica). Quem já tinha
    // passado da posição recebe a dispensa na hora do seed.
    stableKey: 'b3-corretora-ordens',
    code: '2.5',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 23,
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
    code: '2.6',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 24,
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
    stableKey: '2.6.1',
    code: '2.7.1',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 25,
    title: 'Lendo um balanço',
    centralConcept:
      'Peças básicas: Receita, EBIT, Lucro Líquido, Patrimônio Líquido, Dívida Bruta, Caixa',
    scenarioText:
      'Por trás de VALR3 existe uma empresa de verdade, a Mineradora Vale do Rio, e o motor de simulação ' +
      'gera um relatório financeiro dela a cada ciclo, com seis números.' +
      '\n\n' +
      'Receita Líquida (o que ela faturou), EBIT (lucro operacional, antes de juros e impostos), Lucro ' +
      'Líquido (o que sobra depois de tudo), Patrimônio Líquido (o que a empresa vale, descontadas as ' +
      'dívidas), Dívida Bruta e Caixa.',
    microDecisionPrompt:
      'Entre EBIT e Lucro Líquido, um deles é calculado primeiro, antes de descontar juros e impostos. Você ' +
      'acha que esse é sempre maior ou sempre menor que o Lucro Líquido final?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Maior', 'Menor'],
    microDecisionCorrectOption: 0,
    revelationText:
      'EBIT vem primeiro e costuma ser maior que o Lucro Líquido, já que ainda falta descontar juros da ' +
      'dívida e impostos antes de chegar ao resultado final.' +
      '\n\n' +
      'Patrimônio Líquido não é caixa: é a diferença entre tudo que a empresa tem e tudo que ela deve, ' +
      'acumulada ao longo do tempo.' +
      '\n\n' +
      'Dívida Bruta e Caixa, sozinhos, ainda não dizem se a empresa está endividada de verdade: isso só ' +
      'aparece juntando os dois, na lição 2.6.5.' +
      '\n\n' +
      'Esses seis números são a base de todo indicador que você vai calcular daqui pra frente; veja abaixo ' +
      'o painel calculado ao vivo pra VALR3 a partir do relatório mais recente dela.',
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
    scenarioText:
      'Duas empresas podem faturar o mesmo e sobrar valores bem diferentes no fim: o que importa não é só ' +
      'quanto a Mineradora Vale do Rio (VALR3) fatura, mas que fração desse faturamento ela mantém como ' +
      'lucro, em cada etapa do resultado.' +
      '\n\n' +
      'É isso que uma margem mede: um lucro dividido pela receita que o gerou.',
    microDecisionPrompt:
      'Margem EBIT usa o lucro operacional (antes de juros e impostos); Margem Líquida usa o que sobra no ' +
      'fim, depois de tudo descontado. Pra VALR3, você espera que a Margem Líquida seja maior ou menor que a ' +
      'Margem EBIT?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Maior', 'Menor'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Margem EBIT = EBIT / Receita Líquida; Margem Líquida = Lucro Líquido / Receita Líquida.' +
      '\n\n' +
      'Como o Lucro Líquido já descontou juros e impostos que o EBIT ainda não descontou, a Margem Líquida ' +
      'costuma ser menor que a Margem EBIT.' +
      '\n\n' +
      'A diferença entre as duas mostra quanto do resultado operacional a empresa perde pra dívida e ' +
      'impostos antes de chegar ao lucro final.' +
      '\n\n' +
      'Veja abaixo as duas margens calculadas ao vivo pra VALR3, a partir do relatório mais recente.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.3',
    code: '2.7.3',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 27,
    title: 'Retorno sobre patrimônio (ROE)',
    centralConcept: 'Quão bem a empresa usa o capital dos sócios',
    scenarioText:
      'Imagine duas empresas com o mesmo Lucro Líquido, mas uma precisou de um Patrimônio Líquido bem maior ' +
      'que a outra pra chegar nesse resultado. As duas lucraram igual, mas usaram o capital dos sócios com a ' +
      'mesma eficiência?',
    microDecisionPrompt:
      'Se a Mineradora Vale do Rio (VALR3, {{ref:2.1}}) e o Banco Nordeste Digital (BNDD4, {{ref:2.3}}) tivessem o mesmo Lucro ' +
      'Líquido, mas a VALR3 precisasse de um Patrimônio Líquido menor pra chegar lá, qual das duas estaria ' +
      'usando melhor o capital dos seus sócios?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['VALR3 (Mineradora)', 'BNDD4 (Banco)'],
    microDecisionCorrectOption: 0,
    revelationText:
      'A VALR3 estaria usando melhor: ROE = Lucro Líquido / Patrimônio Líquido mede quanto lucro a empresa ' +
      'gera pra cada real de capital que os sócios colocaram nela.' +
      '\n\n' +
      'Então, pra um mesmo lucro, menos patrimônio empregado significa ROE mais alto e capital mais bem ' +
      'aproveitado. É por isso que ROE alto é lido como sinal de boa gestão do capital próprio, não só de ' +
      'lucro alto em valor absoluto.' +
      '\n\n' +
      'Veja abaixo o ROE calculado ao vivo pra VALR3.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.4',
    code: '2.7.4',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 28,
    title: 'Indicadores de preço (P/L e P/VP)',
    centralConcept: 'Ação "cara" ou "barata" frente ao que a empresa entrega',
    scenarioText:
      'O preço de VALR3 sozinho não diz se a ação está cara ou barata: R$20 pode ser caro pra uma empresa ' +
      'que lucra pouco por ação e barato pra uma que lucra muito.' +
      '\n\n' +
      'Pra comparar preço com o que a empresa de fato entrega, primeiro é preciso trazer Lucro Líquido e ' +
      'Patrimônio Líquido pra base "por ação".',
    microDecisionPrompt:
      'Se o preço de VALR3 triplicar de um dia pro outro, mas o Lucro Líquido por ação dela continuar o ' +
      'mesmo, o P/L (Preço / Lucro por ação) sobe, desce ou fica igual?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Sobe', 'Desce', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText:
      'LPA (lucro por ação) = Lucro Líquido / número de ações; P/L = Preço / LPA.' +
      '\n\n' +
      'Com o LPA parado e o preço triplicando, o P/L também triplica: o mercado passa a pagar três vezes ' +
      'mais por cada real de lucro que a empresa gera, ou seja, a ação fica mais "cara" nesse critério.' +
      '\n\n' +
      'O mesmo raciocínio vale pro par VPA (Patrimônio Líquido / número de ações) e P/VP (Preço / VPA), só ' +
      'que comparando preço ao patrimônio da empresa em vez de ao lucro. Veja abaixo os quatro calculados ao ' +
      'vivo pra VALR3.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.5',
    code: '2.7.5',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 29,
    title: 'Endividamento',
    centralConcept: 'Risco de alavancagem',
    scenarioText:
      'Dívida Bruta alta assusta à primeira vista, mas sozinha não conta a história inteira: uma empresa com ' +
      'muita dívida e ainda mais Caixa parado pode estar bem mais segura que uma com pouca dívida e nenhum ' +
      'Caixa de reserva.',
    microDecisionPrompt:
      'Se a Dívida Bruta de uma empresa é alta, mas o Caixa dela é ainda mais alto, a Dívida Líquida ' +
      '(Dívida Bruta menos Caixa) dessa empresa é alta ou baixa?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Alta', 'Baixa'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Baixa, podendo até ser negativa: Dívida Líquida = Dívida Bruta − Caixa, então quando o Caixa supera a ' +
      'Dívida Bruta, a empresa tem, na prática, mais dinheiro guardado do que deve.' +
      '\n\n' +
      'O indicador Dívida Líquida/EBIT vai além, comparando essa dívida líquida com a capacidade de geração ' +
      'de caixa operacional da empresa. O resultado é, em anos de {{EBIT}}, quanto tempo levaria pra quitar a ' +
      'dívida líquida se todo o resultado operacional fosse usado só pra isso.' +
      '\n\n' +
      'Esse indicador pesa ainda mais numa empresa de perfil sofisticado como o Banco Nordeste Digital ' +
      '(BNDD4), mais sensível a mudanças na Selic, já que juros mais altos encarecem ' +
      'justamente a dívida que entra nessa conta.' +
      '\n\n' +
      'Veja abaixo a Dívida Líquida/EBIT calculada ao vivo pra VALR3.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.6',
    code: '2.7.6',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 30,
    title: 'Dividend Yield',
    centralConcept: 'Quanto a ação "paga" em relação ao preço',
    scenarioText:
      'Além de poder valorizar de preço, VALR3 pode distribuir parte do lucro da Mineradora Vale do Rio ' +
      'direto pros seus acionistas, em dinheiro, os dividendos (ou proventos).' +
      '\n\n' +
      'O Dividend Yield resume, num só número, quanto isso representa frente ao preço atual da ação.',
    microDecisionPrompt:
      'Se o preço de VALR3 dobrar de um dia pro outro, mas os dividendos pagos por ação nos últimos 12 ' +
      'meses continuarem os mesmos, o Dividend Yield sobe, desce ou fica igual?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Sobe', 'Desce', 'Fica igual'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Desce: Dividend Yield = soma dos dividendos pagos por ação nos últimos 12 meses / Preço atual, então, ' +
      'com o numerador parado, dobrar o preço corta o Dividend Yield pela metade.' +
      '\n\n' +
      'É por isso que um Dividend Yield alto pode significar tanto uma empresa boa pagadora de dividendos ' +
      'quanto uma ação com o preço em queda, sem que os dividendos tenham mudado.' +
      '\n\n' +
      'Nunca leia esse número sozinho, sem olhar o preço e o histórico de pagamentos por trás dele. Você ' +
      'encontra esse histórico completo, com cada valor e cada data de pagamento, na tela de Detalhe do ' +
      'Ativo de qualquer ação.' +
      '\n\n' +
      'Veja abaixo o Dividend Yield calculado ao vivo pra VALR3, o último dos 9 indicadores ' +
      'fundamentalistas do currículo; a próxima lição explica como e quando esse pagamento chega até você.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.7',
    code: '2.8',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 31,
    title: 'Dividendos e data ex',
    centralConcept: 'Como e quando o acionista recebe',
    scenarioText:
      'Você tem VALR3 na carteira no dia em que a Mineradora Vale do Rio fecha seu ciclo de relatório (a ' +
      'cada 14 dias simulados) e a empresa distribui parte do lucro como dividendo.' +
      '\n\n' +
      'Nesse exato dia, a plataforma registra quem tem direito a receber esse provento: é a data ex.',
    microDecisionPrompt:
      'Se você vender toda a sua posição em VALR3 um dia depois da data ex, mas antes do dia de pagamento, ' +
      'ainda recebe o dividendo dessa distribuição?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Sim. O direito ao provento é definido pela posição que você tinha exatamente na data ex, o dia de ' +
      'relatório em que o dividendo é gerado, não pela posição no dia do pagamento.' +
      '\n\n' +
      'A plataforma registra quem tem posição nesse momento e paga esse mesmo grupo depois, com uma ' +
      'defasagem fixa de 5 dias simulados entre a data ex e o pagamento, sempre antes do próximo ciclo de ' +
      'relatório distribuir um novo provento sobre o mesmo ativo.' +
      '\n\n' +
      'Vender depois da data ex não tira o seu direito ao provento já gerado; comprar depois da data ex não ' +
      'dá direito a ele, só ao provento do próximo ciclo.' +
      '\n\n' +
      'O valor por ação, o mesmo que forma o {{Dividend Yield}} da lição anterior, é creditado direto no seu ' +
      'saldo, e vale tanto para ações quanto para FIIs, o produto da lição 2.10.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.8',
    code: '2.9',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 32,
    title: 'Setores e ciclicidade',
    centralConcept: 'Conecta com Selic afetando fundamentos (3.2.2), defensivo vs cíclico',
    scenarioText:
      'A Selic não afeta só renda fixa: ela também entra na simulação dos fundamentos de toda empresa ' +
      'listada, e não afeta todas do mesmo jeito.' +
      '\n\n' +
      'A Mineradora Vale do Rio (VALR3, setor Mineração, perfil Conservador, {{ref:2.1}}) e o Banco Nordeste ' +
      'Digital (BNDD4, setor Bancário/Financeiro, perfil Sofisticado, {{ref:2.3}}) reagem de forma diferente ' +
      'quando a Selic simulada sobe.',
    microDecisionPrompt:
      'Perfil Sofisticado (setores mais cíclicos e alavancados) é mais sensível a juros altos do que perfil ' +
      'Conservador (fluxo de caixa mais estável).' +
      '\n\n' +
      'Numa alta de Selic, qual das duas você espera que sinta um efeito maior nos fundamentos: VALR3 ' +
      '(Conservador) ou BNDD4 (Sofisticado)?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['VALR3 (Conservador)', 'BNDD4 (Sofisticado)'],
    microDecisionCorrectOption: 1,
    revelationText:
      'BNDD4 sente um efeito maior. É o mesmo perfil de risco (Conservador/Sofisticado) que você já viu na ' +
      'Trilha 1 para renda fixa, aqui aplicado ao efeito da Selic sobre os fundamentos de cada empresa.' +
      '\n\n' +
      'Perfil Sofisticado, como o do Banco Nordeste Digital, concentra setores mais cíclicos e alavancados, ' +
      'mais sensíveis a juros altos; perfil Conservador, como o da Mineradora Vale do Rio, tem fluxo de ' +
      'caixa mais estável e sente menos esse efeito.' +
      '\n\n' +
      'É essa mesma lógica que explica por que diversificar entre setores e perfis diferentes reduz o risco ' +
      'da carteira. Numa alta de juros, nem todas as empresas pioram do mesmo jeito, e um portfólio ' +
      'concentrado só em setores cíclicos sofre mais do que um distribuído entre defensivo e cíclico.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.9',
    code: '2.10',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 33,
    title: 'ETFs',
    centralConcept: 'Diversificação automática via índice',
    scenarioText:
      'Comprar uma única cota do ETF Índice Sintético (SINT11) dá exposição, de uma vez, a uma cesta ' +
      'inteira de empresas que compõem o índice de referência dele.' +
      '\n\n' +
      'Hoje replicado por amostragem representativa com a Mineradora Vale do Rio (40% do peso), o Banco ' +
      'Nordeste Digital (35%) e outras posições agregadas (25%).' +
      '\n\n' +
      'Em vez de escolher ação por ação, você compra o índice inteiro.',
    microDecisionPrompt:
      'Se só a Mineradora Vale do Rio (40% do peso do SINT11) sofrer uma queda forte de preço, o preço do ' +
      'SINT11 inteiro deveria cair na mesma proporção, ou menos?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Na mesma proporção', 'Menos'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Menos. O preço do ETF acompanha o índice de referência que ele replica, formado pela média ponderada ' +
      'de todos os constituintes, não só de um.' +
      '\n\n' +
      'Com a Mineradora Vale do Rio pesando 40% da composição, uma queda forte só nela puxa o índice pra ' +
      'baixo proporcionalmente a esse peso, mas o resto da cesta (Banco Nordeste Digital e outras posições) ' +
      'amortece o efeito.' +
      '\n\n' +
      'É essa diversificação automática, numa única compra, que torna o ETF diferente de comprar uma ação ' +
      'isolada: você nunca fica 100% exposto ao resultado de uma empresa só.' +
      '\n\n' +
      'Dois números ajudam a ler um ETF. O NAV é o valor real da cesta dividido pelo número de cotas. O preço ' +
      'no mercado oscila em torno dele: acima do NAV é ágio, abaixo é deságio. Quando a diferença fica grande, ' +
      'um participante autorizado entra em ação, criando cotas novas (compra a cesta e recebe cotas) ou ' +
      'resgatando cotas (devolve cotas e recebe a cesta), o que empurra o preço de volta pro NAV.' +
      '\n\n' +
      'O fundo também recebe os dividendos das empresas da cesta e os distribui aos cotistas, e cobra uma ' +
      'taxa de administração pequena, que reduz um pouco o valor da cota com o tempo. Completar esta lição ' +
      'libera a compra real do SINT11 no Mercado.',
    unlocksDescription: 'Compra real de ETF (SINT11) no Mercado',
    unlocksKeys: ['asset:etf'],
    unlocksAssetTicker: 'SINT11',
  },
  {
    stableKey: '2.10',
    code: '2.11',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 34,
    title: 'FIIs',
    centralConcept: 'Fundos imobiliários, tickers final 11',
    scenarioText:
      'FII (Fundo de Investimento Imobiliário) também tem ticker terminado em 11, igual ETF (lição 2.3), ' +
      'mas o produto por trás é bem diferente.' +
      '\n\n' +
      'Em vez de replicar um índice de ações, um FII investe em imóveis ou em recebíveis ligados ao setor ' +
      'imobiliário, e distribui o resultado como dividendo aos cotistas.' +
      '\n\n' +
      'O FII Tijolo Corporativo (TJLO11) é dono direto de imóveis (segmento Lajes Corporativas, com 5,2% de ' +
      'vacância); o FII Papel Recebíveis (PAPL11) não tem imóvel nenhum, ele é dono de uma carteira de ' +
      'recebíveis (dívidas ligadas ao setor imobiliário) indexada ao CDI.',
    microDecisionPrompt:
      'TJLO11 tem 5,2% de vacância (fração dos imóveis dele sem inquilino no momento). Esse indicador de ' +
      'vacância faz sentido calcular também pro PAPL11, que não tem imóvel próprio?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim, faz sentido', 'Não faz sentido'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Não faz sentido: vacância é um indicador exclusivo do perfil tijolo, porque só existe imóvel físico ' +
      'pra ficar vago.' +
      '\n\n' +
      'O perfil papel, como o PAPL11, é avaliado por indicadores diferentes, principalmente o indexador da ' +
      'carteira de recebíveis (CDI, no caso do PAPL11) e o valor total dessa carteira.' +
      '\n\n' +
      'Já que o resultado dele vem do que os devedores pagam, não do aluguel de um imóvel. Os dois perfis, ' +
      'porém, compartilham o mesmo {{Dividend Yield}} (lição 2.6.6) como indicador comum de quanto o FII ' +
      'distribui frente ao preço da cota.' +
      '\n\n' +
      'Completar esta lição libera a compra real de FIIs no Mercado e conclui a Trilha 2 (Renda Variável): ' +
      'a Trilha 3 (Estratégia e Tributação) abre na sequência.',
    unlocksDescription:
      'O resto do patrimônio com onde crescer (ações, ETFs, FIIs), compra real de FIIs (TJLO11/PAPL11) no ' +
      'Mercado, acesso à Trilha 3 (Estratégia e Tributação)',
    unlocksKeys: ['asset:fii'],
    unlocksAssetTicker: 'TJLO11',
  },
  {
    stableKey: '3.1',
    code: '3.1',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 35,
    title: 'Diversificação',
    centralConcept: 'Por que não concentrar tudo num ativo',
    scenarioText:
      'Você tem R$10.000 e dois planos: colocar tudo em VALR3, uma única ação, ou dividir esse valor entre ' +
      'VALR3, BNDD4 e um pouco de Tesouro Selic.' +
      '\n\n' +
      'Nos dois planos você está investindo o mesmo valor total, mas o resultado de um evento ruim ' +
      'específico da Mineradora Vale do Rio (uma quebra de safra, um escândalo contábil, qualquer choque ' +
      'isolado) afeta cada plano de um jeito bem diferente.' +
      '\n\n' +
      'Esta trilha fecha o arco das duas anteriores: juntar a reserva segura (Trilha 1) e a parte de risco ' +
      '(Trilha 2) numa única estratégia, e testar essa estratégia contra um evento de mercado real na ' +
      'última lição.',
    microDecisionPrompt:
      'Se um evento negativo atinge só a Mineradora Vale do Rio, qual dos dois planos sofre a perda maior no ' +
      'patrimônio total: o concentrado 100% em VALR3, ou o dividido entre VALR3, BNDD4 e Tesouro Selic?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'O plano concentrado 100% em VALR3',
      'O plano dividido entre VALR3, BNDD4 e Tesouro Selic',
    ],
    microDecisionCorrectOption: 0,
    revelationText:
      'O plano concentrado. Todo o patrimônio está exposto ao mesmo risco específico daquela empresa, então ' +
      'um choque nela vira um choque no portfólio inteiro.' +
      '\n\n' +
      'No plano diversificado, o mesmo evento só afeta a fatia aplicada em VALR3; o resto (BNDD4, com ' +
      'fundamentos e setor diferentes, e o Tesouro Selic, sem nenhuma ligação com o desempenho de uma ' +
      'empresa) segue intacto.' +
      '\n\n' +
      'É a mesma lógica por trás do ETF da lição 2.9 (uma cesta de ações amortecendo o choque de uma só), ' +
      'aplicada agora entre classes inteiras: renda fixa, ações de setores diferentes e perfis de risco ' +
      'diferentes (lição 2.8).' +
      '\n\n' +
      'Diversificar não aumenta o retorno esperado de cada ativo isolado, mas reduz o risco específico de ' +
      'cada um pesar sozinho no resultado final.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.2',
    code: '3.2',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 36,
    title: 'Perfil de risco',
    centralConcept: 'Conservador vs Sofisticado, risco x retorno',
    scenarioText:
      'Você já viu o rótulo de risco em vários produtos ao longo da trilha: VALR3 e o Tesouro Selic com ' +
      'perfil Conservador; BNDD4 com perfil Sofisticado; CRI2028 (AA) e CRA2028 (A) com classificação de ' +
      'crédito.' +
      '\n\n' +
      'Cada um mede uma coisa diferente, mas todos apontam pra uma mesma pergunta: quanta oscilação e ' +
      'quanto risco de perda você está disposto a aceitar em troca de um retorno maior?',
    microDecisionPrompt:
      'Um portfólio 100% perfil Sofisticado tende a oscilar mais, pra cima e pra baixo, do que um portfólio ' +
      '100% perfil Conservador. Pra alguém que pode precisar resgatar o dinheiro em poucos meses, qual dos ' +
      'dois perfis é mais adequado?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Conservador', 'Sofisticado'],
    microDecisionCorrectOption: 0,
    revelationText:
      'O perfil Conservador. Risco e retorno não são opostos que se escolhe livremente: são uma troca.' +
      '\n\n' +
      'Perfil Sofisticado, como o do Banco Nordeste Digital (lição 2.8), tende a entregar retorno maior no ' +
      'longo prazo justamente por aceitar mais oscilação no caminho, o que é perigoso pra quem precisa do ' +
      'valor num prazo curto e pode ser forçado a vender numa hora ruim.' +
      '\n\n' +
      'Perfil Conservador entrega menos oscilação em troca de um retorno esperado mais modesto. Não existe ' +
      'perfil certo ou errado, existe perfil adequado ao seu horizonte de tempo e à sua necessidade real ' +
      'daquele dinheiro.' +
      '\n\n' +
      'É por isso que a mesma pergunta vale tanto pra escolher entre ações de perfis diferentes quanto ' +
      'entre CRI2028 (AA, mais seguro) e CRA2028 (A, mais arriscado e mais rentável).',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.3',
    code: '3.3',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 37,
    title: 'Comparando produtos na prática',
    centralConcept: 'CDB 110% CDI líquido vs LCI 90% CDI isento, qual rende mais?',
    scenarioText:
      'Você já viu, na lição 1.6, que CDB é tributado pela tabela regressiva de IR e LCI é isento.' +
      '\n\n' +
      'Mas taxa bruta maior e isenção de imposto são coisas diferentes, e comparar os dois de verdade exige ' +
      'olhar o valor líquido no bolso, não só o percentual anunciado.',
    microDecisionPrompt:
      'Use a calculadora abaixo, mantendo os valores padrão (CDB 110% CDI vs LCI 90% CDI, R$10.000, 365 ' +
      'dias) e compare o valor líquido dos dois. Depois mude o prazo pra 180 dias e compare de novo: o ' +
      'vencedor muda?',
    microDecisionType: 'fixed_income_comparison',
    microDecisionAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    revelationText:
      'Com os valores padrão (365 dias, alíquota regressiva de 17,5% nessa faixa), o CDB a 11,00% a.a. ' +
      'bruto rende R$10.907,50 líquidos contra R$10.900,00 do LCI a 9,00% a.a. isento: o CDB vence, mas por ' +
      'pouco.' +
      '\n\n' +
      'Em 180 dias, a alíquota sobe pra 22,5% (a faixa mais alta da tabela regressiva, mesma da lição 1.5), ' +
      'e o resultado se inverte: o CDB rende R$10.409,30 líquidos contra R$10.434,15 do LCI, que agora ' +
      'vence.' +
      '\n\n' +
      'A taxa bruta maior do CDB não garante o resultado líquido maior: quanto mais cedo você resgata, ' +
      'maior a alíquota que corrói o rendimento tributado, e mais a isenção do LCI pesa a favor dele.' +
      '\n\n' +
      'Quanto mais tempo o dinheiro fica aplicado, menor a alíquota, e mais o CDB tem chance de recuperar a ' +
      'vantagem. Não existe produto que "rende mais" de forma absoluta: existe o produto que rende mais ' +
      'líquido pro prazo que você de fato pretende manter o dinheiro aplicado.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.4',
    code: '3.4',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 38,
    title: 'Desafio final da trilha',
    centralConcept: 'Cenário combinando renda fixa + variável + um evento macro',
    scenarioText:
      'Você tem um portfólio com Tesouro Selic (LFT2029) e ações da Mineradora Vale do Rio (VALR3) e do ' +
      'Banco Nordeste Digital (BNDD4).' +
      '\n\n' +
      'Um evento macro de alta da Selic é disparado (lição 2.4): o Tesouro Selic passa a render mais no ' +
      'mesmo instante em que os fundamentos das duas empresas sentem o efeito sistêmico da Selic (lição ' +
      '2.8) e o preço de ambas reage ao choque especulativo do evento (lição 2.5).',
    microDecisionPrompt:
      'Juntando o que você já viu nas lições 2.8 e 3.2.' +
      '\n\n' +
      'Nesse cenário de alta de Selic, qual das duas ações tende a sentir o efeito maior nos fundamentos, ' +
      'VALR3 (Conservador) ou BNDD4 (Sofisticado), e o que acontece com o Tesouro Selic ao mesmo tempo?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'VALR3 sente mais o efeito, e o Tesouro Selic passa a render menos',
      'VALR3 sente mais o efeito, e o Tesouro Selic passa a render mais',
      'BNDD4 sente mais o efeito, e o Tesouro Selic passa a render menos',
      'BNDD4 sente mais o efeito, e o Tesouro Selic passa a render mais',
    ],
    microDecisionCorrectOption: 3,
    revelationText:
      'BNDD4 (Sofisticado) sente o efeito maior nos fundamentos, o mesmo padrão da lição 2.8, enquanto o ' +
      'Tesouro Selic passa a render mais, acompanhando a taxa que agora subiu (lição 1.2).' +
      '\n\n' +
      'É por isso que um portfólio dividido entre renda fixa e ações de perfis diferentes (lição 3.1) reage ' +
      'de um jeito que nenhum ativo isolado reproduz sozinho.' +
      '\n\n' +
      'A parte em Tesouro Selic ganha justamente no momento em que a parte mais sofisticada da carteira ' +
      'sofre mais, amortecendo o resultado total.' +
      '\n\n' +
      'Entender isso, e não uma fórmula nova, é a diferença entre reagir a um evento macro no susto e já ' +
      'ter, desde a composição do portfólio (perfil de risco, lição 3.2, e produto certo pro prazo certo, ' +
      'lição 3.3), uma resposta pronta pra ele.' +
      '\n\n' +
      'Você concluiu a trilha guiada. A partir de agora, todo o Mercado (renda fixa e renda variável, ' +
      'sandbox e ao vivo) está disponível sem nenhuma restrição de lição.',
    unlocksDescription:
      'Estratégia completa e testada contra um evento real, trilha guiada concluída, mundo aberto liberado ' +
      'por completo',
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
// bloqueado por ela normalmente. `position` é 1-based e igual a `seed.sortOrder`.
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
      .where(or(isNotNull(userLessonProgress.completedAt), isNotNull(userLessonProgress.waivedAt)))
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
