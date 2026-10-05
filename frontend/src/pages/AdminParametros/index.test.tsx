import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getEngineSettings, resetEngineSetting, updateEngineSetting } from '../../services/admin'
import type { EngineSettings } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminParametros } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    getEngineSettings: vi.fn(),
    updateEngineSetting: vi.fn(),
    resetEngineSetting: vi.fn(),
}))

const settings = (overrides: Partial<EngineSettings['editable'][number]> = {}): EngineSettings => ({
    editable: [
        { key: 'ticks_per_day', value: 5, default: 5, min: 1, max: 24, overridden: false, updated_by: null, updated_at: null, version: 0 },
        { key: 'max_catch_up', value: 3, default: 3, min: 1, max: 30, overridden: false, updated_by: null, updated_at: null, version: 0 },
    ].map((s) => (s.key === 'ticks_per_day' ? { ...s, ...overrides } : s)) as EngineSettings['editable'],
    read_only: [{ key: 'initial_capital', value: 'R$ 10000.00', reason: 'Capital inicial é igual pra toda conta nova (RNF06).' }],
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminParametros />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const card = (name: string) => screen.getByRole('article', { name })

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(getEngineSettings).mockResolvedValue(settings())
})

describe('AdminParametros', () => {
    it('mostra os editáveis com valor, padrão e faixa, e os somente leitura sem controle', async () => {
        renderPage()
        const ticks = await screen.findByRole('article', { name: 'Dias simulados por dia real' })
        expect(within(ticks).getByText(/Faixa permitida: 1 a 24/)).toBeInTheDocument()
        expect(within(ticks).getByText('(padrão)', { exact: false })).toBeInTheDocument()
        const readOnly = screen.getByRole('region', { name: 'Parâmetros somente leitura' })
        expect(within(readOnly).getByText('Capital inicial por conta')).toBeInTheDocument()
        expect(within(readOnly).getByText('R$ 10000.00')).toBeInTheDocument()
        expect(within(readOnly).queryByRole('textbox')).not.toBeInTheDocument()
        expect(within(readOnly).queryByRole('button')).not.toBeInTheDocument()
    })

    it('valor fora da faixa é recusado na tela, sem chamar a API', async () => {
        renderPage()
        const ticks = await screen.findByRole('article', { name: 'Dias simulados por dia real' })
        fireEvent.change(within(ticks).getByRole('textbox'), { target: { value: '99' } })
        fireEvent.click(within(ticks).getByRole('button', { name: 'Salvar' }))
        expect(await within(ticks).findByText('Use um valor entre 1 e 24.')).toBeInTheDocument()
        expect(updateEngineSetting).not.toHaveBeenCalled()
    })

    it('salvar pede confirmação e envia a chave e o valor', async () => {
        vi.mocked(updateEngineSetting).mockResolvedValue(settings({ value: 12, overridden: true }))
        renderPage()
        const ticks = await screen.findByRole('article', { name: 'Dias simulados por dia real' })
        fireEvent.change(within(ticks).getByRole('textbox'), { target: { value: '12' } })
        fireEvent.click(within(ticks).getByRole('button', { name: 'Salvar' }))
        expect(screen.getByText(/de 5 para 12/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
        await waitFor(() => expect(updateEngineSetting).toHaveBeenCalledWith('tok', 'ticks_per_day', 12))
        expect(await screen.findByRole('status')).toHaveTextContent('Vale a partir do próximo tick agendado')
    })

    it('mostra a mensagem do motor quando ele recusa o valor', async () => {
        vi.mocked(updateEngineSetting).mockRejectedValue(new ApiError(422, 'ticks_per_day precisa ser um inteiro entre 1 e 24'))
        renderPage()
        const ticks = await screen.findByRole('article', { name: 'Dias simulados por dia real' })
        fireEvent.change(within(ticks).getByRole('textbox'), { target: { value: '12' } })
        fireEvent.click(within(ticks).getByRole('button', { name: 'Salvar' }))
        fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'O motor recusou o valor: ticks_per_day precisa ser um inteiro entre 1 e 24',
        )
    })

    it('restaurar padrão só habilita quando o valor foi alterado e confirma antes de enviar', async () => {
        vi.mocked(getEngineSettings).mockResolvedValue(settings({ value: 12, overridden: true, updated_at: '2026-10-03T12:00:00Z' }))
        vi.mocked(resetEngineSetting).mockResolvedValue(settings())
        renderPage()
        const ticks = await screen.findByRole('article', { name: 'Dias simulados por dia real' })
        expect(within(card('Recuperação máxima depois de uma parada')).getByRole('button', { name: 'Restaurar padrão' })).toBeDisabled()
        fireEvent.click(within(ticks).getByRole('button', { name: 'Restaurar padrão' }))
        fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }))
        await waitFor(() => expect(resetEngineSetting).toHaveBeenCalledWith('tok', 'ticks_per_day'))
    })

    it('mostra erro de carregamento sem derrubar a tela', async () => {
        vi.mocked(getEngineSettings).mockRejectedValue(new ApiError(500, 'x'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os parâmetros')
    })
})
