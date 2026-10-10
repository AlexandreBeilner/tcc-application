import { describe, expect, it } from 'vitest'
import { assetUnlockKey, findLessonUnlocking, safeUnlockPath, unlockedKeysFor } from '.'
import type { Lesson } from '../../../services/lessons'
import type { LessonUnlockHint } from './types'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: overrides.id ?? 'id',
        code: overrides.code ?? '0.1',
        title: overrides.title ?? 'Lição',
        trackNumber: overrides.trackNumber ?? 0,
        trackName: overrides.trackName ?? 'Fundamentos',
        sortOrder: overrides.sortOrder ?? 1,
        centralConcept: overrides.centralConcept ?? 'Conceito',
        scenarioText: overrides.scenarioText ?? '',
        microDecisionPrompt: overrides.microDecisionPrompt ?? '',
        microDecisionType: overrides.microDecisionType ?? 'reflection',
        microDecisionAssetTicker: overrides.microDecisionAssetTicker ?? null,
        revelationText: overrides.revelationText ?? '',
        unlocksDescription: overrides.unlocksDescription ?? '',
        unlocksKeys: overrides.unlocksKeys ?? [],
        unlocksAssetTicker: overrides.unlocksAssetTicker ?? null,
        microDecisionOptions: overrides.microDecisionOptions ?? null,
        status: overrides.status ?? 'locked',
        currentStep: overrides.currentStep ?? 0,
        waived: overrides.waived ?? false,
    }
}

describe('unlockedKeysFor com trilha paralela (RC.4.4)', () => {
    it('lição concluída da trilha paralela não adianta as chaves da corrente', () => {
        const chain = [
            lesson({ id: 'a', sortOrder: 1, status: 'completed', unlocksKeys: ['portfolio'] }),
            lesson({ id: 'b', sortOrder: 2, status: 'available', unlocksKeys: ['calculator'] }),
        ]
        const parallel = lesson({ id: 'f', trackNumber: 4, sortOrder: 3, status: 'completed' })
        expect(unlockedKeysFor([...chain, parallel])).toEqual(new Set(['portfolio']))
    })
})

describe('unlockedKeysFor', () => {
    it('lição dispensada conta como satisfeita e mantém as chaves dela (N.24)', () => {
        const lessons = [
            lesson({ sortOrder: 1, unlocksKeys: ['portfolio'], status: 'completed' }),
            lesson({ sortOrder: 2, unlocksKeys: ['calculator'], status: 'available', waived: true }),
            lesson({ sortOrder: 3, unlocksKeys: ['news_feed'], status: 'completed' }),
            lesson({ sortOrder: 4, unlocksKeys: ['asset:acao'], status: 'available' }),
        ]

        expect(unlockedKeysFor(lessons)).toEqual(new Set(['portfolio', 'calculator', 'news_feed']))
    })

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
    it('devolve code/title/reachable da lição cujo unlocksKeys contém a chave, já alcançável', () => {
        const lessons = [
            lesson({ id: 'l-2-3', code: '2.3', title: 'Nomenclatura de tickers', unlocksKeys: ['asset:acao'], status: 'available' }),
        ]

        expect(findLessonUnlocking('asset:acao', lessons)).toEqual({
            id: 'l-2-3',
            code: '2.3',
            title: 'Nomenclatura de tickers',
            reachable: true,
        })
    })

    it('reachable: false quando a lição encontrada ainda está locked pro usuário', () => {
        const lessons = [lesson({ id: 'l-2-3', code: '2.3', unlocksKeys: ['asset:acao'], status: 'locked' })]

        expect(findLessonUnlocking('asset:acao', lessons)?.reachable).toBe(false)
    })

    it('reachable: true também quando a lição encontrada já está completed', () => {
        const lessons = [lesson({ id: 'l-2-3', code: '2.3', unlocksKeys: ['asset:acao'], status: 'completed' })]

        expect(findLessonUnlocking('asset:acao', lessons)?.reachable).toBe(true)
    })

    it('undefined quando nenhuma lição desbloqueia a chave', () => {
        expect(findLessonUnlocking('asset:acao', [lesson({ unlocksKeys: [] })])).toBeUndefined()
    })
})

describe('safeUnlockPath', () => {
    function hint(overrides: Partial<LessonUnlockHint>): LessonUnlockHint {
        return { id: 'l-1', code: '0.1', title: 'Lição', reachable: true, ...overrides }
    }

    it('navega direto pra lição quando reachable', () => {
        expect(safeUnlockPath(hint({ id: 'l-2-3', reachable: true }))).toBe('/trilha/l-2-3')
    })

    it('cai no Mapa da Trilha quando a lição encontrada ainda não é alcançável', () => {
        expect(safeUnlockPath(hint({ id: 'l-2-3', reachable: false }))).toBe('/trilha')
    })
})

describe('assetUnlockKey', () => {
    it('monta a chave no formato asset:<AssetType>', () => {
        expect(assetUnlockKey('acao')).toBe('asset:acao')
    })
})
