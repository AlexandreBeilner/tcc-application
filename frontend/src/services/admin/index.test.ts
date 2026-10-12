import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    downloadAdminExport,
    getIntegrityRun,
    startIntegrityCheck,
    createAnnouncement,
    endAnnouncement,
    listAdminAnnouncements,
    startMaintenance,
    updateAnnouncement,
    advanceTicks,
    getAdminBotActivity,
    getAdminBotsSummary,
    createAdminBot,
    fundAdminBot,
    listAdminBots,
    updateAdminBot,
    liftTradingHalt,
    cancelMacroEvent,
    getEngineSettings,
    createAgendaTemplate,
    getAdminAssembly,
    liftAssemblyPause,
    listAdminAssemblies,
    listAgendaTemplates,
    listAssemblyPauses,
    listAssemblySettings,
    pauseAssemblies,
    resetAssemblySetting,
    setAgendaTemplateActive,
    updateAgendaTemplate,
    updateAssemblySetting,
    listAdminCatalog,
    updateCatalogAsset,
    previewCatalogAsset,
    createCatalogAsset,
    getMacroEventDetail,
    listTradingHalts,
    resetEngineSetting,
    updateEngineSetting,
    pauseTrading,
    cancelAdminOrder,
    cancelAdminOrdersBatch,
    listAdminOrders,
    getAdminOverview,
    getMarketMonitorAsset,
    getScheduler,
    getSystemHealth,
    listAuditLog,
    listMacroEvents,
    listMarketMonitor,
    listTicks,
    pauseScheduler,
    resumeScheduler,
    triggerMacroEvent,
    triggerTick,
    adjustAdminUserXp,
    grantAdminUserAchievement,
    correctAdminUserLesson,
    creditAdminUser,
    getUserCorrectionContext,
    setAdminUserStreak,
    createAchievement,
    getAchievementCatalog,
    createAdminLesson,
    getAdminLesson,
    getAdminLessons,
    getLessonRevision,
    restoreLessonRevision,
    updateAdminLesson,
    getAdminRanking,
    getMissionCatalog,
    setLessonPublished,
    updateAchievement,
    updateMission,
} from '.'

