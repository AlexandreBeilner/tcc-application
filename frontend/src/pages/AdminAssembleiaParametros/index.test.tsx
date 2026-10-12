import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import {
    getEngineSettings,
    listAssemblySettings,
    resetAssemblySetting,
    resetEngineSetting,
    updateAssemblySetting,
    updateEngineSetting,
} from '../../services/admin'
import type { AssemblySetting, EngineSettings } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminAssembleiaParametros } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    listAssemblySettings: vi.fn(),
    updateAssemblySetting: vi.fn(),
    resetAssemblySetting: vi.fn(),
    getEngineSettings: vi.fn(),
    updateEngineSetting: vi.fn(),
    resetEngineSetting: vi.fn(),
}))

const base = { default: 3, min: 1, max: 1000, overridden: false, updated_by: null, updated_at: null }
const assemblySettings = (overrides: Partial<AssemblySetting> = {}): AssemblySetting[] => [
    { key: 'min_voters', value: 3, ...base, ...overrides },
    { key: 'duration_days', value: 7, ...base, default: 7, min: 1, max: 60 },
]

const engineSettings = (): EngineSettings => ({
    editable: [
        {
            key: 'governance_ramp_ticks',
            value: 30,
            default: 30,
            min: 1,
            max: 365,
            overridden: false,
            updated_by: null,
            updated_at: null,
            version: 0,
        },
    ],
    read_only: [],
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminAssembleiaParametros />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const card = (name: string) => screen.findByRole('article', { name })

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
    vi.mocked(listAssemblySettings).mockResolvedValue(assemblySettings())
    vi.mocked(getEngineSettings).mockResolvedValue(engineSettings())
})

describe('AdminAssembleiaParametros: destinação do lucro (Fase F2)', () => {
    const engineRow = (key: string, value: number, def: number, min: number, max: number) => ({
        key,
        value,
        default: def,
        min,
        max,
        overridden: false,
        updated_by: null,
        updated_at: null,
        version: 0,
    })

    it('mostra os parâmetros de payout, prêmio da PN e retenção do dividendo, cada um com padrão e faixa', async () => {
        vi.mocked(getEngineSettings).mockResolvedValue({
            editable: [
                engineRow('governance_payout_step_centipp', 1000, 1000, 1, 5000),
                engineRow('governance_payout_min_pct', 20, 20, 0, 100),
                engineRow('governance_payout_max_pct', 90, 90, 0, 100),
                engineRow('governance_payout_cooldown_days', 90, 90, 0, 720),
                engineRow('governance_premium_step_centipp', 500, 500, 1, 2000),
                engineRow('governance_premium_min_pct', 10, 10, 10, 100),
                engineRow('governance_premium_max_pct', 30, 30, 10, 100),
                engineRow('governance_hold_declarations', 1, 1, 0, 1),
                engineRow('governance_declaration_safety_days', 60, 60, 1, 80),
            ] as EngineSettings['editable'],
            read_only: [],
        })
        renderPage()
        const payout = await card('Faixa de efeito no payout')
        expect(within(payout).getByText(/Faixa permitida: 1 a 5000/)).toBeInTheDocument()
        expect(within(payout).getByText(/\(padrão\)/)).toBeInTheDocument()
        expect(await card('Payout mínimo da empresa')).toBeInTheDocument()
        expect(await card('Payout máximo da empresa')).toBeInTheDocument()
        expect(await card('Intervalo entre mudanças de destinação do lucro')).toBeInTheDocument()
        expect(await card('Faixa de efeito no prêmio da ação PN')).toBeInTheDocument()
        expect(await card('Prêmio mínimo da ação PN')).toBeInTheDocument()
        expect(await card('Prêmio máximo da ação PN')).toBeInTheDocument()
        const hold = await card('Reter o dividendo até a assembleia decidir')
        expect(within(hold).getByText(/desligue este junto/)).toBeInTheDocument()
        expect(within(hold).getByText(/Faixa permitida: 0 a 1/)).toBeInTheDocument()
        expect(await card('Prazo de segurança do dividendo retido')).toBeInTheDocument()
    })
})

