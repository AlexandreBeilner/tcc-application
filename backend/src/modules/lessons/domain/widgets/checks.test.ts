import { describe, expect, it } from 'vitest'
import {
  checkpointIdsForStep,
  findCheckBlock,
  isCheckCorrect,
  isValidCheckResponse,
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
const numeric: CheckBlock = {
  type: 'check',
  id: 'c3',
  kind: 'numeric',
  prompt: 'p',
  answer: 12.26,
  tolerance: 0.05,
  unit: '%',
  explanation: 'por quê 3',
}

const blocks: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [{ type: 'text', markup: 'oi' }, single],
    microDecision: [],
    revelation: [trueFalse, numeric],
  },
}

describe('checks (RC.3.2)', () => {
  it('versão pública não leva gabarito, explicação nem tolerância', () => {
    const json = JSON.stringify(toPublicBlocks(blocks))

    expect(json).not.toContain('por quê')
    expect(json).not.toContain('"answer"')
    expect(json).not.toContain('tolerance')
    expect(toPublicBlocks(blocks)?.phases.revelation[0]).toMatchObject({
      kind: 'true_false',
      options: ['Verdadeiro', 'Falso'],
    })
    expect(toPublicBlocks(blocks)?.phases.revelation[1]).toMatchObject({
      kind: 'numeric',
      unit: '%',
    })
  })

  it('findCheckBlock e checkpointIdsForStep respeitam as fases', () => {
    expect(findCheckBlock(blocks, 'c3')).toBe(numeric)
    expect(findCheckBlock(blocks, 'nope')).toBeUndefined()
    expect(checkpointIdsForStep(blocks, 0)).toEqual(['c1'])
    expect(checkpointIdsForStep(blocks, 1)).toEqual([])
    expect(checkpointIdsForStep(blocks, 2)).toEqual(['c2', 'c3'])
    expect(checkpointIdsForStep(blocks, 3)).toEqual([])
    expect(checkpointIdsForStep(null, 0)).toEqual([])
  })

  it.each([
    [single, { selectedOption: 1 }, true],
    [single, { selectedOption: 0 }, false],
    [trueFalse, { selectedOption: 1 }, true],
    [trueFalse, { selectedOption: 0 }, false],
    [numeric, { value: 12.26 }, true],
    [numeric, { value: 12.3 }, true],
    [numeric, { value: 12.32 }, false],
    [numeric, { value: 9.5 }, false],
  ])('isCheckCorrect %#', (block, response, expected) => {
    expect(isCheckCorrect(block, response)).toBe(expected)
  })

  it.each([
    [single, { selectedOption: 3 }, false],
    [single, { selectedOption: -1 }, false],
    [single, { value: 1 }, false],
    [trueFalse, { selectedOption: 2 }, false],
    [trueFalse, { selectedOption: 1 }, true],
    [numeric, { selectedOption: 1 }, false],
    [numeric, { value: Number.NaN }, false],
    [numeric, { value: 3 }, true],
  ])('isValidCheckResponse %#', (block, response, expected) => {
    expect(isValidCheckResponse(block, response)).toBe(expected)
  })
})
