import { describe, expect, it } from 'vitest'
import {
  describeEffectProblem,
  readOptionEffects,
  toStoredEffect,
  touchesProfit,
  type OptionEffect,
} from './effects'
import { readEffectPreview, readEffectPreviews } from './scoreboard'

const growth = { metric: 'base_growth_pct', direction: 1, intensity: 0.5 }
const payout = { metric: 'payout_ratio_pct', direction: -1, intensity: 1 }
const policy = { metric: 'dividend_policy', value: 'annual' }

describe('readOptionEffects', () => {
  it('lê o formato antigo (um efeito só) como lista de um', () => {
    expect(readOptionEffects(growth)).toEqual([growth])
  })

  it('lê a lista de 1 a 2 efeitos, na ordem escrita', () => {
    expect(readOptionEffects({ effects: [payout, growth] })).toEqual([payout, growth])
    expect(readOptionEffects({ effects: [policy] })).toEqual([policy])
  })

  it.each([
    ['lista vazia', { effects: [] }],
    ['três efeitos', { effects: [growth, payout, policy] }],
    ['mesma alavanca duas vezes', { effects: [growth, { ...growth, direction: -1 }] }],
    ['alavanca desconhecida', { effects: [{ ...growth, metric: 'preco' }] }],
    ['sentido inválido', { effects: [{ ...growth, direction: 0 }] }],
    ['intensidade fora de (0, 1]', { effects: [{ ...growth, intensity: 1.01 }] }],
    ['política sem valor', { effects: [{ metric: 'dividend_policy' }] }],
    [
      'política com valor desconhecido',
      { effects: [{ metric: 'dividend_policy', value: 'mensal' }] },
    ],
    ['efeito que não é objeto', { effects: [42] }],
  ])('devolve null para %s', (_name, raw) => {
    expect(readOptionEffects(raw as Record<string, unknown>)).toBeNull()
  })
})

describe('toStoredEffect', () => {
  it('grava só os campos conhecidos de cada efeito', () => {
    const effects = [
      { ...payout, extra: 1 },
      { ...policy, direction: 1 },
    ] as unknown as OptionEffect[]
    expect(toStoredEffect(effects)).toEqual({
      effects: [payout, { metric: 'dividend_policy', value: 'annual' }],
    })
  })

  it('o que se grava volta igual na leitura', () => {
    const stored = toStoredEffect([payout as OptionEffect, policy as OptionEffect])
    expect(readOptionEffects(stored)).toEqual([payout, policy])
  })
})

describe('describeEffectProblem', () => {
  it('diz quando a quantidade de efeitos é inválida', () => {
    expect(describeEffectProblem({ effects: [] })).toMatch(/1 a 2 efeitos/)
  })

  it('aponta qual efeito está inválido', () => {
    expect(describeEffectProblem({ effects: [growth, { ...payout, direction: 0 }] })).toMatch(
      /efeito 2/,
    )
  })

  it('diz quando só falta a alavanca ser diferente', () => {
    expect(describeEffectProblem({ effects: [growth, growth] })).toMatch(/não podem se repetir/)
  })
})

describe('touchesProfit', () => {
  it('só payout, prêmio da PN e política mexem no destino do lucro', () => {
    expect(touchesProfit([growth as OptionEffect])).toBe(false)
    expect(touchesProfit([growth as OptionEffect, payout as OptionEffect])).toBe(true)
    expect(touchesProfit([policy as OptionEffect])).toBe(true)
  })
})

describe('prévia dos efeitos para a ficha da pauta', () => {
  it('traduz as alavancas e mantém a ordem, sem valor absoluto', () => {
    expect(readEffectPreviews({ effects: [payout, growth] })).toEqual([
      { metric: 'payout', direction: -1, intensity: 1 },
      { metric: 'growth', direction: 1, intensity: 0.5 },
    ])
    expect(readEffectPreviews({ effects: [policy] })).toEqual([
      { metric: 'dividend_policy', value: 'annual' },
    ])
  })

  it('o primeiro efeito segue disponível para quem lê um só', () => {
    expect(readEffectPreview({ effects: [payout, growth] })).toEqual({
      metric: 'payout',
      direction: -1,
      intensity: 1,
    })
    expect(readEffectPreview(growth)).toEqual({ metric: 'growth', direction: 1, intensity: 0.5 })
  })

  it('formato inválido vira lista vazia e primeiro efeito nulo (a ficha omite a faixa)', () => {
    expect(readEffectPreviews({ metric: 'x' })).toEqual([])
    expect(readEffectPreview({ effects: [] })).toBeNull()
  })
})
