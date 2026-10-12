import { markPrice } from '../../domain/markPrice'
import type { AccountReader, PositionRecord } from '../ports/accountReader'
import type { CatalogReader } from '../ports/catalogReader'

interface BaseMyAccountPosition {
  assetId: string
  ticker: string
  name: string
  type: string
  isSandbox: boolean
  quantity: number
  averagePrice: number
}

export interface MyAccountPosition extends BaseMyAccountPosition {
  // Proventos recebidos nesse ativo, em R$ (tarefa S.15) — soma dos eventos
  // dividend_payment do usuário nesse ativo, já agregada pelo motor
  // (GET /positions). Sempre presente, 0 sem provento nenhum.
  dividendsReceived: number
  // Preço de marcação a mercado (tarefa S.6) — ponto médio do book com
  // fallback pro último negócio (`markPrice`, `domain/markPrice.ts`).
  // Ausente pra posição sandbox (nunca teve book real, RF12/RNF08).
  markPrice?: number
}

export interface MyAccountFixedIncomePosition extends BaseMyAccountPosition {
  averageRate: number
  // Valor BRUTO de hoje e líquido de IR (MO.8.1), 1:1 com o que o motor avalia pelo mesmo caminho
  // do resgate. Ausentes no sandbox e quando a avaliação dessa posição falhou: quem lê cai no custo.
  currentValue?: number
  netValue?: number
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
  constructor(
    private readonly accountReader: AccountReader,
    private readonly catalogReader: CatalogReader,
  ) {}

  async execute(input: GetMyAccountInput): Promise<MyAccountResult> {
    const [account, positions, fixedIncomePositions] = await Promise.all([
      this.accountReader.getAccount(input.userId),
      this.accountReader.listPositions(input.userId),
      this.accountReader.listFixedIncomePositions(input.userId, { valuation: true }),
    ])

    const markPriceByAssetId = await this.loadMarkPrices(input.userId, positions)

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
        dividendsReceived: position.dividends_received,
        markPrice: markPriceByAssetId.get(position.asset_id),
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
        currentValue: position.is_sandbox ? undefined : position.current_value,
        netValue: position.is_sandbox ? undefined : position.net_value,
      })),
    }
  }

  // loadMarkPrices (tarefa S.6) resolve o preço de marcação a mercado só
  // das posições de renda variável do Mercado Ao Vivo (sandbox nunca teve
  // book real, RF12/RNF08 — fica sem `markPrice`). Um `GET .../book` por
  // ativo distinto (não por posição — `positions` nunca repete `asset_id`
  // duas vezes pro mesmo usuário) mais um `listAssets` pro fallback de
  // último negócio; usuário sem posição de renda variável real não faz
  // nenhuma chamada extra.
  private async loadMarkPrices(
    userId: string,
    positions: PositionRecord[],
  ): Promise<Map<string, number>> {
    const liveAssetIds = [...new Set(positions.filter((p) => !p.is_sandbox).map((p) => p.asset_id))]
    if (liveAssetIds.length === 0) {
      return new Map()
    }

    const [assets, books] = await Promise.all([
      this.catalogReader.listAssets(),
      Promise.all(liveAssetIds.map((assetId) => this.catalogReader.getAssetBook(assetId, userId))),
    ])
    const lastTradeByAssetId = new Map(assets.map((asset) => [asset.id, asset.current_price]))

    const result = new Map<string, number>()
    liveAssetIds.forEach((assetId, index) => {
      const lastTradePrice = lastTradeByAssetId.get(assetId)
      if (lastTradePrice === undefined) {
        return
      }
      result.set(assetId, markPrice(books[index].mid_price, lastTradePrice))
    })
    return result
  }
}
