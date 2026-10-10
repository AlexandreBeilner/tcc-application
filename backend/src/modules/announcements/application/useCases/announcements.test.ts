import { beforeEach, describe, expect, it } from 'vitest'
import { FakeAnnouncementRepository } from '../../test/fakes/fakeAnnouncementRepository'
import type { AnnouncementDraft } from '../../domain/announcement'
import {
  AnnouncementConflictError,
  AnnouncementNotFoundError,
  InvalidAnnouncementError,
} from '../../domain/errors'
import {
  CreateAnnouncementUseCase,
  EndAnnouncementUseCase,
  ListActiveAnnouncementsUseCase,
  ListAnnouncementsUseCase,
  UpdateAnnouncementUseCase,
} from './announcements'

const NOW = new Date('2026-10-06T12:00:00Z')
const hour = 3_600_000
const clock = () => NOW

const draft: AnnouncementDraft = {
  title: 'Aviso',
  body: 'Texto',
  severity: 'info',
  dismissible: true,
  notifyByEmail: false,
  startsAt: new Date(NOW.getTime() - hour),
  endsAt: new Date(NOW.getTime() + hour),
}

describe('announcements', () => {
  let repository: FakeAnnouncementRepository
  let create: CreateAnnouncementUseCase

  beforeEach(() => {
    repository = new FakeAnnouncementRepository()
    create = new CreateAnnouncementUseCase(repository, clock)
  })

  it('o app só recebe o que está na janela, o mais grave primeiro', async () => {
    await create.execute({ draft, createdBy: 'a' })
    await create.execute({
      draft: { ...draft, title: 'Grave', severity: 'critical' },
      createdBy: 'a',
    })
    await create.execute({
      draft: { ...draft, title: 'Futuro', startsAt: new Date(NOW.getTime() + hour), endsAt: null },
      createdBy: 'a',
    })
    await create.execute({
      draft: {
        ...draft,
        title: 'Passado',
        startsAt: new Date(NOW.getTime() - 2 * hour),
        endsAt: new Date(NOW.getTime() - hour),
      },
      createdBy: 'a',
    })

    const active = await new ListActiveAnnouncementsUseCase(repository, clock).execute()
    expect(active.map((a) => a.title)).toEqual(['Grave', 'Aviso'])
  })

  it('o painel vê todos com o estado de cada um', async () => {
    await create.execute({ draft, createdBy: 'a' })
    await create.execute({
      draft: { ...draft, title: 'Futuro', startsAt: new Date(NOW.getTime() + hour), endsAt: null },
      createdBy: 'a',
    })
    const entries = await new ListAnnouncementsUseCase(repository, clock).execute()
    expect(entries.map((e) => e.status).sort()).toEqual(['active', 'scheduled'])
  })

  it('e-mail só para comunicado crítico: o resto fica no banner do app (EM.5.2)', async () => {
    await expect(
      create.execute({
        draft: { ...draft, severity: 'warning', notifyByEmail: true },
        createdBy: 'a',
      }),
    ).rejects.toBeInstanceOf(InvalidAnnouncementError)

    const critical = await create.execute({
      draft: { ...draft, severity: 'critical', notifyByEmail: true },
      createdBy: 'a',
    })
    expect(critical.notifyByEmail).toBe(true)
  })

  it('manutenção pode pedir e-mail mesmo vindo com outra severidade (nasce crítica)', async () => {
    const maintenance = await create.execute({
      draft: { ...draft, severity: 'info', notifyByEmail: true, endsAt: null },
      createdBy: 'a',
      maintenance: { linkedHaltId: null },
    })
    expect(maintenance.notifyByEmail).toBe(true)
  })

  it('editar não muda o pedido de e-mail (o lote já saiu)', async () => {
    const created = await create.execute({
      draft: { ...draft, severity: 'critical', notifyByEmail: true },
      createdBy: 'a',
    })
    const updated = await new UpdateAnnouncementUseCase(repository, clock).execute(created.id, {
      severity: 'info',
      title: 'Outro',
    })
    expect(updated.notifyByEmail).toBe(true)
  })

  it('manutenção nasce crítica e não dispensável, e só pode haver uma em aberto', async () => {
    const maintenance = await create.execute({
      draft: { ...draft, severity: 'info', dismissible: true, endsAt: null },
      createdBy: 'a',
      maintenance: { linkedHaltId: 'halt-1' },
    })
    expect(maintenance).toMatchObject({
      kind: 'maintenance',
      severity: 'critical',
      dismissible: false,
      linkedHaltId: 'halt-1',
    })
    await expect(
      create.execute({ draft, createdBy: 'a', maintenance: { linkedHaltId: null } }),
    ).rejects.toBeInstanceOf(AnnouncementConflictError)
  })

  it('edita um comunicado e valida o estado final', async () => {
    const created = await create.execute({ draft, createdBy: 'a' })
    const update = new UpdateAnnouncementUseCase(repository, clock)
    expect((await update.execute(created.id, { title: 'Outro' })).title).toBe('Outro')
    await expect(update.execute('nao-existe', { title: 'x' })).rejects.toBeInstanceOf(
      AnnouncementNotFoundError,
    )
  })

  it('não edita manutenção nem comunicado que já terminou', async () => {
    const maintenance = await create.execute({
      draft: { ...draft, endsAt: null },
      createdBy: 'a',
      maintenance: { linkedHaltId: null },
    })
    const ended = await create.execute({
      draft: {
        ...draft,
        startsAt: new Date(NOW.getTime() - 2 * hour),
        endsAt: new Date(NOW.getTime() - hour),
      },
      createdBy: 'a',
    })
    const update = new UpdateAnnouncementUseCase(repository, clock)
    await expect(update.execute(maintenance.id, { title: 'x' })).rejects.toBeInstanceOf(
      AnnouncementConflictError,
    )
    await expect(update.execute(ended.id, { title: 'x' })).rejects.toBeInstanceOf(
      AnnouncementConflictError,
    )
  })

  it('encerrar tira do ar agora; agendado é cancelado; terminado é conflito', async () => {
    const live = await create.execute({ draft, createdBy: 'a' })
    const scheduled = await create.execute({
      draft: { ...draft, startsAt: new Date(NOW.getTime() + hour), endsAt: null },
      createdBy: 'a',
    })
    const end = new EndAnnouncementUseCase(repository, clock)

    expect((await end.execute(live.id)).outcome).toBe('ended')
    expect((await repository.findById(live.id))?.endsAt).toEqual(NOW)
    expect(await new ListActiveAnnouncementsUseCase(repository, clock).execute()).toEqual([])

    expect((await end.execute(scheduled.id)).outcome).toBe('cancelled')
    expect(await repository.findById(scheduled.id)).toBeNull()

    await expect(end.execute(live.id)).rejects.toBeInstanceOf(AnnouncementConflictError)
    await expect(end.execute('nao-existe')).rejects.toBeInstanceOf(AnnouncementNotFoundError)
  })
})
