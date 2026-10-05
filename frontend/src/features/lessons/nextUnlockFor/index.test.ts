import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { nextUnlockFor } from '.'

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

describe('nextUnlockFor', () => {
    it('lição dispensada nunca é o alvo e conta como satisfeita na distância (N.24)', () => {
        const lessons = [
            lesson({ sortOrder: 1, status: 'completed', unlocksDescription: '' }),
            lesson({ sortOrder: 2, status: 'available', waived: true, unlocksDescription: 'Acesso à calculadora' }),
            lesson({ sortOrder: 3, status: 'completed', unlocksDescription: '' }),
            lesson({ sortOrder: 4, status: 'available', unlocksDescription: 'Compra real de CDB' }),
        ]

        expect(nextUnlockFor(lessons)).toEqual({ description: 'Compra real de CDB', lessonsRemaining: 1 })
    })

    it('sem lições, não há próximo desbloqueio', () => {
        expect(nextUnlockFor([])).toBeNull()
    })

    it('lição available com desbloqueio: falta 1 lição (ela mesma)', () => {
        const lessons = [
            lesson({ sortOrder: 1, status: 'completed', unlocksDescription: 'Acesso ao Portfólio' }),
            lesson({ sortOrder: 2, status: 'available', unlocksDescription: 'Acesso à Trilha 1' }),
        ]

        expect(nextUnlockFor(lessons)).toEqual({ description: 'Acesso à Trilha 1', lessonsRemaining: 1 })
    })

    it('desbloqueio mais à frente: falta a distância até o sortOrder da lição-alvo', () => {
        const lessons = [
            lesson({ sortOrder: 1, status: 'completed', unlocksDescription: '' }),
            lesson({ sortOrder: 2, status: 'available', unlocksDescription: '' }),
            lesson({ sortOrder: 3, status: 'locked', unlocksDescription: '' }),
            lesson({ sortOrder: 4, status: 'locked', unlocksDescription: 'Compra real de LCI/LCA' }),
        ]

        expect(nextUnlockFor(lessons)).toEqual({ description: 'Compra real de LCI/LCA', lessonsRemaining: 3 })
    })

    it('pula lições concluídas/pendentes sem desbloqueio e pega a primeira com description', () => {
        const lessons = [
            lesson({ sortOrder: 1, status: 'completed', unlocksDescription: 'Acesso ao Portfólio' }),
            lesson({ sortOrder: 2, status: 'completed', unlocksDescription: '' }),
            lesson({ sortOrder: 3, status: 'available', unlocksDescription: '' }),
            lesson({ sortOrder: 4, status: 'locked', unlocksDescription: 'Compra real de Tesouro Selic' }),
            lesson({ sortOrder: 5, status: 'locked', unlocksDescription: 'Compra real de CDB' }),
        ]

        expect(nextUnlockFor(lessons)).toEqual({ description: 'Compra real de Tesouro Selic', lessonsRemaining: 2 })
    })

    it('nenhuma lição pendente com desbloqueio: sem badge, não um estado vazio estranho', () => {
        const lessons = [
            lesson({ sortOrder: 1, status: 'completed', unlocksDescription: 'Acesso ao Portfólio' }),
            lesson({ sortOrder: 2, status: 'available', unlocksDescription: '' }),
            lesson({ sortOrder: 3, status: 'locked', unlocksDescription: '' }),
        ]

        expect(nextUnlockFor(lessons)).toBeNull()
    })

    it('tudo concluído: sem próximo desbloqueio', () => {
        const lessons = [
            lesson({ sortOrder: 1, status: 'completed', unlocksDescription: 'Acesso ao Portfólio' }),
            lesson({ sortOrder: 2, status: 'completed', unlocksDescription: 'Mundo aberto' }),
        ]

        expect(nextUnlockFor(lessons)).toBeNull()
    })
})
