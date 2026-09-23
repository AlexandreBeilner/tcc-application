import type { CatalogReader } from '../ports/catalogReader'
import type { EngineOrderRecord, OrderExecutor } from '../ports/orderExecutor'

export interface MyOrderResult {
  order_id: string
  asset_id: string
  ticker: string
  name: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  quantity: number
  filled_quantity: number
  price: number
  status: string
  cancel_reason?: EngineOrderRecord['cancel_reason']
  created_at: string
}

export interface ListMyOrdersInput {
  userId: string
}

// Fecha o achado 012 (tarefa O.3, pontos-em-aberto-decisao-produto.md):
// enriquece cada ordem crua do motor (só `asset_id`) com ticker/nome via
// CatalogReader — mesmo padrão de `assertProductUnlocked`
// (productUnlockGate.ts) já usar `getAsset` por id em vez do motor embutir
// o catálogo em cada rota de ordem. Deduplicado por asset_id (a mesma
// ação costuma se repetir em várias ordens) pra não chamar o motor uma vez
// por ordem. Sem paginação/filtro de status (escopo de protótipo) — o
// agrupamento em Pendentes/Executadas/Recusadas (O.4) é responsabilidade
// do frontend.
export class ListMyOrdersUseCase {
  constructor(
    private readonly orderExecutor: OrderExecutor,
    private readonly catalogReader: CatalogReader,
  ) {}

  async execute(input: ListMyOrdersInput): Promise<MyOrderResult[]> {
    const orders = await this.orderExecutor.list(input.userId)

    const uniqueAssetIds = [...new Set(orders.map((order) => order.asset_id))]
    const assets = await Promise.all(
      uniqueAssetIds.map((assetId) => this.catalogReader.getAsset(assetId)),
    )
    const assetById = new Map(assets.map((asset) => [asset.id, asset]))

    return orders.map((order) => {
      const asset = assetById.get(order.asset_id)!
      return {
        order_id: order.order_id,
        asset_id: order.asset_id,
        ticker: asset.ticker,
        name: asset.name,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        filled_quantity: order.filled_quantity,
        price: order.price,
        status: order.status,
        cancel_reason: order.cancel_reason,
        created_at: order.created_at,
      }
    })
  }
}
