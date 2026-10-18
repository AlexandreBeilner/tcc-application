import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'
import { swapForCheck } from './swapChecks'
import type { Blocks, Phases } from './swapChecks'

// Migração de conteúdo única (LJ.2.7): quatro perguntas de alternativas viraram estimativa
// (`kind: 'estimate'`) no seed, mas o seed nunca sobrescreve uma lição já importada (N.23), então
// o banco ainda guarda a versão antiga. Para cada lição listada, troca só o bloco antigo, na
// mesma posição, pelo bloco novo do seed, preservando qualquer outra edição feita pelo painel.
// Idempotente: se o bloco antigo não está mais lá (já trocado, ou removido pelo painel), não faz nada.
// Uso: DATABASE_URL=... npx tsx src/db/applyEstimateChecks.ts

export interface EstimateSwap {
  stableKey: string
  // `id` da pergunta de alternativas que sai e `id` da estimativa que entra no lugar dela.
  oldId: string
  newId: string
}

export const ESTIMATE_SWAPS: EstimateSwap[] = [
  { stableKey: '0.2', oldId: 'simples-3-anos', newId: 'chute-20-anos' },
  { stableKey: '0.3', oldId: 'inflacao-8', newId: 'chute-preco-10-anos' },
  {
    stableKey: 'divida-os-juros-do-outro-lado',
    oldId: 'dois-meses',
    newId: 'chute-divida-12-meses',
  },
  { stableKey: 'custos-de-investir', oldId: 'retorno-liquido', newId: 'chute-taxa-30-anos' },
]

export function swapForEstimate(
  current: Blocks,
  seed: { phases?: Phases },
  swap: Pick<EstimateSwap, 'oldId' | 'newId'>,
): { blocks: Blocks; replaced: number } {
  return swapForCheck(current, seed, { ...swap, kind: 'estimate' })
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const swap of ESTIMATE_SWAPS) {
    const seed = LESSON_SEEDS.find((l) => l.stableKey === swap.stableKey)
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, swap.stableKey))
    if (!row?.blocks || !seed?.blocks) continue
    const { blocks, replaced } = swapForEstimate(
      row.blocks as Blocks,
      seed.blocks as { phases?: Phases },
      swap,
    )
    if (replaced === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: "${swap.oldId}" virou estimativa "${swap.newId}"`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar estimativas:', err)
    process.exit(1)
  })
}
