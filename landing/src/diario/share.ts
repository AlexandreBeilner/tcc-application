import type { DailyGame, GameProgress, LetterState } from './types.ts'

const SQUARE: Record<LetterState, string> = { correct: '🟩', present: '🟨', absent: '⬜' }
export const DEFAULT_SHARE_URL = 'selucra.com.br/diario'

/** Cartão compartilhável: só número do jogo, cores dos palpites e acerto por cartão. Nunca a resposta, nunca valor em R$. */
export function buildShareText(game: DailyGame, progress: GameProgress, url = DEFAULT_SHARE_URL): string {
    const lines = [`Diário Selucra #${game.number}`]
    for (const g of progress.word.guesses) lines.push(g.letters.map((l) => SQUARE[l]).join(''))
    lines.push(progress.word.solved ? `palavra em ${progress.word.guesses.length}` : 'palavra não resolvida')
    const mark = (ok: boolean) => (ok ? '✅' : '❌')
    lines.push(`❓ ${mark(progress.trivia.answered && progress.trivia.correct)}`)
    lines.push(url)
    return lines.join('\n')
}
