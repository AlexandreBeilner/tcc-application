import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'
import { swapForCheck } from './swapChecks'
import type { Blocks, Phases } from './swapChecks'

// Migração de conteúdo (LJ.2.7): perguntas de alternativas viraram ordenar, agrupar ou ligar pares no
// seed, mas o seed nunca sobrescreve uma lição já importada (N.23). Para cada troca, o script põe o
// bloco novo do seed no lugar do antigo (por `id`), preservando qualquer outra edição do painel.
// Idempotente: sem o bloco antigo (já trocado ou removido), não faz nada. Mesmo molde de
// `applyEstimateChecks.ts`; a função pura vive em `swapChecks.ts`.
// Uso: DATABASE_URL=... npx tsx src/db/applyGameChecks.ts

export interface GameSwap {
  stableKey: string
  kind: 'order' | 'categorize' | 'match'
  // `id` da pergunta que sai e `id` da pergunta de jogo que entra no lugar dela.
  oldId: string
  newId: string
}

export const GAME_SWAPS: GameSwap[] = [
  { stableKey: '3.2', kind: 'order', oldId: 'mais-risco-mais-retorno', newId: 'ordem-de-risco' },
  { stableKey: '1.5', kind: 'order', oldId: 'ir-90-dias', newId: 'ordem-aliquotas' },
  { stableKey: '2.2', kind: 'order', oldId: 'dinheiro-no-secundario', newId: 'etapas-da-oferta' },
  { stableKey: '2.6.1', kind: 'order', oldId: 'ebit-x-lucro', newId: 'ordem-do-resultado' },
  { stableKey: '1.1', kind: 'categorize', oldId: 'tipo-hibrido', newId: 'tipos-de-regra' },
  { stableKey: '2.8', kind: 'categorize', oldId: 'setor-defensivo', newId: 'ciclico-ou-defensivo' },
  {
    stableKey: 'imposto-renda-variavel',
    kind: 'categorize',
    oldId: 'isencao-so-acoes',
    newId: 'isento-ou-tributado',
  },
  {
    stableKey: 'orcamento-para-onde-vai',
    kind: 'categorize',
    oldId: 'regra-50-30-20',
    newId: 'grupos-50-30-20',
  },
]

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const swap of GAME_SWAPS) {
    const seed = LESSON_SEEDS.find((l) => l.stableKey === swap.stableKey)
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, swap.stableKey))
    if (!row?.blocks || !seed?.blocks) continue
    const { blocks, replaced } = swapForCheck(
      row.blocks as Blocks,
      seed.blocks as { phases?: Phases },
      swap,
    )
    if (replaced === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: "${swap.oldId}" virou ${swap.kind} "${swap.newId}"`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar perguntas de jogo:', err)
    process.exit(1)
  })
}
