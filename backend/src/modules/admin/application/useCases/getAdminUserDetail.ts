import type { AchievementsExporter } from '../../../auth/application/ports/achievementsExporter'
import type { FriendshipsExporter } from '../../../auth/application/ports/friendshipsExporter'
import type {
  ExportedProgression,
  ProgressionExporter,
} from '../../../auth/application/ports/progressionExporter'
import type { UserRepository } from '../../../auth/application/ports/userRepository'
import { hasLocalPassword } from '../../../auth/domain/user'
import type { UserRole, UserStatus } from '../../../auth/domain/user'
import type { AdminAuditEntry } from '../../domain/auditEntry'
import { AdminUserNotFoundError } from '../../domain/errors'
import type { AuditLogRepository } from '../ports/auditLogRepository'
import type { AdminOrder, OrderAdmin } from '../ports/orderAdmin'
import type { UserPortfolio, UserPortfolioReader } from '../ports/userPortfolioReader'

export const DETAIL_OPEN_ORDERS_LIMIT = 10
export const DETAIL_TIMELINE_LIMIT = 20

export interface AdminUserDetail {
  account: {
    id: string
    name: string
    email: string
    username: string
    role: UserRole
    status: UserStatus
    suspendedReason: string | null
    suspendedAt: Date | null
    onboardingCompleted: boolean
    providers: string[]
    createdAt: Date
  }
  progression: ExportedProgression
  achievementsCount: number
  friendsCount: number
  // `null` quando o motor não respondeu: o resto do detalhe continua útil.
  portfolio: UserPortfolio | null
  openOrders: { total: number; orders: AdminOrder[] } | null
  // Ações do painel sobre esta conta, mais recentes primeiro (inclui as da N.17).
  timeline: AdminAuditEntry[]
}

// Detalhe de um usuário pro painel (N.16). Reaproveita as portas de exportação
// do módulo `auth` (progressão, conquistas, amizades) em vez de abrir um
// segundo caminho de leitura nessas tabelas. O patrimônio absoluto é exposto de
// propósito: a RNF09 vale entre usuários, não pro administrador (CLAUDE.md), e
// a leitura não é auditada.
export class GetAdminUserDetailUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly progressionExporter: ProgressionExporter,
    private readonly achievementsExporter: AchievementsExporter,
    private readonly friendshipsExporter: FriendshipsExporter,
    private readonly portfolioReader: UserPortfolioReader,
    private readonly orderAdmin: OrderAdmin,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async execute(userId: string): Promise<AdminUserDetail> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new AdminUserNotFoundError('usuário não encontrado')
    }

    const [identities, progression, achievements, friendships, portfolio, openOrders, timeline] =
      await Promise.all([
        this.userRepository.listIdentitiesForUser(userId),
        this.progressionExporter.exportForUser(userId),
        this.achievementsExporter.exportForUser(userId),
        this.friendshipsExporter.exportForUser(userId),
        this.portfolioReader.read(userId).catch(() => null),
        this.orderAdmin
          .list({ user_id: userId, status: 'open', limit: DETAIL_OPEN_ORDERS_LIMIT })
          .then((result) => ({ total: result.total, orders: result.orders }))
          .catch(() => null),
        this.auditLog.list({
          targetType: 'user',
          targetId: userId,
          limit: DETAIL_TIMELINE_LIMIT,
          offset: 0,
        }),
      ])

    const providers = identities.map((identity) => identity.providerName)
    if (hasLocalPassword(user)) providers.unshift('password')

    return {
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        suspendedReason: user.suspendedReason,
        suspendedAt: user.suspendedAt,
        onboardingCompleted: user.onboardingCompleted,
        providers,
        createdAt: user.createdAt,
      },
      progression,
      achievementsCount: achievements.length,
      friendsCount: friendships.filter((friendship) => friendship.status === 'accepted').length,
      portfolio,
      openOrders,
      timeline: timeline.entries,
    }
  }
}
