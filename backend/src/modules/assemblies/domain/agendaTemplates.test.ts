import { describe, expect, it } from 'vitest'
import {
  validateTemplateInput,
  validateTemplateKey,
  type AgendaTemplateInput,
} from './agendaTemplates'
import { InvalidAgendaTemplateError } from './errors'

const option = (key: string, overrides: Record<string, unknown> = {}) => ({
  key,
  label: `Rótulo ${key}`,
  gain: 'O que ganha.',
  loss: 'O que perde.',
  effect: { metric: 'base_growth_pct', direction: 1, intensity: 0.5 },
  ...overrides,
})

const valid: AgendaTemplateInput = {
  sector: 'Varejo',
  title: 'Expansão de lojas',
  description: 'A rede avalia abrir novas lojas no próximo ano.',
  options: [
    option('expandir'),
    option('conter', { effect: { metric: 'quality_multiplier', direction: -1, intensity: 1 } }),
  ],
}

describe('validação das pautas do painel', () => {
  it('aceita uma pauta de dois lados e devolve o conteúdo aparado', () => {
    const result = validateTemplateInput({
      ...valid,
      title: '  Expansão de lojas  ',
      sector: '  Varejo ',
    })
    expect(result.title).toBe('Expansão de lojas')
    expect(result.sector).toBe('Varejo')
    expect(result.options).toHaveLength(2)
  })

  it('setor vazio vira pauta geral', () => {
    expect(validateTemplateInput({ ...valid, sector: '  ' }).sector).toBeNull()
    expect(validateTemplateInput({ ...valid, sector: null }).sector).toBeNull()
  })

  it('o efeito guarda só métrica, sentido e intensidade', () => {
    const result = validateTemplateInput({
      ...valid,
      options: [
        option('aa', {
          effect: { metric: 'base_growth_pct', direction: 1, intensity: 0.5, extra: 99 },
        }),
        option('bb'),
      ],
    })
    expect(result.options[0].effect).toEqual({
      metric: 'base_growth_pct',
      direction: 1,
      intensity: 0.5,
    })
  })

  it.each([
    ['uma opção só', [option('aa')]],
    ['cinco opções', ['aa', 'bb', 'cc', 'dd', 'ee'].map((k) => option(k))],
    ['chaves de opção repetidas', [option('aa'), option('aa')]],
    ['chave de opção inválida', [option('A b'), option('bb')]],
    [
      'métrica desconhecida',
      [option('aa', { effect: { metric: 'preco', direction: 1, intensity: 0.5 } }), option('bb')],
    ],
    [
      'sentido inválido',
      [
        option('aa', { effect: { metric: 'base_growth_pct', direction: 0, intensity: 0.5 } }),
        option('bb'),
      ],
    ],
    [
      'intensidade zero',
      [
        option('aa', { effect: { metric: 'base_growth_pct', direction: 1, intensity: 0 } }),
        option('bb'),
      ],
    ],
    [
      'intensidade acima de 1',
      [
        option('aa', { effect: { metric: 'base_growth_pct', direction: 1, intensity: 1.2 } }),
        option('bb'),
      ],
    ],
    ['rótulo curto', [option('aa', { label: 'ab' }), option('bb')]],
  ])('recusa %s', (_name, options) => {
    expect(() => validateTemplateInput({ ...valid, options })).toThrow(InvalidAgendaTemplateError)
  })

  it.each([
    ['título curto', { title: 'ab' }],
    ['descrição curta', { description: 'curta' }],
    ['título com travessão', { title: 'Expansão — lojas' }],
    ['descrição com meia-risca', { description: 'A rede avalia – de novo – abrir lojas.' }],
  ])('recusa %s', (_name, patch) => {
    expect(() => validateTemplateInput({ ...valid, ...patch })).toThrow(InvalidAgendaTemplateError)
  })

  it('travessão também é recusado dentro de uma opção', () => {
    expect(() =>
      validateTemplateInput({
        ...valid,
        options: [option('aa', { gain: 'Cresce — e rápido.' }), option('bb')],
      }),
    ).toThrow(/travessão/)
  })

  it('valida a chave da pauta', () => {
    expect(validateTemplateKey('capital_budget')).toBe('capital_budget')
    for (const bad of ['ab', 'Capital', '1abc', 'tem espaço', 'a'.repeat(61)]) {
      expect(() => validateTemplateKey(bad), bad).toThrow(InvalidAgendaTemplateError)
    }
  })
})
