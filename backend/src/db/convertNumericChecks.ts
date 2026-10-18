import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'

// Migração de conteúdo única: as perguntas `numeric` (campo de texto) viraram `single`
// (alternativas) no seed, mas o seed nunca sobrescreve uma lição já importada, então o banco
// ainda guarda a versão antiga. Para cada lição com pergunta `numeric`, troca só esse bloco pelo
// bloco de mesmo `id` do seed, preservando qualquer outra edição feita pelo painel.
// Uso: DATABASE_URL=... npx tsx src/db/convertNumericChecks.ts

type Block = { type?: string; kind?: string; id?: string }
type Phases = Record<string, Block[] | undefined>

export function replaceNumericChecks(
  current: { phases?: Phases } & Record<string, unknown>,
  seed: { phases?: Phases },
): { blocks: typeof current; replaced: number } {
  let replaced = 0
  const phases: Phases = {}
  for (const [phase, list] of Object.entries(current.phases ?? {})) {
    phases[phase] = (list ?? []).map((block) => {
      if (block.type !== 'check' || block.kind !== 'numeric') return block
      const fromSeed = Object.values(seed.phases ?? {})
        .flatMap((l) => l ?? [])
        .find((b) => b.type === 'check' && b.id === block.id && b.kind !== 'numeric')
      if (!fromSeed) return block
      replaced += 1
      return fromSeed
    })
  }
  return { blocks: { ...current, phases }, replaced }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const seed of LESSON_SEEDS) {
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, seed.stableKey))
    if (!row?.blocks || !seed.blocks) continue
    const { blocks, replaced } = replaceNumericChecks(
      row.blocks as Parameters<typeof replaceNumericChecks>[0],
      seed.blocks as Parameters<typeof replaceNumericChecks>[1],
    )
    if (replaced === 0) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: ${replaced} pergunta(s) convertida(s)`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao converter perguntas:', err)
    process.exit(1)
  })
}
