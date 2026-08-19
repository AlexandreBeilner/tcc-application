import { createApp } from './app'
import { runMigrations } from './db/migrate'

const port = Number(process.env.PORT) || 3000

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    await runMigrations(databaseUrl)
    console.log('migrations do banco gamification aplicadas')
  }

  createApp().listen(port, () => {
    console.log(`backend gamificado escutando na porta ${port}`)
  })
}

main().catch((err) => {
  console.error('erro ao iniciar o backend gamificado:', err)
  process.exit(1)
})
