import { InvalidCredentialsError, UserNotFoundError } from '../../domain/errors'
import type { AdminSessionAuditor } from '../ports/adminSessionAuditor'
import type { PasswordHasher } from '../ports/passwordHasher'
import type { TokenIssuer } from '../ports/tokenIssuer'
import type { UserRepository } from '../ports/userRepository'

export interface ReauthenticateInput {
  userId: string
  password: string
}

// Reautenticação (N.22): confere a senha de quem já está logado e devolve um
// token novo com `authTime` fresco, que libera as ações destrutivas do painel
// por mais alguns minutos. Conta sem senha local (só OAuth) não consegue —
// administrador é sempre criado por seed com senha.
export class ReauthenticateUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
    private readonly sessionAuditor?: AdminSessionAuditor,
  ) {}

  async execute(input: ReauthenticateInput): Promise<{ token: string }> {
    const user = await this.userRepository.findById(input.userId)
    if (!user) {
      throw new UserNotFoundError('usuário não encontrado')
    }

    const valid =
      user.passwordHash !== null &&
      (await this.passwordHasher.verify(input.password, user.passwordHash))
    if (!valid) {
      if (user.role === 'admin') {
        await this.sessionAuditor?.record({ adminId: user.id, kind: 'reauth_failed' })
      }
      throw new InvalidCredentialsError('senha incorreta')
    }

    if (user.role === 'admin') {
      await this.sessionAuditor?.record({ adminId: user.id, kind: 'reauth' })
    }
    return { token: this.tokenIssuer.issue({ sub: user.id, role: user.role }) }
  }
}
