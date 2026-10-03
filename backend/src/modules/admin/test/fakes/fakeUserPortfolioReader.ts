import type {
  UserPortfolio,
  UserPortfolioReader,
} from '../../application/ports/userPortfolioReader'

export const samplePortfolio: UserPortfolio = {
  cash: 4000,
  variable_income_value: 5000,
  fixed_income_value: 1500,
  net_worth: 10500,
  positions: [
    {
      asset_id: 'asset-1',
      ticker: 'BNDD3',
      name: 'Bandeira Energia',
      type: 'stock',
      is_sandbox: false,
      quantity: 100,
      average_price: 50,
    },
  ],
}

export function createFakeUserPortfolioReader(
  portfolio: UserPortfolio = samplePortfolio,
): UserPortfolioReader & { error?: Error } {
  const fake: UserPortfolioReader & { error?: Error } = {
    error: undefined,
    async read() {
      if (fake.error) throw fake.error
      return portfolio
    },
  }
  return fake
}
