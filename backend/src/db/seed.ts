import { createBcryptPasswordHasher } from '../modules/auth/infrastructure/security/bcryptPasswordHasher'
import { createDrizzleUserRepository } from '../modules/auth/infrastructure/persistence/drizzleUserRepository'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { createDb } from './client'
import { AdminPasswordUnavailableError, resolveAdminPassword } from './adminPassword'

// Pergunta no terminal sem repetir o que se digita (a saída do eco fica muda).
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const write = (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput
    ;(rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = (text) => {
      if (text.startsWith(question)) write.call(rl, text)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

// Único jeito de criar um usuário `admin` — nunca por autocadastro (RNF07,
// CLAUDE.md). Desenvolvimento:
//   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed:admin
// Produção (dentro da imagem, sem `tsx`): senha por arquivo (ADMIN_PASSWORD_FILE), digitada no
// terminal ou por pipe, nunca na linha de comando. Ver `adminPassword.ts` e o runbook de seeds.
//   docker compose exec -it backend node dist/db/seed.js
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const email = process.env.ADMIN_EMAIL
  const name = process.env.ADMIN_NAME ?? 'Administrador'
  const username = process.env.ADMIN_USERNAME ?? 'admin'

  if (!databaseUrl || !email) {
    console.error('defina DATABASE_URL e ADMIN_EMAIL antes de rodar o seed')
    process.exit(1)
  }

  const repository = createDrizzleUserRepository(createDb(databaseUrl))

  const existing = await repository.findByEmail(email)
  if (existing) {
    console.log(`usuário ${email} já existe (role atual: ${existing.role}) — nada a fazer`)
    process.exit(0)
  }

  const password = await resolveAdminPassword({
    env: process.env,
    readFile: (path) => readFile(path, 'utf8'),
    isTty: Boolean(process.stdin.isTTY),
    promptHidden,
    readStdin,
  })
  const passwordHash = await createBcryptPasswordHasher().hash(password)
  const admin = await repository.createUser({
    name,
    email,
    username,
    passwordHash,
    role: 'admin',
    emailVerified: true,
  })
  console.log(`usuário admin criado: ${admin.email} (id ${admin.id})`)
  process.exit(0)
}

main().catch((err) => {
  if (err instanceof AdminPasswordUnavailableError) {
    console.error(err.message)
    process.exit(1)
  }
  console.error('erro ao rodar seed de admin:', err)
  process.exit(1)
})
