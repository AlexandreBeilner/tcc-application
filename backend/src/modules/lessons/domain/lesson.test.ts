import { describe, expect, it } from 'vitest'
import {
  buildLessonView,
  buildMicroDecisionAttemptsChronological,
  completedTrackNumbers,
  countCompleted,
  countReviewedLessons,
  currentMicroDecisionStreak,
  isCorrectOption,
  isEligibleForReview,
  isUnlocked,
  lessonStatus,
  microDecisionResultFor,
  tracksCompletedWithoutErrors,
  unlockedKeysFor,
  utcDateString,
} from './lesson'

describe('isUnlocked', () => {
  it.each([
    [1, 0, true], // primeira lição sempre disponível, ninguém concluiu nada
    [2, 0, false],
    [2, 1, true],
    [5, 4, true], // última lição da Trilha 0 (0.5), as 4 anteriores concluídas
    [6, 4, false], // 1.1 ainda bloqueada — Trilha 0 não terminou
    [6, 5, true], // 1.1 desbloqueia só depois de concluir 0.5 (0.5 → Trilha 1)
  ])('sortOrder=%i, completedCount=%i → %s', (sortOrder, completedCount, expected) => {
    expect(isUnlocked(sortOrder, completedCount)).toBe(expected)
  })
})

describe('lessonStatus', () => {
  it('completed quando o usuário já concluiu, mesmo se a contagem global não sustentaria mais', () => {
    expect(lessonStatus({ sortOrder: 1, completedCount: 0, completedByUser: true })).toBe(
      'completed',
    )
  })

  it('available quando desbloqueada e ainda não concluída', () => {
    expect(lessonStatus({ sortOrder: 2, completedCount: 1, completedByUser: false })).toBe(
      'available',
    )
  })

  it('locked quando ainda não desbloqueada', () => {
    expect(lessonStatus({ sortOrder: 3, completedCount: 1, completedByUser: false })).toBe('locked')
  })
})

describe('buildLessonView', () => {
  const lesson = {
    id: 'l1',
    code: '0.1',
    title: 'O que é investir',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 1,
    centralConcept: 'Investir vs poupar',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection' as const,
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: 'Acesso ao Portfólio',
    unlocksKeys: ['portfolio'],
    unlocksAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
  }

  it('sem progresso: primeira lição available, currentStep=0', () => {
    const view = buildLessonView(lesson, undefined, 0)

    expect(view.status).toBe('available')
    expect(view.currentStep).toBe(0)
  })

  it('com progresso em andamento: status calculado normalmente, currentStep persistido', () => {
    const view = buildLessonView(
      lesson,
      { currentStep: 1, completedAt: null, microDecisionSelectedOption: null },
      0,
    )

    expect(view.status).toBe('available')
    expect(view.currentStep).toBe(1)
  })

  it('com completedAt preenchido: completed, independente do sortOrder', () => {
    const view = buildLessonView(
      lesson,
      { currentStep: 3, completedAt: new Date(), microDecisionSelectedOption: null },
      0,
    )

    expect(view.status).toBe('completed')
  })

  it('correção da revisão da PR 18: nunca devolve microDecisionCorrectOption, mesmo pra lição com aposta real', () => {
    const lessonWithOptions = {
      ...lesson,
      microDecisionOptions: ['Sim', 'Não'],
      microDecisionCorrectOption: 0,
    }

    const view = buildLessonView(lessonWithOptions, undefined, 0)

    expect(Object.keys(view)).not.toContain('microDecisionCorrectOption')
  })
})

describe('unlockedKeysFor', () => {
  const lessons = [
    { sortOrder: 1, unlocksKeys: ['portfolio'] },
    { sortOrder: 2, unlocksKeys: ['calculator'] },
    { sortOrder: 3, unlocksKeys: [] },
    { sortOrder: 6, unlocksKeys: ['asset:tesouro_selic'] },
  ]

  it('nenhuma lição concluída → nenhuma chave desbloqueada', () => {
    expect(unlockedKeysFor(0, lessons)).toEqual(new Set())
  })

  it('só chaves de lições com sortOrder <= completedCount', () => {
    expect(unlockedKeysFor(2, lessons)).toEqual(new Set(['portfolio', 'calculator']))
  })

  it('lição sem unlocksKeys não adiciona nada (mesma progressão via sortOrder)', () => {
    expect(unlockedKeysFor(3, lessons)).toEqual(new Set(['portfolio', 'calculator']))
  })

  it('une chaves de múltiplas lições concluídas, sem duplicar', () => {
    const withDuplicate = [...lessons, { sortOrder: 6, unlocksKeys: ['asset:tesouro_selic'] }]
    expect(unlockedKeysFor(6, withDuplicate)).toEqual(
      new Set(['portfolio', 'calculator', 'asset:tesouro_selic']),
    )
  })
})