describe('AdminAssembleiaParametros', () => {
    it('mostra os parâmetros do backend e os do motor, cada um com padrão e faixa', async () => {
        renderPage()
        const quorum = await card('Mínimo de votantes')
        expect(within(quorum).getByText(/Faixa permitida: 1 a 1000/)).toBeInTheDocument()
        expect(within(quorum).getByText(/\(padrão\)/)).toBeInTheDocument()
        expect(await card('Rampa do efeito')).toBeInTheDocument()
        expect(getEngineSettings).toHaveBeenCalledWith('tok', 'governance')
    })

    it('avisa que a edição vale para as próximas assembleias', async () => {
        renderPage()
        expect(await screen.findByText(/A mudança vale para as próximas assembleias/)).toBeInTheDocument()
    })

    it('salvar um parâmetro do backend pede confirmação e grava', async () => {
        vi.mocked(updateAssemblySetting).mockResolvedValue(assemblySettings({ value: 5, overridden: true }))
        renderPage()
        const quorum = await card('Mínimo de votantes')
        fireEvent.change(within(quorum).getByLabelText('Novo valor'), { target: { value: '5' } })
        fireEvent.click(within(quorum).getByRole('button', { name: 'Salvar' }))

        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveTextContent('De 3 para 5 pessoas')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Alterar' }))

        await waitFor(() => expect(updateAssemblySetting).toHaveBeenCalledWith('tok', 'min_voters', 5))
        expect(await screen.findByText(/Mínimo de votantes: 5 pessoas\. Vale para as próximas assembleias/)).toBeInTheDocument()
    })

    it('salvar um parâmetro do motor usa a rota de parâmetros do motor', async () => {
        vi.mocked(updateEngineSetting).mockResolvedValue(engineSettings())
        renderPage()
        const ramp = await card('Rampa do efeito')
        fireEvent.change(within(ramp).getByLabelText('Novo valor'), { target: { value: '60' } })
        fireEvent.click(within(ramp).getByRole('button', { name: 'Salvar' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Alterar' }))

        await waitFor(() => expect(updateEngineSetting).toHaveBeenCalledWith('tok', 'governance_ramp_ticks', 60))
        expect(updateAssemblySetting).not.toHaveBeenCalled()
    })

    it('valida o valor na tela, sem chamar a API', async () => {
        renderPage()
        const quorum = await card('Mínimo de votantes')
        fireEvent.change(within(quorum).getByLabelText('Novo valor'), { target: { value: '5000' } })
        fireEvent.click(within(quorum).getByRole('button', { name: 'Salvar' }))
        expect(await within(quorum).findByRole('alert')).toHaveTextContent('Use um valor entre 1 e 1000.')
        fireEvent.change(within(quorum).getByLabelText('Novo valor'), { target: { value: 'abc' } })
        fireEvent.click(within(quorum).getByRole('button', { name: 'Salvar' }))
        expect(await within(quorum).findByRole('alert')).toHaveTextContent('Digite um número inteiro.')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(updateAssemblySetting).not.toHaveBeenCalled()
    })

    it('o mesmo valor atual é recusado', async () => {
        renderPage()
        const quorum = await card('Mínimo de votantes')
        fireEvent.change(within(quorum).getByLabelText('Novo valor'), { target: { value: '3' } })
        fireEvent.click(within(quorum).getByRole('button', { name: 'Salvar' }))
        expect(await within(quorum).findByRole('alert')).toHaveTextContent('O valor já é esse.')
    })

    it('restaurar só vale para parâmetro alterado e confirma antes', async () => {
        vi.mocked(listAssemblySettings).mockResolvedValue(
            assemblySettings({ value: 5, overridden: true, updated_at: '2026-10-11T12:00:00Z' }),
        )
        vi.mocked(resetAssemblySetting).mockResolvedValue(assemblySettings())
        renderPage()
        const quorum = await card('Mínimo de votantes')
        const duration = await card('Duração da votação')
        expect(within(duration).getByRole('button', { name: 'Restaurar padrão' })).toBeDisabled()
        fireEvent.click(within(quorum).getByRole('button', { name: 'Restaurar padrão' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restaurar' }))

        await waitFor(() => expect(resetAssemblySetting).toHaveBeenCalledWith('tok', 'min_voters'))
        expect(resetEngineSetting).not.toHaveBeenCalled()
        expect(await screen.findByText(/voltou ao padrão \(3 pessoas\)/)).toBeInTheDocument()
    })

    it('mostra a faixa recusada pelo backend (422)', async () => {
        vi.mocked(updateAssemblySetting).mockRejectedValue(new ApiError(422, 'valor deve ser um inteiro de 1 a 1000'))
        renderPage()
        const quorum = await card('Mínimo de votantes')
        fireEvent.change(within(quorum).getByLabelText('Novo valor'), { target: { value: '9' } })
        fireEvent.click(within(quorum).getByRole('button', { name: 'Salvar' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Alterar' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('valor deve ser um inteiro de 1 a 1000')
    })
})
