// Lógica pura da migração das enquetes (LJ.2.6). Fica fora de `applyPollBlocks.ts` para o teste importá-la
// sem disparar o `main` dele (que encerra o processo).
import type { Block, Blocks, Phases } from './widgetGoalsMigration'

function sameBlock(a: Block, b: Block): boolean {
  return a.id && b.id ? a.id === b.id : JSON.stringify(a) === JSON.stringify(b)
}

// Para cada enquete do seed que o banco ainda não tem (pelo `id`, em qualquer fase): insere depois do bloco que
// a antecede no seed, ou, se esse bloco sumiu (a lição foi reescrita), na mesma posição, limitada ao tamanho
// da fase. Não apaga nem move mais nada. Idempotente.
export function applyPollBlocks(
  current: Blocks,
  seed: { phases?: Phases },
): { blocks: Blocks; added: number } {
  let added = 0
  const phases: Phases = {}
  for (const [phase, list] of Object.entries(current.phases ?? {}))
    phases[phase] = [...(list ?? [])]
  const existing = new Set(
    Object.values(phases).flatMap((list) =>
      (list ?? []).filter((b) => b.type === 'poll').map((b) => b.id),
    ),
  )

  for (const [phase, seedList] of Object.entries(seed.phases ?? {})) {
    ;(seedList ?? []).forEach((seedBlock, index) => {
      if (seedBlock.type !== 'poll' || !seedBlock.id || existing.has(seedBlock.id)) return
      const target = (phases[phase] ??= [])
      const previous = (seedList ?? [])[index - 1]
      const after = previous ? target.findIndex((b) => sameBlock(b, previous)) : -1
      const position = after >= 0 ? after + 1 : Math.min(index, target.length)
      target.splice(position, 0, seedBlock)
      existing.add(seedBlock.id)
      added += 1
    })
  }
  return { blocks: { ...current, phases }, added }
}