function mockFetchOnce(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status, json: async () => body })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('services/admin', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('listMacroEvents sem parâmetros faz GET /admin/macro-events', async () => {
        const fetchMock = mockFetchOnce({ events: [], total_entries: 0 })
        await listMacroEvents('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/macro-events')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('listMacroEvents com limit/offset monta a query string', async () => {
        const fetchMock = mockFetchOnce({ events: [], total_entries: 0 })
        await listMacroEvents('token', 20, 40)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/macro-events?limit=20&offset=40')
    })

    it('triggerMacroEvent faz POST /admin/macro-events com o payload de template', async () => {
        const fetchMock = mockFetchOnce({ event: { id: 'e1' } }, 201)
        await triggerMacroEvent('token', { template_key: 'alta-minerio-ferro', targets: [{ sector: 'Mineração' }] })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/macro-events')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ template_key: 'alta-minerio-ferro', targets: [{ sector: 'Mineração' }] })
    })

    it('triggerMacroEvent faz POST /admin/macro-events com o payload avulso', async () => {
        const fetchMock = mockFetchOnce({ event: { id: 'e1' } }, 201)
        const input = {
            title: 'Título avulso',
            narrative: 'Narrativa avulsa',
            direction: 'negativo' as const,
            magnitude_band: 'leve' as const,
            affects_price: true,
            affects_fundamentals: false,
            targets: [{ asset_id: 'a1' }],
        }
        await triggerMacroEvent('token', input)
        const [, init] = fetchMock.mock.calls[0]
        expect(JSON.parse(init.body)).toEqual(input)
    })

    it('listAuditLog sem filtros faz GET /admin/audit-log', async () => {
        const fetchMock = mockFetchOnce({ entries: [], total_entries: 0 })
        await listAuditLog('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/audit-log')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('listAuditLog monta a query só com os filtros preenchidos', async () => {
        const fetchMock = mockFetchOnce({ entries: [], total_entries: 0 })
        await listAuditLog('token', { action: 'tick.trigger', result: undefined, limit: 20, offset: 40 })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/audit-log?action=tick.trigger&limit=20&offset=40')
    })

    it('getScheduler faz GET /admin/scheduler', async () => {
        const fetchMock = mockFetchOnce({ enabled: true })
        await getScheduler('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/scheduler')
    })

    it('pauseScheduler e resumeScheduler fazem POST nas rotas certas', async () => {
        const fetchMock = mockFetchOnce({ paused: true })
        await pauseScheduler('token')
        await resumeScheduler('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/scheduler/pause')
        expect(fetchMock.mock.calls[0][1].method).toBe('POST')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/scheduler/resume')
    })

    it('listTicks monta limit/offset', async () => {
        const fetchMock = mockFetchOnce({ ticks: [], total_entries: 0 })
        await listTicks('token', 20, 40)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/ticks?limit=20&offset=40')
    })

    it('triggerTick faz POST /admin/tick', async () => {
        const fetchMock = mockFetchOnce({ day: 1 })
        await triggerTick('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/tick')
        expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    })

    it('advanceTicks faz POST /admin/tick/advance com { days }', async () => {
        const fetchMock = mockFetchOnce({ requested: 3, ticks: [] })
        await advanceTicks('token', 3)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/tick/advance')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ days: 3 })
    })

    it('getSystemHealth faz GET /admin/system/health com o token', async () => {
        const fetchMock = mockFetchOnce({ checked_at: '2026-10-03T12:00:00Z', components: [] })
        await getSystemHealth('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/system/health')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('getAdminOverview faz GET /admin/overview com o token', async () => {
        const fetchMock = mockFetchOnce({ market: null, scheduler: null, last_tick: null, users: null, errors: {} })
        await getAdminOverview('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/overview')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('listMarketMonitor faz GET /admin/market/assets com o token', async () => {
        const fetchMock = mockFetchOnce({ assets: [] })
        await listMarketMonitor('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/market/assets')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('getMarketMonitorAsset faz GET /admin/market/assets/:id', async () => {
        const fetchMock = mockFetchOnce({ asset_id: 'a1' })
        await getMarketMonitorAsset('token', 'a1')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/market/assets/a1')
    })

    it('listAdminOrders monta a query só com os filtros definidos', async () => {
        const fetchMock = mockFetchOnce({ orders: [], total: 0 })
        await listAdminOrders('token', { status: 'open', asset_id: 'a1', side: undefined, limit: 50, offset: 100 })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/orders?status=open&asset_id=a1&limit=50&offset=100')
    })

    it('cancelAdminOrder faz POST /admin/orders/:id/cancel', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined })
        vi.stubGlobal('fetch', fetchMock)
        await cancelAdminOrder('token', 'ord-1')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/orders/ord-1/cancel')
        expect(init.method).toBe('POST')
    })

    it('cancelAdminOrdersBatch faz POST com o filtro no corpo', async () => {
        const fetchMock = mockFetchOnce({ cancelled_count: 1, cancelled_ids: ['a'] })
        const result = await cancelAdminOrdersBatch('token', { asset_id: 'asset-1' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/orders/cancel-batch')
        expect(JSON.parse(init.body)).toEqual({ asset_id: 'asset-1' })
        expect(result.cancelled_count).toBe(1)
    })

    it('listMacroEvents manda só os filtros preenchidos', async () => {
        const fetchMock = mockFetchOnce({ events: [], total_entries: 0 })
        await listMacroEvents('token', 20, 0, { status: 'cancelado', sector: 'Mineração', from_day: 10 })
        const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://x')
        expect(Object.fromEntries(url.searchParams)).toEqual({
            limit: '20',
            offset: '0',
            status: 'cancelado',
            sector: 'Mineração',
            from_day: '10',
        })
    })

    it('getMacroEventDetail faz GET /admin/macro-events/:id com a janela', async () => {
        const fetchMock = mockFetchOnce({})
        await getMacroEventDetail('token', 'e1', 10)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/macro-events/e1?window_days=10')
    })

    it('cancelMacroEvent faz DELETE /admin/macro-events/:id', async () => {
        const fetchMock = mockFetchOnce({ event: {} })
        await cancelMacroEvent('token', 'e1')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/macro-events/e1')
        expect(init.method).toBe('DELETE')
    })

    it('getEngineSettings faz GET /admin/settings', async () => {
        const fetchMock = mockFetchOnce({ editable: [], read_only: [] })
        await getEngineSettings('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/settings')
    })

    it('updateEngineSetting faz PUT /admin/settings/:key com o valor', async () => {
        const fetchMock = mockFetchOnce({ editable: [], read_only: [] })
        await updateEngineSetting('token', 'ticks_per_day', 12)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/settings/ticks_per_day')
        expect(init.method).toBe('PUT')
        expect(JSON.parse(init.body)).toEqual({ value: 12 })
    })

    it('resetEngineSetting faz DELETE /admin/settings/:key', async () => {
        const fetchMock = mockFetchOnce({ editable: [], read_only: [] })
        await resetEngineSetting('token', 'max_catch_up')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/settings/max_catch_up')
        expect(init.method).toBe('DELETE')
    })

    it('listAdminCatalog faz GET /admin/catalog e devolve só a lista', async () => {
        const fetchMock = mockFetchOnce({ assets: [{ asset_id: 'a1' }] })
        expect(await listAdminCatalog('token')).toEqual([{ asset_id: 'a1' }])
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/catalog')
    })

    it('updateCatalogAsset faz PATCH /admin/catalog/:id com o patch', async () => {
        const fetchMock = mockFetchOnce({ asset_id: 'a1' })
        await updateCatalogAsset('token', 'a1', { name: 'Novo' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/catalog/a1')
        expect(init.method).toBe('PATCH')
        expect(JSON.parse(init.body)).toEqual({ name: 'Novo' })
    })

    it('previewCatalogAsset e createCatalogAsset fazem POST com o pedido', async () => {
        const asset = { kind: 'fii_papel', ticker: 'NOVP11', name: 'Fii', indexador: 'CDI' } as const
        const preview = mockFetchOnce({ ticker: 'NOVP11', pool: null })
        await previewCatalogAsset('token', asset)
        expect(preview.mock.calls[0][0]).toBe('/admin/catalog/preview')
        expect(preview.mock.calls[0][1].method).toBe('POST')
        expect(JSON.parse(preview.mock.calls[0][1].body)).toEqual(asset)

        const create = mockFetchOnce({ asset_id: 'a1' })
        await createCatalogAsset('token', asset)
        expect(create.mock.calls[0][0]).toBe('/admin/catalog')
        expect(JSON.parse(create.mock.calls[0][1].body)).toEqual(asset)
    })

    it('listTradingHalts faz GET /admin/halts', async () => {
        const fetchMock = mockFetchOnce({ active: [], recent: [] })
        await listTradingHalts('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/halts')
    })

    it('pauseTrading faz POST /admin/halts com escopo, ativo e motivo', async () => {
        const fetchMock = mockFetchOnce({ id: 'h1' }, 201)
        await pauseTrading('token', { scope: 'asset', asset_id: 'a1', reason: 'volatilidade' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/halts')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ scope: 'asset', asset_id: 'a1', reason: 'volatilidade' })
    })

    it('liftTradingHalt faz POST /admin/halts/:id/lift', async () => {
        const fetchMock = mockFetchOnce({ id: 'h1' })
        await liftTradingHalt('token', 'h1')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/halts/h1/lift')
        expect(init.method).toBe('POST')
    })

    it('listAdminBots faz GET /admin/bots com o token', async () => {
        const fetchMock = mockFetchOnce({ bots: [], uncovered_assets: [] })
        await listAdminBots('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/bots')
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
    })

    it('createAdminBot faz POST /admin/bots com o corpo', async () => {
        const fetchMock = mockFetchOnce({ account_id: 'b1' })
        await createAdminBot('token', {
            archetype: 'chartista',
            sectors: ['Varejo'],
            risk_classes: [],
            asset_classes: [],
            within_scope_pct: 0.9,
            max_position_size_pct: 0.3,
            market_order_preference: 0.5,
            spread_width_pct: 0,
            initial_cash: 1000,
        })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/bots')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toMatchObject({ archetype: 'chartista', initial_cash: 1000 })
    })

    it('updateAdminBot faz PATCH /admin/bots/:id só com os campos informados', async () => {
        const fetchMock = mockFetchOnce({ account_id: 'b1' })
        await updateAdminBot('token', 'b1', { is_active: false })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/bots/b1')
        expect(init.method).toBe('PATCH')
        expect(JSON.parse(init.body)).toEqual({ is_active: false })
    })

    it('getAdminBotActivity faz GET /admin/bots/:id/activity com a janela', async () => {
        const fetchMock = mockFetchOnce({ account_id: 'b1' })
        await getAdminBotActivity('token', 'b1', 7)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/bots/b1/activity?days=7')
        await getAdminBotActivity('token', 'b1')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/bots/b1/activity')
    })

    it('getAdminBotsSummary faz GET /admin/bots/summary com idle_days opcional', async () => {
        const fetchMock = mockFetchOnce({ idle_bots: [] })
        await getAdminBotsSummary('token', 5)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/bots/summary?idle_days=5')
        await getAdminBotsSummary('token')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/bots/summary')
    })

    it('fundAdminBot faz POST /admin/bots/:id/funding com caixa e posição', async () => {
        const fetchMock = mockFetchOnce({ account_id: 'b1' })
        await fundAdminBot('token', 'b1', { cash: 5000, holdings: [{ asset_id: 'a1', quantity: 40 }] })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/bots/b1/funding')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ cash: 5000, holdings: [{ asset_id: 'a1', quantity: 40 }] })
    })

    it('updateAdminBot repassa os campos de personalidade', async () => {
        const fetchMock = mockFetchOnce({ account_id: 'b1' })
        await updateAdminBot('token', 'b1', { spread_width_pct: 0.03, sectors: ['Varejo'] })
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ spread_width_pct: 0.03, sectors: ['Varejo'] })
    })

    it('getUserCorrectionContext faz GET /admin/users/:id/corrections', async () => {
        const fetchMock = mockFetchOnce({ achievements: [], lessons: [] })
        await getUserCorrectionContext('token', 'u1')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/users/u1/corrections')
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
    })

    it('creditAdminUser faz POST /credit com o valor e o motivo', async () => {
        const fetchMock = mockFetchOnce({ user_id: 'u1', credited: 10 })
        await creditAdminUser('token', 'u1', { amount: 10, reason: 'reparo' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/users/u1/credit')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ amount: 10, reason: 'reparo' })
    })

    it('adjustAdminUserXp e setAdminUserStreak fazem POST com o ajuste e o motivo', async () => {
        const fetchMock = mockFetchOnce({ xp: 1, level: 1, current_streak: 0, longest_streak: 0 })
        await adjustAdminUserXp('token', 'u1', -50, 'por engano')
        await setAdminUserStreak('token', 'u1', 7, 'falha nossa')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/users/u1/xp')
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ delta: -50, reason: 'por engano' })
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/users/u1/streak')
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ value: 7, reason: 'falha nossa' })
    })

    it('grantAdminUserAchievement e correctAdminUserLesson montam a rota', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined })
        vi.stubGlobal('fetch', fetchMock)
        await grantAdminUserAchievement('token', 'u1', 'a1', 'dada por engano')
        await correctAdminUserLesson('token', 'u1', 'l1', 'complete', 'lição travada')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/users/u1/achievements/a1/grant')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/users/u1/lessons/l1/complete')
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ reason: 'lição travada' })
    })

    it('getAchievementCatalog e getMissionCatalog fazem GET no catálogo de gamificação', async () => {
        const fetchMock = mockFetchOnce({ achievements: [], criteria: [], missions: [] })
        await getAchievementCatalog('token')
        await getMissionCatalog('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/gamification/achievements')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/gamification/missions')
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
    })

    it('createAchievement e updateAchievement mandam POST e PATCH com o corpo', async () => {
        const fetchMock = mockFetchOnce({ id: 'a1' })
        await createAchievement('token', { name: 'Fiel', description: null, criteria_type: 'streak_days', criteria_value: 30 })
        await updateAchievement('token', 'a1', { is_active: false })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/gamification/achievements')
        expect(fetchMock.mock.calls[0][1].method).toBe('POST')
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            name: 'Fiel',
            description: null,
            criteria_type: 'streak_days',
            criteria_value: 30,
        })
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/gamification/achievements/a1')
        expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ is_active: false })
    })

    it('updateMission faz PATCH só com os campos informados', async () => {
        const fetchMock = mockFetchOnce({ id: 'm1' })
        await updateMission('token', 'm1', { xp_reward: 45 })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/gamification/missions/m1')
        expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ xp_reward: 45 })
    })

    it('getAdminLessons faz GET e setLessonPublished faz PATCH com published', async () => {
        const fetchMock = mockFetchOnce({ lessons: [] })
        await getAdminLessons('token')
        await setLessonPublished('token', 'l1', false)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/lessons')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/lessons/l1/published')
        expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ published: false })
    })

    it('editor de lições: GET, PUT com o conteúdo, POST de criação e revisões', async () => {
        const fetchMock = mockFetchOnce({})
        const content = { title: 'x' } as never
        await getAdminLesson('token', 'l1')
        await updateAdminLesson('token', 'l1', content)
        await createAdminLesson('token', { ...(content as object), after_lesson_id: null } as never)
        await getLessonRevision('token', 'l1', 'r1')
        await restoreLessonRevision('token', 'l1', 'r1')
        const calls = fetchMock.mock.calls.map((c) => [c[0], c[1]?.method ?? 'GET'])
        expect(calls).toEqual([
            ['/admin/lessons/l1', 'GET'],
            ['/admin/lessons/l1', 'PUT'],
            ['/admin/lessons', 'POST'],
            ['/admin/lessons/l1/revisions/r1', 'GET'],
            ['/admin/lessons/l1/revisions/r1/restore', 'POST'],
        ])
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ title: 'x' })
        expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ title: 'x', after_lesson_id: null })
    })

    it('getAdminRanking monta a query e omite a janela no critério de nível', async () => {
        const fetchMock = mockFetchOnce({ entries: [] })
        await getAdminRanking('token', { window: 'month', criterion: 'overall', page: 2 })
        await getAdminRanking('token', { criterion: 'level', page: 1 })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/gamification/ranking?criterion=overall&page=2&window=month')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/gamification/ranking?criterion=level&page=1')
    })
    it('comunicados: lista, cria, edita e encerra pelas rotas /admin/announcements', async () => {
        let fetchMock = mockFetchOnce({ announcements: [] })
        await listAdminAnnouncements('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/announcements')

        fetchMock = mockFetchOnce({ id: 'a1' }, 201)
        await createAnnouncement('token', { title: 't', body: 'b', severity: 'info', dismissible: true, ends_at: null })
        let [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/announcements')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ title: 't', body: 'b', severity: 'info', dismissible: true, ends_at: null })

        fetchMock = mockFetchOnce({ id: 'a1' })
        await updateAnnouncement('token', 'a1', { title: 'novo' })
        ;[url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/announcements/a1')
        expect(init.method).toBe('PATCH')

        fetchMock = mockFetchOnce({ outcome: 'ended' })
        await endAnnouncement('token', 'a1')
        ;[url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/announcements/a1/end')
        expect(init.method).toBe('POST')
    })

    it('startMaintenance faz POST /admin/maintenance com a opção de pausar', async () => {
        const fetchMock = mockFetchOnce({ id: 'a1' }, 201)
        await startMaintenance('token', { title: 't', body: 'b', pause_trading: true })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/maintenance')
        expect(JSON.parse(init.body)).toEqual({ title: 't', body: 'b', pause_trading: true })
    })
    it('startIntegrityCheck faz POST e getIntegrityRun faz GET e devolve só o run', async () => {
        let fetchMock = mockFetchOnce({ id: 'r1', status: 'running' }, 202)
        await startIntegrityCheck('token')
        let [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/integrity/check')
        expect(init.method).toBe('POST')

        fetchMock = mockFetchOnce({ run: { id: 'r1', status: 'done' } })
        expect(await getIntegrityRun('token')).toEqual({ id: 'r1', status: 'done' })
        ;[url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/integrity/check')
        expect(init.method ?? 'GET').toBe('GET')

        mockFetchOnce({ run: null })
        expect(await getIntegrityRun('token')).toBeNull()
    })

    it('downloadAdminExport monta o caminho com o conjunto e só os filtros informados', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Disposition': 'attachment; filename="x.csv"', 'X-Export-Rows': '1' }),
            blob: async () => new Blob(['x']),
        })
        vi.stubGlobal('fetch', fetchMock)

        await downloadAdminExport('token', 'market-events', { from: '2026-10-01T00:00:00.000Z', limit: 50 })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/exports/market-events?from=2026-10-01T00%3A00%3A00.000Z&limit=50')

        await downloadAdminExport('token', 'users')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/exports/users')
    })

    it('getEngineSettings sem grupo pede o ritmo; com grupo monta a query', async () => {
        const fetchMock = mockFetchOnce({ editable: [], read_only: [] })
        await getEngineSettings('token', 'governance')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/settings?group=governance')
    })

    it('listAdminAssemblies sem filtro faz GET /admin/assemblies e devolve a lista', async () => {
        const fetchMock = mockFetchOnce({ assemblies: [{ id: 'a1' }] })
        expect(await listAdminAssemblies('token')).toEqual([{ id: 'a1' }])
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/assemblies')
    })

    it('listAdminAssemblies com situação monta a query', async () => {
        const fetchMock = mockFetchOnce({ assemblies: [] })
        await listAdminAssemblies('token', 'open')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/assemblies?status=open')
    })

    it('getAdminAssembly faz GET /admin/assemblies/:id', async () => {
        const fetchMock = mockFetchOnce({ votes: [] })
        await getAdminAssembly('token', 'a1')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/assemblies/a1')
    })

    it('pausa e retomada das assembleias', async () => {
        const fetchMock = mockFetchOnce({ active: [], recent: [] })
        await listAssemblyPauses('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/assemblies/pauses')

        const post = mockFetchOnce({ id: 'p1' }, 201)
        await pauseAssemblies('token', { scope: 'company', company_id: 'c1', reason: 'revisão' })
        const [url, init] = post.mock.calls[0]
        expect(url).toBe('/admin/assemblies/pauses')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ scope: 'company', company_id: 'c1', reason: 'revisão' })

        const lift = mockFetchOnce({ id: 'p1' })
        await liftAssemblyPause('token', 'p1')
        expect(lift.mock.calls[0][0]).toBe('/admin/assemblies/pauses/p1/lift')
        expect(lift.mock.calls[0][1].method).toBe('POST')
    })

    it('parâmetros das assembleias: lista, altera e restaura devolvendo a lista nova', async () => {
        const list = mockFetchOnce({ settings: [{ key: 'min_voters' }] })
        expect(await listAssemblySettings('token')).toEqual([{ key: 'min_voters' }])
        expect(list.mock.calls[0][0]).toBe('/admin/assemblies/settings')

        const put = mockFetchOnce({ settings: [] })
        await updateAssemblySetting('token', 'min_voters', 5)
        expect(put.mock.calls[0][0]).toBe('/admin/assemblies/settings/min_voters')
        expect(put.mock.calls[0][1].method).toBe('PUT')
        expect(JSON.parse(put.mock.calls[0][1].body)).toEqual({ value: 5 })

        const del = mockFetchOnce({ settings: [] })
        await resetAssemblySetting('token', 'min_voters')
        expect(del.mock.calls[0][1].method).toBe('DELETE')
    })

    it('catálogo de pautas: lista, cria com a chave no corpo, edita e ativa', async () => {
        const content = { sector: null, title: 'T', description: 'D', options: [] }
        const list = mockFetchOnce({ templates: [{ key: 'k' }] })
        expect(await listAgendaTemplates('token')).toEqual([{ key: 'k' }])
        expect(list.mock.calls[0][0]).toBe('/admin/assemblies/agenda-templates')

        const post = mockFetchOnce({ key: 'k' }, 201)
        await createAgendaTemplate('token', 'k', content)
        expect(post.mock.calls[0][0]).toBe('/admin/assemblies/agenda-templates')
        expect(JSON.parse(post.mock.calls[0][1].body)).toEqual({ key: 'k', ...content })

        const put = mockFetchOnce({ key: 'k' })
        await updateAgendaTemplate('token', 'k', content)
        expect(put.mock.calls[0][0]).toBe('/admin/assemblies/agenda-templates/k')
        expect(put.mock.calls[0][1].method).toBe('PUT')
        expect(JSON.parse(put.mock.calls[0][1].body)).toEqual(content)

        const active = mockFetchOnce({ key: 'k' })
        await setAgendaTemplateActive('token', 'k', false)
        expect(active.mock.calls[0][0]).toBe('/admin/assemblies/agenda-templates/k/active')
        expect(JSON.parse(active.mock.calls[0][1].body)).toEqual({ active: false })
    })
})
