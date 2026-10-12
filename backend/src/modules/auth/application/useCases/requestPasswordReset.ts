import { EMAIL_TOKEN_TTL_MS } from '../../domain/emailToken'
import type { AdminSessionAuditor } from '../ports/adminSessionAuditor'
import type { AuthEmailTokenRepository } from '../ports/authEmailTokenRepository'
import type { AuthMailer } from '../ports/authMailer'
import type { EmailTokenGenerator } from '../ports/emailTokenGenerator'
import type { UserRepository } from '../ports/userRepository'

export interface RequestPasswordResetInput {
  email: string
}

// Pedido de "esqueci minha senha". Nunca diz se o e-mail existe: o caso de uso devolve sempre
// `void` e a rota responde 202 igual (plano 4.4). Conta só-Google recebe o mesmo link e cria a
// primeira senha (D4). Conta admin não redefine por e-mail: nada é enviado e a tentativa vai
// para o log de auditoria (D7).
export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokens: AuthEmailTokenRepository,
    private readonly tokenGenerator: EmailTokenGenerator,
    private readonly mailer: AuthMailer,
    private readonly sessionAuditor?: AdminSessionAuditor,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const user = await this.userRepository.findByEmail(input.email)
    if (!user) return

    if (user.role === 'admin') {
      await this.sessionAuditor?.record({ adminId: user.id, kind: 'password_reset_denied' })
      return
    }

    const now = this.now()
    const { token, tokenHash } = this.tokenGenerator.generate()
    const expiresAt = new Date(now.getTime() + EMAIL_TOKEN_TTL_MS.password_reset)
    const { id: tokenId } = await this.tokens.replaceActive(
      { userId: user.id, kind: 'password_reset', tokenHash, expiresAt },
      now,
    )
    await this.mailer.sendPasswordReset({
      userId: user.id,
      to: user.email,
      name: user.name,
      token,
      tokenId,
      expiresAt,
    })
  }
}
