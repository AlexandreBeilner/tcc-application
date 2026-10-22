import { JSDOM } from 'jsdom'
import { DailyApiError } from '../../src/diario/api.ts'
import type { DailyApi } from '../../src/diario/api.ts'
import type { DailyGame, DailyStats, GuessResponse, LetterState, TriviaResponse } from '../../src/diario/types.ts'

export const ANSWER = 'ACOES'
export const ACCEPTED = new Set(['ACOES', 'CARRO', 'AASSA', 'LUCRO', 'JUROS', 'CASAS'])

export function makeGame(number = 47, over: Partial<DailyGame> = {}): DailyGame {
    const day = 17 + (number - 47)
    return {
        number,
        date: `2026-12-${String(day).padStart(2, '0')}`,
        isToday: true,
        nextGameAt: `2026-12-${String(day + 1).padStart(2, '0')}T00:00:00.000Z`,
        cards: {
            word: { length: 5, maxAttempts: 6 },
            trivia: { question: 'Qual índice é a referência da meta de inflação?', options: ['Selic', 'IPCA', 'IGP-M', 'CDI'] },
        },
        ...over,
    }
}

/** A regra do Termo mora no servidor; este fake só a imita para os testes (letra repetida consome uma ocorrência). */
export function score(guess: string, answer: string): LetterState[] {
    const out: LetterState[] = guess.split('').map(() => 'absent')
    const left = answer.split('')
    guess.split('').forEach((ch, i) => {
        if (answer[i] === ch) {
            out[i] = 'correct'
            left[i] = ''
        }
    })
    guess.split('').forEach((ch, i) => {
        if (out[i] === 'correct') return
        const at = left.indexOf(ch)
        if (at >= 0) {
            out[i] = 'present'
            left[at] = ''
        }
    })
    return out
}

export interface FakeApi extends DailyApi {
    calls: { guess: { guess: string; attempt?: number }[]; trivia: number[]; me: number[]; game: number[] }
    today: () => Promise<{ status: 'live'; game: DailyGame }>
    setToday(game: DailyGame): void
}

/** `logged` imita o servidor com login: guarda o estado e responde `/me`. */
export function makeApi(initial: DailyGame, { logged = false } = {}): FakeApi {
    let current = initial
    const calls: FakeApi['calls'] = { guess: [], trivia: [], me: [], game: [] }
    const saved = {
        guesses: [] as { guess: string; letters: LetterState[] }[],
        finished: false,
        solved: false,
        trivia: null as null | (TriviaResponse & { choice: number }),
    }
    const api: FakeApi = {
        calls,
        setToday: (g) => (current = g),
        today: async () => ({ status: 'live', game: current }),
        game: async (n) => {
            calls.game.push(n)
            if (n > current.number) throw new DailyApiError(404, 'not_found', { error: 'not_found' }, null)
            return makeGame(n, { isToday: n === current.number })
        },
        guess: async (_n, guess, attempt): Promise<GuessResponse> => {
            calls.guess.push({ guess, attempt })
            if (logged && saved.finished) throw new DailyApiError(409, 'already_answered', null, null)
            const word = guess.toUpperCase()
            if (!/^[A-Z]{5}$/.test(word))
                throw new DailyApiError(422, 'invalid_guess', { error: 'invalid_guess', reason: 'wrong_length' }, null)
            if (!ACCEPTED.has(word)) throw new DailyApiError(422, 'word_not_accepted', { error: 'word_not_accepted' }, null)
            const letters = score(word, ANSWER)
            const solved = word === ANSWER
            const n = logged ? saved.guesses.length + 1 : (attempt as number)
            const finished = solved || n >= 6
            if (logged) {
                saved.guesses.push({ guess: word, letters })
                saved.finished = finished
                saved.solved = solved
            }
            return {
                letters,
                solved,
                attempt: n,
                finished,
                ...(finished ? { reveal: { answer: 'AÇÕES', definition: 'Parte do capital de uma empresa.', learnMore: null } } : {}),
            }
        },
        trivia: async (_n, choice) => {
            calls.trivia.push(choice)
            if (logged && saved.trivia) throw new DailyApiError(409, 'already_answered', null, null)
            const res: TriviaResponse = {
                correct: choice === 1,
                correctIndex: 1,
                explanation: 'A meta é medida pelo IPCA.',
                sourceRef: 'Banco Central',
                learnMore: null,
            }
            if (logged) saved.trivia = { ...res, choice }
            return res
        },
        me: async (n) => {
            calls.me.push(n)
            return {
                number: n,
                completed: saved.finished && !!saved.trivia,
                word: {
                    guesses: saved.guesses,
                    finished: saved.finished,
                    solved: saved.solved,
                    ...(saved.finished ? { reveal: { answer: 'AÇÕES', definition: 'Parte do capital.', learnMore: null } } : {}),
                },
                trivia: saved.trivia ? { answered: true, ...saved.trivia } : { answered: false },
            }
        },
        stats: async (): Promise<DailyStats> => ({
            games: 3,
            word: { played: 3, correct: 2, accuracy: 67 },
            trivia: { played: 3, correct: 3, accuracy: 100 },
            wordAttempts: { distribution: { '1': 0, '2': 1, '3': 1, '4': 0, '5': 0, '6': 0 }, failed: 1 },
            currentStreak: 2,
            longestStreak: 3,
        }),
    }
    return api
}

export function memoryStorage(initial: Record<string, string> = {}): Storage {
    const map = new Map(Object.entries(initial))
    return {
        get length() {
            return map.size
        },
        clear: () => map.clear(),
        getItem: (k) => map.get(k) ?? null,
        key: (i) => [...map.keys()][i] ?? null,
        removeItem: (k) => void map.delete(k),
        setItem: (k, v) => void map.set(k, String(v)),
    }
}

export function makeDom() {
    const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { pretendToBeVisual: true })
    const { window } = dom
    const root = window.document.getElementById('root') as HTMLElement
    const flush = async () => {
        for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0))
    }
    const key = (k: string) =>
        window.document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
    const type = (word: string) => [...word].forEach(key)
    const $ = (sel: string) => root.querySelector<HTMLElement>(sel)
    const $$ = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel))
    const click = (node: Element | null) => (node as HTMLElement).dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    const rowStates = (r: number) => Array.from($$('.dg-row')[r].children).map((t) => (t as HTMLElement).dataset.state)
    const rowText = (r: number) =>
        Array.from($$('.dg-row')[r].children)
            .map((t) => t.textContent)
            .join('')
    const button = (text: string) => $$('button').find((b) => b.textContent?.includes(text)) ?? null
    return { window, root, flush, key, type, $, $$, click, rowStates, rowText, button }
}
