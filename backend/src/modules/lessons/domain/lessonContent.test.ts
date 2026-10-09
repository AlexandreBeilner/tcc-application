import { describe, expect, it } from 'vitest'
import { buildCatalogLesson } from '../test/fakes/lessonFixtures'
import { changedFields, checkLessonContent, contentOf, type LessonContent } from './lessonContent'

function content(overrides: Partial<LessonContent> = {}): LessonContent {
  return { ...contentOf(buildCatalogLesson()), ...overrides }
}

const errorsOf = (overrides: Partial<LessonContent>) =>
  checkLessonContent(content(overrides)).errors

describe('checkLessonContent', () => {
  it('conteúdo válido não tem recusa nem aviso', () => {
    expect(checkLessonContent(content())).toEqual({ errors: [], warnings: [] })
  })

  it('exige título e conceito central, e respeita os limites de tamanho', () => {
    expect(errorsOf({ title: '  ' })).toContain('o título é obrigatório')
    expect(errorsOf({ centralConcept: '' })).toContain('o conceito central é obrigatório')
    expect(errorsOf({ title: 'x'.repeat(151) })).toContain('o título passa de 150 caracteres')
    expect(errorsOf({ scenarioText: 'x'.repeat(5001) })).toContain(
      'o campo cenário passa de 5000 caracteres',
    )
    expect(errorsOf({ unlocksDescription: 'x'.repeat(501) })).toContain(
      'a descrição do desbloqueio passa de 500 caracteres',
    )
  })

  describe('aposta', () => {
    const bet = { microDecisionOptions: ['a', 'b'], microDecisionCorrectOption: 1 }

    it('aceita 2 a 6 opções com a correta dentro da faixa', () => {
      expect(errorsOf(bet)).toEqual([])
      expect(
        errorsOf({
          microDecisionOptions: ['a', 'b', 'c', 'd', 'e', 'f'],
          microDecisionCorrectOption: 5,
        }),
      ).toEqual([])
    })

    it.each([
      [
        { microDecisionOptions: ['a'], microDecisionCorrectOption: 0 },
        'a aposta tem de 2 a 6 opções',
      ],
      [
        {
          microDecisionOptions: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          microDecisionCorrectOption: 0,
        },
        'a aposta tem de 2 a 6 opções',
      ],
      [
        { microDecisionOptions: ['a', 'b'], microDecisionCorrectOption: 2 },
        'a opção correta precisa ser uma das opções da aposta',
      ],
      [
        { microDecisionOptions: ['a', 'b'], microDecisionCorrectOption: -1 },
        'a opção correta precisa ser uma das opções da aposta',
      ],
      [
        { microDecisionOptions: ['a', 'b'], microDecisionCorrectOption: 0.5 },
        'a opção correta precisa ser uma das opções da aposta',
      ],
      [
        { microDecisionOptions: ['a', 'b'], microDecisionCorrectOption: null },
        'a aposta precisa das opções e da opção correta juntas',
      ],
      [
        { microDecisionOptions: null, microDecisionCorrectOption: 0 },
        'a aposta precisa das opções e da opção correta juntas',
      ],
      [
        { microDecisionOptions: ['a', ' '], microDecisionCorrectOption: 0 },
        'cada opção precisa de texto e no máximo 200 caracteres',
      ],
      [
        { microDecisionOptions: ['a', 'a'], microDecisionCorrectOption: 0 },
        'as opções da aposta não podem se repetir',
      ],
    ] as const)('recusa %j', (overrides, message) => {
      expect(
        errorsOf({
          ...overrides,
          microDecisionOptions: overrides.microDecisionOptions
            ? [...overrides.microDecisionOptions]
            : null,
        }),
      ).toContain(message)
    })

    it('widget embutido (calculadora, comparador) não leva aposta', () => {
      expect(errorsOf({ ...bet, microDecisionType: 'growth_calculator' })).toContain(
        'a calculadora e o comparador já são a interação do passo: não levam aposta',
      )
    })
  })

  describe('ticker da micro-decisão', () => {
    it('indicador de ativo ao vivo exige ticker, e os outros tipos não aceitam', () => {
      expect(errorsOf({ microDecisionType: 'live_indicator' })).toContain(
        'o indicador de ativo ao vivo exige o ticker do ativo',
      )
      expect(
        errorsOf({ microDecisionType: 'live_indicator', microDecisionAssetTicker: 'VALR3' }),
      ).toEqual([])
      expect(errorsOf({ microDecisionAssetTicker: 'VALR3' })).toContain(
        'só o indicador de ativo ao vivo usa ticker na micro-decisão',
      )
    })
  })

  describe('chaves de desbloqueio', () => {
    it('aceita funcionalidades e produtos do vocabulário fechado com o ticker do produto', () => {
      expect(errorsOf({ unlocksKeys: ['portfolio', 'calculator', 'news_feed'] })).toEqual([])
      expect(
        errorsOf({ unlocksKeys: ['asset:cri', 'asset:cra'], unlocksAssetTicker: 'CRI2028' }),
      ).toEqual([])
    })

    it('recusa chave fora do vocabulário, repetida, e produto sem ticker (e o contrário)', () => {
      expect(errorsOf({ unlocksKeys: ['carteira'] })).toContain(
        'chave de desbloqueio desconhecida: carteira',
      )
      expect(errorsOf({ unlocksKeys: ['asset:bitcoin'], unlocksAssetTicker: 'X' })).toContain(
        'chave de desbloqueio desconhecida: asset:bitcoin',
      )
      expect(errorsOf({ unlocksKeys: ['portfolio', 'portfolio'] })).toContain(
        'há chaves de desbloqueio repetidas',
      )
      expect(errorsOf({ unlocksKeys: ['asset:acao'] })).toContain(
        'chave de produto (asset:*) exige o ticker do produto desbloqueado',
      )
      expect(errorsOf({ unlocksKeys: ['portfolio'], unlocksAssetTicker: 'VALR3' })).toContain(
        'o ticker do produto desbloqueado só vale com uma chave de produto (asset:*)',
      )
    })
  })

  it('travessão vira aviso (não bloqueia) e diz o campo', () => {
    const result = checkLessonContent(
      content({
        scenarioText: 'Antes — depois',
        microDecisionOptions: ['sim — claro', 'não'],
        microDecisionCorrectOption: 0,
      }),
    )

    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([
      'o campo cenário usa travessão (—) como pontuação; o texto do produto evita',
      'uma das opções da aposta usa travessão (—) como pontuação; o texto do produto evita',
    ])
  })
})

describe('changedFields', () => {
  it('lista só os campos que mudaram, comparando listas por valor', () => {
    const before = content({ unlocksKeys: ['portfolio'] })

    expect(changedFields(before, { ...before })).toEqual([])
    expect(
      changedFields(before, { ...before, title: 'Novo', unlocksKeys: ['portfolio', 'calculator'] }),
    ).toEqual(['title', 'unlocksKeys'])
  })
})
