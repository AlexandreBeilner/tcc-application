import type { User, UserRole } from '../../domain/user'

export interface NewUserInput {
  name: string
  email: string
  username: string
  passwordHash: string | null
  // Só o script de seed (src/db/seed.ts) passa `role: 'admin'` — os casos de
  // uso de autocadastro (RegisterUserUseCase, LoginWithGoogleUseCase) nunca
  // definem esse campo (RNF07).
  role?: UserRole
}

export interface IdentityRecord {
  id: string
  userId: string
  providerName: string
  providerAccountId: string
}

export interface NewIdentityInput {
  userId: string
  providerName: string
  providerAccountId: string
}

// `undefined` num campo = não altera; `null` só é válido pra `passwordHash`
// (setar/limpar a senha local) — os demais campos nunca aceitam null (mesmas
// colunas `NOT NULL` de `users`).
export interface UpdateUserInput {
  name?: string
  email?: string
  username?: string
  passwordHash?: string | null
  onboardingCompleted?: boolean
  // `null` limpa o avatar (não usado nesta sessão — 6.10.8 cobre só upload,
  // sem remoção); `UploadAvatarUseCase` sempre passa uma string nova.
  avatarPath?: string | null
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | undefined>
  findByUsername(username: string): Promise<User | undefined>
  findById(id: string): Promise<User | undefined>
  createUser(input: NewUserInput): Promise<User>
  updateUser(id: string, input: UpdateUserInput): Promise<User>
  findIdentity(providerName: string, providerAccountId: string): Promise<IdentityRecord | undefined>
  createIdentity(input: NewIdentityInput): Promise<IdentityRecord>
  // Sem tokens — usada por GET /me/identities (RNF04) e pela exportação de
  // dados (ExportUserDataUseCase).
  listIdentitiesForUser(userId: string): Promise<IdentityRecord[]>
  // Usada só por AnonymizeAccountUseCase — "excluir conta" (tela 9.3) tira
  // todos os provedores conectados, não desconecta um por vez.
  deleteIdentitiesForUser(userId: string): Promise<void>
}
