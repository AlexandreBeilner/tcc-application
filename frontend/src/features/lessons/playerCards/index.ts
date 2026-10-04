import { splitIntoCards } from '../splitIntoCards'
import type { CheckBlock, LessonBlock, WidgetBlock } from '../widgets/schema'

// Cartão do player (RC.3.1/RC.3.2): texto (como antes da fase 3), widget ou
// pergunta intermediária. Widget e pergunta são sempre um cartão próprio: evita tela cheia de coisa e mantém o
// Voltar simples.
export type PlayerCard =
    { kind: 'text'; text: string; hidden: boolean } | { kind: 'widget'; block: WidgetBlock } | { kind: 'check'; block: CheckBlock }

// Fase com `blocks` (e ao menos um bloco) usa os blocos; senão cai no texto
// legado da coluna (`scenarioText`/`microDecisionPrompt`/`revelationText`),
// que renderiza igual a antes de existirem blocos.
export function buildPhaseCards(blocks: LessonBlock[] | undefined, legacyText: string): PlayerCard[] {
    if (!blocks || blocks.length === 0) {
        return splitIntoCards(legacyText).map((card) => ({ kind: 'text', ...card }))
    }

    return blocks.flatMap((block): PlayerCard[] =>
        block.type === 'text'
            ? splitIntoCards(block.markup).map((card) => ({ kind: 'text', ...card }))
            : block.type === 'check'
              ? [{ kind: 'check', block }]
              : [{ kind: 'widget', block }],
    )
}