describe('countCompleted', () => {
  it('conta só entradas com completedAt preenchido', () => {
    expect(
      countCompleted([
        { completedAt: new Date() },
        { completedAt: null },
        { completedAt: new Date() },
      ]),
    ).toBe(2)
  })

  it('0 pra lista vazia', () => {
    expect(countCompleted([])).toBe(0)
  })
})

describe('completedTrackNumbers', () => {
  it('trilha só entra no resultado se todas as lições dela estiverem concluídas', () => {
    expect(
      completedTrackNumbers([
        { trackNumber: 0, completedAt: new Date() },
        { trackNumber: 0, completedAt: new Date() },
        { trackNumber: 1, completedAt: new Date() },
        { trackNumber: 1, completedAt: null },
      ]),
    ).toEqual([0])
  })

  it('lista vazia → nenhuma trilha completa', () => {
    expect(completedTrackNumbers([])).toEqual([])
  })

  it('nenhuma lição concluída → nenhuma trilha completa', () => {
    expect(
      completedTrackNumbers([
        { trackNumber: 0, completedAt: null },
        { trackNumber: 1, completedAt: null },
      ]),
    ).toEqual([])
  })

  it('várias trilhas completas voltam ordenadas por número', () => {
    expect(
      completedTrackNumbers([
        { trackNumber: 3, completedAt: new Date() },
        { trackNumber: 0, completedAt: new Date() },
        { trackNumber: 1, completedAt: new Date() },
        { trackNumber: 2, completedAt: null },
      ]),
    ).toEqual([0, 1, 3])
  })
})

describe('utcDateString', () => {
  it('formata a data em YYYY-MM-DD, UTC', () => {
    expect(utcDateString(new Date('2026-08-24T23:59:59Z'))).toBe('2026-08-24')
    expect(utcDateString(new Date('2026-08-25T00:00:00Z'))).toBe('2026-08-25')
  })
})

describe('isEligibleForReview', () => {
  const now = new Date('2026-09-06T12:00:00Z')

  it.each([
    ['2026-08-23T12:00:00Z', true], // exatos 14 dias atrás
    ['2026-08-23T12:00:01Z', false], // 1s a menos que 14 dias
    ['2026-08-01T00:00:00Z', true], // bem mais antigo que 14 dias
    ['2026-09-05T12:00:00Z', false], // 1 dia atrás
    ['2026-09-06T12:00:00Z', false], // concluída agora mesmo
  ])('completedAt=%s → %s', (completedAt, expected) => {
    expect(isEligibleForReview(new Date(completedAt), now)).toBe(expected)
  })
})

describe('isCorrectOption', () => {
  it.each([
    [1, 1, true], // acertou
    [1, 0, false], // errou
    [1, null, null], // ainda não escolheu nada
    [null, 1, null], // lição sem aposta real (checkbox de hoje)
    [null, null, null], // sem aposta real e sem escolha
  ])(
    'microDecisionCorrectOption=%s, selectedOption=%s → %s',
    (microDecisionCorrectOption, selectedOption, expected) => {
      expect(isCorrectOption({ microDecisionCorrectOption }, selectedOption)).toBe(expected)
    },
  )
})

describe('currentMicroDecisionStreak', () => {
  it('lista vazia → 0', () => {
    expect(currentMicroDecisionStreak([])).toBe(0)
  })

  it('conta os acertos seguidos mais recentes, do fim pro começo', () => {
    expect(
      currentMicroDecisionStreak([
        { completedAt: new Date('2026-09-01'), correct: false },
        { completedAt: new Date('2026-09-02'), correct: true },
        { completedAt: new Date('2026-09-03'), correct: true },
        { completedAt: new Date('2026-09-04'), correct: true },
      ]),
    ).toBe(3)
  })

  it('erro mais recente zera a sequência, mesmo com acertos antes dele', () => {
    expect(
      currentMicroDecisionStreak([
        { completedAt: new Date('2026-09-01'), correct: true },
        { completedAt: new Date('2026-09-02'), correct: true },
        { completedAt: new Date('2026-09-03'), correct: false },
      ]),
    ).toBe(0)
  })

  it('todos acertos → sequência é o tamanho da lista inteira', () => {
    expect(
      currentMicroDecisionStreak([
        { completedAt: new Date('2026-09-01'), correct: true },
        { completedAt: new Date('2026-09-02'), correct: true },
      ]),
    ).toBe(2)
  })
})

