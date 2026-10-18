import { termsInText } from '../parseLessonMarkup'
import { splitIntoCards } from '../splitIntoCards'
import type { CheckBlock, LessonBlock, MoreBlock, PollBlock, WidgetBlock } from '../widgets/schema'

// Cartão do player (RC.3.1/RC.3.2): texto (como antes da fase 3), widget ou
// pergunta intermediária. Widget e pergunta são sempre um cartão próprio: evita tela cheia de coisa e mantém o
// Voltar simples. `footnotes` (LJ.1.3) são blocos "Na plataforma" que vinham logo depois dele e que o player
// mostra como rodapé recolhido, em vez de cartão próprio. `more` (LJ.5.7) são os "Saiba mais" colados ao cartão,
// também recolhidos e fora da contagem de cartões.
export type PlayerCard = { footnotes?: WidgetBlock[]; more?: MoreBlock[] } & (
    | { kind: 'text'; text: string; hidden: boolean }
    | { kind: 'widget'; block: WidgetBlock }
    | { kind: 'check'; block: CheckBlock }
    // Enquete (LJ.2.6): cartão próprio, mas sem resposta certa, sem trava e fora do placar.
    | { kind: 'poll'; block: PollBlock }
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
    const pushBlock = (block: LessonBlock) => {
        const previous = cards[cards.length - 1]
        if (previous && isPlatformNote(block)) {
            cards[cards.length - 1] = { ...previous, footnotes: [...(previous.footnotes ?? []), block] }
        } else if (block.type === 'more') {
            if (previous) {
                cards[cards.length - 1] = { ...previous, more: [...(previous.more ?? []), block] }
            } else {
                // Sem cartão a que se colar (o servidor recusa, mas conteúdo antigo ou editado não pode sumir): vira cartões.
                block.blocks.forEach(pushBlock)
            }
        } else if (block.type === 'text') {
            cards.push(...splitIntoCards(block.markup).map((card): PlayerCard => ({ kind: 'text', ...card })))
        } else if (block.type === 'check') {
            cards.push({ kind: 'check', block })
        } else if (block.type === 'poll') {
            cards.push({ kind: 'poll', block })
        } else {
            cards.push({ kind: 'widget', block })
        }
    }
    blocks.forEach(pushBlock)
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
