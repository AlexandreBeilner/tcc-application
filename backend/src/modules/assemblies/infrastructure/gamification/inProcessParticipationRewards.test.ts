import { describe, expect, it, vi } from 'vitest'
import { createInProcessParticipationRewards } from './inProcessParticipationRewards'

describe('createInProcessParticipationRewards', () => {
  it('concede o XP configurado, com a assembleia no motivo', async () => {
    const awardXp = { execute: vi.fn(async () => undefined) }
    const rewards = createInProcessParticipationRewards(awardXp, () => 10)

    await rewards.rewardFirstVote('u1', 'asm-1')

    expect(awardXp.execute).toHaveBeenCalledWith({
      userId: 'u1',
      amount: 10,
      reason: 'assembly_vote:asm-1',
    })
  })

  it('lê o valor na hora, então mudar o parâmetro vale já', async () => {
    const awardXp = { execute: vi.fn(async () => undefined) }
    let xp = 10
    const rewards = createInProcessParticipationRewards(awardXp, () => xp)
    xp = 25

    await rewards.rewardFirstVote('u1', 'asm-1')

    expect(awardXp.execute).toHaveBeenCalledWith(expect.objectContaining({ amount: 25 }))
  })

  it('valor zero não concede nada', async () => {
    const awardXp = { execute: vi.fn(async () => undefined) }

    await createInProcessParticipationRewards(awardXp, () => 0).rewardFirstVote('u1', 'asm-1')

    expect(awardXp.execute).not.toHaveBeenCalled()
  })
})
