import { termsInText } from '../parseLessonMarkup'
import { splitIntoCards } from '../splitIntoCards'
import type { CheckBlock, LessonBlock, WidgetBlock } from '../widgets/schema'

// Cartão do player (RC.3.1/RC.3.2): texto (como antes da fase 3), widget ou
// pergunta intermediária. Widget e pergunta são sempre um cartão próprio: evita tela cheia de coisa e mantém o
// Voltar simples. `footnotes` (LJ.1.3) são blocos "Na plataforma" que vinham logo depois dele e que o player
// mostra como rodapé recolhido, em vez de cartão próprio.
export type PlayerCard = { footnotes?: WidgetBlock[] } & (
    { kind: 'text'; text: string; hidden: boolean } | { kind: 'widget'; block: WidgetBlock } | { kind: 'check'; block: CheckBlock }
)

const PLATFORM_NOTE_WIDGET = 'platform-note'

function isPlatformNote(block: LessonBlock): block is WidgetBlock {
    return block.type === 'widget' && block.widget === PLATFORM_NOTE_WIDGET
}

// Fase com `blocks` (e ao menos um bloco) usa os blocos; senão cai no texto
// legado da coluna (`scenarioText`/`microDecisionPrompt`/`revelationText`),
// que renderiza igual a antes de existirem blocos.
export function buildPhaseCards(blocks: LessonBlock[] | undefined, legacyText: string): PlayerCard[] {
    if (!blocks || blocks.length === 0) {
        return splitIntoCards(legacyText).map((card) => ({ kind: 'text', ...card }))
    }

    const cards: PlayerCard[] = []
    for (const block of blocks) {
        const previous = cards[cards.length - 1]
        if (previous && isPlatformNote(block)) {
            cards[cards.length - 1] = { ...previous, footnotes: [...(previous.footnotes ?? []), block] }
        } else if (block.type === 'text') {
            cards.push(...splitIntoCards(block.markup).map((card): PlayerCard => ({ kind: 'text', ...card })))
        } else if (block.type === 'check') {
            cards.push({ kind: 'check', block })
        } else {
            cards.push({ kind: 'widget', block })
        }
    }
    return cards
}

// Termos de glossário já usados em cartões anteriores da lição (na ordem do
// player), por cartão de texto: derivado do conteúdo, sem estado, então Voltar
// e revisão mostram sempre o mesmo cartão do mesmo jeito.
export function termsSeenBeforeEachCard(cards: PlayerCard[]): Map<PlayerCard, Set<string>> {
    const seen = new Set<string>()
    const result = new Map<PlayerCard, Set<string>>()
    for (const card of cards) {
        if (card.kind !== 'text') continue
        result.set(card, new Set(seen))
        termsInText(card.text).forEach((term) => seen.add(term))
    }
    return result
}
