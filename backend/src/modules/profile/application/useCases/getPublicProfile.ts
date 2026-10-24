import {
  NO_COSMETICS,
  type CosmeticsReader,
  type PublicCosmetics,
} from '../../../../shared/publicCosmetics'
import { buildAvatarUrl } from '../../../../shared/avatarUrl'
import { UserNotFoundError } from '../../domain/errors'
import type { AchievementsReader, UnlockedAchievementSummary } from '../ports/achievementsReader'
import type { GamificationReader } from '../ports/gamificationReader'
import type { ProfileWindow, ProfitabilityReader } from '../ports/profitabilityReader'
import type { TrackCompletionReader } from '../ports/trackCompletionReader'
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
  // Trilhas totalmente concluídas (backlog de engajamento F.2, sala de
  // troféus do Perfil) — só o número da trilha, nunca patrimônio (RNF09
  // continua estrutural: este campo não expõe nenhum valor monetário).
  completedTracks: number[]
  // Códigos das lições concluídas (LJ.5.9): o cliente cruza com o glossário pra mostrar as cartas de termo ganhas.
  // Só progresso de estudo, nunca patrimônio (RNF09).
  completedLessonCodes: string[]
  // Moldura e título (MO.5.1), só apresentação.
  cosmetics: PublicCosmetics
}

export class GetPublicProfileUseCase {
  constructor(
    private readonly userDirectory: UserDirectory,
    private readonly gamificationReader: GamificationReader,
    private readonly achievementsReader: AchievementsReader,
    private readonly profitabilityReader: ProfitabilityReader,
    private readonly trackCompletionReader: TrackCompletionReader,
    private readonly cosmeticsReader?: CosmeticsReader,
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

    const [
      summary,
      achievements,
      profitabilityPct,
      completedTracks,
      completedLessonCodes,
      displays,
    ] = await Promise.all([
      this.gamificationReader.getSummary(input.userId),
      this.achievementsReader.listUnlocked(input.userId),
      this.profitabilityReader.getProfitabilityPct(input.userId, window, user.createdAt),
      this.trackCompletionReader.listCompleted(input.userId),
      this.trackCompletionReader.listCompletedLessonCodes(input.userId),
      this.cosmeticsReader?.findDisplays([input.userId]),
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
      completedTracks,
      completedLessonCodes,
      cosmetics: displays?.get(input.userId) ?? NO_COSMETICS,
    }
  }
}
