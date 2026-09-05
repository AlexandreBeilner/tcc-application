import { paginate } from '../../../../shared/pagination'
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

    const entries = accepted.map((friendship) => ({
      friendshipId: friendship.id,
      otherUserId:
        friendship.requesterId === input.userId ? friendship.addresseeId : friendship.requesterId,
      friendsSince: friendship.respondedAt,
    }))

    // Nenhuma das 3 queries do repositório tem `ORDER BY` (achado da
    // 6.9.1) — ordenar aqui, sobre o conjunto completo antes de paginar,
    // garante resultado determinístico independente da ordem devolvida
    // pelo Postgres, mesmo padrão de `GetRankingUseCase`.
    entries.sort((a, b) => {
      const diff = (a.friendsSince?.getTime() ?? 0) - (b.friendsSince?.getTime() ?? 0)
      return input.sort === 'asc' ? diff : -diff
    })

    const {
      items: pageEntries,
      page,
      totalEntries,
      totalPages,
    } = paginate(entries, input.page, FRIENDS_PAGE_SIZE)

    // Achado de revisão da 6.9.1: resolver usuário só pra página exibida
    // (uma query batched via `findByIds`), não pro conjunto de amizades
    // inteiro — evita N chamadas a `findById` num usuário com centenas
    // de amigos pra só mostrar 20 por vez.
    const users = await this.userDirectory.findByIds(pageEntries.map((entry) => entry.otherUserId))
    const userById = new Map(users.map((user) => [user.id, user]))

    const items = pageEntries
      .map((entry): FriendListItem | undefined => {
        const user = userById.get(entry.otherUserId)
        if (!user) {
          return undefined
        }
        return {
          friendshipId: entry.friendshipId,
          userId: user.id,
          username: user.username,
          name: user.name,
          friendsSince: entry.friendsSince,
        }
      })
      .filter((item): item is FriendListItem => item !== undefined)

    return {
      items,
      page,
      pageSize: FRIENDS_PAGE_SIZE,
      totalEntries,
      totalPages,
    }
  }
}
