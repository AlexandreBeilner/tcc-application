import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { createAgendaTemplate, listAgendaTemplates, setAgendaTemplateActive, updateAgendaTemplate } from '../../services/admin'
import type { AgendaTemplate } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminAssembleiaPautas } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAgendaTemplates: vi.fn(),
    createAgendaTemplate: vi.fn(),
    updateAgendaTemplate: vi.fn(),
    setAgendaTemplateActive: vi.fn(),
}))

const template = (overrides: Partial<AgendaTemplate> = {}): AgendaTemplate => ({
    key: 'capital_budget',
    sector: null,
    title: 'Orçamento de capital',
    description: 'A empresa separa parte do lucro para investir.',
    active: true,
    created_at: '2026-10-01T00:00:00Z',
    usage: { assemblies: 2, active_proposals: 1 },
    options: [
        {
            key: 'expandir',
            label: 'Ampliar',
            gain: 'Cresce.',
            loss: 'Margem menor.',
            effect: { metric: 'base_growth_pct', direction: 1, intensity: 0.8 },
        },
        {
            key: 'eficiencia',
            label: 'Eficiência',
            gain: 'Margem.',
            loss: 'Cresce menos.',
            effect: { metric: 'quality_multiplier', direction: 1, intensity: 0.8 },
        },
    ],
    ...overrides,
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminAssembleiaPautas />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const editor = () => screen.getByRole('region', { name: /Nova pauta|Editar/ })

function fillNewTemplate() {
    const form = editor()
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Política de dividendos' } })
    fireEvent.change(within(form).getByLabelText('Descrição'), { target: { value: 'A empresa decide quanto distribuir.' } })
    const [firstKey, secondKey] = within(form).getAllByLabelText('Chave da opção')
    fireEvent.change(firstKey, { target: { value: 'distribuir' } })
    fireEvent.change(secondKey, { target: { value: 'reter' } })
    for (const [i, name] of ['Rótulo', 'O que ganha', 'O que perde'].entries()) {
        const [a, b] = within(form).getAllByLabelText(name)
        fireEvent.change(a, { target: { value: `${name} A${i}` } })
        fireEvent.change(b, { target: { value: `${name} B${i}` } })
    }
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAgendaTemplates).mockResolvedValue([
        template(),
        template({
            key: 'debt_policy',
            title: 'Política de endividamento',
            active: false,
            sector: 'Varejo',
            usage: { assemblies: 0, active_proposals: 0 },
        }),
    ])
})

