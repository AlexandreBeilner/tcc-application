import { describe, expect, it } from 'vitest'
import { authed } from './support/http'
import { registerRandomUser, loginAsAdmin } from './support/users'
import { unlockKey } from './support/lessons'
import { ensureMarketOpen } from './support/market'
import { tickUntil, triggerTick } from './support/tick'

// Tabela fixa do IR regressivo (Lei 11.033/2004, .docs/engine/fixedincome.md)
// — reimplementada aqui só pra conferir a alíquota que o motor aplicou de
// verdade, não pra reimplementar o motor (mesma fórmula, cálculo
// independente, ver descrição da tarefa 7.3 no backlog).
function expectedTaxRate(daysHeld: number): number {
  if (daysHeld <= 180) return 0.225
  if (daysHeld <= 360) return 0.2
  if (daysHeld <= 720) return 0.175
  return 0.15
}

async function cashBalance(userToken: string): Promise<number> {
  const res = await authed(userToken).get('/market/me/account')
  expect(res.status).toBe(200)
  return res.body.cashBalance as number
}

interface AssetSummary {
  id: string
  ticker: string
  type: string
  is_sandbox: boolean
}

// Jornada 2 da tarefa 7.3: resgate de renda fixa com IR — aporte, avanço de
// dias simulados via POST /admin/tick, resgate conferido contra a tabela
// fixa de IR regressivo documentada.
describe('jornada: resgate de renda fixa com IR', () => {
  it(
    'compra um CDB, avança dias simulados e resgata com net_value/tax_rate coerentes com a tabela de IR, creditando o líquido',
    async () => {
      const user = await registerRandomUser()
      const adminToken = await loginAsAdmin()

      const catalog = await authed(user.token).get('/market/assets?type=cdb&include_sandbox=false')
      expect(catalog.status).toBe(200)
      const cdbs = catalog.body.assets as AssetSummary[]
      expect(cdbs.length).toBeGreaterThan(0)
      const cdb = cdbs[0]

      const blockedPurchase = await authed(user.token)
        .post('/market/fixed-income/purchases')
        .send({ asset_id: cdb.id, amount: 1000 })
      expect(blockedPurchase.status).toBe(403)
      expect(blockedPurchase.body.key).toBe('asset:cdb')

      await unlockKey(user.token, 'asset:cdb')

      // Prefixado/pós-fixado dependem do Temporizador já ter rodado pelo
      // menos um tick (fixedincome.md, ErrMarketNotInitialized) — garante
      // isso antes da compra, além de deixar o mercado aberto (S.11).
      await ensureMarketOpen(user.token, adminToken)
      await triggerTick(adminToken)

      const purchase = await authed(user.token)
        .post('/market/fixed-income/purchases')
        .send({ asset_id: cdb.id, amount: 1000 })
      expect(purchase.status).toBe(201)
      const purchaseDay = (await authed(user.token).get('/market/clock')).body
        .simulated_day as number

      // Avança dias simulados o bastante pra sair da primeira faixa da
      // tabela de IR (> 180 dias corridos), provando que a suíte de fato
      // exercita o mecanismo de avanço de tempo, não só um resgate no
      // mesmo dia.
      const targetDays = 190
      await tickUntil(
        adminToken,
        (result) => result.day - purchaseDay >= targetDays,
        targetDays + 20,
      )
      // Resgate também recusa fim de semana simulado (market_closed, S.11)
      // — garante mercado aberto antes de resgatar, mesma checagem da
      // compra; pode empurrar mais alguns dias, sem risco de cruzar a
      // próxima faixa de IR (190 já tem folga até o limite de 360).
      await ensureMarketOpen(user.token, adminToken)
      const dayBeforeRedemption = (await authed(user.token).get('/market/clock')).body
        .simulated_day as number
      const daysHeld = dayBeforeRedemption - purchaseDay
      expect(daysHeld).toBeGreaterThanOrEqual(targetDays)

      const cashBefore = await cashBalance(user.token)
      const redemption = await authed(user.token)
        .post('/market/fixed-income/redemptions')
        .send({ asset_id: cdb.id })
      expect(redemption.status).toBe(200)

      const {
        total_value: totalValue,
        net_value: netValue,
        tax_rate: taxRate,
      } = redemption.body as {
        total_value: number
        net_value: number
        tax_rate: number
      }

      expect(taxRate).toBeCloseTo(expectedTaxRate(daysHeld), 5)

      const profit = totalValue - 1000
      const expectedNet = profit > 0 ? totalValue - profit * taxRate : totalValue
      expect(netValue).toBeCloseTo(expectedNet, 2)
      // O caixa recebe o líquido: o IR mostrado ao usuário sai de fato da conta.
      expect(netValue).toBeLessThan(totalValue)
      expect(await cashBalance(user.token)).toBeCloseTo(cashBefore + netValue, 2)
    },
    20 * 60 * 1000,
  )
})
