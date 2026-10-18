// Lógica pura da migração de missões de widget (LJ.3.2). Fica fora de `applyWidgetGoals.ts` para outro script
// poder importá-la sem disparar o `main` dele (que encerra o processo).
// Quem escreve em banco é `applyWidgetGoals.ts` e `applyProblemFirst.ts`.

export type Block = { type?: string; id?: string; props?: unknown; goal?: unknown } & Record<
  string,
  unknown
>
export type Phases = Record<string, Block[] | undefined>
export type Blocks = { phases?: Phases } & Record<string, unknown>

function sameBlock(a: Block, b: Block): boolean {
  return a.id && b.id ? a.id === b.id : JSON.stringify(a) === JSON.stringify(b)
}

export function applyWidgetGoals(
  current: Blocks,
  seed: { phases?: Phases },
): { blocks: Blocks; changed: number } {
  let changed = 0
  const phases: Phases = {}
  for (const [phase, list] of Object.entries(current.phases ?? {}))
    phases[phase] = [...(list ?? [])]

  for (const [phase, seedList] of Object.entries(seed.phases ?? {})) {
    ;(seedList ?? []).forEach((seedBlock, index) => {
      if (seedBlock.type !== 'widget' || !seedBlock.goal || !seedBlock.id) return
      const target = (phases[phase] ??= [])
      const at = target.findIndex((b) => b.type === 'widget' && b.id === seedBlock.id)
      if (at >= 0) {
        if (target[at].goal) return
        target[at] = {
          ...target[at],
          props: { ...(target[at].props as object), ...(seedBlock.props as object) },
          // A legenda acompanha a missão quando o seed a reescreveu (ela descrevia os controles de antes).
          ...(seedBlock.caption === undefined ? {} : { caption: seedBlock.caption }),
          goal: seedBlock.goal,
        }
        changed += 1
        return
      }
      // Ainda não existe no banco: entra depois do bloco que vinha antes dele no seed (texto não tem `id`, então
      // casa pelo conteúdo). Se esse bloco foi removido ou editado pelo painel, entra no fim da fase.
      const previous = (seedList ?? [])[index - 1]
      const after = previous ? target.findIndex((b) => sameBlock(b, previous)) : -1
      target.splice(after >= 0 ? after + 1 : previous ? target.length : 0, 0, seedBlock)
      changed += 1
    })
  }
  return { blocks: { ...current, phases }, changed }
}
