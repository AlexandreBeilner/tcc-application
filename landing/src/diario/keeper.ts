import type { DailyApi } from './api.ts'
import { isRecord } from './dom.ts'
import { hasAnyPlay, isComplete, parseProgress } from './progress.ts'
import type { DailyGame, DailyStats, GameProgress } from './types.ts'

/** Guarda e devolve o estado do jogo. No modo `publico` é o navegador; no modo `app` é o servidor. */
export interface StateKeeper {
    /** `null` = jogo novo (nada salvo, ou salvo em formato que não serve). */
    load(number: number, todayNumber: number): Promise<GameProgress | null>
    save(game: DailyGame, progress: GameProgress): Promise<void>
    stats(todayNumber: number): Promise<DailyStats | null>
    /** Números de jogo já concluídos, para marcar a lista de dias anteriores (opcional). */
    done?(): Promise<number[]>
}

export const STORAGE_KEY = 'selucra.diario.v1'
export const KEEP_GAMES = 60

interface Tally {
    played: number
    correct: number
}
interface LocalStats {
    games: number
    word: Tally
    trivia: Tally
    distribution: Record<string, number>
    failed: number
    streak: { current: number; longest: number; last: number }
}
export interface LocalState {
    v: 1
    games: Record<string, GameProgress>
    stats: LocalStats
}

function freshStats(): LocalStats {
    return {
        games: 0,
        word: { played: 0, correct: 0 },
        trivia: { played: 0, correct: 0 },
        distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 },
        failed: 0,
        streak: { current: 0, longest: 0, last: 0 },
    }
}

const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

function parseTally(v: unknown): Tally | null {
    return isRecord(v) && count(v.played) && count(v.correct) ? { played: v.played, correct: v.correct } : null
}

function parseStats(raw: unknown, todayNumber: number): LocalStats | null {
    if (!isRecord(raw) || !count(raw.games) || !count(raw.failed) || !isRecord(raw.distribution) || !isRecord(raw.streak)) return null
    const word = parseTally(raw.word)
    const trivia = parseTally(raw.trivia)
    // A contagem da Linha do tempo, de quem jogou com três cartões, fica de fora (DI18).
    if (!word || !trivia) return null
    const stats = freshStats()
    for (const k of Object.keys(stats.distribution)) {
        const value = raw.distribution[k]
        if (!count(value)) return null
        stats.distribution[k] = value
    }
    const { current, longest, last } = raw.streak
    if (!count(current) || !count(longest) || !count(last) || last > todayNumber) return null
    return {
        games: raw.games,
        word,
        trivia,
        distribution: stats.distribution,
        failed: raw.failed,
        streak: { current, longest, last },
    }
}

/**
 * Lê o texto salvo. JSON corrompido, versão desconhecida ou estatística inválida descartam tudo (estado novo);
 * um jogo com número maior que o de hoje (relógio ou dado adulterado) ou fora do formato é ignorado sozinho.
 */
export function parseState(text: string | null, todayNumber: number): LocalState {
    const fresh: LocalState = { v: 1, games: {}, stats: freshStats() }
    if (!text) return fresh
    let raw: unknown
    try {
        raw = JSON.parse(text)
    } catch {
        return fresh
    }
    if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.games)) return fresh
    const stats = parseStats(raw.stats, todayNumber)
    if (!stats) return fresh
    const games: Record<string, GameProgress> = {}
    for (const [key, value] of Object.entries(raw.games)) {
        const number = Number(key)
        if (!Number.isInteger(number) || number < 1 || number > todayNumber) continue
        const progress = parseProgress(value, number)
        if (progress) games[key] = progress
    }
    return { v: 1, games, stats }
}

export interface LocalKeeperOptions {
    /** Padrão: `localStorage` (qualquer erro de acesso vira "sem storage"). */
    getStorage?: () => Storage | null
    now?: () => number
}

function defaultStorage(): Storage | null {
    try {
        return globalThis.localStorage ?? null
    } catch {
        return null
    }
}

