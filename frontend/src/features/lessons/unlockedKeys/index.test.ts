import { describe, expect, it } from 'vitest'
import { assetUnlockKey, findLessonUnlocking, unlockedKeysFor } from '.'
import type { Lesson } from '../../../services/lessons'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: overrides.id ?? 'id',
        code: overrides.code ?? '0.1',
        title: overrides.title ?? 'Lição',
        trackNumber: overrides.trackNumber ?? 0,
        trackName: overrides.trackName ?? 'Fundamentos',
        sortOrder: overrides.sortOrder ?? 1,
        centralConcept: overrides.centralConcept ?? 'Conceito',
        unlocksDescription: overrides.unlocksDescription ?? '',
        unlocksKeys: overrides.unlocksKeys ?? [],
        status: overrides.status ?? 'locked',
        currentStep: overrides.currentStep ?? 0,
    }
}

describe('unlockedKeysFor', () => {
    it('nenhuma lição completed → nenhuma chave desbloqueada', () => {
        const lessons = [
            lesson({ sortOrder: 1, unlocksKeys: ['portfolio'], status: 'available' }),
            lesson({ sortOrder: 2, unlocksKeys: ['calculator'], status: 'locked' }),
        ]

        expect(unlockedKeysFor(lessons)).toEqual(new Set())
    })

    it('só chaves de lições com sortOrder <= quantidade de completed', () => {
        const lessons = [
            lesson({ sortOrder: 1, unlocksKeys: ['portfolio'], status: 'completed' }),
            lesson({ sortOrder: 2, unlocksKeys: ['calculator'], status: 'available' }),
        ]

        expect(unlockedKeysFor(lessons)).toEqual(new Set(['portfolio']))
    })

    it('une chaves de múltiplas lições concluídas, sem duplicar', () => {
        const lessons = [
            lesson({ sortOrder: 1, unlocksKeys: ['portfolio'], status: 'completed' }),
            lesson({ sortOrder: 2, unlocksKeys: ['asset:tesouro_selic'], status: 'completed' }),
            lesson({ sortOrder: 3, unlocksKeys: ['asset:tesouro_selic'], status: 'available' }),
        ]

        expect(unlockedKeysFor(lessons)).toEqual(new Set(['portfolio', 'asset:tesouro_selic']))
    })
})

describe('findLessonUnlocking', () => {
    it('devolve code/title da lição cujo unlocksKeys contém a chave', () => {
        const lessons = [
            lesson({ id: 'l-2-3', code: '2.3', title: 'Nomenclatura de tickers', unlocksKeys: ['asset:acao'] }),
        ]

        expect(findLessonUnlocking('asset:acao', lessons)).toEqual({
            id: 'l-2-3',
            code: '2.3',
            title: 'Nomenclatura de tickers',
        })
    })

    it('undefined quando nenhuma lição desbloqueia a chave', () => {
        expect(findLessonUnlocking('asset:acao', [lesson({ unlocksKeys: [] })])).toBeUndefined()
    })
})

describe('assetUnlockKey', () => {
    it('monta a chave no formato asset:<AssetType>', () => {
        expect(assetUnlockKey('acao')).toBe('asset:acao')
    })
})
