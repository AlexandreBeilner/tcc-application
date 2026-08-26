import { UserNotFoundError } from '../../domain/errors'
import type { UserRole } from '../../domain/user'
import type { AchievementsExporter, ExportedAchievement } from '../ports/achievementsExporter'
import type { ExportedFriendship, FriendshipsExporter } from '../ports/friendshipsExporter'
import type {
  ExportedLessonProgress,
  LessonProgressExporter,
} from '../ports/lessonProgressExporter'
import type {
  ExportedMissionProgress,
  MissionProgressExporter,
} from '../ports/missionProgressExporter'
import type { ExportedProgression, ProgressionExporter } from '../ports/progressionExporter'
import type { IdentityRecord, UserRepository } from '../ports/userRepository'

export interface ExportUserDataInput {
  userId: string
}

export interface ExportedUserData {
  user: {
    id: string
    name: string
    email: string
    username: string
    role: UserRole
    createdAt: Date
  }
  identities: IdentityRecord[]
  progression: ExportedProgression
  lessonProgress: ExportedLessonProgress[]
  achievements: ExportedAchievement[]
  friendships: ExportedFriendship[]
  missionProgress: ExportedMissionProgress[]
}

// Portabilidade (RNF04) — agrega em JSON os dados do próprio usuário nas
// tabelas que o backend já possui. Nunca `password_hash` (nem em `user`,
// que só devolve os campos públicos), nunca tokens de identidade (ver
// `UserRepository.listIdentitiesForUser`). Dados financeiros (saldo/
// posições/extrato, banco `market`) ficam fora desta tarefa — exigiria uma
// nova chamada ao motor sem nenhum critério de aceite pedindo isso
// explicitamente; decisão de escopo a revisitar se a intenção pedagógica
// exigir o extrato completo na exportação.
export class ExportUserDataUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly progressionExporter: ProgressionExporter,
    private readonly lessonProgressExporter: LessonProgressExporter,
    private readonly achievementsExporter: AchievementsExporter,
    private readonly friendshipsExporter: FriendshipsExporter,
    private readonly missionProgressExporter: MissionProgressExporter,
  ) {}

  async execute(input: ExportUserDataInput): Promise<ExportedUserData> {
    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    const [identities, progression, lessonProgress, achievements, friendships, missionProgress] =
      await Promise.all([
        this.userRepository.listIdentitiesForUser(input.userId),
        this.progressionExporter.exportForUser(input.userId),
        this.lessonProgressExporter.exportForUser(input.userId),
        this.achievementsExporter.exportForUser(input.userId),
        this.friendshipsExporter.exportForUser(input.userId),
        this.missionProgressExporter.exportForUser(input.userId),
      ])

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      },
      identities,
      progression,
      lessonProgress,
      achievements,
      friendships,
      missionProgress,
    }
  }
}
