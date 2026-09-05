import { z } from 'zod'

export const searchUsersQuerySchema = z.object({
  q: z.string().min(1, 'informe ao menos 1 caractere'),
})

export const sendFriendRequestBodySchema = z.object({
  addresseeUsername: z.string().min(1),
})

// Paginação/ordenação de `GET /friendships` (6.9.1) — página 1-based,
// tamanho fixo (`FRIENDS_PAGE_SIZE`, não é parâmetro de query). `sort`
// (`asc`/`desc`) por `friendsSince`, default `desc` (mais recente primeiro).
export const listFriendsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['asc', 'desc']).default('desc'),
})

// Paginação independente pras duas listas de `GET /friendships/requests`
// (6.9.1) — a tela mostra Recebidas e Enviadas ao mesmo tempo, cada uma
// com sua própria página; `sort` é único pras duas (por `createdAt`).
export const listFriendRequestsQuerySchema = z.object({
  receivedPage: z.coerce.number().int().min(1).default(1),
  sentPage: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['asc', 'desc']).default('desc'),
})
