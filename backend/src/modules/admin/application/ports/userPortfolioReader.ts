// Visão financeira de um usuário pro detalhe do painel (N.16): o administrador
// vê o patrimônio absoluto (exceção deliberada à RNF09, CLAUDE.md), lido do
// estado atual da conta no motor, nunca da reconstrução do ranking.
export interface UserPortfolioPosition {
  asset_id: string
  ticker: string
  name: string
  type: string
  is_sandbox: boolean
  quantity: number
  average_price: number
}

export interface UserPortfolio {
  cash: number
  variable_income_value: number
  fixed_income_value: number
  net_worth: number
  positions: UserPortfolioPosition[]
}

export interface UserPortfolioReader {
  read(userId: string): Promise<UserPortfolio>
}