describe('buildMicroDecisionAttemptsChronological', () => {
  const lessonWithBet = { id: 'l1', microDecisionCorrectOption: 1 }
  const lessonWithoutBet = { id: 'l2', microDecisionCorrectOption: null }

  it('descarta progresso sem completedAt', () => {
    expect(
      buildMicroDecisionAttemptsChronological(
        [lessonWithBet],
        [{ lessonId: 'l1', completedAt: null, microDecisionSelectedOption: 1 }],
      ),
    ).toEqual([])
  })

  it('descarta progresso de lição sem aposta real', () => {
    expect(
      buildMicroDecisionAttemptsChronological(
        [lessonWithoutBet],
        [
          {
            lessonId: 'l2',
            completedAt: new Date('2026-09-01'),
            microDecisionSelectedOption: null,
          },
        ],
      ),
    ).toEqual([])
  })

  it('descarta progresso sem lição correspondente no catálogo', () => {
    expect(
      buildMicroDecisionAttemptsChronological(
        [],
        [{ lessonId: 'nope', completedAt: new Date('2026-09-01'), microDecisionSelectedOption: 1 }],
      ),
    ).toEqual([])
  })

  it('devolve em ordem cronológica ascendente, com o veredito calculado', () => {
    expect(
      buildMicroDecisionAttemptsChronological(
        [lessonWithBet],
        [
          { lessonId: 'l1', completedAt: new Date('2026-09-03'), microDecisionSelectedOption: 0 },
          { lessonId: 'l1', completedAt: new Date('2026-09-01'), microDecisionSelectedOption: 1 },
        ],
      ),
    ).toEqual([
      { completedAt: new Date('2026-09-01'), correct: true },
      { completedAt: new Date('2026-09-03'), correct: false },
    ])
  })
})

describe('tracksCompletedWithoutErrors', () => {
  it('trilha só entra se completa e sem nenhum erro na aposta', () => {
    expect(
      tracksCompletedWithoutErrors([
        {
          trackNumber: 0,
          completedAt: new Date(),
          microDecisionCorrectOption: 1,
          microDecisionSelectedOption: 1,
        },
        {
          trackNumber: 0,
          completedAt: new Date(),
          microDecisionCorrectOption: null,
          microDecisionSelectedOption: null,
        },
      ]),
    ).toEqual([0])
  })

  it('um erro em qualquer lição da trilha exclui a trilha inteira', () => {
    expect(
      tracksCompletedWithoutErrors([
        {
          trackNumber: 0,
          completedAt: new Date(),
          microDecisionCorrectOption: 1,
          microDecisionSelectedOption: 1,
        },
        {
          trackNumber: 0,
          completedAt: new Date(),
          microDecisionCorrectOption: 1,
          microDecisionSelectedOption: 0,
        },
      ]),
    ).toEqual([])
  })

  it('lição concluída com aposta real nunca respondida exclui a trilha', () => {
    expect(
      tracksCompletedWithoutErrors([
        {
          trackNumber: 0,
          completedAt: new Date(),
          microDecisionCorrectOption: 1,
          microDecisionSelectedOption: null,
        },
      ]),
    ).toEqual([])
  })

  it('lição incompleta exclui a trilha, mesmo sem erro registrado', () => {
    expect(
      tracksCompletedWithoutErrors([
        {
          trackNumber: 0,
          completedAt: null,
          microDecisionCorrectOption: 1,
          microDecisionSelectedOption: null,
        },
      ]),
    ).toEqual([])
  })

  it('várias trilhas sem erro voltam ordenadas por número', () => {
    expect(
      tracksCompletedWithoutErrors([
        {
          trackNumber: 2,
          completedAt: new Date(),
          microDecisionCorrectOption: null,
          microDecisionSelectedOption: null,
        },
        {
          trackNumber: 0,
          completedAt: new Date(),
          microDecisionCorrectOption: null,
          microDecisionSelectedOption: null,
        },
      ]),
    ).toEqual([0, 2])
  })
})

describe('countReviewedLessons', () => {
  it('conta só lições com lastReviewedAt preenchido', () => {
    expect(
      countReviewedLessons([
        { lastReviewedAt: new Date() },
        { lastReviewedAt: null },
        { lastReviewedAt: new Date() },
      ]),
    ).toBe(2)
  })

  it('lista vazia → 0', () => {
    expect(countReviewedLessons([])).toBe(0)
  })
})

describe('microDecisionResultFor', () => {
  const lessonWithOptions = { microDecisionOptions: ['Sim', 'Não'], microDecisionCorrectOption: 0 }
  const lessonWithoutOptions = { microDecisionOptions: null, microDecisionCorrectOption: null }

  it('acertou: correct=true, correctOptionLabel é a opção certa', () => {
    expect(microDecisionResultFor(lessonWithOptions, 0)).toEqual({
      correct: true,
      correctOptionLabel: 'Sim',
    })
  })

  it('errou: correct=false, correctOptionLabel continua sendo a opção certa (não a escolhida)', () => {
    expect(microDecisionResultFor(lessonWithOptions, 1)).toEqual({
      correct: false,
      correctOptionLabel: 'Sim',
    })
  })

  it('undefined quando selectedOption não veio nesta chamada', () => {
    expect(microDecisionResultFor(lessonWithOptions, undefined)).toBeUndefined()
  })

  it('undefined pra lição sem aposta real, mesmo com selectedOption presente', () => {
    expect(microDecisionResultFor(lessonWithoutOptions, 0)).toBeUndefined()
  })
})
