import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'

// Ajustes de conteúdo decididos pelo autor em 2026-10-18 (depois da LJ.2.5), aplicados no banco por
// serem edições em lição já importada (o seed nunca sobrescreve, N.23):
//  - 2.11: o chute da taxa de 2% em 30 anos passa para antes do widget `fee-drag` (preserva a surpresa);
//  - 0.4: o texto da missão deixa de usar "rendimento real" antes de o termo ser definido.
// Idempotente: se o bloco já está na ordem nova, ou o texto já é o novo, não faz nada.
// Uso: DATABASE_URL=... npx tsx src/db/applyAuthorDecisions.ts

type Block = { type?: string; id?: string; goal?: { text?: string } } & Record<string, unknown>
type Blocks = { phases?: Record<string, Block[] | undefined> } & Record<string, unknown>

// Põe o bloco `id` imediatamente antes do bloco `beforeId`, se ele estiver depois, na mesma fase.
export function moveBefore(
  blocks: Blocks,
  id: string,
  beforeId: string,
): { blocks: Blocks; changed: boolean } {
  let changed = false
  const phases: Record<string, Block[] | undefined> = {}
  for (const [phase, list] of Object.entries(blocks.phases ?? {})) {
    const items = [...(list ?? [])]
    const from = items.findIndex((b) => b.id === id)
    const target = items.findIndex((b) => b.id === beforeId)
    if (from > target && target >= 0) {
      const [moved] = items.splice(from, 1)
      items.splice(target, 0, moved as Block)
      changed = true
    }
    phases[phase] = items
  }
  return { blocks: { ...blocks, phases }, changed }
}

// Troca o texto da missão do widget `id`, só se ainda for exatamente `from`.
export function replaceGoalText(
  blocks: Blocks,
  id: string,
  from: string,
  to: string,
): { blocks: Blocks; changed: boolean } {
  let changed = false
  const phases: Record<string, Block[] | undefined> = {}
  for (const [phase, list] of Object.entries(blocks.phases ?? {})) {
    phases[phase] = (list ?? []).map((b) => {
      if (b.id !== id || b.goal?.text !== from) return b
      changed = true
      return { ...b, goal: { ...b.goal, text: to } }
    })
  }
  return { blocks: { ...blocks, phases }, changed }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  const edits: [string, (b: Blocks) => { blocks: Blocks; changed: boolean }][] = [
    ['custos-de-investir', (b) => moveBefore(b, 'chute-taxa-30-anos', 'efeito-da-taxa')],
    [
      '0.4',
      (b) =>
        replaceGoalText(
          b,
          'rendimento-real',
          'Deixe o rendimento real negativo',
          'Aumente a Inflação até ela passar o Rendimento nominal',
        ),
    ],
  ]
  for (const [stableKey, edit] of edits) {
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, stableKey))
    if (!row?.blocks) continue
    const { blocks, changed } = edit(row.blocks as Blocks)
    if (!changed) continue
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${stableKey}: ajuste aplicado`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar ajustes:', err)
    process.exit(1)
  })
}
