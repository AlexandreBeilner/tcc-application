import { describe, expect, it } from 'vitest'
import { LESSON_SEEDS } from '../db/seedLessons'
import { findTermViolations, TERM_RULES } from '../modules/lessons/domain/termPrerequisites'

// Modo estrito (RC.1.2): uso de termo antes da definição quebra o teste. Ligado
// na RC.5.9, quando as lições 2.1 e 2.3 passaram a definir ticker e ON/PN e não
// sobrou nenhum uso antecipado.
const STRICT = true

const lessons = LESSON_SEEDS.map((l) => ({
  code: l.code,
  sortOrder: l.sortOrder,
  text: [
    l.title,
    l.scenarioText,
    l.microDecisionPrompt,
    ...(l.microDecisionOptions ?? []),
    l.revelationText,
  ].join('\n'),
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
    // A lição nova (0.5, RC.4.1) define Selic, CDI e TR; a poupança (0.6) vem depois.
    expect(has('selic', '0.6')).toBe(false)
    expect(has('cdi', '0.6')).toBe(false)
    expect(has('tr', '0.6')).toBe(false)
    // 0.3 e 0.4 (RC.5.1) definem o IPCA inline com {{IPCA}}: sem aviso.
    expect(has('ipca', '0.4')).toBe(false)
    expect(has('ipca', '0.3')).toBe(false)
    expect(has('ipca', '1.4')).toBe(false)
    // 2.1 define o ticker e 2.3 define ON/PN (RC.5.9): nenhum aviso nas lições 2.x.
    expect(has('ticker', '2.2')).toBe(false)
    expect(has('ticker', '2.3')).toBe(false)
    expect(has('on-pn', '2.3')).toBe(false)
  })

  it('relata (aviso) ou falha (estrito) os usos antes da definição', () => {
    const lines = violations.map(
      (v) =>
        `${v.label} em ${v.lessonCode} (definição: ${v.definedIn ?? `ainda não existe, ${v.plannedIn}`})`,
    )
    if (STRICT) {
      expect(lines).toEqual([])
    } else if (lines.length > 0) {
      console.warn(
        `[RC.1.2] ${lines.length} uso(s) de termo antes da definição:\n  ${lines.join('\n  ')}`,
      )
    }
  })
})
