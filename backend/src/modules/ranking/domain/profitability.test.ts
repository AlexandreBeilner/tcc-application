import { describe, expect, it } from 'vitest'
import {
  classDietzReturnPct,
  classReturnPct,
  dietzDenominator,
  extractWindowFlows,
  investmentDietzReturnPct,
  investmentReturnPct,
  profitabilityPct,
  type ClassRiskCapital,
  type DatedFlow,
  type RiskCapitalSnapshot,
} from './profitability'
import type { MarketEventRecord } from './networth'

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

// --- Dietz modificado (Dietz, 1966; GIPS 2019, provisão 2.A.24) ---------------------------------

const DAY = 24 * 60 * 60 * 1000
const WINDOW_START = new Date('2026-09-01T00:00:00Z')
const WINDOW_END = new Date(WINDOW_START.getTime() + 30 * DAY)
const dayAt = (day: number) => new Date(WINDOW_START.getTime() + day * DAY)

describe('investmentDietzReturnPct', () => {
  const cases: {
    name: string
    baseline: Partial<RiskCapitalSnapshot>
    current: Partial<RiskCapitalSnapshot>
    flows: DatedFlow[]
    want: number
  }[] = [
    {
      // Sem fluxos: V_início 10.200, G_início 200, G_atual 950 → 750 / 10.200.
      name: 'sem fluxos na janela: ganho da janela sobre o valor do começo',
      baseline: { investedCost: 10000, currentInvestedValue: 10200 },
      current: { investedCost: 10000, currentInvestedValue: 10950 },
      flows: [],
      want: (750 / 10200) * 100,
    },
    {
      // Aporte de 9.000 no dia 29 de 30: 100 / (1.000 + 9.000 × 1/30) = 100 / 1.300. A fórmula
      // antiga (sobre o custo bruto no fim, 10.000) daria 1,00%.
      name: 'aporte no fim da janela quase não pesa no denominador',
      baseline: { investedCost: 1000, currentInvestedValue: 1000 },
      current: { investedCost: 10000, currentInvestedValue: 10100 },
      flows: [{ at: dayAt(29), amount: 9000 }],
      want: (100 / 1300) * 100,
    },
    {
      // Compra e venda do mesmo valor: o denominador só muda pela diferença dos pesos
      // (500 × (20/30) − 500 × (10/30)), sem efeito no numerador.
      name: 'compra e venda do mesmo valor dentro da janela só mexem pelo peso dos dois fluxos',
      baseline: { investedCost: 1000, currentInvestedValue: 1000 },
      current: { investedCost: 1500, disinvestedProceeds: 500, currentInvestedValue: 1100 },
      flows: [
        { at: dayAt(10), amount: 500 },
        { at: dayAt(20), amount: -500 },
      ],
      want: (100 / (1000 + (500 * 20) / 30 - (500 * 10) / 30)) * 100,
    },
    {
      name: 'quem nunca investiu fica com 0%',
      baseline: {},
      current: {},
      flows: [],
      want: 0,
    },
    {
      // Vendeu mais do que tinha em risco no começo: denominador negativo → 0%, nunca absurdo.
      name: 'denominador <= 0 no geral dá 0%, não um percentual absurdo',
      baseline: { investedCost: 1000, currentInvestedValue: 1000 },
      current: { investedCost: 1000, disinvestedProceeds: 2000, currentInvestedValue: 0 },
      flows: [{ at: dayAt(1), amount: -2000 }],
      want: 0,
    },
  ]

  it.each(cases)('$name', ({ baseline, current, flows, want }) => {
    const got = investmentDietzReturnPct(
      riskCapital(current),
      riskCapital(baseline),
      flows,
      WINDOW_START,
      WINDOW_END,
    )
    expect(got).toBeCloseTo(want, 6)
  })

  it('o aporte no fim da janela dá 7,69% (a fórmula antiga daria 1,00%)', () => {
    const baseline = riskCapital({ investedCost: 1000, currentInvestedValue: 1000 })
    const current = riskCapital({ investedCost: 10000, currentInvestedValue: 10100 })
    const dietz = investmentDietzReturnPct(
      current,
      baseline,
      [{ at: dayAt(29), amount: 9000 }],
      WINDOW_START,
      WINDOW_END,
    )
    expect(dietz).toBeCloseTo(7.6923, 3)
    expect(investmentReturnPct(current, baseline)).toBeCloseTo(1, 6)
  })
})

