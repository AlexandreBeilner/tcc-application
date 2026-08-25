import type { CurrentAccountStateReader } from '../../application/ports/currentAccountStateReader'
import type { Snapshot } from '../../domain/networth'

interface AccountResponse {
  current_balance: number
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
      const [account, positions, fixedIncomePositions, assets] = await Promise.all([
        fetchJson<AccountResponse>(`${engineUrl}/accounts/${userId}`),
        fetchJson<PositionResponse[]>(`${engineUrl}/positions?user_id=${userId}`),
        fetchJson<PositionResponse[]>(`${engineUrl}/fixed-income/positions?user_id=${userId}`),
        fetchJson<AssetResponse[]>(`${engineUrl}/assets`),
      ])

      const priceByAssetId = new Map(assets.map((asset) => [asset.id, asset.current_price ?? 0]))

      const variableIncomeValue = positions
        .filter((position) => !position.is_sandbox)
        .reduce(
          (sum, position) => sum + position.quantity * (priceByAssetId.get(position.asset_id) ?? 0),
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
      }
    },
  }
}
