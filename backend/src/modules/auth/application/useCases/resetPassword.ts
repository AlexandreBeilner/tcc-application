import { InvalidEmailTokenError } from '../../domain/errors'
import { emailTokenProblem } from '../../domain/emailToken'
import type { AuthEmailTokenRepository } from '../ports/authEmailTokenRepository'
import type { AuthMailer } from '../ports/authMailer'
import type { EmailTokenGenerator } from '../ports/emailTokenGenerator'
import type { PasswordHasher } from '../ports/passwordHasher'
import type { UserRepository } from '../ports/userRepository'

export interface ResetPasswordInput {
  token: string
  newPassword: string
}

// Conclui a redefinição: o token é de uso único, vale 30 minutos, grava a senha nova, marca o
// e-mail como verificado, encerra todas as sessões abertas (`revokeSessions`) e avisa por e-mail (E4). Conta sem senha local
// (só Google) ganha aqui a primeira senha (D4).
export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokens: AuthEmailTokenRepository,
    private readonly tokenGenerator: EmailTokenGenerator,
    private readonly passwordHasher: PasswordHasher,
    private readonly mailer: AuthMailer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const now = this.now()
    const record = await this.tokens.findByHash(
      this.tokenGenerator.hash(input.token),
      'password_reset',
    )
    if (!record) throw new InvalidEmailTokenError('invalid')
    const problem = emailTokenProblem(record, now)
    if (problem) throw new InvalidEmailTokenError(problem)

    const user = await this.userRepository.findById(record.userId)
    // Admin nunca tem token (o pedido é negado), mas a regra vale também aqui (D7).
    if (!user || user.role === 'admin') throw new InvalidEmailTokenError('invalid')

    const passwordHash = await this.passwordHasher.hash(input.newPassword)
    // Consome antes de gravar: duas requisições simultâneas com o mesmo link, só uma passa.
    if (!(await this.tokens.markUsed(record.id, now))) throw new InvalidEmailTokenError('used')

    // Quem leu o link provou controlar a caixa de e-mail: a conta também fica verificada.
    await this.userRepository.updateUser(user.id, {
      passwordHash,
      ...(user.emailVerifiedAt === null && { emailVerifiedAt: now }),
    })
    await this.userRepository.revokeSessions(user.id)

    // A senha já mudou: falha em enfileirar o aviso não pode desfazer nem derrubar o reset.
    try {
      await this.mailer.sendPasswordChanged({
        userId: user.id,
        to: user.email,
        name: user.name,
        eventId: record.id,
      })
    } catch (err) {
      console.error('[auth] falha ao enfileirar o aviso de senha alterada', err)
    }
  }
}
