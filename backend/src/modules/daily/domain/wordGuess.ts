export const MIN_WORD_LENGTH = 4
export const MAX_WORD_LENGTH = 9
export const MAX_WORD_ATTEMPTS = 6

export type LetterState = 'correct' | 'present' | 'absent'

// Comparação sem acento e sem cedilha, em maiúsculas: `AÇÕES` e `acoes` são
// a mesma coisa. É a mesma forma normalizada da lista de palavras aceitas.
export function normalizeWord(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

export type GuessEvaluation =
  | { ok: true; letters: LetterState[]; solved: boolean }
  | { ok: false; reason: 'invalid_characters' | 'invalid_length' | 'wrong_length' }

// Letra repetida como no Termo: primeiro marcam-se os verdes, depois cada
// amarelo consome uma ocorrência ainda não casada da letra na resposta, então
// o total de verdes mais amarelos de uma letra nunca passa do que a resposta tem.
export function evaluateGuess(guess: string, answer: string): GuessEvaluation {
  const g = normalizeWord(guess)
  const a = normalizeWord(answer)
  if (!/^[A-Z]+$/.test(g)) return { ok: false, reason: 'invalid_characters' }
  if (g.length < MIN_WORD_LENGTH || g.length > MAX_WORD_LENGTH)
    return { ok: false, reason: 'invalid_length' }
  if (g.length !== a.length) return { ok: false, reason: 'wrong_length' }

  const letters: LetterState[] = Array.from({ length: g.length }, () => 'absent')
  const remaining = new Map<string, number>()

  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      letters[i] = 'correct'
    } else {
      remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1)
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (letters[i] === 'correct') continue
    const left = remaining.get(g[i]) ?? 0
    if (left > 0) {
      letters[i] = 'present'
      remaining.set(g[i], left - 1)
    }
  }
  return { ok: true, letters, solved: g === a }
}

export type WordProgress = 'playing' | 'won' | 'lost'

export function wordProgress(attempts: number, solved: boolean): WordProgress {
  if (solved) return 'won'
  return attempts >= MAX_WORD_ATTEMPTS ? 'lost' : 'playing'
}

// DI6: no Termo, "acertou" = descobriu a palavra em até 6 tentativas.
export function isWordCardCorrect(attempts: number, solved: boolean): boolean {
  return solved && attempts >= 1 && attempts <= MAX_WORD_ATTEMPTS
}
