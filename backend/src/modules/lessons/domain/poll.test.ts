import { describe, expect, it } from 'vitest'
import { POLL_MIN_VOTES, buildPollResults, buildPollState, isValidPollOption } from './poll'
import type { PollBlock } from './widgets/lessonBlocks'

const block: PollBlock = {
  type: 'poll',
  id: 'p1',
  prompt: 'O que você faz?',
  options: ['a', 'b', 'c'],
}

describe('buildPollResults', () => {
  it('não mostra resultado abaixo do mínimo de votos', () => {
    expect(buildPollResults(3, [{ option: 0, count: POLL_MIN_VOTES - 1 }])).toBeUndefined()
    expect(buildPollResults(3, [])).toBeUndefined()
  })

  it('mostra a partir do mínimo de votos (20 ou mais)', () => {
    expect(buildPollResults(3, [{ option: 1, count: POLL_MIN_VOTES }])).toEqual({
      total: 20,
      percentages: [0, 100, 0],
    })
  })

  it.each([
    [
      [
        { option: 0, count: 10 },
        { option: 1, count: 10 },
        { option: 2, count: 10 },
      ],
      [34, 33, 33],
    ],
    [
      [
        { option: 0, count: 13 },
        { option: 1, count: 7 },
      ],
      [65, 35, 0],
    ],
    [
      [
        { option: 0, count: 1 },
        { option: 1, count: 1 },
        { option: 2, count: 28 },
      ],
      [4, 3, 93],
    ],
  ])('a soma dos percentuais fecha em 100 (%j)', (counts, expected) => {
    const results = buildPollResults(3, counts)
    expect(results?.percentages).toEqual(expected)
    expect(results?.percentages.reduce((sum, n) => sum + n, 0)).toBe(100)
  })

  it('ignora contagem de opção que não existe mais na enquete', () => {
    const results = buildPollResults(2, [
      { option: 0, count: 15 },
      { option: 1, count: 15 },
      { option: 3, count: 100 },
    ])
    expect(results).toEqual({ total: 30, percentages: [50, 50] })
  })
})

describe('buildPollState', () => {
  it('leva o voto e, com votos suficientes, o resultado agregado', () => {
    expect(buildPollState(block, 2, [{ option: 2, count: 4 }])).toEqual({ pollId: 'p1', vote: 2 })
    expect(buildPollState(block, 2, [{ option: 2, count: 25 }])).toEqual({
      pollId: 'p1',
      vote: 2,
      results: { total: 25, percentages: [0, 0, 100] },
    })
  })
})

describe('isValidPollOption', () => {
  it.each([
    [0, true],
    [2, true],
    [3, false],
    [-1, false],
    [1.5, false],
    ['1', false],
  ])('opção %j -> %s', (option, expected) => {
    expect(isValidPollOption(block, option)).toBe(expected)
  })
})
