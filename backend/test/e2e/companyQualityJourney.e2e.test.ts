import { describe, expect, it } from 'vitest'
import { authed } from './support/http'
import { registerRandomUser, loginAsAdmin } from './support/users'
import { tickUntil, triggerTick } from './support/tick'

interface AssetSummary {
  id: string
  ticker: string
  is_sandbox: boolean
}

interface Indicators {
  roe?: number
  net_margin?: number
  ebit_margin?: number
  price_to_book_value?: number
}

interface AssetDetail {
  equity: { company: { id: string; sector: string }; indicators?: Indicators }
}

interface Fundamentals {
  sector: string
  ticker: string
  indicators: Required<
    Pick<Indicators, 'roe' | 'net_margin' | 'ebit_margin' | 'price_to_book_value'>
  >
}

// Jornada do achado 025 (companies.quality_multiplier): ROE, margem e
// alavancagem deixam de ser idênticos entre empresas do mesmo setor. O seed
// pareia cada nível de crescimento (Boa/Média/Ruim) a um multiplicador de
// qualidade (1,25/1,00/0,75), então dentro de cada setor a empresa Boa tem
// ROE/margens acima da Média, e a Média acima da Ruim, tanto nos fundamentos
// iniciais do seed quanto depois de um ciclo de relatório real (91 dias
// simulados) — prova que o multiplicador sobrevive ao Temporizador e chega
// ao `GET /market/assets/:id` que a tela de detalhe (4.5) consome.
//
// Precondição extra: banco de mercado seedado DEPOIS da migration 000039
// (`ensureCompany` não atualiza empresa já existente, então um banco
// seedado antes dela fica com 1.00 em todas e este teste falha de propósito).
async function loadFundamentals(token: string): Promise<Fundamentals[]> {
  const catalog = await authed(token).get('/market/assets?type=acao&include_sandbox=false')
  expect(catalog.status).toBe(200)
  const equities = (catalog.body.assets as AssetSummary[]).filter((a) => !a.is_sandbox)

  const rows: Fundamentals[] = []
  for (const asset of equities) {
    const detail = await authed(token).get(`/market/assets/${asset.id}`)
    expect(detail.status).toBe(200)
    const equity = (detail.body.asset as AssetDetail).equity
    const ind = equity.indicators
    if (
      ind?.roe === undefined ||
      ind.net_margin === undefined ||
      ind.ebit_margin === undefined ||
      ind.price_to_book_value === undefined
    ) {
      throw new Error(`${asset.ticker} sem indicadores fundamentalistas completos`)
    }
    rows.push({
      sector: equity.company.sector,
      ticker: asset.ticker,
      indicators: {
        roe: ind.roe,
        net_margin: ind.net_margin,
        ebit_margin: ind.ebit_margin,
        price_to_book_value: ind.price_to_book_value,
      },
    })
  }
  return rows
}

// Por setor: maior e menor ROE são empresas diferentes e o ROE nunca é igual
// pra todas (o defeito original do achado 025). A empresa de maior ROE
// também lidera margem líquida e EBIT, a de menor ROE fecha as duas.
function assertQualitySpread(rows: Fundamentals[]): void {
  const bySector = new Map<string, Fundamentals[]>()
  for (const row of rows) {
    bySector.set(row.sector, [...(bySector.get(row.sector) ?? []), row])
  }
  expect(bySector.size).toBe(6)

  for (const [sector, companies] of bySector) {
    const byRoe = [...companies].sort((a, b) => b.indicators.roe - a.indicators.roe)
    const best = byRoe[0]
    const worst = byRoe[byRoe.length - 1]
    const distinctRoes = new Set(companies.map((c) => c.indicators.roe.toFixed(6)))

    expect(
      distinctRoes.size,
      `${sector}: ROE idêntico em todas as empresas`,
    ).toBeGreaterThanOrEqual(3)
    expect(best.indicators.roe, sector).toBeGreaterThan(worst.indicators.roe * 1.3)
    expect(best.indicators.net_margin, sector).toBeGreaterThan(worst.indicators.net_margin)
    expect(best.indicators.ebit_margin, sector).toBeGreaterThan(worst.indicators.ebit_margin)
    // Crescimento e rentabilidade melhores sustentam múltiplo maior.
    expect(best.indicators.price_to_book_value, sector).toBeGreaterThan(
      worst.indicators.price_to_book_value,
    )
  }
}

describe('jornada: qualidade da empresa (ROE/margem por empresa dentro do setor)', () => {
  it(
    'diferencia empresas do mesmo setor no seed e depois de um ciclo de relatório',
    async () => {
      const user = await registerRandomUser()
      const adminToken = await loginAsAdmin()

      // Um tick antes: P/L e P/VP só existem com cotação corrente, e um banco
      // recém-seedado ainda não tem nenhuma.
      await triggerTick(adminToken)

      const beforeReport = await loadFundamentals(user.token)
      assertQualitySpread(beforeReport)

      // Um ciclo de relatório inteiro (91 dias simulados): o Temporizador
      // regrava os 6 campos de company_fundamentals de toda empresa via
      // DeriveFinancials com o mesmo multiplicador.
      await tickUntil(adminToken, (result) => result.is_report_day, 100)

      const afterReport = await loadFundamentals(user.token)
      assertQualitySpread(afterReport)

      // ROE = margem líquida / patrimônio-receita não depende da receita do
      // ciclo, então cada empresa mantém o mesmo ROE do seed ao relatório.
      const roeBefore = new Map(beforeReport.map((r) => [r.ticker, r.indicators.roe]))
      for (const row of afterReport) {
        expect(row.indicators.roe, row.ticker).toBeCloseTo(roeBefore.get(row.ticker)!, 4)
      }
    },
    20 * 60 * 1000,
  )
})
