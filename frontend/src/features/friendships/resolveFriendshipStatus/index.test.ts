import { describe, expect, it } from 'vitest'
import type { Friend, FriendRequest } from '../../../services/friendships'
import { resolveFriendshipStatus } from '.'

function friend(overrides: Partial<Friend> = {}): Friend {
    return {
        friendshipId: 'f1',
        userId: 'u2',
        username: 'bia',
        name: 'Bia',
        avatarUrl: null,
        cosmetics: { frame: null, title: null },
        friendsSince: '2026-01-01T00:00:00.000Z',
        ...overrides,
    }
}

function request(overrides: Partial<FriendRequest> = {}): FriendRequest {
    return {
        friendshipId: 'f1',
        userId: 'u2',
        username: 'bia',
        name: 'Bia',
        avatarUrl: null,
        cosmetics: { frame: null, title: null },
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    }
}

describe('resolveFriendshipStatus', () => {
    it('self quando o alvo é o próprio usuário', () => {
        expect(
            resolveFriendshipStatus({ currentUserId: 'u1', targetUserId: 'u1', friends: [], sentRequests: [], receivedRequests: [] }),
        ).toEqual({ status: 'self', friendshipId: null })
    })

    it('friend quando o alvo já está na lista de amigos', () => {
        expect(
            resolveFriendshipStatus({
                currentUserId: 'u1',
                targetUserId: 'u2',
                friends: [friend()],
                sentRequests: [],
                receivedRequests: [],
            }),
        ).toEqual({ status: 'friend', friendshipId: null })
    })

    it('pendingReceived quando o alvo já te enviou uma solicitação (pedido mútuo simultâneo)', () => {
        expect(
            resolveFriendshipStatus({
                currentUserId: 'u1',
                targetUserId: 'u2',
                friends: [],
                sentRequests: [],
                receivedRequests: [request({ friendshipId: 'f9' })],
            }),
        ).toEqual({ status: 'pendingReceived', friendshipId: 'f9' })
    })

    it('pendingSent quando você já enviou uma solicitação pro alvo', () => {
        expect(
            resolveFriendshipStatus({
                currentUserId: 'u1',
                targetUserId: 'u2',
                friends: [],
                sentRequests: [request({ friendshipId: 'f7' })],
                receivedRequests: [],
            }),
        ).toEqual({ status: 'pendingSent', friendshipId: 'f7' })
    })

    it('none quando não há nenhuma relação', () => {
        expect(
            resolveFriendshipStatus({ currentUserId: 'u1', targetUserId: 'u2', friends: [], sentRequests: [], receivedRequests: [] }),
        ).toEqual({ status: 'none', friendshipId: null })
    })

    it('recebida tem prioridade sobre enviada se as duas listas contiverem o mesmo alvo por engano', () => {
        expect(
            resolveFriendshipStatus({
                currentUserId: 'u1',
                targetUserId: 'u2',
                friends: [],
                sentRequests: [request({ friendshipId: 'sent' })],
                receivedRequests: [request({ friendshipId: 'received' })],
            }),
        ).toEqual({ status: 'pendingReceived', friendshipId: 'received' })
    })
})
