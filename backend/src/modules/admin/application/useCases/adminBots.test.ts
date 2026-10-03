import { describe, expect, it } from 'vitest'
import { BotConflictError, BotRejectedError } from '../../domain/errors'
import { createFakeAuditLogRepository } from '../../test/fakes/fakeAuditLogRepository'
import { createFakeBotAdmin } from '../../test/fakes/fakeBotAdmin'
import { CreateAdminBotUseCase } from './createAdminBot'
import { FundAdminBotUseCase } from './fundAdminBot'
import { GetAdminBotActivityUseCase } from './getAdminBotActivity'
import { GetAdminBotsSummaryUseCase } from './getAdminBotsSummary'
import { ListAdminBotsUseCase } from './listAdminBots'
import { RecordAdminActionUseCase } from './recordAdminAction'
import { UpdateAdminBotUseCase } from './updateAdminBot'

function build() {
  const botAdmin = createFakeBotAdmin()
  const auditLog = createFakeAuditLogRepository()
  const record = new RecordAdminActionUseCase(auditLog)
  return {
    botAdmin,
    auditLog,
    list: new ListAdminBotsUseCase(botAdmin),
    create: new CreateAdminBotUseCase(botAdmin, record),
    update: new UpdateAdminBotUseCase(botAdmin, record),
    fund: new FundAdminBotUseCase(botAdmin, record),
  }
}

const createInput = {
  archetype: 'chartista' as const,
  sectors: ['Varejo'],
  riskClasses: [],
  assetClasses: ['fii'],
  withinScopePct: 0.9,
  maxPositionSizePct: 0.3,
  marketOrderPreference: 0.4,
  spreadWidthPct: 0.02,
  initialCash: 25000,
}

describe('ListAdminBotsUseCase', () => {
  it('devolve os bots e os ativos sem cobertura do motor, sem auditar', async () => {
    const { list, auditLog } = build()
    const listing = await list.execute()
    expect(listing.bots).toHaveLength(1)
    expect(listing.uncovered_assets).toEqual([{ asset_id: 'asset-2', ticker: 'BBB3' }])
    expect(auditLog.entries).toHaveLength(0)
  })
})

describe('CreateAdminBotUseCase', () => {
  it('cria no motor e audita bot.create com o id do bot criado', async () => {
    const { create, botAdmin, auditLog } = build()

    const bot = await create.execute('admin-1', createInput)

    expect(botAdmin.created).toEqual([createInput])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'bot.create',
      targetType: 'bot',
      targetId: bot.account_id,
      result: 'success',
      payload: {
        archetype: 'chartista',
        sectors: ['Varejo'],
        asset_classes: ['fii'],
        initial_cash: 25000,
      },
    })
  })

  it('motor recusa a personalidade: propaga o erro e audita como falha', async () => {
    const { create, botAdmin, auditLog } = build()
    botAdmin.errorToThrow = new BotRejectedError('largura de spread acima do teto')

    await expect(create.execute('admin-1', createInput)).rejects.toThrow(BotRejectedError)
    expect(auditLog.entries[0]).toMatchObject({
      action: 'bot.create',
      result: 'failed',
      errorMessage: 'largura de spread acima do teto',
    })
  })
})

describe('UpdateAdminBotUseCase', () => {
  it('altera no motor e audita só os campos pedidos', async () => {
    const { update, botAdmin, auditLog } = build()

    const bot = await update.execute('admin-1', 'bot-1', { isActive: false })

    expect(bot.is_active).toBe(false)
    expect(botAdmin.updated).toEqual([{ botId: 'bot-1', input: { isActive: false } }])
    expect(auditLog.entries[0]).toMatchObject({
      action: 'bot.update',
      targetType: 'bot',
      targetId: 'bot-1',
      result: 'success',
      payload: { is_active: false },
    })
    expect(auditLog.entries[0].payload).not.toHaveProperty('covered_asset_ids')
  })

  it('reatribuição de cobertura audita o conjunto final de ativos', async () => {
    const { update, auditLog } = build()
    await update.execute('admin-1', 'bot-1', { maxCoveredAssets: 5, coveredAssetIds: ['a', 'b'] })
    expect(auditLog.entries[0].payload).toEqual({
      max_covered_assets: 5,
      covered_asset_ids: ['a', 'b'],
    })
  })

  it('ativo já coberto por outro Market Maker: propaga e audita a falha', async () => {
    const { update, botAdmin, auditLog } = build()
    botAdmin.errorToThrow = new BotConflictError('o ativo já é coberto por outro Market Maker')

    await expect(update.execute('admin-1', 'bot-1', { coveredAssetIds: ['a'] })).rejects.toThrow(
      BotConflictError,
    )
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.update', result: 'failed' })
  })
})

