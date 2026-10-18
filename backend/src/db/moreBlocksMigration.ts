// Lógica pura da migração dos "Saiba mais" (LJ.5.7). Fica fora de `applyMoreBlocks.ts` para o teste
// importá-la sem disparar o `main` dele (que encerra o processo).
import type { Block, Blocks, Phases } from './widgetGoalsMigration'

type Inner = Block & { markup?: string }

function sameInner(a: Block, b: Block): boolean {
  return a.type === 'widget' && b.type === 'widget'
    ? a.id === b.id
    : a.type === 'text' && b.type === 'text' && (a as Inner).markup === (b as Inner).markup
}

function sameBlock(a: Block, b: Block): boolean {
  return a.id && b.id ? a.id === b.id : JSON.stringify(a) === JSON.stringify(b)
}

// Para cada `more` do seed que o banco ainda não tem (pelo `id`): tira do banco os blocos de texto e de
// widget que o `more` agora guarda (texto casa pelo conteúdo, widget pelo `id`) e põe o `more` depois do
// bloco que o antecede no seed. Só move o que encontrar: se nada casar (a lição foi reescrita), não
// insere, para não duplicar conteúdo. Idempotente, e preserva todo o resto da lição.
export function applyMoreBlocks(
  current: Blocks,
  seed: { phases?: Phases },
): { blocks: Blocks; moved: number } {
  let moved = 0
  const phases: Phases = {}
  for (const [phase, list] of Object.entries(current.phases ?? {}))
    phases[phase] = [...(list ?? [])]

  for (const [phase, seedList] of Object.entries(seed.phases ?? {})) {
    ;(seedList ?? []).forEach((seedBlock, index) => {
      if (seedBlock.type !== 'more' || !seedBlock.id) return
      const target = (phases[phase] ??= [])
      if (target.some((b) => b.type === 'more' && b.id === seedBlock.id)) return

      const inner = (seedBlock.blocks ?? []) as Block[]
      let firstRemoved = -1
      let removed = 0
      for (const piece of inner) {
        const at = target.findIndex((b) => b.type !== 'more' && sameInner(b, piece))
        if (at < 0) continue
        if (firstRemoved < 0 || at < firstRemoved) firstRemoved = at
        target.splice(at, 1)
        removed += 1
      }
      if (removed === 0) return

      const previous = (seedList ?? [])[index - 1]
      const after = previous ? target.findIndex((b) => sameBlock(b, previous)) : -1
      const position = after >= 0 ? after + 1 : Math.min(firstRemoved, target.length)
      target.splice(Math.max(position, 1), 0, seedBlock)
      moved += removed
    })
  }
  return { blocks: { ...current, phases }, moved }
}
