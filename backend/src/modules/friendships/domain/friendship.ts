import { SelfFriendshipError } from './errors'

export type FriendshipStatus = 'pending' | 'accepted' | 'declined'

export interface Friendship {
  id: string
  requesterId: string
  addresseeId: string
  status: FriendshipStatus
  createdAt: Date
  respondedAt: Date | null
}

// Validação de domínio espelhando o `CHECK` já existente no banco (1.3,
// mesmo raciocínio de `fii.NewDetails`/`macroevent.NewTarget` no motor Go —
// a garantia final é a constraint, mas o caso de uso quer um erro de negócio
// claro em vez de deixar o Postgres estourar a constraint crua).
export function newRequest(requesterId: string, addresseeId: string): void {
  if (requesterId === addresseeId) {
    throw new SelfFriendshipError('não é possível enviar solicitação de amizade pra si mesmo')
  }
}
