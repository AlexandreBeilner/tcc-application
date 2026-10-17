import { isRecord } from './dom.ts'
import type {
    DailyGame,
    GameProgress,
    GuessResponse,
    LearnMore,
    LetterState,
    TimelineEventReveal,
    TimelineProgress,
    TimelineResponse,
    TriviaProgress,
    TriviaResponse,
    WordProgress,
} from './types.ts'

// Estado de um jogo na tela. Funções puras: só juntam o que o servidor devolveu, nunca avaliam nada.

export function emptyProgress(game: DailyGame): GameProgress {
    return {
        number: game.number,
        word: { guesses: [], finished: false, solved: false, reveal: null },
        trivia: { answered: false },
        timeline: { answered: false },
        finishedAt: null,
        onTime: false,
    }
}

export function isComplete(p: GameProgress): boolean {
    return p.word.finished && p.trivia.answered && p.timeline.answered
}

export function correctCards(p: GameProgress): number {
    return (p.word.solved ? 1 : 0) + (p.trivia.answered && p.trivia.correct ? 1 : 0) + (p.timeline.answered && p.timeline.correct ? 1 : 0)
}

export function applyGuess(p: GameProgress, guess: string, res: GuessResponse): GameProgress {
    const word: WordProgress = {
        guesses: [...p.word.guesses, { guess, letters: res.letters }],
        finished: res.finished,
        solved: res.solved,
        reveal: res.reveal ?? p.word.reveal,
    }
    return { ...p, word }
}

export function applyTrivia(p: GameProgress, choice: number, res: TriviaResponse): GameProgress {
    return {
        ...p,
        trivia: {
            answered: true,
            choice,
            correct: res.correct,
            correctIndex: res.correctIndex,
            explanation: res.explanation,
            sourceRef: res.sourceRef,
            learnMore: res.learnMore ?? null,
        },
    }
}

export function applyTimeline(p: GameProgress, order: string[], res: TimelineResponse): GameProgress {
    return { ...p, timeline: { answered: true, order, correct: res.correct, positionHits: res.positionHits, events: res.events } }
}

// ---- leitura defensiva (localStorage e GET /daily/:n/me): o que não bate com o formato é descartado, nunca quebra ----

const LETTER_STATES = new Set(['correct', 'present', 'absent'])
const str = (v: unknown): v is string => typeof v === 'string'
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseLearnMore(raw: unknown): LearnMore {
    if (!isRecord(raw)) return null
    if ((raw.kind === 'lesson' || raw.kind === 'glossary' || raw.kind === 'guide') && str(raw.ref)) return { kind: raw.kind, ref: raw.ref }
    return null
}

function parseWord(raw: unknown): WordProgress | null {
    if (!isRecord(raw) || !Array.isArray(raw.guesses) || typeof raw.finished !== 'boolean') return null
    const guesses: WordProgress['guesses'] = []
    for (const g of raw.guesses) {
        if (!isRecord(g) || !str(g.guess) || !Array.isArray(g.letters) || !g.letters.every((l) => LETTER_STATES.has(l as string)))
            return null
        guesses.push({ guess: g.guess, letters: g.letters as LetterState[] })
    }
    let reveal: WordProgress['reveal'] = null
    if (isRecord(raw.reveal) && str(raw.reveal.answer)) {
        reveal = {
            answer: raw.reveal.answer,
            definition: str(raw.reveal.definition) ? raw.reveal.definition : '',
            learnMore: parseLearnMore(raw.reveal.learnMore),
        }
    }
    return { guesses, finished: raw.finished, solved: raw.solved === true, reveal }
}

function parseTrivia(raw: unknown): TriviaProgress | null {
    if (!isRecord(raw) || typeof raw.answered !== 'boolean') return null
    if (!raw.answered) return { answered: false }
    if (!num(raw.choice) || typeof raw.correct !== 'boolean' || !num(raw.correctIndex)) return null
    return {
        answered: true,
        choice: raw.choice,
        correct: raw.correct,
        correctIndex: raw.correctIndex,
        explanation: str(raw.explanation) ? raw.explanation : '',
        sourceRef: str(raw.sourceRef) ? raw.sourceRef : '',
        learnMore: parseLearnMore(raw.learnMore),
    }
}

function parseEvent(raw: unknown): TimelineEventReveal | null {
    if (!isRecord(raw) || !str(raw.id) || !str(raw.label) || !num(raw.year)) return null
    return {
        id: raw.id,
        label: raw.label,
        year: raw.year,
        explanation: str(raw.explanation) ? raw.explanation : '',
        sourceRef: str(raw.sourceRef) ? raw.sourceRef : '',
        learnMore: parseLearnMore(raw.learnMore),
    }
}

function parseTimeline(raw: unknown): TimelineProgress | null {
    if (!isRecord(raw) || typeof raw.answered !== 'boolean') return null
    if (!raw.answered) return { answered: false }
    if (typeof raw.correct !== 'boolean' || !Array.isArray(raw.order) || !raw.order.every(str)) return null
    if (!Array.isArray(raw.positionHits) || !raw.positionHits.every((h) => typeof h === 'boolean')) return null
    if (!Array.isArray(raw.events)) return null
    const events = raw.events.map(parseEvent)
    if (events.some((e) => e === null)) return null
    return {
        answered: true,
        order: raw.order as string[],
        correct: raw.correct,
        positionHits: raw.positionHits as boolean[],
        events: events as TimelineEventReveal[],
    }
}

/** `null` quando o formato não bate ou o número não é o esperado (o chamador começa um jogo novo). */
export function parseProgress(raw: unknown, expectedNumber: number): GameProgress | null {
    if (!isRecord(raw) || raw.number !== expectedNumber) return null
    const word = parseWord(raw.word)
    const trivia = parseTrivia(raw.trivia)
    const timeline = parseTimeline(raw.timeline)
    if (!word || !trivia || !timeline) return null
    return {
        number: expectedNumber,
        word,
        trivia,
        timeline,
        finishedAt: str(raw.finishedAt) ? raw.finishedAt : null,
        onTime: raw.onTime === true,
    }
}

/** `/me` de um jogo sem nenhuma jogada vem tudo como não respondido: tratar como jogo novo. */
export function hasAnyPlay(p: GameProgress): boolean {
    return p.word.guesses.length > 0 || p.trivia.answered || p.timeline.answered
}
