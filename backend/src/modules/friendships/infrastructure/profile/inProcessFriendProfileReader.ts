import type { GetPublicProfileUseCase } from '../../../profile/application/useCases/getPublicProfile'
import type { FriendProfileReader } from '../../application/ports/friendProfileReader'

// Lê nível e rentabilidade da semana pelo mesmo caso de uso do perfil público (que, por
// construção, nunca devolve patrimônio absoluto, RNF09). Falha de leitura (ex.: motor fora do ar)
// vira `null`: o e-mail sai sem as estatísticas em vez de não sair.
export function createInProcessFriendProfileReader(
  getPublicProfile: Pick<GetPublicProfileUseCase, 'execute'>,
): FriendProfileReader {
  return {
    async read(userId) {
      try {
        const profile = await getPublicProfile.execute({ userId, window: 'week' })
        return { level: profile.level, profitabilityPct: profile.profitabilityPct }
      } catch (err) {
        console.error('[email] não foi possível ler o perfil para o e-mail de amizade', err)
        return null
      }
    },
  }
}
