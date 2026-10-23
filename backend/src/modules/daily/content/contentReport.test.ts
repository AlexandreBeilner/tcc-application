import { describe, expect, it } from 'vitest'
import { readAcceptedWordsFile } from './acceptedWordsFile'
import { buildContentReport, CONTENT_FLOOR } from './contentReport'
import { INITIAL_CONTENT, type ContentBundle } from './dailyContent'
import { EXTRA_ACCEPTED_WORDS } from './extraAcceptedWords'

const accepted = new Set([...readAcceptedWordsFile(), ...EXTRA_ACCEPTED_WORDS])

describe('buildContentReport', () => {
  it('o conteúdo atual passa na validação e fica acima do mínimo', () => {
    const report = buildContentReport(INITIAL_CONTENT, accepted)

    expect(report.errors).toEqual([])
    expect(report.belowFloor).toEqual([])
    expect(report.counts.words).toBeGreaterThanOrEqual(CONTENT_FLOOR.words)
    expect(report.runwayDays).toEqual(report.counts)
  })

  it('conta por categoria, marcador e posição do gabarito', () => {
    const report = buildContentReport(INITIAL_CONTENT, accepted)

    expect(Object.values(report.questions.byCategory).reduce((a, b) => a + b, 0)).toBe(
      report.counts.questions,
    )
    expect(report.questions.brasilShare).toBeGreaterThan(0.7)
    expect(Object.keys(report.questions.correctIndex).sort()).toEqual(['0', '1', '2', '3'])
  })

  it('aponta abaixo do mínimo, erro de validação e enunciado repetido', () => {
    const q = INITIAL_CONTENT.questions[0]
    const content: ContentBundle = {
      words: [],
      questions: [
        q,
        { ...q, key: 'outra-chave' },
        { ...INITIAL_CONTENT.questions[1], source: ' ' },
      ],
    }
    const report = buildContentReport(content, accepted)

    expect(report.belowFloor).toEqual(['words: 0 de 250', 'questions: 3 de 30'])
    expect(report.possibleDuplicates).toEqual([
      `perguntas ${q.key} e outra-chave têm o mesmo enunciado`,
    ])
    expect(report.errors).toEqual([expect.stringContaining('sem fonte primária')])
  })
})
