import { ApiError } from '../../../services/client'
import type { ProductLockedErrorBody } from '../../../services/market'

// `POST /market/orders`/`POST /market/fixed-income/purchases` respondem
// 403 com `{ error, key, unlockingLesson }` (tarefa 7.0.1,
// `.docs/backend/market.md`) — foge da convenção `{ error }` do resto do
// módulo, então `ApiError.details` carrega o corpo bruto (services/client)
// e quem chama faz o narrowing. Usado por `OrderConfirmationDialog`
// (tarefa J.3) pra mostrar o mesmo banner amigável de `AssetDetail` em vez
// da mensagem genérica quando a trava só é descoberta na confirmação
// (ex: acesso direto por URL).
export function asProductLockedError(err: unknown): ProductLockedErrorBody | null {
    if (!(err instanceof ApiError) || err.status !== 403) return null

    const body = err.details as Partial<ProductLockedErrorBody> | undefined
    if (typeof body?.key !== 'string') return null

    return { error: body.error ?? err.message, key: body.key, unlockingLesson: body.unlockingLesson ?? null }
}
