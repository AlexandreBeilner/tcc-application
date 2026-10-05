import type { CurrentAccountStateReader } from '../../../ranking/application/ports/currentAccountStateReader'
import type {
  UserPortfolio,
  UserPortfolioPosition,
  UserPortfolioReader,
} from '../../application/ports/userPortfolioReader'

interface PositionResponse {
  asset_id: string
  ticker: string
  name: string
  type: string
  is_sandbox: boolean
  quantity: number
  average_price: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `falha ao ler a carteira do usuário no motor de simulação (status ${res.status})`,
    )
  }
  return (await res.json()) as T
}

// Os valores (caixa, patrimônio) vêm do mesmo leitor de estado atual que o
// ranking usa (marcação a mercado de renda variável); as linhas de posição vêm
// direto das duas rotas de posição do motor. Só posição com quantidade > 0
// aparece: venda total deixa a linha zerada (nunca apagada).
export function createEngineUserPortfolioReader(
  engineUrl: string,
  currentAccountState: CurrentAccountStateReader,
): UserPortfolioReader {
  return {
    async read(userId): Promise<UserPortfolio> {
      const [snapshot, variable, fixed] = await Promise.all([
        currentAccountState.getCurrentSnapshot(userId),
        fetchJson<PositionResponse[]>(`${engineUrl}/positions?user_id=${userId}`),
        fetchJson<PositionResponse[]>(`${engineUrl}/fixed-income/positions?user_id=${userId}`),
      ])
      const positions: UserPortfolioPosition[] = [...variable, ...fixed]
        .filter((position) => position.quantity > 0)
        .map((position) => ({
          asset_id: position.asset_id,
          ticker: position.ticker,
          name: position.name,
          type: position.type,
          is_sandbox: position.is_sandbox,
          quantity: position.quantity,
          average_price: position.average_price,
        }))
      return {
        cash: snapshot.cash,
        variable_income_value: snapshot.variableIncomeValue,
        fixed_income_value: snapshot.fixedIncomeValue,
        net_worth: snapshot.total,
        positions,
      }
    },
  }
}