describe('UpdateAdminBotUseCase, personalidade (N.15)', () => {
  it('audita só os campos de personalidade pedidos, em snake_case', async () => {
    const { update, botAdmin, auditLog } = build()
    await update.execute('admin-1', 'bot-1', {
      spreadWidthPct: 0.03,
      maxPositionSizePct: 0.2,
      sectors: ['Varejo'],
      knowledgeLevel: 0.8,
    })
    expect(botAdmin.updated[0].input).toMatchObject({ spreadWidthPct: 0.03, sectors: ['Varejo'] })
    expect(auditLog.entries[0]).toMatchObject({
      action: 'bot.update',
      result: 'success',
      payload: {
        spread_width_pct: 0.03,
        max_position_size_pct: 0.2,
        sectors: ['Varejo'],
        knowledge_level: 0.8,
      },
    })
    expect(auditLog.entries[0].payload).not.toHaveProperty('is_active')
  })

  it('personalidade recusada pelo motor: propaga e audita a falha', async () => {
    const { update, botAdmin, auditLog } = build()
    botAdmin.errorToThrow = new BotRejectedError('largura de spread acima do teto')
    await expect(update.execute('admin-1', 'bot-1', { spreadWidthPct: 0.09 })).rejects.toThrow(
      BotRejectedError,
    )
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.update', result: 'failed' })
  })
})

describe('FundAdminBotUseCase (N.15)', () => {
  it('aporta no motor e audita bot.fund com o que foi pedido', async () => {
    const { fund, botAdmin, auditLog } = build()
    const bot = await fund.execute('admin-1', 'bot-1', {
      cash: 5000,
      holdings: [{ assetId: 'asset-1', quantity: 40 }],
    })
    expect(bot.cash).toBe(85000)
    expect(botAdmin.funded).toEqual([
      { botId: 'bot-1', input: { cash: 5000, holdings: [{ assetId: 'asset-1', quantity: 40 }] } },
    ])
    expect(auditLog.entries[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'bot.fund',
      targetType: 'bot',
      targetId: 'bot-1',
      result: 'success',
      payload: { cash: 5000, holdings: [{ asset_id: 'asset-1', quantity: 40 }] },
    })
  })

  it('só caixa não audita holdings', async () => {
    const { fund, auditLog } = build()
    await fund.execute('admin-1', 'bot-1', { cash: 100 })
    expect(auditLog.entries[0].payload).toEqual({ cash: 100 })
  })

  it('teto de float: propaga o 409 e audita a falha', async () => {
    const { fund, botAdmin, auditLog } = build()
    botAdmin.errorToThrow = new BotConflictError('a posição passaria do total de cotas')
    await expect(
      fund.execute('admin-1', 'bot-1', { holdings: [{ assetId: 'a', quantity: 1 }] }),
    ).rejects.toThrow(BotConflictError)
    expect(auditLog.entries[0]).toMatchObject({ action: 'bot.fund', result: 'failed' })
  })
})

describe('leituras de desempenho (N.14)', () => {
  it('atividade e resumo delegam ao motor sem auditar', async () => {
    const { botAdmin, auditLog } = build()
    const activity = await new GetAdminBotActivityUseCase(botAdmin).execute('bot-1', 7)
    const summary = await new GetAdminBotsSummaryUseCase(botAdmin).execute(5)
    expect(activity.account_id).toBe('bot-1')
    expect(summary.active_bots).toBe(5)
    expect(botAdmin.activityAsks).toEqual([{ botId: 'bot-1', days: 7 }])
    expect(botAdmin.summaryAsks).toEqual([5])
    expect(auditLog.entries).toHaveLength(0)
  })
})
