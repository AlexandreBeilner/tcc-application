import { markPrice } from '../../domain/markPrice'
import type { CurrentAccountStateReader } from '../../application/ports/currentAccountStateReader'
import type { Snapshot } from '../../domain/networth'

interface AccountResponse {
  current_balance: number
  total_invested: number
  total_disinvested: number
  total_dividends_received: number
}

interface PositionResponse {
  asset_id: string
  is_sandbox: boolean
  quantity: number
  average_price: number
}

interface AssetResponse {
  id: string
  current_price?: number
}

// BookResponse é o subconjunto de `GET /assets/:id/book` (motor, tarefa
// S.5) que a marcação a mercado precisa — só `mid_price` (`null` quando
// falta um dos lados do book).
interface BookResponse {
  mid_price: number | null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`falha ao ler estado do usuário no motor de simulação (status ${res.status})`)
  }
  return (await res.json()) as T
}

export function createEngineCurrentAccountStateReader(
  engineUrl: string,
): CurrentAccountStateReader {
  return {
    async getCurrentSnapshot(userId: string): Promise<Snapshot> {
      const [account, positions, fixedIncomePositions] = await Promise.all([
        fetchJson<AccountResponse>(`${engineUrl}/accounts/${userId}`),
        fetchJson<PositionResponse[]>(`${engineUrl}/positions?user_id=${userId}`),
        fetchJson<PositionResponse[]>(`${engineUrl}/fixed-income/positions?user_id=${userId}`),
      ])

      // Marcação a mercado (tarefa S.6): ponto médio do book de cada ativo
      // distinto que o usuário tem em posição real (`!is_sandbox`), com
      // fallback pro último negócio (`GET /assets`) quando falta um dos
      // lados — nunca o inverso, pra um negócio de 1 cota não conseguir
      // mover a marcação de outra carteira além do ponto médio. Usuário
      // sem posição de renda variável real não faz nenhuma chamada extra.
      const liveAssetIds = [
        ...new Set(
          positions.filter((position) => !position.is_sandbox).map((position) => position.asset_id),
        ),
      ]
      const markPriceByAssetId = new Map<string, number>()
      if (liveAssetIds.length > 0) {
        const [assets, books] = await Promise.all([
          fetchJson<AssetResponse[]>(`${engineUrl}/assets`),
          Promise.all(
            liveAssetIds.map((assetId) =>
              fetchJson<BookResponse>(`${engineUrl}/assets/${assetId}/book?user_id=${userId}`),
            ),
          ),
        ])
        const lastTradeByAssetId = new Map(assets.map((asset) => [asset.id, asset.current_price]))
        liveAssetIds.forEach((assetId, index) => {
          const lastTradePrice = lastTradeByAssetId.get(assetId)
          if (lastTradePrice === undefined) {
            return
          }
          markPriceByAssetId.set(assetId, markPrice(books[index].mid_price, lastTradePrice))
        })
      }

      const variableIncomeValue = positions
        .filter((position) => !position.is_sandbox)
        .reduce(
          (sum, position) =>
            sum + position.quantity * (markPriceByAssetId.get(position.asset_id) ?? 0),
          0,
        )

      // Mesma aproximação de custo (sem marcação a mercado) do replay
      // (`domain/networth.ts`) — mantém baseline (passado) e atual (agora)
      // na mesma metodologia de valorização.
      const fixedIncomeValue = fixedIncomePositions
        .filter((position) => !position.is_sandbox)
        .reduce((sum, position) => sum + position.quantity * position.average_price, 0)

      const cash = account.current_balance

      return {
        cash,
        variableIncomeValue,
        fixedIncomeValue,
        // Não computado no caminho rápido — ver getNetWorth.ts.
        tradesExecuted: 0,
        total: cash + variableIncomeValue + fixedIncomeValue,
        // investedCost/disinvestedProceeds/dividendsReceived (tarefa T.1) são
        // lidos direto dos acumuladores crus do motor (`accounts`), sem
        // filtro de sandbox — mesma convenção do replay (`domain/networth.ts`,
        // ver comentário em `Snapshot`), pra bater com o mesmo instante.
        investedCost: account.total_invested,
        disinvestedProceeds: account.total_disinvested,
        dividendsReceived: account.total_dividends_received,
      }
    },
  }
}
