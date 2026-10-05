import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { emptyDraft } from '../../../features/admin/lessonDraft'
import type { LessonDraft } from '../../../features/admin/lessonDraft'
import { LessonEditorForm } from '.'

// Estado real do formulário, pra o teste acompanhar o que o admin vê depois de cada edição.
function Harness({ initial = emptyDraft(), onDraft }: { initial?: LessonDraft; onDraft?: (draft: LessonDraft) => void }) {
    const [draft, setDraft] = useState(initial)
    return (
        <LessonEditorForm
            draft={draft}
            onChange={(next) => {
                setDraft(next)
                onDraft?.(next)
            }}
        />
    )
}

describe('LessonEditorForm', () => {
    it('edita os campos de texto', () => {
        let latest = emptyDraft()
        render(<Harness onDraft={(d) => (latest = d)} />)

        fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Juros compostos' } })
        fireEvent.change(screen.getByLabelText('Cenário'), { target: { value: 'Maria investe.' } })

        expect(latest).toMatchObject({ title: 'Juros compostos', scenarioText: 'Maria investe.' })
    })

    it('o ticker do indicador só aparece no tipo indicador de ativo ao vivo', () => {
        render(<Harness />)

        expect(screen.queryByLabelText('Ticker do ativo ao vivo')).not.toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Tipo de micro-decisão'), { target: { value: 'live_indicator' } })
        expect(screen.getByLabelText('Ticker do ativo ao vivo')).toBeInTheDocument()
    })

    it('widget embutido troca a aposta por um aviso', () => {
        render(<Harness />)

        expect(screen.getByLabelText('Esta lição tem aposta com resposta certa')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Tipo de micro-decisão'), { target: { value: 'growth_calculator' } })
        expect(screen.queryByLabelText('Esta lição tem aposta com resposta certa')).not.toBeInTheDocument()
        expect(screen.getByText(/já são a interação deste passo/)).toBeInTheDocument()
    })

    it('aposta: liga, edita opções, marca a correta, adiciona e remove respeitando 2 a 6', () => {
        let latest = emptyDraft()
        render(<Harness onDraft={(d) => (latest = d)} />)

        fireEvent.click(screen.getByLabelText('Esta lição tem aposta com resposta certa'))
        fireEvent.change(screen.getByLabelText('Texto da opção 1'), { target: { value: 'Sim' } })
        fireEvent.change(screen.getByLabelText('Texto da opção 2'), { target: { value: 'Não' } })
        fireEvent.click(screen.getByLabelText('Opção 2 é a correta'))
        expect(latest).toMatchObject({ hasBet: true, options: ['Sim', 'Não'], correctOption: 1 })

        // Com 2 opções não dá pra remover.
        expect(screen.getByRole('button', { name: 'Remover a opção 1' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar opção' }))
        expect(screen.getByLabelText('Texto da opção 3')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Remover a opção 1' }))
        expect(latest).toMatchObject({ options: ['Não', ''], correctOption: 0 })
    })

    it('chave de produto liga o campo do ticker do produto', () => {
        let latest = emptyDraft()
        render(<Harness onDraft={(d) => (latest = d)} />)

        expect(screen.queryByLabelText('Ticker do produto liberado')).not.toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Tesouro Selic'))
        fireEvent.change(screen.getByLabelText('Ticker do produto liberado'), { target: { value: 'LFT2029' } })

        expect(latest).toMatchObject({ unlocksKeys: ['asset:tesouro_selic'], unlocksAssetTicker: 'LFT2029' })
    })

    it('desabilitado trava os campos', () => {
        render(<LessonEditorForm draft={emptyDraft()} onChange={() => undefined} disabled />)

        expect(screen.getByLabelText('Título')).toBeDisabled()
    })
})
