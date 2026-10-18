import { describe, expect, it } from 'vitest'
import { collectAcceptedForms, toAcceptedForm } from './veroFilter'
import { OFFENSIVE_WORDS } from './offensiveWords'

const none = new Set<string>()

describe('toAcceptedForm', () => {
  it.each([
    ['juros', 'JUROS'],
    ['ações', 'ACOES'],
    ['inflação', 'INFLACAO'],
    ['﻿renda', 'RENDA'],
    ['  bolsa  ', 'BOLSA'],
    ['pé-de-meia', null],
    ['Brasil', null],
    ['SELIC', null],
    ['sAlto', null],
    ['são', null],
    ['ano', null],
    ['abcdefghi', 'ABCDEFGHI'],
    ['abcdefghij', null],
    ['d’água', null],
    ['b3', null],
    ['', null],
  ])('%j vira %j', (raw, expected) => {
    expect(toAcceptedForm(raw, none)).toBe(expected)
  })

  it('descarta palavra da lista de ofensivas depois de normalizar', () => {
    expect(toAcceptedForm('boceta', new Set(['BOCETA']))).toBeNull()
    expect(toAcceptedForm('bolsa', new Set(['BOCETA']))).toBe('BOLSA')
  })

  it('a lista de ofensivas só tem formas já normalizadas e dentro do tamanho do jogo', () => {
    for (const word of OFFENSIVE_WORDS) {
      expect(word, word).toMatch(/^[A-Z]{4,9}$/)
    }
  })
})

describe('collectAcceptedForms', () => {
  it('ordena, tira repetidas e é estável', async () => {
    const lines = ['renda', 'juros', 'ações', 'acoes', 'Renda', 'Maria', 'taxa']
    expect(await collectAcceptedForms(lines, none)).toEqual(['ACOES', 'JUROS', 'RENDA', 'TAXA'])
    expect(await collectAcceptedForms([...lines].reverse(), none)).toEqual(
      await collectAcceptedForms(lines, none),
    )
  })
})
