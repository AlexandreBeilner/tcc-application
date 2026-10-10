import { emailTokenProblem } from '../../domain/emailToken'
import { InvalidEmailTokenError } from '../../domain/errors'
import type { AuthEmailTokenRepository } from '../ports/authEmailTokenRepository'
import type { EmailTokenGenerator } from '../ports/emailTokenGenerator'
import type { UserRepository } from '../ports/userRepository'

export interface VerifyEmailInput {
  token: string
}

// Consome o link de verificação: marca `email_verified_at` e deixa a conta entrar. O token vale
// 24 h e é de uso único. Não devolve sessão: depois de verificar, a pessoa entra pelo login
// normal (quem abre o link em outro aparelho não ganha sessão por ele).
export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokens: AuthEmailTokenRepository,
    private readonly tokenGenerator: EmailTokenGenerator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: VerifyEmailInput): Promise<void> {
    const now = this.now()
    const record = await this.tokens.findByHash(
      this.tokenGenerator.hash(input.token),
      'email_verification',
    )
    if (!record) throw new InvalidEmailTokenError('invalid')
    const problem = emailTokenProblem(record, now)
    if (problem) throw new InvalidEmailTokenError(problem)

    const user = await this.userRepository.findById(record.userId)
    if (!user) throw new InvalidEmailTokenError('invalid')

    // Consome antes de gravar: dois cliques simultâneos no mesmo link, só um passa.
    if (!(await this.tokens.markUsed(record.id, now))) throw new InvalidEmailTokenError('used')

    if (user.emailVerifiedAt === null) {
      await this.userRepository.updateUser(user.id, { emailVerifiedAt: now })
    }
  }
}
