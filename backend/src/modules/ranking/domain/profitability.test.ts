import { describe, expect, it } from 'vitest'
import {
  classReturnPct,
  investmentReturnPct,
  profitabilityPct,
  type RiskCapitalSnapshot,
} from './profitability'

describe('profitabilityPct', () => {
  it('ganho positivo', () => {
    expect(profitabilityPct(10000, 11000)).toBeCloseTo(10)
  })

  it('perda', () => {
    expect(profitabilityPct(10000, 9000)).toBeCloseTo(-10)
  })

  it('sem variação', () => {
    expect(profitabilityPct(10000, 10000)).toBe(0)
  })

  it('baseline zero não gera Infinity/NaN', () => {
    expect(profitabilityPct(0, 500)).toBe(0)
  })
})

function riskCapital(partial: Partial<RiskCapitalSnapshot>): RiskCapitalSnapshot {
  return {
    investedCost: 0,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    currentInvestedValue: 0,
    ...partial,
  }
}

describe('investmentReturnPct (sem baseline — retorno desde a criação da conta)', () => {
  it('compra parcial, ainda posicionada (ganho não realizado)', () => {
    const current = riskCapital({ investedCost: 1000, currentInvestedValue: 1080 })
    expect(investmentReturnPct(current)).toBeCloseTo(8)
  })

  it('compra parcial, ainda posicionada (perda não realizada)', () => {
    const current = riskCapital({ investedCost: 1000, currentInvestedValue: 970 })
    expect(investmentReturnPct(current)).toBeCloseTo(-3)
  })

  it('venda com lucro (totalmente realizada, nada mais posicionado)', () => {
    const current = riskCapital({
      investedCost: 1000,
      disinvestedProceeds: 1300,
      currentInvestedValue: 0,
    })
    expect(investmentReturnPct(current)).toBeCloseTo(30)
  })

  it('venda com perda (totalmente realizada, nada mais posicionado)', () => {
    const current = riskCapital({
      investedCost: 1000,
      disinvestedProceeds: 800,
      currentInvestedValue: 0,
    })
    expect(investmentReturnPct(current)).toBeCloseTo(-20)
  })

  it('dividendo recebido, ainda posicionado sem variação de preço', () => {
    const current = riskCapital({
      investedCost: 1000,
      currentInvestedValue: 1000,
      dividendsReceived: 50,
    })
    expect(investmentReturnPct(current)).toBeCloseTo(5)
  })

  it('só depósito inicial, sem nenhuma operação — 0%, não -100% (nunca investiu)', () => {
    const current = riskCapital({})
    expect(investmentReturnPct(current)).toBe(0)
  })
})

describe('investmentReturnPct (com baseline — retorno da janela do ranking)', () => {
  it('vender com lucro uma posição comprada antes da janela, sem reinvestir, ainda conta na janela', () => {
    // Comprou por R$1.000 antes da janela; no início da janela valia
    // R$1.100 (ganho não realizado); vendeu por R$1.300 durante a janela.
    const baseline = riskCapital({ investedCost: 1000, currentInvestedValue: 1100 })
    const current = riskCapital({
      investedCost: 1000,
      disinvestedProceeds: 1300,
      currentInvestedValue: 0,
    })
    // (1300 - 1000) - (1100 - 1000) = 200, sobre investedCost atual (1000) = 20%.
    expect(investmentReturnPct(current, baseline)).toBeCloseTo(20)
  })

  it('nenhuma atividade dentro da janela — retorno da janela é 0%, mesmo com ganho histórico grande', () => {
    const baseline = riskCapital({
      investedCost: 1000,
      disinvestedProceeds: 1300,
      currentInvestedValue: 0,
    })
    const current = riskCapital({
      investedCost: 1000,
      disinvestedProceeds: 1300,
      currentInvestedValue: 0,
    })
    expect(investmentReturnPct(current, baseline)).toBe(0)
  })

  it('comprou e valorizou inteiramente dentro da janela (baseline zerado, sem vantagem de tempo de conta)', () => {
    const baseline = riskCapital({})
    const current = riskCapital({ investedCost: 500, currentInvestedValue: 550 })
    expect(investmentReturnPct(current, baseline)).toBeCloseTo(10)
  })

  it('nunca investiu nada, nem antes nem dentro da janela — 0%, não Infinity/NaN', () => {
    const baseline = riskCapital({})
    const current = riskCapital({})
    expect(investmentReturnPct(current, baseline)).toBe(0)
  })

  it('rentabilidade geral pondera várias posições não vendidas pelo valor investido em cada uma', () => {
    // 3 ações de R$1.000 cada, uma +8%, uma +4%, uma -3%, nenhuma vendida.
    const baseline = riskCapital({})
    const current = riskCapital({ investedCost: 3000, currentInvestedValue: 1080 + 1040 + 970 })
    expect(investmentReturnPct(current, baseline)).toBeCloseTo(3)
  })
})

describe('classReturnPct', () => {
  const capital = (c: Partial<Parameters<typeof classReturnPct>[0]>) => ({
    investedCost: 0,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    currentValue: 0,
    ...c,
  })

  it.each([
    ['sem custo na classe: fora do ranking', capital({}), capital({}), null],
    [
      'valorização da posição que já existia no começo da janela',
      capital({ investedCost: 1000, currentValue: 1100 }),
      capital({ investedCost: 1000, currentValue: 1000 }),
      10,
    ],
    [
      'investiu só dentro da janela (começo zerado)',
      capital({ investedCost: 1000, currentValue: 1100 }),
      capital({}),
      10,
    ],
    [
      'aporte durante a janela não conta como ganho',
      capital({ investedCost: 2000, currentValue: 2000 }),
      capital({ investedCost: 1000, currentValue: 1000 }),
      0,
    ],
    [
      'venda com lucro e provento contam',
      capital({ investedCost: 1000, disinvestedProceeds: 1050, dividendsReceived: 50 }),
      capital({ investedCost: 1000, currentValue: 1000 }),
      10,
    ],
    [
      'perda',
      capital({ investedCost: 1000, currentValue: 900 }),
      capital({ investedCost: 1000, currentValue: 1000 }),
      -10,
    ],
  ])('%s', (_name, current, baseline, expected) => {
    const result = classReturnPct(current, baseline)
    if (expected === null) expect(result).toBeNull()
    else expect(result).toBeCloseTo(expected)
  })
})
