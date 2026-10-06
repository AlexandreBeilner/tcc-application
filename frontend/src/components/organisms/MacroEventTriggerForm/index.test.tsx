import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { listAssets } from '../../../services/market'
import { triggerMacroEvent } from '../../../services/admin'
import { MacroEventTriggerForm } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({ listAssets: vi.fn() }))
vi.mock('../../../services/admin', () => ({ triggerMacroEvent: vi.fn(), listMacroEvents: vi.fn() }))

function renderForm(onTriggered = vi.fn()) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MacroEventTriggerForm onTriggered={onTriggered} />
        </QueryClientProvider>,
    )
    return { onTriggered }
}

function selectOption(ariaLabel: string, optionLabel: string) {
    fireEvent.click(screen.getByRole('button', { name: ariaLabel }))
    fireEvent.click(screen.getByRole('option', { name: optionLabel }))
}

describe('MacroEventTriggerForm (tela 10.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listAssets).mockResolvedValue({
            assets: [{ id: 'a1', ticker: 'BNDD4', name: 'Banco D S.A.', type: 'acao', is_sandbox: false }],
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('nasce no modo template, com o alvo padrão do tipo Setor', () => {
        renderForm()
        expect(screen.getByRole('button', { name: 'Template' })).toBeInTheDocument()
        expect(screen.queryByPlaceholderText(/Ex: Nova legislação/)).not.toBeInTheDocument()
    })

    it('só pede ações ao catálogo pro seletor de ativo (FII/ETF/renda fixa não são alvos válidos)', async () => {
        renderForm()
        await waitFor(() => expect(listAssets).toHaveBeenCalled())
        expect(vi.mocked(listAssets).mock.calls.every((call) => call[1] === 'acao')).toBe(true)
    })

    it('alterna pro modo avulso e mostra os campos textuais', () => {
        renderForm()
        fireEvent.click(screen.getByRole('button', { name: 'Criar evento avulso' }))
        expect(screen.getByPlaceholderText(/Ex: Nova legislação/)).toBeInTheDocument()
    })

    it('clicar em "Disparar agora" sem preencher nada mostra erros de validação e não abre a confirmação', () => {
        renderForm()
        fireEvent.click(screen.getByRole('button', { name: 'Disparar agora' }))

        expect(screen.getByText('Selecione um template do catálogo.')).toBeInTheDocument()
        expect(screen.getByText('Preencha o valor de todos os alvos (ou remova a linha vazia).')).toBeInTheDocument()
        expect(screen.queryByText('Confirmar disparo')).not.toBeInTheDocument()
    })

    it('modo avulso sem nenhum efeito marcado é rejeitado no cliente', () => {
        renderForm()
        fireEvent.click(screen.getByRole('button', { name: 'Criar evento avulso' }))
        fireEvent.click(screen.getByLabelText('Afeta preço'))
        fireEvent.click(screen.getByRole('button', { name: 'Disparar agora' }))

        expect(screen.getByText('Selecione ao menos um tipo de efeito (preço e/ou fundamentos).')).toBeInTheDocument()
    })

    it('preenchendo template e alvo, "Disparar agora" abre a confirmação com a prévia', async () => {
        renderForm()
        selectOption('Template', 'Minério de ferro dispara no mercado internacional')
        selectOption('Setor', 'Mineração')

        fireEvent.click(screen.getByRole('button', { name: 'Disparar agora' }))

        expect(await screen.findByRole('heading', { name: 'Confirmar disparo' })).toBeInTheDocument()
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('Minério de ferro dispara no mercado internacional')).toBeInTheDocument()
        expect(within(dialog).getByText('Setor: Mineração')).toBeInTheDocument()
    })

    it('confirmar dispara POST /admin/macro-events e chama onTriggered', async () => {
        vi.mocked(triggerMacroEvent).mockResolvedValue({
            event: {
                id: 'e1',
                title: 'x',
                narrative: 'x',
                direction: 'positivo',
                magnitude_band: 'moderado',
                affects_price: true,
                affects_fundamentals: true,
                status: 'pendente',
                triggered_on_day: 1,
                duration_days: 2,
                targets: [{ sector: 'Mineração' }],
            },
        })
        const { onTriggered } = renderForm()

        selectOption('Template', 'Minério de ferro dispara no mercado internacional')
        selectOption('Setor', 'Mineração')
        fireEvent.click(screen.getByRole('button', { name: 'Disparar agora' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Confirmar disparo' }))

        await waitFor(() =>
            expect(triggerMacroEvent).toHaveBeenCalledWith('token', {
                template_key: 'alta-minerio-ferro',
                targets: [{ sector: 'Mineração' }],
            }),
        )
        await waitFor(() => expect(onTriggered).toHaveBeenCalled())
    })

    it('só oferece a antecedência de aparição num evento agendado e a manda ao motor (N.25)', async () => {
        vi.mocked(triggerMacroEvent).mockResolvedValue({
            event: {
                id: 'e1',
                title: 'x',
                narrative: 'x',
                direction: 'positivo',
                magnitude_band: 'moderado',
                affects_price: true,
                affects_fundamentals: true,
                status: 'pendente',
                triggered_on_day: 130,
                duration_days: 2,
                targets: [{ sector: 'Mineração' }],
            },
        })
        renderForm()
        selectOption('Template', 'Minério de ferro dispara no mercado internacional')
        selectOption('Setor', 'Mineração')

        expect(screen.queryByLabelText(/Dias de antecedência/)).not.toBeInTheDocument()
        fireEvent.change(screen.getByLabelText(/Dia simulado em que o efeito começa/), { target: { value: '130' } })
        fireEvent.change(screen.getByLabelText(/Dias de antecedência/), { target: { value: '7' } })
        fireEvent.click(screen.getByRole('button', { name: 'Agendar evento' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('7 dias antes do efeito')).toBeInTheDocument()
        fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar agendamento' }))

        await waitFor(() =>
            expect(triggerMacroEvent).toHaveBeenCalledWith('token', {
                template_key: 'alta-minerio-ferro',
                targets: [{ sector: 'Mineração' }],
                apply_on_day: 130,
                reveal_lead_days: 7,
            }),
        )
    })

    it('erro do backend mantém a confirmação aberta e mostra a mensagem', async () => {
        vi.mocked(triggerMacroEvent).mockRejectedValue(new Error('falhou'))
        renderForm()

        selectOption('Template', 'Minério de ferro dispara no mercado internacional')
        selectOption('Setor', 'Mineração')
        fireEvent.click(screen.getByRole('button', { name: 'Disparar agora' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Confirmar disparo' }))

        await waitFor(() => expect(screen.getByText('Não foi possível disparar o evento agora. Tente novamente.')).toBeInTheDocument())
        expect(screen.getByRole('heading', { name: 'Confirmar disparo' })).toBeInTheDocument()
    })

    it('adiciona e remove linhas de alvo, sem permitir remover a última', () => {
        renderForm()
        expect(screen.getAllByRole('button', { name: 'Remover alvo' })).toHaveLength(1)
        expect(screen.getAllByRole('button', { name: 'Remover alvo' })[0]).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: /Adicionar alvo/ }))
        expect(screen.getAllByRole('button', { name: 'Remover alvo' })).toHaveLength(2)

        fireEvent.click(screen.getAllByRole('button', { name: 'Remover alvo' })[0])
        expect(screen.getAllByRole('button', { name: 'Remover alvo' })).toHaveLength(1)
    })
})
