import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

type Phase = keyof LessonBlocks['phases']

// Texto legado (colunas `scenarioText` etc.) derivado dos blocos de texto: o
// conteúdo existe uma vez só, e quem lê sem `blocks` (cliente antigo) vê o mesmo.
export function legacyText(blocks: LessonBlocks, phase: Phase): string {
  return blocks.phases[phase]
    .flatMap((block) => (block.type === 'text' ? [block.markup] : []))
    .join('\n\n')
}
