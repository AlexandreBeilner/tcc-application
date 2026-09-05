import { buildAvatarUrl } from '../../../../shared/avatarUrl'
import { UserNotFoundError } from '../../domain/errors'
import type { AchievementsReader, UnlockedAchievementSummary } from '../ports/achievementsReader'
import type { GamificationReader } from '../ports/gamificationReader'
import type { ProfileWindow, ProfitabilityReader } from '../ports/profitabilityReader'
import type { UserDirectory } from '../ports/userDirectory'

export interface GetPublicProfileInput {
  userId: string
  window?: ProfileWindow
}

// RF20: perfil público de outro usuário (tela 8.4) ou do próprio (tela
// 9.1, combinado no frontend com GET /auth/me pra dados de identidade).
// Nunca consulta saldo/patrimônio absoluto em nenhum ponto do caminho —
// a blindagem de RNF09 é estrutural (o campo não existe aqui, não é um
// campo omitido na serialização).
export interface PublicProfile {
  username: string
  avatarUrl: string | null
  level: number
  xp: number
  currentStreak: number
  achievements: UnlockedAchievementSummary[]
  profitabilityPct: number
  window: ProfileWindow
}

export class GetPublicProfileUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly gamificationReader: GamificationReader,
    private readonly achievementsReader: AchievementsReader,
    private readonly profitabilityReader: ProfitabilityReader,
  ) {}

  async execute(input: GetPublicProfileInput): Promise<PublicProfile> {
    const user = await this.userDirectory.findById(input.userId)
    if (!user) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    // RF20 não especifica janela — default semanal, mesma decisão de
    // escopo não confirmada explicitamente já usada em outros pontos desta
    // semana (ex: 5.5). Sinalizar se divergir.
    const window = input.window ?? 'week'

    const [summary, achievements, profitabilityPct] = await Promise.all([
      this.gamificationReader.getSummary(input.userId),
      this.achievementsReader.listUnlocked(input.userId),
      this.profitabilityReader.getProfitabilityPct(input.userId, window, user.createdAt),
    ])

    return {
      username: user.username,
      avatarUrl: buildAvatarUrl(user.avatarPath),
      level: summary.level,
      xp: summary.xp,
      currentStreak: summary.currentStreak,
      achievements,
      profitabilityPct,
      window,
    }
  }
}
