import { splitIntoCards } from '../splitIntoCards'
import type { LessonBlock, WidgetBlock } from '../widgets/schema'

// Cartão do player (RC.3.1): texto (como antes da fase 3) ou widget. Um
// widget é sempre um cartão próprio: evita tela cheia de coisa e mantém o
// Voltar simples.
export type PlayerCard = { kind: 'text'; text: string; hidden: boolean } | { kind: 'widget'; block: WidgetBlock }

// Fase com `blocks` (e ao menos um bloco) usa os blocos; senão cai no texto
// legado da coluna (`scenarioText`/`microDecisionPrompt`/`revelationText`),
// que renderiza igual a antes de existirem blocos.
export function buildPhaseCards(blocks: LessonBlock[] | undefined, legacyText: string): PlayerCard[] {
    if (!blocks || blocks.length === 0) {
        return splitIntoCards(legacyText).map((card) => ({ kind: 'text', ...card }))
    }

    return blocks.flatMap((block): PlayerCard[] =>
        block.type === 'text' ? splitIntoCards(block.markup).map((card) => ({ kind: 'text', ...card })) : [{ kind: 'widget', block }],
    )
}
