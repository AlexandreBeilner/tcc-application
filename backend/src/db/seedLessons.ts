import { randomUUID } from 'node:crypto'
import { createDb } from './client'
import { lessons } from './schema'
import type { MicroDecisionType } from '../modules/lessons/domain/lesson'

interface LessonSeed {
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
  revelationText: string
  unlocksDescription: string | null
  unlocksKeys: string[]
  unlocksAssetTicker: string | null
}

// Seed mínimo (tarefa 5.6) — só o bastante pra exercitar a cadeia de
// desbloqueio entre trilhas ponta a ponta (0.5 → 1.1), não o currículo
// completo (33 lições — autoria é semana 7). Conteúdo real da spec seção
// 5.1, não placeholder. `1.2` (Tesouro Selic) é exceção deliberada da
// tarefa 7.0.2: conteúdo pedagógico completo, escrito pra provar o
// pipeline schema→API→tela (scenarioText/microDecisionPrompt/
// revelationText reais + unlocksAssetTicker/"Comprar agora") ponta a
// ponta antes da 7.1.2 autorar 1.3–1.9 em massa — 7.1.2 reescreve/atualiza
// esta linha junto das demais, não é escopo congelado.
const LESSON_SEEDS: LessonSeed[] = [
  {
    code: '0.1',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 1,
    title: 'O que é investir',
    centralConcept: 'Investir vs poupar; capital trabalhando para você',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: 'Acesso ao Portfólio',
    unlocksKeys: ['portfolio'],
    unlocksAssetTicker: null,
  },
  {
    code: '0.2',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 2,
    title: 'Juros simples vs compostos',
    centralConcept: 'Crescimento linear vs exponencial (TCC cap. 2.1.1)',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: 'Calculadora Financeira',
    unlocksKeys: ['calculator'],
    unlocksAssetTicker: null,
  },
  {
    code: '0.3',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 3,
    title: 'Inflação e poder de compra',
    centralConcept: 'Por que R$100 hoje ≠ R$100 amanhã',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '0.4',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 4,
    title: 'Rendimento nominal vs real',
    centralConcept: 'Descontar a inflação do retorno',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '0.5',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 5,
    title: 'Por que a poupança geralmente perde',
    centralConcept: 'Comparação direta poupança vs Selic/CDI',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: 'Acesso à Trilha 1 (Renda Fixa)',
    // Chave vazia de propósito: o acesso à Trilha 1 já funciona via
    // sortOrder (5.6), não é uma chave de unlocksKeys — ver vocabulário
    // fixo da 7.0.1 (só feature/produto, não lição/trilha).
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '1.1',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 6,
    title: 'O que é renda fixa',
    centralConcept: 'Emprestar dinheiro a um emissor',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: 'Tesouro Selic',
    // `asset:tesouro_selic` pertence de fato à lição 1.2 (spec 5.1, ver
    // backlog 7.0.1). 1.1 é só conceitual, unlocksDescription acima é
    // decorativo.
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '1.2',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 7,
    title: 'Tesouro Selic',
    centralConcept: 'Emprestar dinheiro ao governo, com liquidez diária e risco de crédito mínimo',
    scenarioText:
      'Você tem R$1.000 parados e quer emprestar esse dinheiro para o Tesouro Nacional, ' +
      'recebendo de volta o valor corrigido pela taxa Selic todo dia útil. É exatamente isso ' +
      'que o Tesouro Selic (LFT) faz: um título público pós-fixado, o mais líquido e o mais ' +
      'indicado para reserva de emergência.',
    microDecisionPrompt:
      'Antes de ver o preço de hoje, pense: se a Selic sobe, o que acontece com o preço ' +
      'unitário do Tesouro Selic: ele sobe, cai ou fica igual?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'O preço unitário do Tesouro Selic sobe (quase) todo dia útil, acompanhando de perto a ' +
      'taxa Selic, diferente do Tesouro Prefixado/IPCA+, que sofre marcação a mercado negativa ' +
      'com mais frequência. É por isso que a spec do TCC (cap. 3) o trata como o "porto seguro" ' +
      'da renda fixa: baixíssima volatilidade, resgate diário sem perda relevante de valor.',
    unlocksDescription: 'Compra real de Tesouro Selic (LFT2029) no Mercado',
    unlocksKeys: ['asset:tesouro_selic'],
    // Ticker canônico real do catálogo (engine/cmd/seed/main.go, tarefa 3.9)
    // — usado pelo CTA "Comprar agora" do passo Desbloqueio.
    unlocksAssetTicker: 'LFT2029',
  },
]

// Idempotente: DATABASE_URL=... npm run db:seed:lessons
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  for (const seed of LESSON_SEEDS) {
    const [row] = await db
      .insert(lessons)
      .values({ id: randomUUID(), ...seed })
      .onConflictDoNothing({ target: lessons.code })
      .returning()
    console.log(row ? `lição ${seed.code} criada` : `lição ${seed.code} já existia — nada a fazer`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('erro ao rodar seed de lições:', err)
  process.exit(1)
})
