import { isRecord } from './dom.ts'
import type {
    DailyGame,
    GameProgress,
    GuessResponse,
    LearnMore,
    LetterState,
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
        finishedAt: null,
        onTime: false,
    }
}

/** Ninguém jogou nada neste jogo ainda (nem um palpite). */
export function isUntouched(p: GameProgress): boolean {
    return p.word.guesses.length === 0 && !p.word.finished && !p.trivia.answered
}

export function isComplete(p: GameProgress): boolean {
    return p.word.finished && p.trivia.answered
}

export function correctCards(p: GameProgress): number {
    return (p.word.solved ? 1 : 0) + (p.trivia.answered && p.trivia.correct ? 1 : 0)
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

/**
 * `null` quando o formato não bate ou o número não é o esperado (o chamador começa um jogo novo). Jogo salvo na versão
 * de três cartões traz também a Linha do tempo, que saiu (DI18): ela é ignorada e o jogo vale com os dois cartões.
 */
export function parseProgress(raw: unknown, expectedNumber: number): GameProgress | null {
    if (!isRecord(raw) || raw.number !== expectedNumber) return null
    const word = parseWord(raw.word)
    const trivia = parseTrivia(raw.trivia)
    if (!word || !trivia) return null
    return {
        number: expectedNumber,
        word,
        trivia,
        finishedAt: str(raw.finishedAt) ? raw.finishedAt : null,
        onTime: raw.onTime === true,
    }
}

/** `/me` de um jogo sem nenhuma jogada vem tudo como não respondido: tratar como jogo novo. */
export function hasAnyPlay(p: GameProgress): boolean {
    return p.word.guesses.length > 0 || p.trivia.answered
}
