import { describe, expect, it } from 'vitest'
import { authed, sleep } from './support/http'
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

// Linha de evidência da validação do TCC (docs/validacao-tcc.md): uma linha JSON por produto em
// stderr, prefixada para ser filtrada na saída do Vitest. Não altera nenhuma asserção.
function evidence(label: string, data: Record<string, unknown>): void {
  process.stderr.write(`EVIDENCIA ${label} ${JSON.stringify(data)}\n`)
}

// Produtos isentos de IR (LCI, LCA, CRI e CRA): comprados junto com o CDB e resgatados no mesmo dia.
const EXEMPT_TYPES = ['lci', 'lca', 'cri', 'cra'] as const

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
      for (const type of EXEMPT_TYPES) {
        await unlockKey(user.token, `asset:${type}`)
      }

      // Prefixado/pós-fixado dependem do Temporizador já ter rodado pelo
      // menos um tick (fixedincome.md, ErrMarketNotInitialized) — garante
      // isso antes da compra, além de deixar o mercado aberto (S.11).
      await ensureMarketOpen(user.token, adminToken)
      await triggerTick(adminToken)

      const exempt: { type: string; ticker: string; id: string }[] = []
      for (const type of EXEMPT_TYPES) {
        const list = await authed(user.token).get(
          `/market/assets?type=${type}&include_sandbox=false`,
        )
        expect(list.status).toBe(200)
        const asset = (list.body.assets as AssetSummary[])[0]
        expect(asset).toBeDefined()
        exempt.push({ type, ticker: asset.ticker, id: asset.id })
      }

      const cashBeforePurchase = await cashBalance(user.token)
      const purchase = await authed(user.token)
        .post('/market/fixed-income/purchases')
        .send({ asset_id: cdb.id, amount: 1000 })
      expect(purchase.status).toBe(201)
      for (const item of exempt) {
        const bought = await authed(user.token)
          .post('/market/fixed-income/purchases')
          .send({ asset_id: item.id, amount: 1000 })
        expect(bought.status).toBe(201)
      }
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
      const cashAfter = await cashBalance(user.token)
      expect(cashAfter).toBeCloseTo(cashBefore + netValue, 2)
      evidence('CDB', {
        ticker: cdb.ticker,
        valor_aplicado: 1000,
        dias_simulados_ate_o_resgate: daysHeld,
        valor_bruto: totalValue,
        ganho: profit,
        aliquota: taxRate,
        imposto: totalValue - netValue,
        valor_liquido: netValue,
        saldo_antes_do_resgate: cashBefore,
        saldo_depois_do_resgate: cashAfter,
        variacao_do_saldo_no_resgate: cashAfter - cashBefore,
        saldo_antes_da_compra: cashBeforePurchase,
      })

      for (const item of exempt) {
        const before = await cashBalance(user.token)
        const res = await authed(user.token)
          .post('/market/fixed-income/redemptions')
          .send({ asset_id: item.id })
        expect(res.status).toBe(200)
        const after = await cashBalance(user.token)
        evidence(item.type.toUpperCase(), {
          ticker: item.ticker,
          valor_aplicado: 1000,
          dias_simulados_ate_o_resgate: daysHeld,
          valor_bruto: res.body.total_value,
          aliquota: res.body.tax_rate,
          valor_creditado: res.body.net_value,
          variacao_do_saldo: after - before,
        })
        expect(res.body.tax_rate).toBe(0)
        expect(res.body.net_value).toBeCloseTo(res.body.total_value, 2)
        expect(after - before).toBeCloseTo(res.body.net_value, 2)
      }

      // Serviço de integridade (N.21): reconstrói saldo e posição dos eventos e compara com a projeção.
      // Roda depois de todos os resgates; é somente leitura.
      const started = await authed(adminToken).post('/admin/integrity/check')
      expect([202, 409]).toContain(started.status)
      let run = (await authed(adminToken).get('/admin/integrity/check')).body.run
      for (let i = 0; i < 120 && (!run || run.status === 'running'); i++) {
        await sleep(1000)
        run = (await authed(adminToken).get('/admin/integrity/check')).body.run
      }
      evidence('INTEGRIDADE', {
        status: run?.status,
        verificado: run?.report?.checked,
        total_de_divergencias: run?.report?.total,
        por_tipo: run?.report?.counts,
        divergencias: run?.report?.divergences,
      })
      expect(run?.status).toBe('done')
    },
    20 * 60 * 1000,
  )
})