describe('AdminAssembleiaPautas', () => {
    it('lista as pautas com situação, setor e uso', async () => {
        renderPage()
        expect(await screen.findByText('Orçamento de capital')).toBeInTheDocument()
        expect(screen.getByText(/em 2 assembleias e 1 propostas ativas/)).toBeInTheDocument()
        expect(screen.getByText('Inativa')).toBeInTheDocument()
        expect(screen.getByText(/Varejo/)).toBeInTheDocument()
    })

    it('a chave da pauta nova é sugerida a partir do título', async () => {
        renderPage()
        await screen.findByText('Orçamento de capital')
        fireEvent.change(within(editor()).getByLabelText('Título'), { target: { value: 'Política de dividendos' } })
        expect(within(editor()).getByLabelText(/Chave \(definitiva/)).toHaveValue('politica_de_dividendos')
    })

    it('cria uma pauta com o conteúdo do formulário e avisa', async () => {
        vi.mocked(createAgendaTemplate).mockResolvedValue(template({ key: 'politica_de_dividendos' }))
        renderPage()
        await screen.findByText('Orçamento de capital')
        fillNewTemplate()
        fireEvent.click(within(editor()).getByRole('button', { name: 'Criar pauta' }))

        await waitFor(() => expect(createAgendaTemplate).toHaveBeenCalled())
        const [token, key, content] = vi.mocked(createAgendaTemplate).mock.calls[0]
        expect(token).toBe('tok')
        expect(key).toBe('politica_de_dividendos')
        expect(content).toMatchObject({ sector: null, title: 'Política de dividendos' })
        expect(content.options[0]).toEqual({
            key: 'distribuir',
            label: 'Rótulo A0',
            gain: 'O que ganha A1',
            loss: 'O que perde A2',
            effect: { metric: 'base_growth_pct', direction: 1, intensity: 0.5 },
        })
        expect(await screen.findByText('Pauta politica_de_dividendos criada e ativa.')).toBeInTheDocument()
    })

    it('campo faltando é apontado na tela, sem chamar a API', async () => {
        renderPage()
        await screen.findByText('Orçamento de capital')
        fireEvent.click(within(editor()).getByRole('button', { name: 'Criar pauta' }))
        expect(await screen.findByText(/Informe a chave da opção 1/)).toBeInTheDocument()
        expect(createAgendaTemplate).not.toHaveBeenCalled()
    })

    it('editar carrega a pauta, trava a chave, avisa do uso e salva sem trocar a chave', async () => {
        vi.mocked(updateAgendaTemplate).mockResolvedValue(template({ title: 'Novo título' }))
        renderPage()
        fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0])

        const form = editor()
        expect(within(form).getByLabelText(/Chave \(definitiva/)).toBeDisabled()
        expect(within(form).getByText(/já foi usada em 2 assembleias/)).toBeInTheDocument()
        fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Novo título' } })
        fireEvent.click(within(form).getByRole('button', { name: 'Salvar alterações' }))

        await waitFor(() => expect(updateAgendaTemplate).toHaveBeenCalled())
        const [, key, content] = vi.mocked(updateAgendaTemplate).mock.calls[0]
        expect(key).toBe('capital_budget')
        expect(content.title).toBe('Novo título')
        expect(content.options[1].effect).toEqual({ metric: 'quality_multiplier', direction: 1, intensity: 0.8 })
    })

    it('mostra a regra recusada pelo backend (422) sem perder o que foi digitado', async () => {
        vi.mocked(updateAgendaTemplate).mockRejectedValue(
            new ApiError(422, 'o efeito da opção 1 precisa de intensidade de 0 (exclusive) a 1'),
        )
        renderPage()
        fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0])
        fireEvent.change(within(editor()).getByLabelText('Título'), { target: { value: 'Outro título' } })
        fireEvent.click(within(editor()).getByRole('button', { name: 'Salvar alterações' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('intensidade de 0 (exclusive) a 1')
        expect(within(editor()).getByLabelText('Título')).toHaveValue('Outro título')
    })

    it('desativar pede confirmação e nunca apaga', async () => {
        vi.mocked(setAgendaTemplateActive).mockResolvedValue(template({ active: false }))
        renderPage()
        fireEvent.click((await screen.findAllByRole('button', { name: 'Desativar' }))[0])
        const dialog = screen.getByRole('dialog', { name: 'Desativar Orçamento de capital?' })
        expect(dialog).toHaveTextContent('As assembleias já abertas continuam')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }))

        await waitFor(() => expect(setAgendaTemplateActive).toHaveBeenCalledWith('tok', 'capital_budget', false))
        expect(screen.queryByRole('button', { name: 'Apagar' })).not.toBeInTheDocument()
    })

    it('adiciona e remove opções dentro dos limites (2 a 4)', async () => {
        renderPage()
        await screen.findByText('Orçamento de capital')
        const form = editor()
        expect(within(form).queryByRole('button', { name: /Remover opção/ })).not.toBeInTheDocument()
        fireEvent.click(within(form).getByRole('button', { name: 'Adicionar opção' }))
        fireEvent.click(within(form).getByRole('button', { name: 'Adicionar opção' }))
        expect(within(form).getAllByLabelText('Chave da opção')).toHaveLength(4)
        expect(within(form).queryByRole('button', { name: 'Adicionar opção' })).not.toBeInTheDocument()
        fireEvent.click(within(form).getByRole('button', { name: 'Remover opção 4' }))
        expect(within(form).getAllByLabelText('Chave da opção')).toHaveLength(3)
    })
})