describe('classDietzReturnPct', () => {
  const capital = (partial: Partial<ClassRiskCapital>): ClassRiskCapital => ({
    investedCost: 0,
    disinvestedProceeds: 0,
    dividendsReceived: 0,
    currentValue: 0,
    ...partial,
  })

  it('nunca investiu na classe: fora do ranking dela (null)', () => {
    expect(classDietzReturnPct(capital({}), capital({}), [], WINDOW_START, WINDOW_END)).toBeNull()
  })

  it('denominador <= 0: fora do ranking da classe (null)', () => {
    const got = classDietzReturnPct(
      capital({ investedCost: 1000, disinvestedProceeds: 2000, currentValue: 0 }),
      capital({ investedCost: 1000, currentValue: 1000 }),
      [{ at: dayAt(1), amount: -2000 }],
      WINDOW_START,
      WINDOW_END,
    )
    expect(got).toBeNull()
  })

  it('aporte no fim da janela: mesmo cálculo do critério geral, restrito à classe', () => {
    const got = classDietzReturnPct(
      capital({ investedCost: 10000, currentValue: 10100 }),
      capital({ investedCost: 1000, currentValue: 1000 }),
      [{ at: dayAt(29), amount: 9000 }],
      WINDOW_START,
      WINDOW_END,
    )
    expect(got).toBeCloseTo((100 / 1300) * 100, 6)
  })

  it('quem investiu só dentro da janela (começo zerado) entra no ranking da classe', () => {
    const got = classDietzReturnPct(
      capital({ investedCost: 1000, currentValue: 1050 }),
      capital({}),
      [{ at: dayAt(10), amount: 1000 }],
      WINDOW_START,
      WINDOW_END,
    )
    expect(got).toBeCloseTo((50 / ((1000 * 20) / 30)) * 100, 6)
  })
})

describe('dietzDenominator', () => {
  it('peso do fluxo = (T − t) / T: no começo pesa 1, no fim pesa 0', () => {
    expect(
      dietzDenominator(100, [{ at: WINDOW_START, amount: 50 }], WINDOW_START, WINDOW_END),
    ).toBe(150)
    expect(dietzDenominator(100, [{ at: WINDOW_END, amount: 50 }], WINDOW_START, WINDOW_END)).toBe(
      100,
    )
    expect(dietzDenominator(100, [{ at: dayAt(15), amount: 50 }], WINDOW_START, WINDOW_END)).toBe(
      125,
    )
  })

  it('janela de duração zero devolve só o valor do começo', () => {
    expect(
      dietzDenominator(100, [{ at: WINDOW_START, amount: 50 }], WINDOW_START, WINDOW_START),
    ).toBe(100)
  })
})

describe('extractWindowFlows', () => {
  const event = (partial: Partial<MarketEventRecord>): MarketEventRecord => ({
    id: 'e',
    eventType: 'buy_order_executed',
    timestamp: dayAt(5),
    ...partial,
  })
  const live = new Set<string>(['SAND'])

  it('compra e aplicação entram positivas; venda, resgate e provento negativos; sandbox e folha ficam de fora', () => {
    const flows = extractWindowFlows(
      [
        event({ eventType: 'buy_order_executed', assetId: 'A', quantity: 10, unitValue: 5 }),
        event({ eventType: 'sell_order_executed', assetId: 'A', quantity: 4, unitValue: 6 }),
        event({ eventType: 'fixed_income_purchase', assetId: 'F', unitValue: 300 }),
        event({ eventType: 'fixed_income_redemption', assetId: 'F', unitValue: 320 }),
        event({ eventType: 'dividend_payment', assetId: 'A', quantity: 6, unitValue: 0.5 }),
        event({ eventType: 'buy_order_executed', assetId: 'SAND', quantity: 1, unitValue: 999 }),
        event({ eventType: 'salary_payment', unitValue: 2000 }),
        event({ eventType: 'initial_deposit', unitValue: 10000 }),
      ],
      live,
      WINDOW_START,
      WINDOW_END,
    )
    expect(flows.overall.map((f) => f.amount)).toEqual([50, -24, 300, -320, -3])
    expect(flows.variableIncome.map((f) => f.amount)).toEqual([50, -24, -3])
    expect(flows.fixedIncome.map((f) => f.amount)).toEqual([300, -320])
  })

  it('só conta eventos depois do baseline (exclusivo) e até o fim (inclusivo)', () => {
    const flows = extractWindowFlows(
      [
        event({ assetId: 'A', quantity: 1, unitValue: 1, timestamp: WINDOW_START }),
        event({ assetId: 'A', quantity: 1, unitValue: 2, timestamp: dayAt(1) }),
        event({ assetId: 'A', quantity: 1, unitValue: 3, timestamp: WINDOW_END }),
        event({ assetId: 'A', quantity: 1, unitValue: 4, timestamp: dayAt(31) }),
      ],
      live,
      WINDOW_START,
      WINDOW_END,
    )
    expect(flows.overall.map((f) => f.amount)).toEqual([2, 3])
  })
})
