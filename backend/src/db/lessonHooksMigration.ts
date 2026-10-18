// Lógica pura da migração dos ganchos de abertura (LJ.5.8). Fica fora de `applyLessonHooks.ts` para o teste
// importá-la sem disparar o `main` dele (que encerra o processo).
import type { Block, Blocks } from './widgetGoalsMigration'
import type { LessonHook } from './lessonHooks'

// Troca, no Cenário, o primeiro parágrafo antigo pelo gancho. Só mexe em texto que casa exatamente com o
// antigo (lição editada ou já migrada passa direto), então é idempotente e preserva o resto da lição.
export function applyLessonHook(
  current: Blocks,
  hook: LessonHook,
): { blocks: Blocks; changed: number } {
  const scenario = current.phases?.scenario ?? []
  let changed = 0
  const next = scenario.map((block: Block) => {
    const markup = block.type === 'text' ? (block.markup as string | undefined) : undefined
    // O gancho novo costuma conter o texto antigo: sem esta guarda, uma segunda execução o aplicaria de novo.
    if (!markup || markup.includes(hook.next) || !markup.includes(hook.old)) return block
    changed += 1
    return { ...block, markup: markup.replace(hook.old, () => hook.next) }
  })
  return { blocks: { ...current, phases: { ...current.phases, scenario: next } }, changed }
}
