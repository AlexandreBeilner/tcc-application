import type { Friendship } from '../../domain/friendship'
import type { FriendshipRepository } from '../ports/friendshipRepository'

export interface ExportFriendshipsInput {
  userId: string
}

// Consumida em processo pelo módulo `auth` (5.11, portabilidade RNF04) —
// junta os 3 recortes já existentes do repositório (aceitas, pendentes
// recebidas, pendentes enviadas) sem duplicar nenhuma linha (uma amizade
// nunca está em mais de um recorte pro mesmo usuário) e sem método novo no
// repositório.
export class ExportFriendshipsUseCase {
  constructor(private readonly friendshipRepository: FriendshipRepository) {}

  async execute(input: ExportFriendshipsInput): Promise<Friendship[]> {
    const [accepted, receivedPending, sentPending] = await Promise.all([
      this.friendshipRepository.listAccepted(input.userId),
      this.friendshipRepository.listReceivedPending(input.userId),
      this.friendshipRepository.listSentPending(input.userId),
    ])
    return [...accepted, ...receivedPending, ...sentPending]
  }
}
