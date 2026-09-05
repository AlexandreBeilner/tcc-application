import { paginate } from '../../../../shared/pagination'
import type { FriendshipRepository } from '../ports/friendshipRepository'
import type { UserDirectory } from '../ports/userDirectory'
import { FRIENDS_PAGE_SIZE, type FriendsSortOrder } from './listFriends'

export interface FriendRequestItem {
  friendshipId: string
  userId: string
  username: string
  name: string
  createdAt: Date
}

export interface PaginatedFriendRequests {
  items: FriendRequestItem[]
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
}

export interface ListFriendRequestsInput {
  userId: string
  // Recebidas e enviadas paginam de forma independente (6.9.1) — a tela
  // 8.3 mostra as duas listas ao mesmo tempo, então um par de parâmetros
  // separado evita acoplar a página de uma à da outra.
  receivedPage: number
  sentPage: number
  // Único parâmetro pras duas listas (não `receivedSort`/`sentSort`) —
  // decisão desta sessão: ambas ordenam por data, sem motivo pra UX
  // divergente entre elas.
  sort: FriendsSortOrder
}

export interface ListFriendRequestsResult {
  received: PaginatedFriendRequests
  sent: PaginatedFriendRequests
}

export class ListFriendRequestsUseCase {
  constructor(
    private readonly friendshipRepository: FriendshipRepository,
    private readonly userDirectory: UserDirectory,
  ) {}

  async execute(input: ListFriendRequestsInput): Promise<ListFriendRequestsResult> {
    const [receivedRows, sentRows] = await Promise.all([
      this.friendshipRepository.listReceivedPending(input.userId),
      this.friendshipRepository.listSentPending(input.userId),
    ])

    const [received, sent] = await Promise.all([
      this.paginate(
        receivedRows,
        (friendship) => friendship.requesterId,
        input.receivedPage,
        input.sort,
      ),
      this.paginate(sentRows, (friendship) => friendship.addresseeId, input.sentPage, input.sort),
    ])

    return { received, sent }
  }

  private async paginate(
    rows: Awaited<ReturnType<FriendshipRepository['listReceivedPending']>>,
    otherUserId: (friendship: (typeof rows)[number]) => string,
    page: number,
    sort: FriendsSortOrder,
  ): Promise<PaginatedFriendRequests> {
    const entries = rows.map((friendship) => ({
      friendshipId: friendship.id,
      otherUserId: otherUserId(friendship),
      createdAt: friendship.createdAt,
    }))

    // Mesmo achado da 6.9.1 em `listFriends.ts` — sem `ORDER BY` no
    // repositório, ordenar aqui garante determinismo.
    entries.sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime()
      return sort === 'asc' ? diff : -diff
    })

    const {
      items: pageEntries,
      page: clampedPage,
      totalEntries,
      totalPages,
    } = paginate(entries, page, FRIENDS_PAGE_SIZE)

    // Achado de revisão da 6.9.1 (mesmo de `listFriends.ts`) — resolver
    // usuário só pra página exibida, com uma query batched via
    // `findByIds`, não uma por solicitação pendente.
    const users = await this.userDirectory.findByIds(pageEntries.map((entry) => entry.otherUserId))
    const userById = new Map(users.map((user) => [user.id, user]))

    const items = pageEntries
      .map((entry): FriendRequestItem | undefined => {
        const user = userById.get(entry.otherUserId)
        if (!user) {
          return undefined
        }
        return {
          friendshipId: entry.friendshipId,
          userId: user.id,
          username: user.username,
          name: user.name,
          createdAt: entry.createdAt,
        }
      })
      .filter((item): item is FriendRequestItem => item !== undefined)

    return {
      items,
      page: clampedPage,
      pageSize: FRIENDS_PAGE_SIZE,
      totalEntries,
      totalPages,
    }
  }
}
