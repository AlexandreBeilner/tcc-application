import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { createDrizzleUserRepository } from './modules/auth/infrastructure/persistence/drizzleUserRepository'

const port = Number(process.env.PORT) || 3000

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    await runMigrations(databaseUrl)
    console.log('migrations do banco gamification aplicadas')
  }

  const userRepository = createDrizzleUserRepository(
    createDb(databaseUrl ?? 'postgres://unconfigured'),
  )

  createApp({ userRepository }).listen(port, () => {
    console.log(`backend gamificado escutando na porta ${port}`)
  })
}

main().catch((err) => {
  console.error('erro ao iniciar o backend gamificado:', err)
  process.exit(1)
})
