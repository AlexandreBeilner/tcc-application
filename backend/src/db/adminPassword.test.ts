import { describe, expect, it, vi } from 'vitest'
import {
  AdminPasswordUnavailableError,
  resolveAdminPassword,
  type AdminPasswordDeps,
} from './adminPassword'

function deps(overrides: Partial<AdminPasswordDeps> = {}): AdminPasswordDeps {
  return {
    env: {},
    readFile: vi.fn(async () => 'do-arquivo\n'),
    isTty: false,
    promptHidden: vi.fn(async () => 'digitada'),
    readStdin: vi.fn(async () => 'do-pipe\n'),
    ...overrides,
  }
}

describe('resolveAdminPassword', () => {
  it('prefere o arquivo e tira a quebra de linha do fim', async () => {
    const d = deps({ env: { ADMIN_PASSWORD_FILE: '/run/senha', ADMIN_PASSWORD: 'ignorada' } })
    expect(await resolveAdminPassword(d)).toBe('do-arquivo')
    expect(d.readFile).toHaveBeenCalledWith('/run/senha')
  })

  it('arquivo vazio é recusado', async () => {
    const d = deps({ env: { ADMIN_PASSWORD_FILE: '/run/senha' }, readFile: async () => '\n' })
    await expect(resolveAdminPassword(d)).rejects.toThrow(AdminPasswordUnavailableError)
  })

  it('ADMIN_PASSWORD vale em desenvolvimento', async () => {
    expect(await resolveAdminPassword(deps({ env: { ADMIN_PASSWORD: 'dev-senha' } }))).toBe(
      'dev-senha',
    )
  })

  it('ADMIN_PASSWORD é recusada em produção, sem cair nas outras origens', async () => {
    const d = deps({ env: { ADMIN_PASSWORD: 'x', NODE_ENV: 'production' }, isTty: true })
    await expect(resolveAdminPassword(d)).rejects.toThrow(AdminPasswordUnavailableError)
    expect(d.promptHidden).not.toHaveBeenCalled()
  })

  it('em terminal pergunta sem mostrar a digitação', async () => {
    const d = deps({ isTty: true })
    expect(await resolveAdminPassword(d)).toBe('digitada')
    expect(d.readStdin).not.toHaveBeenCalled()
  })

  it('sem terminal lê da entrada padrão', async () => {
    const d = deps()
    expect(await resolveAdminPassword(d)).toBe('do-pipe')
    expect(d.promptHidden).not.toHaveBeenCalled()
  })

  it('senha vazia vinda do pipe ou do terminal é recusada', async () => {
    await expect(resolveAdminPassword(deps({ readStdin: async () => '\n' }))).rejects.toThrow(
      AdminPasswordUnavailableError,
    )
    await expect(
      resolveAdminPassword(deps({ isTty: true, promptHidden: async () => '' })),
    ).rejects.toThrow(AdminPasswordUnavailableError)
  })
})
