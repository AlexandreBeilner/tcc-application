import { describe, expect, it } from 'vitest'
import {
  announcementStatus,
  applyAnnouncementPatch,
  compareForDisplay,
  validateAnnouncementDraft,
  type Announcement,
  type AnnouncementDraft,
} from './announcement'
import { InvalidAnnouncementError } from './errors'

const t = (iso: string) => new Date(iso)

const draft: AnnouncementDraft = {
  title: 'Manutenção às 22h',
  body: 'O app volta em uma hora.',
  severity: 'warning',
  dismissible: true,
  notifyByEmail: false,
  startsAt: t('2026-10-06T10:00:00Z'),
  endsAt: t('2026-10-06T12:00:00Z'),
}

function make(overrides: Partial<Announcement> = {}): Announcement {
  return {
    ...draft,
    id: 'a1',
    kind: 'notice',
    linkedHaltId: null,
    createdBy: 'admin',
    createdAt: t('2026-10-06T09:00:00Z'),
    ...overrides,
  }
}

describe('announcementStatus', () => {
  it.each([
    ['09:59:59', 'scheduled'],
    ['10:00:00', 'active'],
    ['11:59:59', 'active'],
    ['12:00:00', 'ended'],
  ])('às %s está %s (janela [início, fim))', (time, expected) => {
    expect(announcementStatus(draft, t(`2026-10-06T${time}Z`))).toBe(expected)
  })

  it('sem fim fica ativo para sempre', () => {
    expect(announcementStatus({ ...draft, endsAt: null }, t('2030-01-01T00:00:00Z'))).toBe('active')
  })
})

describe('validateAnnouncementDraft', () => {
  it('apara o texto e aceita o rascunho válido', () => {
    const result = validateAnnouncementDraft({ ...draft, title: '  Aviso  ' })
    expect(result.title).toBe('Aviso')
  })

  it.each([
    ['título vazio', { title: '   ' }],
    ['título acima de 80', { title: 'a'.repeat(81) }],
    ['texto vazio', { body: '' }],
    ['texto acima de 280', { body: 'a'.repeat(281) }],
    ['HTML no título', { title: '<b>oi</b>' }],
    ['HTML no texto', { body: 'veja <script>alert(1)</script>' }],
    ['fim igual ao início', { endsAt: draft.startsAt }],
    ['fim antes do início', { endsAt: t('2026-10-06T09:00:00Z') }],
    ['data inválida', { startsAt: new Date('x') }],
  ])('recusa %s', (_label, change) => {
    expect(() => validateAnnouncementDraft({ ...draft, ...change })).toThrow(
      InvalidAnnouncementError,
    )
  })

  it('aceita os limites exatos de tamanho', () => {
    expect(() =>
      validateAnnouncementDraft({ ...draft, title: 'a'.repeat(80), body: 'b'.repeat(280) }),
    ).not.toThrow()
  })
})

describe('applyAnnouncementPatch', () => {
  it('valida o estado final: editar só o fim pra antes do início é recusado', () => {
    expect(() => applyAnnouncementPatch(make(), { endsAt: t('2026-10-06T09:00:00Z') })).toThrow(
      InvalidAnnouncementError,
    )
  })

  it('null no fim tira o fim; campo ausente mantém o atual', () => {
    expect(applyAnnouncementPatch(make(), { endsAt: null }).endsAt).toBeNull()
    expect(applyAnnouncementPatch(make(), { title: 'Novo' }).endsAt).toEqual(draft.endsAt)
  })
})

describe('compareForDisplay', () => {
  it('crítico antes de aviso antes de info; empate pelo mais recente', () => {
    const info = make({ id: 'i', severity: 'info' })
    const warning = make({ id: 'w', severity: 'warning' })
    const critical = make({ id: 'c', severity: 'critical' })
    const newerWarning = make({
      id: 'w2',
      severity: 'warning',
      startsAt: t('2026-10-06T11:00:00Z'),
    })
    const sorted = [info, warning, newerWarning, critical].sort(compareForDisplay)
    expect(sorted.map((a) => a.id)).toEqual(['c', 'w2', 'w', 'i'])
  })
})
