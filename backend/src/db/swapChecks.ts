// Troca de pergunta por `id` dentro do `blocks` de uma lição (LJ.2.7). Função pura, sem efeito colateral
// ao importar: os scripts `applyEstimateChecks.ts` e `applyGameChecks.ts` rodam um `main()` quando
// executados, então a lógica compartilhada fica aqui.

export type Block = { type?: string; kind?: string; id?: string }
export type Phases = Record<string, Block[] | undefined>
export type Blocks = { phases?: Phases } & Record<string, unknown>

// Troca a pergunta `oldId` pela `newId` do seed, do formato `kind` (estimativa, ordenar, agrupar, ligar).
export function swapForCheck(
  current: Blocks,
  seed: { phases?: Phases },
  { oldId, newId, kind }: { oldId: string; newId: string; kind: string },
): { blocks: Blocks; replaced: number } {
  const replacement = Object.values(seed.phases ?? {})
    .flatMap((list) => list ?? [])
    .find((b) => b.type === 'check' && b.id === newId && b.kind === kind)
  let replaced = 0
  const phases: Phases = {}
  for (const [phase, list] of Object.entries(current.phases ?? {})) {
    phases[phase] = (list ?? []).map((block) => {
      if (!replacement || replaced > 0 || block.type !== 'check' || block.id !== oldId) return block
      replaced += 1
      return replacement
    })
  }
  return { blocks: { ...current, phases }, replaced }
}
