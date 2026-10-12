import { isEmailVerified } from '../../../auth/domain/user'
import type { User } from '../../../auth/domain/user'
import type { VoterProfileReader } from '../../application/ports/voterProfileReader'

// Nível (gamification) e e-mail verificado (auth) por portas em processo.
export function createInProcessVoterProfileReader(deps: {
  getProgression: { execute(input: { userId: string }): Promise<{ level: number }> }
  userRepository: { findById(id: string): Promise<User | undefined> }
}): VoterProfileReader {
  return {
    async get(userId) {
      const [progression, user] = await Promise.all([
        deps.getProgression.execute({ userId }),
        deps.userRepository.findById(userId),
      ])
      return { level: progression.level, emailVerified: user ? isEmailVerified(user) : false }
    },
  }
}
