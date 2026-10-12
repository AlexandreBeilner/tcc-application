import { EMAIL_TOKEN_TTL_MS } from '../../domain/emailToken'
import { isEmailVerified, type User } from '../../domain/user'
import type { AuthEmailTokenRepository } from '../ports/authEmailTokenRepository'
import type { AuthMailer } from '../ports/authMailer'
import type { EmailTokenGenerator } from '../ports/emailTokenGenerator'
import type { UserRepository } from '../ports/userRepository'

export interface ResendEmailVerificationInput {
  email: string
}

// Gera o link de verificação (24 h, uso único; pedir outro anula o anterior) e enfileira o
// e-mail. Serve ao cadastro (`sendToUser`) e ao reenvio pedido na tela de login (`execute`), que
// nunca diz se o e-mail existe nem se já foi verificado: devolve sempre `void` e a rota responde
// 202 igual (mesmo princípio do "esqueci minha senha"). O teto de reenvios é da borda HTTP.
export class SendEmailVerificationUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokens: AuthEmailTokenRepository,
    private readonly tokenGenerator: EmailTokenGenerator,
    private readonly mailer: AuthMailer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ResendEmailVerificationInput): Promise<void> {
    const user = await this.userRepository.findByEmail(input.email)
    if (!user || user.status === 'suspended') return
    await this.sendToUser(user)
  }

  async sendToUser(user: User): Promise<void> {
    if (isEmailVerified(user)) return

    const now = this.now()
    const { token, tokenHash } = this.tokenGenerator.generate()
    const expiresAt = new Date(now.getTime() + EMAIL_TOKEN_TTL_MS.email_verification)
    const { id: tokenId } = await this.tokens.replaceActive(
      { userId: user.id, kind: 'email_verification', tokenHash, expiresAt },
      now,
    )
    await this.mailer.sendEmailVerification({
      userId: user.id,
      to: user.email,
      name: user.name,
      token,
      tokenId,
      expiresAt,
    })
  }
}
