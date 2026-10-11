import { describe, expect, it } from 'vitest'
import { tallyVotes, type AgendaOption, type Vote } from './assembly'
import { buildScoreboard, readEffectPreview } from './scoreboard'
import { shareholderPolicies } from './shareholderPolicies'

const options = ['o1', 'o2'].map((id, position): AgendaOption => ({
  id,
  assemblyId: 'a',
  key: id,
  label: id,
  gain: 'g',
  loss: 'l',
  effect: {},
  position,
}))
const vote = (userId: string, optionId: string): Vote => ({
  assemblyId: 'a',
  userId,
  optionId,
  createdAt: new Date(),
  updatedAt: new Date(),
})
const snapshot = {
  takenAt: new Date(),
  holdings: [
    { userId: 'ana', quantity: 30 },
    { userId: 'bia', quantity: 10 },
    { userId: 'caio', quantity: 60 },
  ],
}

describe('buildScoreboard', () => {
  it('mostra votantes e % das ações entre quem votou, sem ações absolutas', () => {
    const tally = tallyVotes(
      options,
      [vote('ana', 'o1'), vote('bia', 'o2'), vote('caio', 'o2')],
      snapshot,
      shareholderPolicies,
      { minVoters: 0 },
    )
    const board = buildScoreboard(tally)
    expect(board).toEqual({
      voters: 3,
      options: [
        { optionId: 'o1', voters: 1, weightPercent: 30 },
        { optionId: 'o2', voters: 2, weightPercent: 70 },
      ],
    })
    expect(JSON.stringify(board)).not.toMatch(/quantity|weight"/)
  })

  it('sem votos tudo é zero (nada de divisão por zero) e quem não tem posição não pesa', () => {
    const empty = buildScoreboard(
      tallyVotes(options, [], snapshot, shareholderPolicies, { minVoters: 0 }),
    )
    expect(empty).toEqual({
      voters: 0,
      options: [
        { optionId: 'o1', voters: 0, weightPercent: 0 },
        { optionId: 'o2', voters: 0, weightPercent: 0 },
      ],
    })
    const outsider = buildScoreboard(
      tallyVotes(options, [vote('zeca', 'o1')], snapshot, shareholderPolicies, { minVoters: 0 }),
    )
    expect(outsider.voters).toBe(0)
  })

  it('arredonda para uma casa decimal', () => {
    const tally = tallyVotes(
      options,
      [vote('ana', 'o1'), vote('bia', 'o2')],
      {
        takenAt: new Date(),
        holdings: [
          { userId: 'ana', quantity: 1 },
          { userId: 'bia', quantity: 2 },
        ],
      },
      shareholderPolicies,
      { minVoters: 0 },
    )
    expect(buildScoreboard(tally).options.map((o) => o.weightPercent)).toEqual([33.3, 66.7])
  })
})

describe('readEffectPreview', () => {
  it('traduz métrica, sentido e intensidade, e ignora formato desconhecido', () => {
    expect(readEffectPreview({ metric: 'base_growth_pct', direction: 1, intensity: 0.8 })).toEqual({
      metric: 'growth',
      direction: 1,
      intensity: 0.8,
    })
    expect(
      readEffectPreview({ metric: 'quality_multiplier', direction: -1, intensity: 1 }),
    ).toEqual({ metric: 'quality', direction: -1, intensity: 1 })
    expect(readEffectPreview({ metric: 'preco', direction: 1, intensity: 1 })).toBeNull()
    expect(readEffectPreview({ metric: 'base_growth_pct', direction: 2, intensity: 1 })).toBeNull()
    expect(readEffectPreview({ metric: 'base_growth_pct', direction: 1, intensity: 0 })).toBeNull()
    expect(readEffectPreview({})).toBeNull()
  })
})
