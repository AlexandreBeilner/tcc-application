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
    const resolved = await Promise.all(
      rows.map(async (friendship) => {
        const user = await this.userDirectory.findById(otherUserId(friendship))
        if (!user) {
          return undefined
        }
        return {
          friendshipId: friendship.id,
          userId: user.id,
          username: user.username,
          name: user.name,
          createdAt: friendship.createdAt,
        }
      }),
    )
    const items = resolved.filter((item): item is FriendRequestItem => item !== undefined)

    // Mesmo achado da 6.9.1 em `listFriends.ts` — sem `ORDER BY` no
    // repositório, ordenar aqui garante determinismo.
    items.sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime()
      return sort === 'asc' ? diff : -diff
    })

    const totalEntries = items.length
    const totalPages = Math.max(1, Math.ceil(totalEntries / FRIENDS_PAGE_SIZE))
    const clampedPage = Math.min(Math.max(1, page), totalPages)
    const pageStart = (clampedPage - 1) * FRIENDS_PAGE_SIZE

    return {
      items: items.slice(pageStart, pageStart + FRIENDS_PAGE_SIZE),
      page: clampedPage,
      pageSize: FRIENDS_PAGE_SIZE,
      totalEntries,
      totalPages,
    }
  }
}
