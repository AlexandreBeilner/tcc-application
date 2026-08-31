import type { FriendshipRepository } from '../ports/friendshipRepository'
import type { UserDirectory } from '../ports/userDirectory'

export type FriendsSortOrder = 'asc' | 'desc'

// Página fixa (6.9.1, mesma técnica de paginação da Classificação/6.8.2,
// não é parâmetro de query configurável) — compartilhada com
// `listFriendRequests.ts`.
export const FRIENDS_PAGE_SIZE = 20

export interface FriendListItem {
  // Tarefa 6.9.3 (desfazer amizade) — `DELETE /friendships/:id` opera
  // sobre o id da amizade, não do usuário; expor aqui evita o frontend
  // ter que cruzar contra `GET /friendships/requests` só pra achar esse id.
  friendshipId: string
  userId: string
  username: string
  name: string
  friendsSince: Date | null
}

export interface ListFriendsInput {
  userId: string
  page: number
  // Por `friendsSince` — `desc` (mais recente primeiro) é o default
  // decidido nesta sessão (6.9.1): quem virou amigo agora importa mais
  // numa lista social do que quem é amigo há mais tempo.
  sort: FriendsSortOrder
}

export interface ListFriendsResult {
  items: FriendListItem[]
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
}

export class ListFriendsUseCase {
  constructor(
    private readonly friendshipRepository: FriendshipRepository,
    private readonly userDirectory: UserDirectory,
  ) {}

  async execute(input: ListFriendsInput): Promise<ListFriendsResult> {
    const accepted = await this.friendshipRepository.listAccepted(input.userId)

    const resolved = await Promise.all(
      accepted.map(async (friendship) => {
        const otherUserId =
          friendship.requesterId === input.userId ? friendship.addresseeId : friendship.requesterId
        const user = await this.userDirectory.findById(otherUserId)
        if (!user) {
          return undefined
        }
        return {
          friendshipId: friendship.id,
          userId: user.id,
          username: user.username,
          name: user.name,
          friendsSince: friendship.respondedAt,
        }
      }),
    )

    const items = resolved.filter((item): item is FriendListItem => item !== undefined)

    // Nenhuma das 3 queries do repositório tem `ORDER BY` (achado da
    // 6.9.1) — ordenar aqui, sobre o conjunto completo antes de paginar,
    // garante resultado determinístico independente da ordem devolvida
    // pelo Postgres, mesmo padrão de `GetRankingUseCase`.
    items.sort((a, b) => {
      const diff = (a.friendsSince?.getTime() ?? 0) - (b.friendsSince?.getTime() ?? 0)
      return input.sort === 'asc' ? diff : -diff
    })

    const totalEntries = items.length
    const totalPages = Math.max(1, Math.ceil(totalEntries / FRIENDS_PAGE_SIZE))
    // Página fora do intervalo válido nunca vira erro (ex: página aberta
    // antes de desfazer amizades o bastante pra ela deixar de existir) —
    // clampa pro extremo mais próximo, mesmo critério de `GetRankingUseCase`.
    const page = Math.min(Math.max(1, input.page), totalPages)
    const pageStart = (page - 1) * FRIENDS_PAGE_SIZE

    return {
      items: items.slice(pageStart, pageStart + FRIENDS_PAGE_SIZE),
      page,
      pageSize: FRIENDS_PAGE_SIZE,
      totalEntries,
      totalPages,
    }
  }
}
