import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

type Phase = keyof LessonBlocks['phases']

// Texto legado (colunas `scenarioText` etc.) derivado dos blocos de texto: o
// conteúdo existe uma vez só, e quem lê sem `blocks` (cliente antigo) vê o mesmo.
//
// O texto de um "Saiba mais" (LJ.5.7) entra no lugar em que o bloco está: quem lê sem `blocks` ainda vê o
// detalhe, só que como parágrafo comum.
export function legacyText(blocks: LessonBlocks, phase: Phase): string {
  return blocks.phases[phase]
    .flatMap((block) =>
      block.type === 'text'
        ? [block.markup]
        : block.type === 'more'
          ? block.blocks.flatMap((inner) => (inner.type === 'text' ? [inner.markup] : []))
          : [],
    )
    .join('\n\n')
}
