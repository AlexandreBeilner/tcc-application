import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { AdminLessonContent } from '../../../services/admin'
import { LessonPreview } from '.'

const content: AdminLessonContent = {
    title: 'Juros compostos',
    central_concept: 'Conceito',
    scenario_text: 'Primeiro cartão.\n\nSegundo cartão.',
    micro_decision_prompt: 'Qual rende mais?',
    micro_decision_type: 'reflection',
    micro_decision_asset_ticker: null,
    micro_decision_options: ['Simples', 'Compostos'],
    micro_decision_correct_option: 1,
    revelation_text: '[revelar] Os compostos rendem mais.',
    unlocks_description: 'Libera a calculadora',
    unlocks_keys: ['calculator'],
    unlocks_asset_ticker: null,
}

function renderPreview(overrides: Partial<AdminLessonContent> = {}) {
    render(
        <MemoryRouter>
            <LessonPreview content={{ ...content, ...overrides }} lessons={[]} />
        </MemoryRouter>,
    )
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('LessonPreview', () => {
    it('abre no cenário com o título e navega entre os cartões', () => {
        renderPreview()

        expect(screen.getByRole('heading', { name: 'Juros compostos' })).toBeInTheDocument()
        expect(screen.getByText('Primeiro cartão.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cartão anterior' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão' }))
        expect(screen.getByText('Segundo cartão.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Próximo cartão' })).toBeDisabled()
    })

    it('micro-decisão mostra as opções da aposta, e a Revelação dá o selo de acerto ou erro conforme a escolha', () => {
        renderPreview()

        fireEvent.click(tab('Micro-decisão'))
        fireEvent.click(screen.getByRole('button', { name: 'Simples' }))
        fireEvent.click(tab('Revelação'))
        expect(screen.getByText('Quase. A resposta certa era: Compostos')).toBeInTheDocument()

        fireEvent.click(tab('Micro-decisão'))
        fireEvent.click(screen.getByRole('button', { name: 'Compostos' }))
        fireEvent.click(tab('Revelação'))
        expect(screen.getByText('Você acertou')).toBeInTheDocument()
    })

    it('revelação com [revelar] esconde o resultado até o toque', () => {
        renderPreview()

        fireEvent.click(tab('Revelação'))
        expect(screen.queryByText('Os compostos rendem mais.')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))
        expect(screen.getByText('Os compostos rendem mais.')).toBeInTheDocument()
    })

    it('desbloqueio mostra o texto e o atalho da funcionalidade liberada', () => {
        renderPreview()

        fireEvent.click(tab('Desbloqueio'))

        expect(screen.getByText('Libera a calculadora')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ir pra Calculadora' })).toBeDisabled()
    })

    it('com produto liberado mostra o Comprar agora com o ticker, e sem texto usa a frase padrão', () => {
        renderPreview({ unlocks_keys: ['asset:acao'], unlocks_asset_ticker: 'VALR3', unlocks_description: null })

        fireEvent.click(tab('Desbloqueio'))

        expect(screen.getByText('Você avançou mais um passo na trilha.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Comprar agora (VALR3)' })).toBeInTheDocument()
    })

    it('widgets ao vivo aparecem como aviso do que entra ali', () => {
        renderPreview({ micro_decision_type: 'growth_calculator', micro_decision_options: null, micro_decision_correct_option: null })
        fireEvent.click(tab('Micro-decisão'))
        expect(screen.getByText('Aqui entra a calculadora de crescimento.')).toBeInTheDocument()
    })

    it('indicador de ativo ao vivo avisa na Revelação qual ativo entra', () => {
        renderPreview({ micro_decision_type: 'live_indicator', micro_decision_asset_ticker: 'VALR3', revelation_text: 'Texto' })
        fireEvent.click(tab('Revelação'))
        expect(screen.getByText('Aqui entram os indicadores ao vivo de VALR3.')).toBeInTheDocument()
    })

    it('lição sem título ainda mostra um título de apoio', () => {
        renderPreview({ title: '' })

        expect(screen.getByRole('heading', { name: 'Título da lição' })).toBeInTheDocument()
    })
})
