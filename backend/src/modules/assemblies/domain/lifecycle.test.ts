import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIFECYCLE_PARAMS,
  pickTemplate,
  planSchedule,
  shareholderDedupeKey,
  type AgendaTemplate,
} from './lifecycle'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-10T12:00:00Z')

function template(key: string, sector: string | null): AgendaTemplate {
  return { key, kind: 'shareholder', sector, title: key, description: '', options: [] }
}

describe('planSchedule', () => {
  it('abre agora, dura 7 dias e o efeito vale 1 dia depois de fechar (padrões do autor)', () => {
    const s = planSchedule(now, DEFAULT_LIFECYCLE_PARAMS)
    expect(s.opensAt).toEqual(now)
    expect(s.snapshotAt).toEqual(now)
    expect(s.closesAt.getTime() - now.getTime()).toBe(7 * DAY)
    expect(s.effectAppliesAt.getTime() - s.closesAt.getTime()).toBe(1 * DAY)
  })

  it('respeita os parâmetros (nada fixo)', () => {
    const s = planSchedule(now, {
      ...DEFAULT_LIFECYCLE_PARAMS,
      durationDays: 3,
      effectDelayDays: 2,
    })
    expect(s.closesAt.getTime() - now.getTime()).toBe(3 * DAY)
    expect(s.effectAppliesAt.getTime() - s.closesAt.getTime()).toBe(2 * DAY)
  })
})

describe('shareholderDedupeKey', () => {
  it('é uma por empresa e por balanço', () => {
    expect(shareholderDedupeKey('c1', 91)).toBe('shareholder:c1:91')
    expect(shareholderDedupeKey('c1', 91)).not.toBe(shareholderDedupeKey('c1', 182))
    expect(shareholderDedupeKey('c1', 91)).not.toBe(shareholderDedupeKey('c2', 91))
  })
})

describe('pickTemplate', () => {
  const templates = [
    template('geral_b', null),
    template('varejo_a', 'Varejo'),
    template('energia_a', 'Energia'),
    template('geral_a', null),
  ]

  it('só considera pautas gerais e as do setor da empresa', () => {
    const seen = new Set<string>()
    for (let day = 0; day < 400; day += 1) {
      const picked = pickTemplate(templates, 'company', 'Varejo', day)
      expect(picked).not.toBeNull()
      seen.add((picked as AgendaTemplate).key)
    }
    expect(seen).toEqual(new Set(['geral_a', 'geral_b', 'varejo_a']))
  })

  it('é determinística e não depende da ordem do catálogo', () => {
    const a = pickTemplate(templates, 'company', 'Energia', 91)
    const b = pickTemplate([...templates].reverse(), 'company', 'Energia', 91)
    expect(a?.key).toBe(b?.key)
    expect(pickTemplate(templates, 'company', 'Energia', 91)?.key).toBe(a?.key)
  })

  it('varia entre balanços e entre empresas (não repete sempre a mesma pauta)', () => {
    const keys = new Set(
      [91, 182, 273, 364, 455, 546].map(
        (day) => pickTemplate(templates, 'company', 'Varejo', day)?.key,
      ),
    )
    expect(keys.size).toBeGreaterThan(1)
  })

  it('devolve null sem candidata', () => {
    expect(pickTemplate([template('energia_a', 'Energia')], 'c', 'Varejo', 1)).toBeNull()
    expect(pickTemplate([], 'c', 'Varejo', 1)).toBeNull()
  })
})
