import { describe, expect, it } from 'vitest'
import { createFakeAchievementsExporter } from '../../../auth/test/fakes/fakeAchievementsExporter'
import { createFakeFriendshipsExporter } from '../../../auth/test/fakes/fakeFriendshipsExporter'
import { createFakeProgressionExporter } from '../../../auth/test/fakes/fakeProgressionExporter'
import { createFakeUserRepository } from '../../../auth/test/fakes/fakeUserRepository'
import { AdminUserNotFoundError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeOrderAdmin } from '../../test/fakes/fakeOrderAdmin'
import {
  createFakeUserPortfolioReader,
  samplePortfolio,
} from '../../test/fakes/fakeUserPortfolioReader'
import { GetAdminUserDetailUseCase } from './getAdminUserDetail'

async function build() {
  const userRepository = createFakeUserRepository()
  const user = await userRepository.createUser({
    name: 'Fulano',
    email: 'fulano@example.com',
    username: 'fulano',
    passwordHash: 'x',
  })
  await userRepository.createIdentity({
    userId: user.id,
    providerName: 'google',
    providerAccountId: 'g-1',
  })
  const auditLog = createFakeAuditLogRepository()
  const portfolioReader = createFakeUserPortfolioReader()
  const orderAdmin = createFakeOrderAdmin()
  const useCase = new GetAdminUserDetailUseCase(
    userRepository,
    createFakeProgressionExporter(),
    createFakeAchievementsExporter(),
    createFakeFriendshipsExporter(),
    portfolioReader,
    orderAdmin,
    auditLog,
  )
  return { useCase, user, auditLog, portfolioReader, orderAdmin }
}

describe('GetAdminUserDetailUseCase', () => {
  it('reúne conta, provedores, progressão, carteira, ordens abertas e linha do tempo', async () => {
    const { useCase, user, auditLog, orderAdmin } = await build()
    await auditLog.append({
      adminId: 'admin-1',
      action: 'user.force_logout',
      targetType: 'user',
      targetId: user.id,
      payload: {},
      result: 'success',
    })
    await auditLog.append({
      adminId: 'admin-1',
      action: 'user.suspend',
      targetType: 'user',
      targetId: 'outro-usuario',
      payload: {},
      result: 'success',
    })

    const detail = await useCase.execute(user.id)

    expect(detail.account).toMatchObject({ id: user.id, username: 'fulano', status: 'active' })
    expect(detail.account.providers).toEqual(['password', 'google'])
    expect(detail.portfolio).toEqual(samplePortfolio)
    expect(detail.openOrders?.total).toBe(1)
    expect(orderAdmin.listQueries[0]).toMatchObject({ user_id: user.id, status: 'open' })
    expect(detail.timeline.map((e) => e.action)).toEqual(['user.force_logout'])
    expect(typeof detail.progression.level).toBe('number')
  })

  it('devolve portfolio e ordens nulos quando o motor falha, sem derrubar o detalhe', async () => {
    const { useCase, user, portfolioReader, orderAdmin } = await build()
    portfolioReader.error = new Error('motor fora')
    orderAdmin.errorToThrow = new Error('motor fora')

    const detail = await useCase.execute(user.id)

    expect(detail.portfolio).toBeNull()
    expect(detail.openOrders).toBeNull()
    expect(detail.account.id).toBe(user.id)
  })

  it('falha com usuário inexistente', async () => {
    const { useCase } = await build()
    await expect(useCase.execute('nao-existe')).rejects.toBeInstanceOf(AdminUserNotFoundError)
  })
})
