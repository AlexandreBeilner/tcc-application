import { authed } from './http'
import { triggerTick } from './tick'

interface AssetSummary {
  id: string
  ticker: string
  type: string
  is_sandbox: boolean
}

interface AssetBook {
  best_bid: number | null
  best_ask: number | null
}

// `POST /market/orders` recusa fim de semana simulado (`market_closed`,
// tarefa S.11) — avança o relógio simulado até abrir, mesmo mecanismo que
// o painel admin/demo usa (docs/backend/market.md, GET /market/clock).
export async function ensureMarketOpen(userToken: string, adminToken: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await authed(userToken).get('/market/clock')
    if (res.status !== 200) {
      throw new Error(`falha ao ler relógio do mercado: ${res.status} ${JSON.stringify(res.body)}`)
    }
    if (res.body.market_open) {
      return
    }
    await triggerTick(adminToken)
  }
  throw new Error('mercado simulado continuou fechado após várias tentativas de tick')
}

// Primeiro ativo de renda variável real (não sandbox) do catálogo —
// qualquer um serve pra jornada 1 (compra/venda), o gate por lição
// (7.0.1) já garante que é um ativo real de `asset:acao`.
export async function firstRealEquityAsset(userToken: string): Promise<AssetSummary> {
  const res = await authed(userToken).get('/market/assets?type=acao&include_sandbox=false')
  if (res.status !== 200) {
    throw new Error(`falha ao listar ações: ${res.status} ${JSON.stringify(res.body)}`)
  }
  const assets = res.body.assets as AssetSummary[]
  if (assets.length === 0) {
    throw new Error('catálogo sem nenhuma ação real (pós-7.2 deveria ter 25) — seed rodou?')
  }
  return assets[0]
}

// Ordem `market` de ativo do Mercado Ao Vivo só executa contra contraparte
// real (bot Market Maker, Fase P) — sem isso, `filled_quantity` pode vir
// `0` sem erro nenhum (comportamento documentado, não bug). Avança ticks
// até o book do ativo ter os dois lados cotados antes de operar, em vez de
// assumir liquidez instantânea numa stack recém-subida.
export async function ensureTwoSidedBook(
  userToken: string,
  adminToken: string,
  assetId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await authed(userToken).get(`/market/assets/${assetId}/book`)
    if (res.status !== 200) {
      throw new Error(`falha ao ler book do ativo: ${res.status} ${JSON.stringify(res.body)}`)
    }
    const book = res.body.book as AssetBook
    if (book.best_bid !== null && book.best_ask !== null) {
      return
    }
    await ensureMarketOpen(userToken, adminToken)
    await triggerTick(adminToken)
  }
  throw new Error(`book do ativo ${assetId} continuou sem os dois lados cotados`)
}
