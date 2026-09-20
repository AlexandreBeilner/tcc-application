import { describe, expect, it } from 'vitest'
import { nextCopomSimulatedDay } from '.'

describe('nextCopomSimulatedDay', () => {
    it('motor nunca rodou (dia 0) aponta pra primeira reunião, dia 21', () => {
        expect(nextCopomSimulatedDay(0)).toBe(21)
    })

    it('dia no meio de um ciclo aponta pro próximo múltiplo de 21', () => {
        expect(nextCopomSimulatedDay(35)).toBe(42)
    })

    it('dia que já é reunião aponta pra próxima, não pra ele mesmo', () => {
        expect(nextCopomSimulatedDay(21)).toBe(42)
    })

    it('dia logo antes de uma reunião aponta pra ela', () => {
        expect(nextCopomSimulatedDay(20)).toBe(21)
    })
})
