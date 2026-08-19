import { EmailAlreadyInUseError, UsernameAlreadyInUseError } from '../../domain/errors'
import type { User } from '../../domain/user'
import type { PasswordHasher } from '../ports/passwordHasher'
import type { TokenIssuer } from '../ports/tokenIssuer'
import type { UserRepository } from '../ports/userRepository'

export interface RegisterUserInput {
  name: string
  email: string
  username: string
  password: string
}

export interface RegisterUserResult {
  user: User
  token: string
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    if (await this.userRepository.findByEmail(input.email)) {
      throw new EmailAlreadyInUseError('e-mail já cadastrado')
    }
    if (await this.userRepository.findByUsername(input.username)) {
      throw new UsernameAlreadyInUseError('username já em uso')
    }

    const passwordHash = await this.passwordHasher.hash(input.password)
    // `role` nunca é definido aqui — autocadastro sempre cria usuário comum
    // (RNF07); `role: 'admin'` só existe via src/db/seed.ts.
    const user = await this.userRepository.createUser({
      name: input.name,
      email: input.email,
      username: input.username,
      passwordHash,
    })

    const token = this.tokenIssuer.issue({ sub: user.id, role: user.role })
    return { user, token }
  }
}
