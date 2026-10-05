import { describe, expect, it } from 'vitest'
import { LESSON_SEEDS } from '../db/seedLessons'
import { findTermViolations, TERM_RULES } from '../modules/lessons/domain/termPrerequisites'

// Modo aviso (RC.1.2): lista os usos de termo antes da definição, sem falhar o
// build. Vira `true` quando a Fase 4 termina e as lições novas passam a definir
// Selic, CDI, TR, IPCA, ticker e ON/PN; daí a violação nova quebra o teste.
const STRICT = false

const lessons = LESSON_SEEDS.map((l) => ({
  code: l.code,
  sortOrder: l.sortOrder,
  text: [l.title, l.scenarioText, l.microDecisionPrompt, ...(l.microDecisionOptions ?? []), l.revelationText].join('\n'),
}))

describe('pré-requisitos de termos nas lições (RC.1.2)', () => {
  const violations = findTermViolations(lessons)

  it('toda regra aponta para uma lição existente (ou está planejada)', () => {
    const codes = new Set(LESSON_SEEDS.map((l) => l.code))
    for (const rule of TERM_RULES) {
      if (rule.definedIn === null) expect(rule.plannedIn, rule.id).toBeTruthy()
      else expect(codes.has(rule.definedIn), `${rule.id} -> ${rule.definedIn}`).toBe(true)
    }
  })

  it('acusa os casos conhecidos de hoje', () => {
    const has = (termId: string, lessonCode: string) =>
      violations.some((v) => v.termId === termId && v.lessonCode === lessonCode)
    expect(has('selic', '0.5')).toBe(true)
    expect(has('cdi', '0.5')).toBe(true)
    // 0.3 e 0.4 (RC.5.1) definem o IPCA inline com {{IPCA}}: sem aviso.
    expect(has('ipca', '0.4')).toBe(false)
    expect(has('ipca', '0.3')).toBe(false)
    expect(has('ipca', '1.3')).toBe(true)
    expect(has('on-pn', '2.3')).toBe(true)
    expect(has('ticker', '2.3')).toBe(true)
  })

  it('relata (aviso) ou falha (estrito) os usos antes da definição', () => {
    const lines = violations.map(
      (v) => `${v.label} em ${v.lessonCode} (definição: ${v.definedIn ?? `ainda não existe, ${v.plannedIn}`})`,
    )
    if (STRICT) {
      expect(lines).toEqual([])
    } else if (lines.length > 0) {
      console.warn(`[RC.1.2] ${lines.length} uso(s) de termo antes da definição:\n  ${lines.join('\n  ')}`)
    }
  })
})
