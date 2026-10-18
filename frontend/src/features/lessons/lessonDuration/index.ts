import { plainLessonText } from '../parseLessonMarkup'
import { buildPhaseCards } from '../playerCards'
import type { PlayerCard } from '../playerCards'
import { parseLessonBlocks } from '../widgets/schema'
import type { Lesson } from '../../../services/lessons'

// Tempo estimado da lição (LJ.5.2): leitura a 15 caracteres por segundo, mais um tempo fixo por interação.
// A missão de widget (LJ.3) entra aqui com 45 s quando existir.
export const READING_CHARS_PER_SECOND = 15
export const CHECK_SECONDS = 15
export const WIDGET_SECONDS = 30
export const MIN_MINUTES = 2

// Widgets que são texto de leitura, não ferramenta para mexer: contam pelos caracteres.
const READ_ONLY_WIDGETS = new Set(['callout', 'platform-note'])
// Widgets embutidos da aposta de lição sem `blocks` (mesma lista do player).
const LEGACY_EMBEDDED_WIDGETS = new Set(['growth_calculator', 'fixed_income_comparison'])

function stringPropsLength(props: unknown): number {
    if (typeof props !== 'object' || props === null) return 0
    return Object.values(props).reduce<number>((sum, value) => sum + (typeof value === 'string' ? value.length : 0), 0)
}

// Rodapés "Na plataforma" (LJ.1.3) vêm recolhidos e são leitura opcional: não entram na conta.
export function cardSeconds(card: PlayerCard): number {
    if (card.kind === 'text') return plainLessonText(card.text).length / READING_CHARS_PER_SECOND
    if (card.kind === 'check') return CHECK_SECONDS
    return READ_ONLY_WIDGETS.has(card.block.widget) ? stringPropsLength(card.block.props) / READING_CHARS_PER_SECOND : WIDGET_SECONDS
}

type DurationSource = Pick<
    Lesson,
    'blocks' | 'scenarioText' | 'microDecisionPrompt' | 'revelationText' | 'microDecisionOptions' | 'microDecisionType' | 'currentStep'
>

// Segundos de cada uma das três fases (Cenário, Micro-decisão, Revelação). Lição sem `blocks` usa o texto
// legado; a aposta legada (pergunta com alternativas ou widget embutido) conta como uma interação.
const phaseSecondsCache = new WeakMap<object, number[]>()

function phaseSeconds(lesson: DurationSource): number[] {
    const cached = phaseSecondsCache.get(lesson)
    if (cached) return cached
    const blocks = parseLessonBlocks(lesson.blocks)
    const sum = (cards: PlayerCard[]) => cards.reduce((total, card) => total + cardSeconds(card), 0)
    const microDecisionHasBlocks = (blocks?.phases.microDecision.length ?? 0) > 0
    let legacyBet = 0
    if (!microDecisionHasBlocks) {
        if (LEGACY_EMBEDDED_WIDGETS.has(lesson.microDecisionType)) legacyBet = WIDGET_SECONDS
        else if ((lesson.microDecisionOptions?.length ?? 0) > 0) legacyBet = CHECK_SECONDS
    }
    const result = [
        sum(buildPhaseCards(blocks?.phases.scenario, lesson.scenarioText)),
        sum(buildPhaseCards(blocks?.phases.microDecision, lesson.microDecisionPrompt)) + legacyBet,
        sum(buildPhaseCards(blocks?.phases.revelation, lesson.revelationText)),
    ]
    phaseSecondsCache.set(lesson, result)
    return result
}

export function toMinutes(seconds: number): number {
    return Math.max(MIN_MINUTES, Math.round(seconds / 60))
}

// Minutos da lição inteira (`fromStep` 0) ou do que falta a partir do início de uma fase.
export function lessonMinutes(lesson: DurationSource, fromStep = 0): number {
    return toMinutes(
        phaseSeconds(lesson)
            .slice(Math.max(fromStep, 0))
            .reduce((total, seconds) => total + seconds, 0),
    )
}

// "~4 min" para lição nova; "Faltam ~2 min" para quem já está no meio (`currentStep` > 0).
export function durationLabel(lesson: DurationSource): string {
    return lesson.currentStep > 0 ? `Faltam ~${lessonMinutes(lesson, lesson.currentStep)} min` : `~${lessonMinutes(lesson)} min`
}
