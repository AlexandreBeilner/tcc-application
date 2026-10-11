import { describe, expect, it } from 'vitest'
import type { Assembly } from '../../../assemblies/domain/assembly'
import { createInProcessAssemblyCalendarSource } from './inProcessAssemblyCalendarSource'

const at = (day: number) => new Date(Date.UTC(2026, 9, day, 12))

function assembly(over: Partial<Assembly>): Assembly {
  return {
    id: 'a',
    kind: 'shareholder',
    subjectRef: 'c',
    dedupeKey: 'k',
    status: 'open',
    opensAt: at(10),
    snapshotAt: at(10),
    closesAt: at(17),
    effectAppliesAt: at(18),
    outcome: null,
    outcomeReason: null,
    winningOptionId: null,
    voterCount: null,
    decidedAt: null,
    title: 'Orçamento de capital',
    subjectLabel: 'Acme',
    templateKey: 't',
    effectAppliedAt: null,
    resultAnnouncedAt: null,
    minVoters: null,
    createdAt: at(10),
    ...over,
  }
}

describe('inProcessAssemblyCalendarSource', () => {
  it('traduz os marcos que caem na janela, com empresa e pauta no título', async () => {
    const source = createInProcessAssemblyCalendarSource({
      listForCalendar: async () => [assembly({})],
    })
    const facts = await source.listBetween(at(9), at(30))
    expect(facts.map((f) => f.milestone)).toEqual([
      'assembly_open',
      'assembly_close',
      'assembly_effect',
    ])
    expect(facts[0].title).toBe('Acme: Orçamento de capital')
  })

  it('só traz os marcos dentro da janela pedida', async () => {
    const source = createInProcessAssemblyCalendarSource({
      listForCalendar: async () => [assembly({})],
    })
    const facts = await source.listBetween(at(16), at(17))
    expect(facts.map((f) => f.milestone)).toEqual(['assembly_close'])
  })

  it('pauta não aprovada não gera marco de efeito', async () => {
    const source = createInProcessAssemblyCalendarSource({
      listForCalendar: async () => [assembly({ status: 'closed', outcome: 'not_approved' })],
    })
    const facts = await source.listBetween(at(9), at(30))
    expect(facts.map((f) => f.milestone)).toEqual(['assembly_open', 'assembly_close'])
  })

  it('sem contexto de exibição usa um título genérico', async () => {
    const source = createInProcessAssemblyCalendarSource({
      listForCalendar: async () => [assembly({ title: null, subjectLabel: null })],
    })
    expect((await source.listBetween(at(9), at(11)))[0].title).toBe('Empresa')
  })
})
