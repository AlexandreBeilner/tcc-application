import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_SEEDS } from '../db/seedAchievements'
import { LESSON_SEEDS } from '../db/seedLessons'
import { MISSION_SEEDS } from '../db/seedMissions'
import {
  blockTextFields,
  summaryTextFields,
  CARD_HARD_LIMIT_CHARS,
  countByKey,
  diffAgainstBaseline,
  findForbidden,
  findOversizedCards,
  type TextField,
  type Violation,
} from './contentRules'

const BASELINE_PATH = join(__dirname, 'contentViolationsBaseline.json')

function lessonFields(): { all: TextField[]; longText: TextField[] } {
  const all: TextField[] = []
  const longText: TextField[] = []
  for (const lesson of LESSON_SEEDS) {
    const source = `lesson:${lesson.code}`
    const push = (field: string, text: string | null | undefined, long = false) => {
      if (!text) return
      const entry = { source, field, text }
      all.push(entry)
      if (long) longText.push(entry)
    }
    push('title', lesson.title)
    push('trackName', lesson.trackName)
    push('centralConcept', lesson.centralConcept)
    push('scenarioText', lesson.scenarioText, true)
    push('microDecisionPrompt', lesson.microDecisionPrompt, true)
    lesson.microDecisionOptions?.forEach((option, i) => push(`microDecisionOptions[${i}]`, option))
    push('revelationText', lesson.revelationText, true)
    push('unlocksDescription', lesson.unlocksDescription)
    for (const [phase, blocks] of Object.entries(lesson.blocks?.phases ?? {})) {
      for (const { field, long } of blockTextFields(source, phase, blocks)) {
        all.push(field)
        if (long) longText.push(field)
      }
    }
    all.push(...summaryTextFields(source, lesson.blocks?.summary))
  }
  return { all, longText }
}

function otherFields(): TextField[] {
  const fields: TextField[] = []
  for (const a of ACHIEVEMENT_SEEDS) {
    fields.push({ source: `achievement:${a.name}`, field: 'name', text: a.name })
    fields.push({ source: `achievement:${a.name}`, field: 'description', text: a.description })
  }
  for (const m of MISSION_SEEDS) {
    for (const field of ['title', 'description', 'completionCriteria'] as const) {
      fields.push({ source: `mission:${m.key}`, field, text: m[field] })
    }
  }
  return fields
}

function collectViolations(): Violation[] {
  const { all, longText } = lessonFields()
  return [...findForbidden([...all, ...otherFields()]), ...findOversizedCards(longText)]
}

describe('conteúdo visível ao usuário (RC.1.1)', () => {
  it('o catálogo tem conteúdo pra varrer', () => {
    expect(LESSON_SEEDS.length).toBeGreaterThan(30)
    expect(ACHIEVEMENT_SEEDS.length).toBeGreaterThan(0)
    expect(MISSION_SEEDS.length).toBeGreaterThan(0)
  })

  // Baseline = dívida conhecida que a RC.1.4 (limpeza) e a Fase 5 (reescrita)
  // zeram. Violação nova falha; violação resolvida também falha até o baseline
  // ser regravado (UPDATE_CONTENT_BASELINE=1 npx vitest run src/content), então
  // ele só encolhe. Meta: baseline vazio.
  it('não introduz violação nova e mantém o baseline encolhendo', () => {
    const violations = collectViolations()
    const current = countByKey(violations)

    if (process.env.UPDATE_CONTENT_BASELINE === '1') {
      const sorted = Object.fromEntries(
        Object.entries(current).sort(([a], [b]) => a.localeCompare(b)),
      )
      writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n')
      return
    }

    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, number>
    const { added, stale } = diffAgainstBaseline(current, baseline)

    const details = violations
      .filter((v) => added.some((a) => a.startsWith(`${v.ruleId}|${v.source}|${v.field} `)))
      .map((v) => `  [${v.ruleId}] ${v.source} ${v.field}: ...${v.excerpt.replace(/\n/g, ' ')}...`)
    expect(added, `violações novas de conteúdo:\n${details.join('\n')}`).toEqual([])
    expect(stale, 'violações resolvidas: regrave o baseline (UPDATE_CONTENT_BASELINE=1)').toEqual(
      [],
    )
  })

  it('rejeita cartão acima do teto duro', () => {
    const violations = findOversizedCards([
      { source: 's', field: 'f', text: 'a'.repeat(CARD_HARD_LIMIT_CHARS + 1) },
    ])
    expect(violations).toHaveLength(1)
    expect(
      findOversizedCards([{ source: 's', field: 'f', text: 'a'.repeat(CARD_HARD_LIMIT_CHARS) }]),
    ).toEqual([])
  })

  it('as regras pegam cada padrão proibido', () => {
    const samples: Record<string, string> = {
      tcc: 'veja o TCC',
      spec: 'conforme a spec do projeto',
      capitulo: 'ver cap. 3',
      backlog: 'item do backlog',
      motor: 'o motor calcula',
      'nesta-plataforma': 'Nesta plataforma é diferente',
      simulado: 'Selic simulada',
      travessao: 'ela reage — a inflação',
      'snake-case': 'soma excede outstanding_shares',
      'numero-de-licao': 'Ação Sandbox Lição 2.3',
      sandbox: 'o Sandbox não entra',
    }
    for (const [ruleId, text] of Object.entries(samples)) {
      const ids = findForbidden([{ source: 's', field: 'f', text }]).map((v) => v.ruleId)
      expect(ids, ruleId).toContain(ruleId)
    }
  })

  it('varre os blocos e isenta só o bloco "Na plataforma" das regras de mecânica', () => {
    const fields = blockTextFields('lesson:x', 'scenario', [
      {
        type: 'widget',
        widget: 'platform-note',
        props: { here: 'Selic simulada nesta plataforma' },
      },
      { type: 'widget', widget: 'callout', props: { body: 'Selic simulada' } },
      { type: 'text', markup: 'o motor decide' },
    ]).map((f) => f.field)
    const ids = findForbidden(fields).map((v) => `${v.field}:${v.ruleId}`)
    expect(ids).toEqual([
      'blocks.scenario[1].props.body:simulado',
      'blocks.scenario[2].markup:motor',
    ])
    const tcc = blockTextFields('l', 'scenario', [
      { type: 'widget', widget: 'platform-note', props: { why: 'veja o TCC' } },
    ]).map((f) => f.field)
    expect(findForbidden(tcc).map((v) => v.ruleId)).toEqual(['tcc'])
  })

  it('varre o texto e a revelação da missão do widget (LJ.3.1)', () => {
    const fields = blockTextFields('l', 'scenario', [
      {
        type: 'widget',
        widget: 'real-return',
        props: {},
        goal: { text: 'ache o motor', reveal: 'sem problema' },
      },
    ]).map((f) => f.field)
    expect(findForbidden(fields).map((v) => `${v.field}:${v.ruleId}`)).toEqual([
      'blocks.scenario[0].goal.text:motor',
    ])
  })

  it('varre o resumo "O que ficou" da raiz do blocks (LJ.1.5)', () => {
    const ids = findForbidden(summaryTextFields('l', ['o motor decide', 'tudo certo'])).map(
      (v) => `${v.field}:${v.ruleId}`,
    )
    expect(ids).toEqual(['blocks.summary[0]:motor'])
    expect(summaryTextFields('l', undefined)).toEqual([])
  })

  it('texto limpo não dispara nenhuma regra', () => {
    expect(
      findForbidden([
        { source: 's', field: 'f', text: 'O CDB paga 110% do CDI, e o FGC cobre até R$ 250 mil.' },
      ]),
    ).toEqual([])
  })
})
