import { describe, expect, it } from 'vitest'
import type { AdminLessonContent } from '../../../services/admin'
import { addOption, draftFromContent, draftToContent, emptyDraft, isDraftDirty, removeOption, toggleUnlockKey } from '.'

const saved: AdminLessonContent = {
    title: 'Tesouro Selic',
    central_concept: 'Conceito',
    scenario_text: 'Cenário',
    micro_decision_prompt: 'Pense',
    micro_decision_type: 'reflection',
    micro_decision_asset_ticker: null,
    micro_decision_options: ['a', 'b', 'c'],
    micro_decision_correct_option: 2,
    revelation_text: 'Revelação',
    unlocks_description: null,
    unlocks_keys: ['asset:tesouro_selic'],
    unlocks_asset_ticker: 'LFT2029',
}

describe('draftFromContent / draftToContent', () => {
    it('ida e volta preserva o conteúdo salvo', () => {
        expect(draftToContent(draftFromContent(saved))).toEqual(saved)
    })

    it('lição sem aposta volta como sem aposta', () => {
        const noBet = { ...saved, micro_decision_options: null, micro_decision_correct_option: null }

        const draft = draftFromContent(noBet)

        expect(draft.hasBet).toBe(false)
        expect(draftToContent(draft)).toEqual(noBet)
    })

    it('só manda o que vale pro tipo: widget embutido descarta a aposta e ticker de outro tipo some', () => {
        const draft = { ...draftFromContent(saved), microDecisionType: 'growth_calculator' as const, microDecisionAssetTicker: 'VALR3' }

        const content = draftToContent(draft)

        expect(content.micro_decision_options).toBeNull()
        expect(content.micro_decision_correct_option).toBeNull()
        expect(content.micro_decision_asset_ticker).toBeNull()
    })

    it('indicador de ativo ao vivo leva o ticker, e o do produto só vai com chave de produto', () => {
        const live = { ...draftFromContent(saved), microDecisionType: 'live_indicator' as const, microDecisionAssetTicker: ' VALR3 ' }
        expect(draftToContent(live).micro_decision_asset_ticker).toBe('VALR3')

        const noAsset = { ...draftFromContent(saved), unlocksKeys: ['portfolio'], unlocksAssetTicker: 'LFT2029' }
        expect(draftToContent(noAsset).unlocks_asset_ticker).toBeNull()
    })

    it('campo opcional em branco vira null e o título é aparado', () => {
        const draft = { ...emptyDraft(), title: '  Título  ', unlocksDescription: '   ' }

        expect(draftToContent(draft)).toMatchObject({ title: 'Título', unlocks_description: null })
    })
})

describe('isDraftDirty', () => {
    it('não conta espaço sobrando nem campo de outro tipo, só mudança real', () => {
        const draft = draftFromContent(saved)

        expect(isDraftDirty(draft, saved)).toBe(false)
        expect(isDraftDirty({ ...draft, title: ' Tesouro Selic ' }, saved)).toBe(false)
        expect(isDraftDirty({ ...draft, title: 'Outro' }, saved)).toBe(true)
        expect(isDraftDirty({ ...draft, correctOption: 0 }, saved)).toBe(true)
    })
})

describe('opções da aposta', () => {
    it('adiciona até 6 e remove até sobrar 2', () => {
        let draft = { ...emptyDraft(), options: ['a', 'b'] }
        for (let i = 0; i < 10; i++) draft = addOption(draft)
        expect(draft.options).toHaveLength(6)
        for (let i = 0; i < 10; i++) draft = removeOption(draft, 0)
        expect(draft.options).toHaveLength(2)
    })

    it('remover mantém a correta apontando pra mesma opção', () => {
        const draft = { ...emptyDraft(), options: ['a', 'b', 'c', 'd'], correctOption: 2 }

        expect(removeOption(draft, 0)).toMatchObject({ options: ['b', 'c', 'd'], correctOption: 1 })
        expect(removeOption(draft, 3)).toMatchObject({ options: ['a', 'b', 'c'], correctOption: 2 })
        expect(removeOption(draft, 2)).toMatchObject({ options: ['a', 'b', 'd'], correctOption: 1 })
    })
})

describe('toggleUnlockKey', () => {
    it('liga e desliga a chave', () => {
        const on = toggleUnlockKey(emptyDraft(), 'portfolio')
        expect(on.unlocksKeys).toEqual(['portfolio'])
        expect(toggleUnlockKey(on, 'portfolio').unlocksKeys).toEqual([])
    })
})
