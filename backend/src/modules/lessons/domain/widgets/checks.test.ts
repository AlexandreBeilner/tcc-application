import { describe, expect, it } from 'vitest'
import {
  checkpointIdsForStep,
  classifyEstimate,
  findCheckBlock,
  isCheckCorrect,
  isValidCheckResponse,
  resolvesOnFirstAnswer,
  scoreOrder,
  shuffledIndices,
  toPublicBlocks,
} from './lessonBlocks'
import type { CheckBlock, LessonBlocks } from './lessonBlocks'

const single: CheckBlock = {
  type: 'check',
  id: 'c1',
  kind: 'single',
  prompt: 'p',
  options: ['a', 'b', 'c'],
  answer: 1,
  explanation: 'por quê 1',
}
const trueFalse: CheckBlock = {
  type: 'check',
  id: 'c2',
  kind: 'true_false',
  prompt: 'p',
  answer: false,
  explanation: 'por quê 2',
}

const blocks: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [{ type: 'text', markup: 'oi' }, single],
    microDecision: [],
    revelation: [trueFalse],
  },
}

describe('checks (RC.3.2)', () => {
  it('versão pública não leva gabarito, explicação nem tolerância', () => {
    const json = JSON.stringify(toPublicBlocks(blocks))

    expect(json).not.toContain('por quê')
    expect(json).not.toContain('"answer"')
    expect(toPublicBlocks(blocks)?.phases.revelation[0]).toMatchObject({
      kind: 'true_false',
      options: ['Verdadeiro', 'Falso'],
    })
  })

  it('versão pública mantém o resumo "O que ficou" só quando existe (LJ.1.5)', () => {
    expect(toPublicBlocks(blocks)).not.toHaveProperty('summary')
    const withSummary = { ...blocks, summary: ['Uma ideia.', 'Outra ideia.'] }
    expect(toPublicBlocks(withSummary)?.summary).toEqual(['Uma ideia.', 'Outra ideia.'])
  })

  it('findCheckBlock e checkpointIdsForStep respeitam as fases', () => {
    expect(findCheckBlock(blocks, 'c2')).toBe(trueFalse)
    expect(findCheckBlock(blocks, 'nope')).toBeUndefined()
    expect(checkpointIdsForStep(blocks, 0)).toEqual(['c1'])
    expect(checkpointIdsForStep(blocks, 1)).toEqual([])
    expect(checkpointIdsForStep(blocks, 2)).toEqual(['c2'])
    expect(checkpointIdsForStep(blocks, 3)).toEqual([])
    expect(checkpointIdsForStep(null, 0)).toEqual([])
  })

  it.each([
    [single, { selectedOption: 1 }, true],
    [single, { selectedOption: 0 }, false],
    [trueFalse, { selectedOption: 1 }, true],
    [trueFalse, { selectedOption: 0 }, false],
  ])('isCheckCorrect %#', (block, response, expected) => {
    expect(isCheckCorrect(block, response)).toBe(expected)
  })

  it.each([
    [single, { selectedOption: 3 }, false],
    [single, { selectedOption: -1 }, false],
    [trueFalse, { selectedOption: 2 }, false],
    [trueFalse, { selectedOption: 1 }, true],
  ])('isValidCheckResponse %#', (block, response, expected) => {
    expect(isValidCheckResponse(block, response)).toBe(expected)
  })

  describe('estimativa (LJ.2.1)', () => {
    // R$ 1.000 a 10% ao ano em 20 anos: 1000 x 1,1^20 = 6.727,50. Tolerância de 10%.
    const answer = 1000 * 1.1 ** 20
    const estimate: CheckBlock = {
      type: 'check',
      id: 'e1',
      kind: 'estimate',
      prompt: 'Quanto viram?',
      min: 1000,
      max: 10000,
      step: 100,
      unit: 'brl',
      answer,
      tolerancePct: 10,
      explanation: 'por quê e1',
    }

    it('versão pública leva só a régua: sem valor real, tolerância nem explicação', () => {
      const json = JSON.stringify(
        toPublicBlocks({ ...blocks, phases: { ...blocks.phases, scenario: [estimate] } }),
      )

      expect(json).toContain('"range":{"min":1000,"max":10000,"step":100,"unit":"brl"}')
      expect(json).not.toContain('6727')
      expect(json).not.toContain('tolerancePct')
      expect(json).not.toContain('por quê')
    })

    it.each([
      ['no valor real', answer, 'exact'],
      ['na borda da tolerância', answer * 1.1, 'exact'],
      ['logo fora da tolerância', answer * 1.11, 'close'],
      ['na borda do dobro da tolerância', answer * 0.8, 'close'],
      ['longe (chute típico)', 3000, 'far'],
    ])('classifyEstimate: %s', (_label, guess, band) => {
      expect(classifyEstimate(estimate as never, guess).band).toBe(band)
    })

    it('classifyEstimate devolve o valor real e a faixa em volta dele', () => {
      const outcome = classifyEstimate(estimate as never, 3000)

      expect(outcome.value).toBeCloseTo(6727.5, 1)
      expect(outcome.low).toBeCloseTo(answer * 0.9, 6)
      expect(outcome.high).toBeCloseTo(answer * 1.1, 6)
    })

    it.each([
      [{ value: 3000 }, true],
      [{ value: 1000 }, true],
      [{ value: 10000 }, true],
      [{ value: 999 }, false],
      [{ value: 10001 }, false],
      [{ value: Number.NaN }, false],
      [{ value: Infinity }, false],
      [{ selectedOption: 0 }, false],
      [{}, false],
    ])('isValidCheckResponse da estimativa %#', (response, expected) => {
      expect(isValidCheckResponse(estimate, response)).toBe(expected)
    })

    it('só "na mosca" conta como correta, e só a estimativa resolve na 1ª resposta', () => {
      expect(isCheckCorrect(estimate, { value: 6700 })).toBe(true)
      expect(isCheckCorrect(estimate, { value: 3000 })).toBe(false)
      expect(resolvesOnFirstAnswer(estimate)).toBe(true)
      expect(resolvesOnFirstAnswer(single)).toBe(false)
      expect(resolvesOnFirstAnswer(trueFalse)).toBe(false)
    })
  })
  describe('ordenar (LJ.2.3)', () => {
    const order: CheckBlock = {
      type: 'check',
      id: 'o1',
      kind: 'order',
      prompt: 'Do menos ao mais arriscado',
      items: ['Tesouro Selic', 'CDB', 'FII', 'Ação pequena'],
      answer: [0, 1, 2, 3],
      lowLabel: 'Menos risco',
      highLabel: 'Mais risco',
      explanation: 'por quê o1',
    }
    const publicItems = () => {
      const result = toPublicBlocks({ ...blocks, phases: { ...blocks.phases, scenario: [order] } })
      return (result?.phases.scenario[0] as { items: string[] }).items
    }

    it('versão pública embaralha os itens, mantém os rótulos de ponta e não leva gabarito nem explicação', () => {
      const json = JSON.stringify(
        toPublicBlocks({ ...blocks, phases: { ...blocks.phases, scenario: [order] } }),
      )

      expect([...publicItems()].sort()).toEqual([...(order as { items: string[] }).items].sort())
      expect(publicItems()).not.toEqual((order as { items: string[] }).items)
      expect(json).toContain('"lowLabel":"Menos risco"')
      expect(json).not.toContain('"answer"')
      expect(json).not.toContain('por quê')
    })

    it('o embaralhamento é o mesmo a cada chamada (a revisão mostra a mesma ordem)', () => {
      expect(publicItems()).toEqual(publicItems())
    })

    it.each(['a', 'b', 'c', 'o1', 'ordem-risco', 'x'.repeat(40)])(
      'shuffledIndices com a semente %s é determinístico, é permutação e respeita isSolved',
      (seed) => {
        const first = shuffledIndices(5, seed, (p) => p.every((v, i) => v === i))
        expect(shuffledIndices(5, seed, (p) => p.every((v, i) => v === i))).toEqual(first)
        expect([...first].sort()).toEqual([0, 1, 2, 3, 4])
        expect(first.every((v, i) => v === i)).toBe(false)
      },
    )

    // Com os itens embaralhados, o gabarito, em índices do que o cliente vê, vem de volta do servidor.
    const correctSequence = () => {
      const shown = publicItems()
      return (order as { items: string[] }).items.map((item) => shown.indexOf(item))
    }

    it('a ordem certa, nos índices embaralhados que o cliente recebeu, acerta tudo', () => {
      const sequence = correctSequence()

      expect(isValidCheckResponse(order, { sequence })).toBe(true)
      expect(isCheckCorrect(order, { sequence })).toBe(true)
      expect(scoreOrder(order as never, sequence)).toEqual({ correctCount: 4, total: 4 })
    })

    it('trocar dois itens vizinhos deixa 2 de 4 no lugar certo', () => {
      const sequence = correctSequence()
      ;[sequence[0], sequence[1]] = [sequence[1] as number, sequence[0] as number]

      expect(isCheckCorrect(order, { sequence })).toBe(false)
      expect(scoreOrder(order as never, sequence)).toEqual({ correctCount: 2, total: 4 })
    })

    it('a ordem inversa em 4 itens não acerta nenhuma posição', () => {
      const sequence = correctSequence().reverse()

      expect(scoreOrder(order as never, sequence)).toEqual({ correctCount: 0, total: 4 })
    })

    it('respeita um `answer` que não é a ordem de autoria', () => {
      const reversed = { ...order, answer: [3, 2, 1, 0] } as CheckBlock
      const shown = (
        toPublicBlocks({ ...blocks, phases: { ...blocks.phases, scenario: [reversed] } })?.phases
          .scenario[0] as { items: string[] }
      ).items
      const sequence = [...(order as { items: string[] }).items]
        .reverse()
        .map((item) => shown.indexOf(item))

      expect(isCheckCorrect(reversed, { sequence })).toBe(true)
    })

    it.each([
      [{ sequence: [0, 1, 2, 3] }, true],
      [{ sequence: [3, 2, 1, 0] }, true],
      [{ sequence: [0, 1, 2] }, false],
      [{ sequence: [0, 1, 2, 2] }, false],
      [{ sequence: [0, 1, 2, 4] }, false],
      [{ sequence: [0, 1, 2, -1] }, false],
      [{ sequence: [0, 1, 2, 1.5] }, false],
      [{ selectedOption: 0 }, false],
      [{}, false],
    ])('isValidCheckResponse do ordenar %#', (response, expected) => {
      expect(isValidCheckResponse(order, response)).toBe(expected)
    })

    it('ordenar não resolve na primeira resposta (errar não avança)', () => {
      expect(resolvesOnFirstAnswer(order)).toBe(false)
    })
  })
})
