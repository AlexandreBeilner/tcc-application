import { createBcryptPasswordHasher } from '../modules/auth/infrastructure/security/bcryptPasswordHasher'
import { createDrizzleUserRepository } from '../modules/auth/infrastructure/persistence/drizzleUserRepository'
import { createDb } from './client'

// Único jeito de criar um usuário `admin` — nunca por autocadastro (RNF07,
// CLAUDE.md). Rodar com:
//   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed:admin
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Administrador'
  const username = process.env.ADMIN_USERNAME ?? 'admin'

  if (!databaseUrl || !email || !password) {
    console.error('defina DATABASE_URL, ADMIN_EMAIL e ADMIN_PASSWORD antes de rodar o seed')
    process.exit(1)
  }

  const repository = createDrizzleUserRepository(createDb(databaseUrl))

  const existing = await repository.findByEmail(email)
  if (existing) {
    console.log(`usuário ${email} já existe (role atual: ${existing.role}) — nada a fazer`)
    process.exit(0)
  }

  const passwordHash = await createBcryptPasswordHasher().hash(password)
  const admin = await repository.createUser({ name, email, username, passwordHash, role: 'admin' })
  console.log(`usuário admin criado: ${admin.email} (id ${admin.id})`)
  process.exit(0)
}

main().catch((err) => {
  console.error('erro ao rodar seed de admin:', err)
  process.exit(1)
})
