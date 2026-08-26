import type { AccountReader } from '../ports/accountReader'

export interface MyAccountPosition {
  assetId: string
  ticker: string
  name: string
  type: string
  isSandbox: boolean
  quantity: number
  averagePrice: number
}

export interface MyAccountFixedIncomePosition extends MyAccountPosition {
  averageRate: number
}

export interface MyAccountResult {
  cashBalance: number
  totalInvested: number
  totalDividendsReceived: number
  positions: MyAccountPosition[]
  fixedIncomePositions: MyAccountFixedIncomePosition[]
}

export interface GetMyAccountInput {
  userId: string
}

// Única agregação real do módulo `market` — as demais rotas são proxy 1:1
// (tarefa 6.0.3). Reúne 3 leituras do motor (`GET /accounts/:id`,
// `GET /positions`, `GET /fixed-income/positions`) numa única resposta
// camelCase pra tela 2.1 (Portfólio). `cashBalance`/`totalInvested` não são
// separados por sandbox — não existe conta paralela, só uma flag por
// posição (`is_sandbox`, `assets.is_sandbox` no motor); os dois cards
// "Mercado Ao Vivo vs. Sandbox" da tela 2.1 se resolvem no frontend
// agrupando `positions`/`fixedIncomePositions` pela flag `isSandbox` de
// cada item, não aqui.
//
// Decisão desta sessão (documentada em `.docs/backend/market.md`, não
// perguntada — reavaliar se divergir da intenção pedagógica): esta
// agregação **não** reaproveita `GetNetWorthUseCase`/
// `CurrentAccountStateReader` de `modules/ranking` — aquele caminho
// calcula um único número (patrimônio total, sem sandbox) pro ranking;
// este endpoint precisa da lista de posições completa, com
// ticker/nome/tipo, pra a tela de portfólio real do próprio usuário. Reusar
// criaria uma dependência `market → ranking` só pra descartar a metade do
// que aquele caso de uso calcula.
export class GetMyAccountUseCase {
  constructor(private readonly accountReader: AccountReader) {}

  async execute(input: GetMyAccountInput): Promise<MyAccountResult> {
    const [account, positions, fixedIncomePositions] = await Promise.all([
      this.accountReader.getAccount(input.userId),
      this.accountReader.listPositions(input.userId),
      this.accountReader.listFixedIncomePositions(input.userId),
    ])

    return {
      cashBalance: account.current_balance,
      totalInvested: account.total_invested,
      totalDividendsReceived: account.total_dividends_received,
      positions: positions.map((position) => ({
        assetId: position.asset_id,
        ticker: position.ticker,
        name: position.name,
        type: position.type,
        isSandbox: position.is_sandbox,
        quantity: position.quantity,
        averagePrice: position.average_price,
      })),
      fixedIncomePositions: fixedIncomePositions.map((position) => ({
        assetId: position.asset_id,
        ticker: position.ticker,
        name: position.name,
        type: position.type,
        isSandbox: position.is_sandbox,
        quantity: position.quantity,
        averagePrice: position.average_price,
        averageRate: position.average_rate,
      })),
    }
  }
}
