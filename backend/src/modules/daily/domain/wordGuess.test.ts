import { describe, expect, it } from 'vitest'
import { evaluateGuess, isWordCardCorrect, normalizeWord, wordProgress } from './wordGuess'

const C = 'correct'
const P = 'present'
const A = 'absent'

describe('normalizeWord', () => {
  it.each([
    ['AÇÕES', 'ACOES'],
    ['ações', 'ACOES'],
    ['Liquidez', 'LIQUIDEZ'],
    ['crédito', 'CREDITO'],
  ])('%s => %s', (input, expected) => {
    expect(normalizeWord(input)).toBe(expected)
  })
})

describe('evaluateGuess', () => {
  // colunas: descrição, resposta, palpite, cores esperadas
  it.each([
    ['acerto total', 'JUROS', 'JUROS', [C, C, C, C, C]],
    ['nenhuma letra em comum', 'JUROS', 'PLANT', [A, A, A, A, A]],
    ['amarelo: letra em outra posição', 'JUROS', 'SUJOS', [A, C, P, C, C]],
    [
      'letra repetida no palpite, uma na resposta (verde fica com ela)',
      'BARCO',
      'RARAS',
      [A, C, C, A, A],
    ],
    [
      'letra repetida no palpite, uma na resposta (só um amarelo)',
      'PRATO',
      'ROROS',
      [P, P, A, A, A],
    ],
    ['três na tentativa, duas na resposta', 'CASAL', 'AAAEE', [P, C, A, A, A]],
    ['verde consome antes do amarelo', 'AAXXX', 'ABABA', [C, A, P, A, A]],
    ['acento e cedilha ignorados', 'AÇÃO', 'acao', [C, C, C, C]],
    ['palavra de 4 letras', 'IPCA', 'IPCA', [C, C, C, C]],
    ['palavra de 9 letras', 'LIQUIDEZA', 'liquidoza', [C, C, C, C, C, C, A, C, C]],
  ])('%s', (_label, answer, guess, expected) => {
    const result = evaluateGuess(guess, answer)
    expect(result).toMatchObject({ ok: true, letters: expected })
  })

  it('marca solved só quando a palavra inteira bate (com acento diferente)', () => {
    expect(evaluateGuess('acoes', 'AÇÕES')).toMatchObject({ ok: true, solved: true })
    expect(evaluateGuess('juros', 'JUROS')).toMatchObject({ ok: true, solved: true })
    expect(evaluateGuess('juras', 'JUROS')).toMatchObject({ ok: true, solved: false })
  })

  it('amarelos de uma letra nunca passam de suas ocorrências na resposta', () => {
    const answer = 'SELIC'
    for (const guess of ['EEEEE', 'ESSES', 'CELSE', 'LECES']) {
      const r = evaluateGuess(guess, answer)
      if (!r.ok) throw new Error('inválido')
      for (const letter of new Set(guess)) {
        const marked = [...guess].filter((ch, i) => ch === letter && r.letters[i] !== A).length
        expect(marked).toBeLessThanOrEqual([...answer].filter((ch) => ch === letter).length)
      }
    }
  })

  it.each([
    ['curto demais', 'ABC', 'AMOR', 'invalid_length'],
    ['longo demais', 'ABCDEFGHIJ', 'AMOR', 'invalid_length'],
    ['tamanho diferente da resposta', 'JUROS', 'AMOR', 'wrong_length'],
    ['hífen', 'AB-CD', 'ABCDE', 'invalid_characters'],
    ['número', 'AB1CD', 'ABCDE', 'invalid_characters'],
    ['espaço', 'AB CD', 'ABCDE', 'invalid_characters'],
  ])('recusa: %s', (_label, guess, answer, reason) => {
    expect(evaluateGuess(guess, answer)).toEqual({ ok: false, reason })
  })
})

describe('wordProgress e isWordCardCorrect', () => {
  it.each([
    [0, false, 'playing', false],
    [5, false, 'playing', false],
    [6, false, 'lost', false],
    [1, true, 'won', true],
    [6, true, 'won', true],
    [7, true, 'won', false],
  ])('tentativas %s, resolvido %s', (attempts, solved, progress, correct) => {
    expect(wordProgress(attempts, solved)).toBe(progress)
    expect(isWordCardCorrect(attempts, solved)).toBe(correct)
  })
})
