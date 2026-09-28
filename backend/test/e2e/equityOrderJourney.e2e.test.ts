import { describe, expect, it } from 'vitest'
import { authed } from './support/http'
import { registerRandomUser, loginAsAdmin } from './support/users'
import { unlockKey } from './support/lessons'
import { ensureMarketOpen, ensureTwoSidedBook, firstRealEquityAsset } from './support/market'

// Jornada 1 da tarefa 7.3: compra/venda de ação real, incluindo o gate de
// desbloqueio por lição (7.0.1) — não só o caminho feliz. Roda contra o
// gateway real (ver README.md desta pasta pra precondição).
describe('jornada: compra/venda de ação com gate de desbloqueio', () => {
  it(
    'recusa operar antes de desbloquear, libera após completar as lições, e opera de ponta a ponta',
    async () => {
      const user = await registerRandomUser()
      const adminToken = await loginAsAdmin()

      const asset = await firstRealEquityAsset(user.token)

      const blockedOrder = await authed(user.token).post('/market/orders').send({
        asset_id: asset.id,
        side: 'buy',
        type: 'market',
        quantity: 1,
      })
      expect(blockedOrder.status).toBe(403)
      expect(blockedOrder.body.key).toBe('asset:acao')

      await unlockKey(user.token, 'asset:acao')

      await ensureMarketOpen(user.token, adminToken)
      await ensureTwoSidedBook(user.token, adminToken, asset.id)

      const accountBefore = await authed(user.token).get('/market/me/account')
      expect(accountBefore.status).toBe(200)
      const cashBefore = accountBefore.body.cashBalance as number

      const buy = await authed(user.token).post('/market/orders').send({
        asset_id: asset.id,
        side: 'buy',
        type: 'market',
        quantity: 1,
      })
      expect(buy.status).toBe(201)
      expect(buy.body.filled_quantity).toBeGreaterThanOrEqual(1)

      const accountAfterBuy = await authed(user.token).get('/market/me/account')
      expect(accountAfterBuy.status).toBe(200)
      expect(accountAfterBuy.body.cashBalance as number).toBeLessThan(cashBefore)
      const position = (
        accountAfterBuy.body.positions as Array<{ assetId: string; quantity: number }>
      ).find((p) => p.assetId === asset.id)
      expect(position).toBeDefined()
      expect(position!.quantity).toBeGreaterThanOrEqual(1)

      await ensureTwoSidedBook(user.token, adminToken, asset.id)

      const sell = await authed(user.token).post('/market/orders').send({
        asset_id: asset.id,
        side: 'sell',
        type: 'market',
        quantity: position!.quantity,
      })
      expect(sell.status).toBe(201)

      const accountAfterSell = await authed(user.token).get('/market/me/account')
      expect(accountAfterSell.status).toBe(200)
      expect(accountAfterSell.body.cashBalance as number).toBeGreaterThan(
        accountAfterBuy.body.cashBalance as number,
      )

      const events = await authed(user.token).get('/market/me/events')
      expect(events.status).toBe(200)
      const timestamps = (events.body.events as Array<{ timestamp: string }>).map((e) =>
        new Date(e.timestamp).getTime(),
      )
      expect(timestamps.length).toBeGreaterThanOrEqual(3) // conta inicial + compra + venda
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]) // mais recente primeiro
      }
    },
    20 * 60 * 1000,
  )
})