/** Modo `publico`: o estado fica no navegador (seção 3.4 do backlog). Sem storage, vale só enquanto a página está aberta. */
export function createLocalKeeper({ getStorage = defaultStorage, now = () => Date.now() }: LocalKeeperOptions = {}): StateKeeper {
    let memory: string | null = null
    let todayHint = 0

    function readText(): string | null {
        try {
            const storage = getStorage()
            if (storage) return storage.getItem(STORAGE_KEY)
        } catch {
            // sem acesso: cai na memória
        }
        return memory
    }

    function read(todayNumber: number): LocalState {
        return parseState(readText(), todayNumber)
    }

    function write(state: LocalState): void {
        const keep = Object.keys(state.games)
            .map(Number)
            .sort((a, b) => b - a)
            .slice(0, KEEP_GAMES)
        const games: Record<string, GameProgress> = {}
        for (const n of keep) games[String(n)] = state.games[String(n)]
        const text = JSON.stringify({ ...state, games })
        memory = text
        try {
            getStorage()?.setItem(STORAGE_KEY, text)
        } catch {
            // cheio ou bloqueado: o jogo segue, só não lembra depois
        }
    }

    function tally(t: Tally, correct: boolean): void {
        t.played += 1
        if (correct) t.correct += 1
    }

    return {
        async load(number, todayNumber) {
            todayHint = todayNumber
            const saved = read(todayNumber).games[String(number)]
            return saved && hasAnyPlay(saved) ? saved : null
        },

        async save(game, progress) {
            todayHint = Math.max(todayHint, game.number)
            const state = read(todayHint)
            const key = String(game.number)
            const before = state.games[key]
            const stats = state.stats

            if (progress.word.finished && !before?.word.finished) {
                tally(stats.word, progress.word.solved)
                if (progress.word.solved) {
                    const tries = String(progress.word.guesses.length)
                    stats.distribution[tries] = (stats.distribution[tries] ?? 0) + 1
                } else stats.failed += 1
            }
            if (progress.trivia.answered && !(before?.trivia.answered ?? false)) tally(stats.trivia, progress.trivia.correct)

            const next: GameProgress = { ...progress, finishedAt: before?.finishedAt ?? null, onTime: before?.onTime ?? false }
            if (isComplete(progress) && !(before && isComplete(before))) {
                const at = now()
                next.finishedAt = new Date(at).toISOString()
                next.onTime = game.isToday && at < Date.parse(game.nextGameAt)
                stats.games += 1
                if (next.onTime) {
                    const s = stats.streak
                    s.current = s.last === game.number - 1 ? s.current + 1 : 1
                    s.longest = Math.max(s.longest, s.current)
                    s.last = game.number
                }
            }
            state.games[key] = next
            write(state)
        },

        async stats(todayNumber) {
            const { stats } = read(todayNumber)
            const view = (t: Tally) => ({ ...t, accuracy: t.played ? Math.round((t.correct / t.played) * 100) : 0 })
            // A sequência segue viva enquanto o jogo de hoje ainda não foi concluído, desde que o de ontem tenha sido.
            const alive = stats.streak.last >= todayNumber - 1 && stats.streak.last > 0
            return {
                games: stats.games,
                word: view(stats.word),
                trivia: view(stats.trivia),
                wordAttempts: { distribution: { ...stats.distribution }, failed: stats.failed },
                currentStreak: alive ? stats.streak.current : 0,
                longestStreak: stats.streak.longest,
            }
        },

        async done() {
            const { games } = read(todayHint)
            return Object.values(games)
                .filter(isComplete)
                .map((g) => g.number)
        },
    }
}

/** Modo `app`: a fonte é o servidor (`/me` e `/me/stats`). Gravar é do próprio servidor, a cada resposta. */
export function createServerKeeper(api: DailyApi): StateKeeper {
    return {
        async load(number) {
            const progress = parseProgress(await api.me(number), number)
            return progress && hasAnyPlay(progress) ? progress : null
        },
        async save() {},
        stats: () => api.stats(),
    }
}
