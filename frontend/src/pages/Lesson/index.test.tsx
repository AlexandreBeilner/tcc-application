import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { ApiError } from '../../services/client'
import { RewardRevealProvider } from '../../features/shell/RewardRevealProvider'
import {
    advanceLesson,
    answerCheckpoint,
    answerMicroDecision,
    getLesson,
    listLessons,
    recordCardReach,
    reviewLesson,
} from '../../services/lessons'
import type { Lesson as LessonType } from '../../services/lessons'
import { getAsset, getFixedIncomeTaxRate, getIndicatorHistory, listAssets } from '../../services/market'
import type { AssetDetail, AssetSummary, IndicatorHistoryEntry } from '../../services/market'
import { listMissions } from '../../services/missions'
import { Lesson } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/lessons', () => ({
    getLesson: vi.fn(),
    listLessons: vi.fn(),
    advanceLesson: vi.fn(),
    answerMicroDecision: vi.fn(),
    answerCheckpoint: vi.fn(),
    reviewLesson: vi.fn(),
    recordCardReach: vi.fn().mockResolvedValue({ recorded: true }),
}))
vi.mock('../../services/market', () => ({
    listAssets: vi.fn(),
    getAsset: vi.fn(),
    getFixedIncomeTaxRate: vi.fn(),
    getIndicatorHistory: vi.fn(),
}))
vi.mock('../../services/missions', () => ({ listMissions: vi.fn(), completeMission: vi.fn() }))

function renderLesson(id = 'lesson-1') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/trilha', element: <div>tela de trilha</div> },
            { path: '/trilha/:id', element: <Lesson /> },
            { path: '/mercado/renda-fixa/:id', element: <div>tela de detalhe de renda fixa</div> },
            { path: '/mercado/ativos/:id', element: <div>tela de detalhe de ativo</div> },
            { path: '/', element: <div>tela de portfólio</div> },
            { path: '/calculadora', element: <div>tela de calculadora</div> },
        ],
        { initialEntries: [`/trilha/${id}`] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RewardRevealProvider>
                <RouterProvider router={router} />
            </RewardRevealProvider>
        </QueryClientProvider>,
    )
}

function lesson(overrides: Partial<LessonType>): LessonType {
    return {
        id: 'lesson-1',
        code: '0.5',
        title: 'Diversificação',
        trackNumber: 0,
        trackName: 'Fundamentos',
        sortOrder: 5,
        centralConcept: 'Espalhar capital reduz risco',
        scenarioText: 'Espalhar capital reduz risco',
        microDecisionPrompt: 'Pense na sua resposta',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: null,
        revelationText: 'Diversificar reduz o risco não sistemático',
        unlocksDescription: 'Tesouro Selic',
        unlocksKeys: [],
        unlocksAssetTicker: null,
        microDecisionOptions: null,
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

describe('Lesson (tela 3.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token-valido',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })
        vi.mocked(listAssets).mockResolvedValue({ assets: [] })
        vi.mocked(listMissions).mockResolvedValue({ missions: [] })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('lição nova abre no passo 0 (Cenário)', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })

        renderLesson()

        expect(await screen.findByRole('heading', { level: 1, name: 'Diversificação' })).toBeInTheDocument()
        // O Cenário não tem etiqueta (LJ.1.2).
        expect(screen.queryByText('Cenário')).not.toBeInTheDocument()
        expect(screen.getByText('Espalhar capital reduz risco')).toBeInTheDocument()
    })

    it('o título da lição vale em todas as fases e nenhum rótulo antigo sobra (LJ.1.2)', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 1, completed: false })

        renderLesson()
        const heading = () => screen.getByRole('heading', { level: 1 })
        await screen.findByRole('heading', { level: 1, name: 'Diversificação' })

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        expect(await screen.findByText('Sua aposta')).toBeInTheDocument()
        expect(heading()).toHaveTextContent('Diversificação')

        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 2, completed: false })
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        expect(await screen.findByText('O que acontece')).toBeInTheDocument()
        expect(heading()).toHaveTextContent('Diversificação')

        for (const old of ['Cenário', 'Micro-decisão', 'Revelação', 'Desbloqueio', 'Pense antes de continuar', 'Por que isso importa']) {
            expect(screen.queryByText(old)).not.toBeInTheDocument()
        }
    })

    it('funil por cartão: reporta o cartão aberto e o da fase seguinte, e nada em revisão', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 1, completed: false })

        const { unmount } = renderLesson()
        await screen.findByRole('heading', { level: 1 })
        await waitFor(() => expect(recordCardReach).toHaveBeenCalledWith('token-valido', 'lesson-1', 0, 0))

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
        await waitFor(() => expect(recordCardReach).toHaveBeenCalledWith('token-valido', 'lesson-1', 1, 0))
        unmount()

        vi.mocked(recordCardReach).mockClear()
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, status: 'completed' }) })
        renderLesson()
        await screen.findByRole('heading', { level: 1 })
        expect(recordCardReach).not.toHaveBeenCalled()
    })

    it('retoma no meio (currentStep vindo do backend), sem voltar ao passo 0', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })

        renderLesson()

        expect(await screen.findByText('O que acontece')).toBeInTheDocument()
        expect(screen.getByText('Diversificar reduz o risco não sistemático')).toBeInTheDocument()
    })

    it('avança do passo 0 chamando POST progress com step 1', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 1, completed: false })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

        await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 1))
        expect(await screen.findByText('Sua aposta')).toBeInTheDocument()
    })

    it('passo de micro-decisão (reflection, sem opções reais) não exige nenhum gate: Continuar já vem habilitado (backlog engajamento M.1)', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 1 }) })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Continuar' })
        expect(button).not.toBeDisabled()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
        expect(screen.queryByText('Já pensei na minha resposta')).not.toBeInTheDocument()
    })

    it('micro-decisão com opções reais (backlog engajamento B.3) mostra os botões de escolha, não o checkbox', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionOptions: ['Sim', 'Não'] }),
        })

        renderLesson()

        expect(await screen.findByRole('button', { name: 'Sim' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Não' })).toBeInTheDocument()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
        expect(screen.queryByText('Já pensei na minha resposta')).not.toBeInTheDocument()
    })

    it('microDecisionOptions vazio (não null) cai de volta pro Continuar direto, não trava com 0 botões', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionOptions: [] }),
        })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Continuar' })
        expect(button).not.toBeDisabled()
        expect(screen.queryByRole('group', { name: 'Escolha uma opção' })).not.toBeInTheDocument()
    })

    describe('pergunta que só avança ao acertar (RC.2.4)', () => {
        const withOptions = (overrides: Partial<LessonType> = {}) =>
            lesson({ currentStep: 1, microDecisionOptions: ['Sim', 'Não', 'Talvez'], ...overrides })

        it('Continuar fica desabilitado até acertar, e Responder só habilita com uma alternativa marcada', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withOptions() })

            renderLesson()

            const responder = await screen.findByRole('button', { name: 'Responder' })
            expect(responder).toBeDisabled()
            expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()

            fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
            expect(responder).not.toBeDisabled()
            expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
        })

        it('errar descarta a alternativa, avisa sem entregar o gabarito, não avança e permite tentar de novo', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withOptions() })
            vi.mocked(answerMicroDecision).mockResolvedValueOnce({ correct: false, attempts: 1, firstTry: false, wrongOptions: [0] })

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Sim' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

            const alert = await screen.findByRole('alert')
            expect(alert).toHaveTextContent('Ainda não')
            expect(answerMicroDecision).toHaveBeenCalledWith('token-valido', 'lesson-1', 0)
            expect(screen.getByRole('button', { name: /Sim/ })).toBeDisabled()
            expect(screen.getByRole('button', { name: 'Não' })).not.toBeDisabled()
            expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
            expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled()
            expect(advanceLesson).not.toHaveBeenCalled()
            await waitFor(() => expect(alert).toHaveFocus())
        })

        it('acertar na segunda tentativa trava a pergunta, libera o Continuar e mostra a tentativa', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withOptions() })
            vi.mocked(answerMicroDecision)
                .mockResolvedValueOnce({ correct: false, attempts: 1, firstTry: false, wrongOptions: [0] })
                .mockResolvedValueOnce({ correct: true, attempts: 2, firstTry: false, wrongOptions: [0], correctOptionLabel: 'Não' })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 2, completed: false })

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Sim' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
            await screen.findByRole('alert')
            fireEvent.click(screen.getByRole('button', { name: 'Não' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

            expect(await screen.findByText('Acertou na 2ª tentativa.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Talvez' })).toBeDisabled()
            expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 2))
            expect(await screen.findByText('Você acertou na 2ª tentativa')).toBeInTheDocument()
        })

        it('acertar de primeira mostra o selo "de primeira" na Revelação', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withOptions() })
            vi.mocked(answerMicroDecision).mockResolvedValue({
                correct: true,
                attempts: 1,
                firstTry: true,
                wrongOptions: [],
                correctOptionLabel: 'Sim',
            })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 2, completed: false })

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Sim' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
            expect(await screen.findByText('Acertou de primeira.')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('Você acertou de primeira')).toBeInTheDocument()
        })

        it('restaura a tela ao recarregar: erros já gravados desativados e pergunta resolvida travada', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withOptions({ microDecisionWrongOptions: [1] }) })

            const { unmount } = renderLesson()
            expect(await screen.findByRole('button', { name: /Não/ })).toBeDisabled()
            expect(screen.getByRole('button', { name: 'Sim' })).not.toBeDisabled()
            unmount()

            vi.mocked(getLesson).mockResolvedValue({ lesson: withOptions({ microDecisionSolved: true, microDecisionWrongOptions: [1] }) })
            renderLesson()

            expect(await screen.findByText('Você já resolveu esta pergunta.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Sim' })).toBeDisabled()
            expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
        })

        it('falha de rede ao responder mostra erro e não descarta a alternativa', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withOptions() })
            vi.mocked(answerMicroDecision).mockRejectedValue(new Error('rede'))

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Sim' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

            expect(await screen.findByText('Não foi possível enviar sua resposta agora. Tente de novo.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Sim' })).not.toBeDisabled()
        })

        it('revisão de lição concluída não trava o Continuar e a resposta certa não grava nada', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: withOptions({ status: 'completed', currentStep: 3, microDecisionSolved: true }),
            })

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('Sua aposta')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
            expect(screen.getByRole('button', { name: 'Sim' })).not.toBeDisabled()
            expect(advanceLesson).not.toHaveBeenCalled()
        })
    })

    it('lição sem opções reais não mostra badge de acerto/erro na Revelação (regressão)', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })

        renderLesson()

        await screen.findByText('O que acontece')
        expect(screen.queryByText('Você acertou')).not.toBeInTheDocument()
        expect(screen.queryByText(/Quase\./)).not.toBeInTheDocument()
    })

    it('micro-decisão growth_calculator embute a calculadora e não exige checkbox', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionType: 'growth_calculator' }),
        })

        renderLesson()

        expect(await screen.findByText('Capital inicial (R$)')).toBeInTheDocument()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
    })

    it('micro-decisão fixed_income_comparison embute o comparador e não exige checkbox', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionType: 'fixed_income_comparison' }),
        })
        vi.mocked(getFixedIncomeTaxRate).mockResolvedValue({ tax_rate: 0.175 })

        renderLesson()

        expect(await screen.findByText('Prazo (dias corridos)')).toBeInTheDocument()
        expect(screen.queryByText('Já pensei na minha resposta')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
    })

    it('revelação de lição live_indicator busca o ativo real e mostra o indicador ao vivo', async () => {
        const asset: AssetSummary = { id: 'asset-eq', ticker: 'VALR3', name: 'Vale do Rio', type: 'acao', is_sandbox: false }
        const detail: AssetDetail = {
            ...asset,
            equity: {
                company: { id: 'company-1', name: 'Vale do Rio', cnpj: '00.000.000/0001-00', sector: 'Mineração' },
                dividend_history: [],
                indicators: { price_to_earnings: 8.4 },
            },
        }
        vi.mocked(listAssets).mockResolvedValue({ assets: [asset] })
        vi.mocked(getAsset).mockResolvedValue({ asset: detail })
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 2, microDecisionType: 'live_indicator', microDecisionAssetTicker: 'VALR3' }),
        })

        renderLesson()

        expect(await screen.findByText('P/L')).toBeInTheDocument()
        expect(screen.getByText('8,4')).toBeInTheDocument()
    })

    it('revelação de lição live_macro_indicator busca a série de indicadores e mostra os cards ao vivo', async () => {
        const entries: IndicatorHistoryEntry[] = [
            { simulated_day: 40, selic_rate: 10.5, ipca_monthly_rate: 0.004, ipca_accumulated_12m: 0.048 },
        ]
        vi.mocked(getIndicatorHistory).mockResolvedValue({ indicators: entries })
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 2, microDecisionType: 'live_macro_indicator' }),
        })

        renderLesson()

        expect(await screen.findByText('Selic (meta anual)')).toBeInTheDocument()
        expect(screen.getByText('10,5%')).toBeInTheDocument()
        expect(screen.getByText('Dia 42')).toBeInTheDocument()
    })

    it('ao chegar no passo 3 mostra o desbloqueio com o que foi liberado', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 3, completed: true })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

        expect(await screen.findByText('Lição concluída')).toBeInTheDocument()
        expect(screen.getByText('Tesouro Selic')).toBeInTheDocument()
    })

    it('desbloqueio com unlocksAssetTicker mostra "Comprar agora" navegando pro ativo real', async () => {
        const asset: AssetSummary = {
            id: 'asset-fi',
            ticker: 'LFT2029',
            name: 'Tesouro Selic 2029',
            type: 'tesouro_selic',
            is_sandbox: false,
        }
        vi.mocked(listAssets).mockResolvedValue({ assets: [asset] })
        vi.mocked(getAsset).mockResolvedValue({ asset })
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 3, unlocksAssetTicker: 'LFT2029' }),
        })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Comprar agora' })
        fireEvent.click(button)

        expect(await screen.findByText('tela de detalhe de renda fixa')).toBeInTheDocument()
    })

    it('desbloqueio sem unlocksAssetTicker não mostra "Comprar agora"', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3 }) })

        renderLesson()

        await screen.findByText('Lição concluída')
        expect(screen.queryByRole('button', { name: 'Comprar agora' })).not.toBeInTheDocument()
    })

    it('desbloqueio com unlocksKeys de feature (portfolio) mostra "Ir pro Portfólio"', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 3, unlocksKeys: ['portfolio'] }),
        })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Ir pro Portfólio' })
        fireEvent.click(button)

        expect(await screen.findByText('tela de portfólio')).toBeInTheDocument()
    })

    it('desbloqueio com unlocksKeys de feature (calculator) mostra "Ir pra Calculadora"', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 3, unlocksKeys: ['calculator'] }),
        })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Ir pra Calculadora' })
        fireEvent.click(button)

        expect(await screen.findByText('tela de calculadora')).toBeInTheDocument()
    })

    it('lição já concluída reabre no Cenário (modo revisão) e navega sem chamar o servidor', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, status: 'completed' }) })

        renderLesson()

        expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        expect(await screen.findByText('Sua aposta')).toBeInTheDocument()
        expect(advanceLesson).not.toHaveBeenCalled()
    })

    it('revisão só é registrada ao chegar na Revelação, não ao abrir a lição', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, status: 'completed' }) })

        renderLesson()

        await screen.findByRole('heading', { level: 1 })
        expect(reviewLesson).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        await screen.findByText('Sua aposta')
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        await screen.findByText('O que acontece')
        await waitFor(() => expect(reviewLesson).toHaveBeenCalledExactlyOnceWith('token-valido', 'lesson-1'))
        expect(advanceLesson).not.toHaveBeenCalled()
    })

    it('lição em andamento, não concluída, não registra revisão nenhuma', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0, status: 'available' }) })

        renderLesson()

        await screen.findByRole('heading', { level: 1 })
        expect(reviewLesson).not.toHaveBeenCalled()
    })

    it('"Continuar" no desbloqueio navega pra próxima lição por sortOrder', async () => {
        vi.mocked(getLesson).mockImplementation((_token, id) =>
            Promise.resolve({
                lesson:
                    id === 'lesson-1'
                        ? lesson({ id: 'lesson-1', currentStep: 3, sortOrder: 5 })
                        : lesson({ id: 'lesson-2', currentStep: 0, sortOrder: 6, title: 'Tesouro Selic' }),
            }),
        )
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: 'lesson-1', sortOrder: 5 }), lesson({ id: 'lesson-2', sortOrder: 6, title: 'Tesouro Selic' })],
        })

        renderLesson('lesson-1')

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
        await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument())
        expect(getLesson).toHaveBeenLastCalledWith('token-valido', 'lesson-2')
    })

    it('sem próxima lição, "Continuar" no desbloqueio volta pra Trilha', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, sortOrder: 5 }) })
        vi.mocked(listLessons).mockResolvedValue({ lessons: [lesson({ id: 'lesson-1', sortOrder: 5 })] })

        renderLesson('lesson-1')

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
        expect(await screen.findByText('tela de trilha')).toBeInTheDocument()
    })

    it('"Sair da lição" volta pra Trilha a qualquer momento', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Sair da lição' }))
        expect(await screen.findByText('tela de trilha')).toBeInTheDocument()
    })

    it('cenário com \\n\\n fatiado em cartões: Continuar navega entre cartões antes de avançar de fase', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 0, scenarioText: 'Primeiro cartão.\n\nSegundo cartão.' }),
        })

        renderLesson()

        expect(await screen.findByText('Primeiro cartão.')).toBeInTheDocument()
        expect(screen.queryByText('Segundo cartão.')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        expect(await screen.findByText('Segundo cartão.')).toBeInTheDocument()
        expect(advanceLesson).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 1))
    })

    it('micro-decisão fatiada sem opções reais: Continuar habilitado do primeiro ao último cartão, navegando entre eles', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionPrompt: 'Primeiro cartão.\n\nSegundo cartão.' }),
        })

        renderLesson()

        await screen.findByText('Primeiro cartão.')
        expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        expect(await screen.findByText('Segundo cartão.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
        expect(advanceLesson).not.toHaveBeenCalled()
    })

    it('lição sem \\n\\n continua com 1 cartão só, sem pontinhos de progresso interno', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })

        renderLesson()

        await screen.findByText('Espalhar capital reduz risco')
        expect(document.querySelector('[class*="cardDots"]')).not.toBeInTheDocument()
    })

    it('cartão marcado com [revelar] esconde o texto atrás de um botão "Ver resultado" (tarefa A.3)', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 2, revelationText: '[revelar] O LCI vence nesse prazo.' }),
        })

        renderLesson()

        expect(await screen.findByRole('button', { name: 'Ver resultado' })).toBeInTheDocument()
        expect(screen.queryByText('O LCI vence nesse prazo.')).not.toBeInTheDocument()
    })

    it('tocar em "Ver resultado" revela o texto no lugar, sem navegar de cartão', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 2, revelationText: '[revelar] O LCI vence nesse prazo.' }),
        })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Ver resultado' }))

        expect(await screen.findByText('O LCI vence nesse prazo.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Ver resultado' })).not.toBeInTheDocument()
        expect(advanceLesson).not.toHaveBeenCalled()
    })

    it('"Ver resultado" é alcançável e ativável por teclado, sem bloquear "Continuar"', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 2, revelationText: '[revelar] O LCI vence nesse prazo.' }),
        })

        renderLesson()

        const revealButton = await screen.findByRole('button', { name: 'Ver resultado' })
        expect(revealButton.tagName).toBe('BUTTON')
        expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()

        revealButton.focus()
        expect(revealButton).toHaveFocus()
        fireEvent.keyDown(revealButton, { key: 'Enter' })
        fireEvent.click(revealButton)

        expect(await screen.findByText('O LCI vence nesse prazo.')).toBeInTheDocument()
    })

    it('cartão sem o prefixo [revelar] continua aparecendo direto (comportamento da A.1/A.2 preservado)', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({
                currentStep: 2,
                revelationText: 'Explicação normal.\n\n[revelar] Resultado escondido.',
            }),
        })

        renderLesson()

        expect(await screen.findByText('Explicação normal.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Ver resultado' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        expect(await screen.findByRole('button', { name: 'Ver resultado' })).toBeInTheDocument()
        expect(screen.queryByText('Resultado escondido.')).not.toBeInTheDocument()
    })

    it('referência {{ref:X.Y}} vira link "já visto na lição X.Y" pra lição já carregada (tarefa C.2)', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: 'lesson-2-1', code: '2.1', title: 'O que é uma ação' })],
        })
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ revelationText: 'Você já viu isso em {{ref:2.1}} antes.', currentStep: 2 }),
        })

        renderLesson()

        const link = await screen.findByRole('link', { name: 'já visto na lição 2.1' })
        expect(link).toHaveAttribute('href', '/trilha/lesson-2-1')
    })

    it('referência a um código que não está na lista cai pro texto puro, sem link e sem quebrar (tarefa C.2)', async () => {
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ revelationText: 'Você já viu isso em {{ref:9.9}} antes.', currentStep: 2 }),
        })

        renderLesson()

        expect(await screen.findByText('Você já viu isso em já visto na lição 9.9 antes.')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'já visto na lição 9.9' })).not.toBeInTheDocument()
    })

    it('lição bloqueada/inexistente mostra erro', async () => {
        vi.mocked(getLesson).mockRejectedValue(new ApiError(404, 'lição bloqueada'))

        renderLesson()

        expect(
            await screen.findByText('Não foi possível carregar esta lição agora. Ela pode estar bloqueada ou não existir.'),
        ).toBeInTheDocument()
    })

    it('lição bloqueada pela trilha mostra o LockedGate com CTA pra próxima lição disponível (achado 039)', async () => {
        vi.mocked(getLesson).mockRejectedValue(new ApiError(404, 'lição bloqueada'))
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: 'lesson-done', title: 'Lição concluída', status: 'completed' }),
                lesson({ id: 'lesson-next', title: 'Próxima da fila', status: 'available' }),
                lesson({ id: 'lesson-1', title: 'Lição trancada', status: 'locked' }),
            ],
        })

        renderLesson()

        expect(await screen.findByText('Travado pela trilha')).toBeInTheDocument()
        expect(screen.getByText('Complete a lição "Próxima da fila" na trilha pra liberar isso.')).toBeInTheDocument()
        expect(screen.queryByText(/Não foi possível carregar esta lição/)).not.toBeInTheDocument()
    })

    describe('botão Voltar (RC.2.2)', () => {
        const voltar = () => screen.getByRole('button', { name: /^Voltar ao/ })

        it('não aparece no primeiro cartão do Cenário', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })

            renderLesson()

            await screen.findByRole('heading', { level: 1 })
            expect(screen.queryByRole('button', { name: /^Voltar ao/ })).not.toBeInTheDocument()
        })

        it('volta entre cartões da mesma fase', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({ currentStep: 0, scenarioText: 'Primeiro cartão.\n\nSegundo cartão.' }),
            })

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('Segundo cartão.')).toBeInTheDocument()

            fireEvent.click(voltar())
            expect(await screen.findByText('Primeiro cartão.')).toBeInTheDocument()
        })

        it('volta pro último cartão da fase anterior e reavançar não chama o servidor de novo', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({ currentStep: 0, scenarioText: 'Primeiro cartão.\n\nÚltimo do cenário.' }),
            })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 1, completed: false })

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('Sua aposta')).toBeInTheDocument()
            expect(advanceLesson).toHaveBeenCalledTimes(1)

            fireEvent.click(voltar())
            expect(await screen.findByText('Último do cenário.')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('Sua aposta')).toBeInTheDocument()
            expect(advanceLesson).toHaveBeenCalledTimes(1)
        })

        it('seta esquerda volta e seta direita continua', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({ currentStep: 0, scenarioText: 'Primeiro cartão.\n\nSegundo cartão.' }),
            })

            renderLesson()

            await screen.findByText('Primeiro cartão.')
            fireEvent.keyDown(window, { key: 'ArrowRight' })
            expect(await screen.findByText('Segundo cartão.')).toBeInTheDocument()
            fireEvent.keyDown(window, { key: 'ArrowLeft' })
            expect(await screen.findByText('Primeiro cartão.')).toBeInTheDocument()
        })

        it('Enter avança o cartão e não pula a pergunta travada (LJ.5.3)', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({ currentStep: 0, scenarioText: 'Primeiro cartão.\n\nSegundo cartão.' }),
            })

            renderLesson()

            await screen.findByText('Primeiro cartão.')
            fireEvent.keyDown(window, { key: 'Enter' })
            expect(await screen.findByText('Segundo cartão.')).toBeInTheDocument()
        })

        it('número escolhe a alternativa da pergunta e Enter responde (LJ.5.3)', async () => {
            const check = { type: 'check', id: 'q1', kind: 'single', prompt: 'Qual rende mais?', options: ['LCI', 'CDB'] }
            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({
                    currentStep: 0,
                    blocks: { schemaVersion: 1, phases: { scenario: [check], microDecision: [], revelation: [] } },
                }),
            })
            vi.mocked(answerCheckpoint).mockResolvedValue({ correct: true, attempts: 1, firstTry: true, wrongOptions: [] })

            renderLesson()

            await screen.findByText('Qual rende mais?')
            // Enter sem alternativa marcada não pula a pergunta.
            fireEvent.keyDown(window, { key: 'Enter' })
            expect(answerCheckpoint).not.toHaveBeenCalled()

            fireEvent.keyDown(window, { key: '2' })
            expect(screen.getByRole('button', { name: 'CDB' })).toHaveAttribute('aria-pressed', 'true')
            fireEvent.keyDown(window, { key: 'Enter' })

            await waitFor(() => expect(answerCheckpoint).toHaveBeenCalledWith('token-valido', 'lesson-1', 'q1', { selectedOption: 1 }))
        })

        it('lição retomada no meio deixa voltar às fases anteriores e reavançar sem POST', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })

            renderLesson()

            await screen.findByText('O que acontece')
            fireEvent.click(voltar())
            expect(await screen.findByText('Sua aposta')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('O que acontece')).toBeInTheDocument()
            expect(advanceLesson).not.toHaveBeenCalled()
        })

        it('voltar pra pergunta já respondida não pede escolha de novo nem deixa trocar a resposta', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2, microDecisionOptions: ['Sim', 'Não'] }) })

            renderLesson()

            await screen.findByText('O que acontece')
            fireEvent.click(voltar())

            expect(await screen.findByText('Sua aposta')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Sim' })).toBeDisabled()
            expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
        })
    })

    describe('conteúdo por blocos (RC.3.1)', () => {
        const blocks = (overrides: Record<string, unknown> = {}) => ({
            schemaVersion: 1,
            phases: {
                scenario: [
                    { type: 'text', markup: 'Texto do bloco.' },
                    {
                        type: 'widget',
                        id: 'dica',
                        widget: 'callout',
                        props: { tone: 'tip', title: 'Dica de bloco', body: 'Corpo da dica' },
                    },
                ],
                microDecision: [],
                revelation: [],
                ...overrides,
            },
        })

        it('lição com blocks mostra texto e widget como cartões, no lugar do texto legado', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0, blocks: blocks() }) })

            renderLesson()

            expect(await screen.findByText('Texto do bloco.')).toBeInTheDocument()
            expect(screen.queryByText('Espalhar capital reduz risco')).not.toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('Dica de bloco')).toBeInTheDocument()
            expect(screen.getByText('Corpo da dica')).toBeInTheDocument()
            expect(advanceLesson).not.toHaveBeenCalled()
        })

        it('fase sem blocos continua no texto legado, mesmo com blocks nas outras', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2, blocks: blocks() }) })

            renderLesson()

            expect(await screen.findByText('Diversificar reduz o risco não sistemático')).toBeInTheDocument()
        })

        it('blocks fora do contrato cai no texto legado', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0, blocks: { schemaVersion: 9 } }) })

            renderLesson()

            expect(await screen.findByText('Espalhar capital reduz risco')).toBeInTheDocument()
        })

        it('widget desconhecido num bloco não derruba a lição: mostra o fallback e segue', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({
                    currentStep: 0,
                    blocks: blocks({
                        scenario: [{ type: 'widget', id: 'x', widget: 'nao-existe', props: {}, caption: 'Texto de reserva' }],
                    }),
                }),
            })

            renderLesson()

            expect(await screen.findByText('Texto de reserva')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
        })

        it('widget do registro na Micro-decisão (growth-calculator) substitui o legado, sem duplicar', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({
                    currentStep: 1,
                    blocks: blocks({ microDecision: [{ type: 'widget', id: 'calc', widget: 'growth-calculator', props: {} }] }),
                }),
            })

            renderLesson()

            expect(await screen.findByRole('group', { name: /Calculadora de juros/ })).toBeInTheDocument()
            expect(screen.getAllByRole('group', { name: /Calculadora de juros/ })).toHaveLength(1)
        })
    })

    describe('"Na plataforma" como rodapé recolhido (LJ.1.3)', () => {
        const note = {
            type: 'widget',
            id: 'n1',
            widget: 'platform-note',
            props: { brazil: 'Regra real.', here: 'Regra aqui.', why: 'Porque sim.' },
        }
        const withNote = (scenario: unknown[]) =>
            lesson({ currentStep: 0, blocks: { schemaVersion: 1, phases: { scenario, microDecision: [], revelation: [] } } })

        it('a nota depois de um texto não vira cartão: o Continuar já sai da fase e o rodapé nasce fechado', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withNote([{ type: 'text', markup: 'Primeiro texto.' }, note]) })

            renderLesson()

            expect(await screen.findByText('Primeiro texto.')).toBeInTheDocument()
            const footnote = screen.getByRole('group', { name: /^Na plataforma\./ })
            expect(footnote).not.toHaveAttribute('open')
            // Um cartão só: a barra mostra "Cartão 1 de 4" (1 de Cenário, 1 de aposta, 1 de revelação, final).
            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Cartão 1 de 4')
        })

        it('abrir mostra as três linhas e o rodapé segue aberto ao voltar ao cartão', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: withNote([{ type: 'text', markup: 'Primeiro texto.' }, note, { type: 'text', markup: 'Segundo texto.' }]),
            })

            renderLesson()
            await screen.findByText('Primeiro texto.')
            fireEvent.click(screen.getByText('Na plataforma'))

            expect(await screen.findByText('Regra real.')).toBeVisible()
            expect(screen.getByText('Regra aqui.')).toBeInTheDocument()
            expect(screen.getByText('Porque sim.')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            expect(await screen.findByText('Segundo texto.')).toBeInTheDocument()
            expect(screen.queryByText('Na plataforma')).not.toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Voltar ao cartão anterior' }))
            expect(await screen.findByText('Primeiro texto.')).toBeInTheDocument()
            expect(screen.getByRole('group', { name: /^Na plataforma\./ })).toHaveAttribute('open')
        })

        it('como primeiro bloco da fase continua cartão próprio, com a nota por inteiro', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withNote([note, { type: 'text', markup: 'Depois.' }]) })

            renderLesson()

            expect(await screen.findByText('Regra real.')).toBeVisible()
            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Cartão 1 de 5')
        })
    })

    describe('perguntas intermediárias (RC.3.2)', () => {
        const check = { type: 'check', id: 'q1', kind: 'single', prompt: 'Qual rende mais?', options: ['LCI', 'CDB'] }
        const withChecks = (scenario: unknown[], overrides: Partial<LessonType> = {}) =>
            lesson({
                currentStep: 0,
                blocks: { schemaVersion: 1, phases: { scenario, microDecision: [], revelation: [] } },
                ...overrides,
            })

        it('Continuar fica travado até acertar; errar desativa a alternativa e não avança', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withChecks([check]) })
            vi.mocked(answerCheckpoint).mockResolvedValueOnce({ correct: false, attempts: 1, firstTry: false, wrongOptions: [0] })

            renderLesson()

            expect(await screen.findByText('Qual rende mais?')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()

            fireEvent.click(screen.getByRole('button', { name: 'LCI' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

            expect(await screen.findByRole('alert')).toHaveTextContent('Ainda não')
            expect(answerCheckpoint).toHaveBeenCalledWith('token-valido', 'lesson-1', 'q1', { selectedOption: 0 })
            expect(screen.getByRole('button', { name: /LCI/ })).toBeDisabled()
            expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
            expect(advanceLesson).not.toHaveBeenCalled()
        })

        it('acertar mostra a explicação, libera o Continuar e avança a fase', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withChecks([check]) })
            vi.mocked(answerCheckpoint).mockResolvedValue({
                correct: true,
                attempts: 1,
                firstTry: true,
                wrongOptions: [],
                explanation: 'O CDB líquido vence.',
            })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 1, completed: false })

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'CDB' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

            expect(await screen.findByText('Acertou de primeira.')).toBeInTheDocument()
            expect(screen.getByText('O CDB líquido vence.')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 1))
        })

        describe('estimativa (LJ.2.2)', () => {
            const estimate = {
                type: 'check',
                id: 'e1',
                kind: 'estimate',
                prompt: 'Quanto viram R$ 1.000?',
                range: { min: 1000, max: 10000, step: 100, unit: 'brl' },
            }
            const far = { guess: 3000, band: 'far' as const, value: 6727.5, low: 6054.75, high: 7400.25 }

            it('chutar longe avança do mesmo jeito: mostra o valor real, a explicação e libera o Continuar', async () => {
                vi.mocked(getLesson).mockResolvedValue({ lesson: withChecks([estimate]) })
                vi.mocked(answerCheckpoint).mockResolvedValue({
                    correct: false,
                    attempts: 1,
                    firstTry: false,
                    wrongOptions: [],
                    explanation: 'Juros sobre juros.',
                    estimate: far,
                })

                renderLesson()

                const slider = await screen.findByRole('slider', { name: 'Seu chute' })
                expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
                expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled()

                fireEvent.change(slider, { target: { value: '3000' } })
                fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

                expect(await screen.findByText('Bem diferente do que parece, né?')).toBeInTheDocument()
                expect(answerCheckpoint).toHaveBeenCalledWith('token-valido', 'lesson-1', 'e1', { value: 3000 })
                expect(screen.getByText('Juros sobre juros.')).toBeInTheDocument()
                expect(screen.getByText(/6\.727,50/)).toBeInTheDocument()
                expect(screen.queryByRole('slider')).not.toBeInTheDocument()
                expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
            })

            it('aceita o valor digitado e recusa o que está fora da régua', async () => {
                vi.mocked(getLesson).mockResolvedValue({ lesson: withChecks([estimate]) })
                vi.mocked(answerCheckpoint).mockResolvedValue({
                    correct: true,
                    attempts: 1,
                    firstTry: true,
                    wrongOptions: [],
                    explanation: 'Juros sobre juros.',
                    estimate: { ...far, guess: 6700, band: 'exact' },
                })

                renderLesson()

                const field = await screen.findByLabelText('Ou digite o valor')
                fireEvent.change(field, { target: { value: '50' } })
                expect(screen.getByRole('alert')).toHaveTextContent('entre')
                expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled()

                fireEvent.change(field, { target: { value: '6.700' } })
                fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

                expect(await screen.findByText('Na mosca!')).toBeInTheDocument()
                expect(answerCheckpoint).toHaveBeenCalledWith('token-valido', 'lesson-1', 'e1', { value: 6700 })
            })

            it('restaura a régua do servidor depois de sair e voltar', async () => {
                vi.mocked(getLesson).mockResolvedValue({
                    lesson: withChecks([estimate], {
                        checkpoints: [{ checkpointId: 'e1', solved: true, attempts: 1, wrongOptions: [], firstTry: false, estimate: far }],
                    }),
                })

                renderLesson()

                expect(await screen.findByText('Bem diferente do que parece, né?')).toBeInTheDocument()
                expect(screen.queryByRole('slider')).not.toBeInTheDocument()
                expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
            })
        })

        it('restaura o estado do servidor ao voltar: erro desativado e pergunta resolvida liberada', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: withChecks([check], {
                    checkpoints: [{ checkpointId: 'q1', solved: false, attempts: 1, wrongOptions: [0], firstTry: false }],
                }),
            })

            const { unmount } = renderLesson()
            expect(await screen.findByRole('button', { name: /LCI/ })).toBeDisabled()
            expect(screen.getByRole('button', { name: 'CDB' })).not.toBeDisabled()
            unmount()

            vi.mocked(getLesson).mockResolvedValue({
                lesson: withChecks([check], {
                    checkpoints: [{ checkpointId: 'q1', solved: true, attempts: 2, wrongOptions: [0], firstTry: false }],
                }),
            })
            renderLesson()

            expect(await screen.findByText('Você já resolveu esta pergunta.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
        })

        it('revisão de lição concluída não trava o Continuar na pergunta', async () => {
            vi.mocked(getLesson).mockResolvedValue({
                lesson: withChecks([check], {
                    status: 'completed',
                    currentStep: 3,
                    checkpoints: [{ checkpointId: 'q1', solved: true, attempts: 1, wrongOptions: [], firstTry: true }],
                }),
            })

            renderLesson()

            expect(await screen.findByText('Qual rende mais?')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'LCI' })).not.toBeDisabled()
            expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()
        })

        it('falha de rede mostra o erro e mantém a pergunta como estava', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withChecks([check]) })
            vi.mocked(answerCheckpoint).mockRejectedValue(new Error('rede'))

            renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'LCI' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

            expect(await screen.findByText('Não foi possível enviar sua resposta agora. Tente de novo.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /LCI/ })).not.toBeDisabled()
        })

        it('suporta 7 perguntas na mesma fase, cada uma num cartão', async () => {
            const seven = Array.from({ length: 7 }, (_, i) => ({ type: 'check', id: `q${i}`, kind: 'true_false', prompt: `Pergunta ${i}` }))
            vi.mocked(getLesson).mockResolvedValue({ lesson: withChecks(seven) })
            vi.mocked(answerCheckpoint).mockResolvedValue({
                correct: true,
                attempts: 1,
                firstTry: true,
                wrongOptions: [],
                explanation: 'ok',
            })

            renderLesson()

            for (let i = 0; i < 7; i++) {
                expect(await screen.findByText(`Pergunta ${i}`)).toBeInTheDocument()
                fireEvent.click(screen.getByRole('button', { name: 'Verdadeiro' }))
                fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
                await screen.findByText('Acertou de primeira.')
                if (i < 6) fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            }
            expect(advanceLesson).not.toHaveBeenCalled()
        })
    })

    describe('tela final (LJ.1.4)', () => {
        const trueFalse = (id: string) => ({ type: 'check', id, kind: 'true_false', prompt: `Pergunta ${id}` })
        const state = (checkpointId: string, firstTry: boolean) => ({
            checkpointId,
            solved: true,
            attempts: firstTry ? 1 : 2,
            wrongOptions: [],
            firstTry,
        })

        function finished(checkIds: string[], firstTry: boolean[], overrides: Partial<LessonType> = {}) {
            return lesson({
                currentStep: 3,
                blocks: {
                    schemaVersion: 1,
                    phases: { scenario: checkIds.map(trueFalse), microDecision: [], revelation: [] },
                    summary: ['Primeira ideia que ficou.', 'Segunda ideia que ficou.'],
                },
                checkpoints: checkIds.map((id, i) => state(id, firstTry[i])),
                ...overrides,
            })
        }

        it.each([
            [[true, true], 'Na mosca!', '2 de 2 de primeira'],
            [[true, true, false], 'Mandou bem!', '2 de 3 de primeira'],
            [[true, false, false], 'Lição concluída', '1 de 3 de primeira'],
        ])('título e placar pelo desempenho %j', async (firstTry, title, summary) => {
            const ids = firstTry.map((_, i) => `q${i}`)
            vi.mocked(getLesson).mockResolvedValue({ lesson: finished(ids, firstTry) })

            renderLesson()

            expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
            expect(screen.getByText(summary)).toBeInTheDocument()
            expect(screen.getByText('Diversificação')).toBeInTheDocument()
        })

        it('mostra "O que ficou" com os resumos e some quando a lição não tem resumo', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: finished(['q0'], [true]) })
            const { unmount } = renderLesson()

            expect(await screen.findByRole('heading', { name: 'O que ficou' })).toBeInTheDocument()
            expect(screen.getByText('Primeira ideia que ficou.')).toBeInTheDocument()
            unmount()

            vi.mocked(getLesson).mockResolvedValue({
                lesson: lesson({
                    currentStep: 3,
                    blocks: { schemaVersion: 1, phases: { scenario: [], microDecision: [], revelation: [] } },
                }),
            })
            renderLesson()

            await screen.findByRole('heading', { level: 1, name: 'Lição concluída' })
            expect(screen.queryByRole('heading', { name: 'O que ficou' })).not.toBeInTheDocument()
            expect(screen.queryByText(/de primeira/)).not.toBeInTheDocument()
        })

        it('concluir a lição mostra o XP ganho na tela, sem o aviso global de XP por cima', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 3, completed: true, xpAwarded: 40 })

            renderLesson()
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

            expect(await screen.findByText('Você ganhou 40 XP')).toBeInTheDocument()
            expect(screen.queryByRole('status')).not.toBeInTheDocument()
        })

        it('subir de nível ainda dispara o aviso de nível', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 3, completed: true, xpAwarded: 40, leveledUp: true, newLevel: 2 })

            renderLesson()
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

            expect(await screen.findByText('Você subiu de nível!')).toBeInTheDocument()
            expect(screen.getByText('Você ganhou 40 XP')).toBeInTheDocument()
        })

        it('em revisão mostra o placar gravado e omite o XP', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: finished(['q0', 'q1'], [true, false], { status: 'completed' }) })

            renderLesson()
            for (let i = 0; i < 2; i++) {
                await screen.findByText(`Pergunta q${i}`)
                fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            }
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

            expect(await screen.findByText('1 de 2 de primeira')).toBeInTheDocument()
            expect(screen.queryByText(/Você ganhou/)).not.toBeInTheDocument()
        })

        it('em revisão sem nenhuma resposta gravada não mostra o placar nem o título de desempenho', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: finished(['q0'], [true], { status: 'completed', checkpoints: [] }) })

            renderLesson()
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

            await screen.findByRole('heading', { level: 1, name: 'Lição concluída' })
            expect(screen.queryByText(/de primeira/)).not.toBeInTheDocument()
        })

        it('mostra o teaser da próxima lição e leva até ela no Continuar', async () => {
            vi.mocked(listLessons).mockResolvedValue({
                lessons: [
                    lesson({ id: 'lesson-1', sortOrder: 5 }),
                    lesson({ id: 'lesson-2', sortOrder: 6, title: 'Juros compostos', scenarioText: 'Imagine R$ 1.000 rendendo todo mês.' }),
                ],
            })
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3 }) })

            renderLesson()

            expect(await screen.findByText('Na próxima')).toBeInTheDocument()
            expect(screen.getByText('Juros compostos')).toBeInTheDocument()
            expect(screen.getByText('Imagine R$ 1.000 rendendo todo mês.')).toBeInTheDocument()
        })
    })

    describe('sequência de acertos (LJ.1.6) e vibração (LJ.5.4)', () => {
        const ids = ['q0', 'q1', 'q2', 'q3', 'q4']
        const vibrate = vi.fn()
        const right = { correct: true, attempts: 1, firstTry: true, wrongOptions: [], explanation: 'ok' }
        const wrong = { correct: false, attempts: 1, firstTry: false, wrongOptions: [1] }
        const later = { correct: true, attempts: 2, firstTry: false, wrongOptions: [1], explanation: 'ok' }

        function withFive(overrides: Partial<LessonType> = {}) {
            return lesson({
                blocks: {
                    schemaVersion: 1,
                    phases: {
                        scenario: ids.map((id) => ({ type: 'check', id, kind: 'true_false', prompt: `Pergunta ${id}` })),
                        microDecision: [],
                        revelation: [],
                    },
                },
                ...overrides,
            })
        }

        // Responde a pergunta `index` com o gabarito simulado; acertando, espera o selo "Acertou" e (se `goOn`) segue.
        async function answer(index: number, response: Awaited<ReturnType<typeof answerCheckpoint>>, goOn = true) {
            await screen.findByText(`Pergunta q${index}`)
            vi.mocked(answerCheckpoint).mockResolvedValueOnce(response)
            fireEvent.click(screen.getByRole('button', { name: 'Verdadeiro' }))
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
            if (!response.correct) {
                await screen.findByRole('alert')
                return
            }
            await screen.findByText(/Acertou|Resposta certa/)
            if (goOn) fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        }

        beforeEach(() => {
            vibrate.mockClear()
            vi.mocked(answerCheckpoint).mockReset()
            Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
        })
        afterEach(() => Reflect.deleteProperty(navigator, 'vibrate'))

        it('mostra o selo ao chegar a 3 e a 5 acertos de primeira seguidos, e só nesses', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withFive() })
            renderLesson()

            for (let i = 0; i < 5; i++) {
                await answer(i, right, false)
                if (i === 2) expect(screen.getByText('3 de primeira seguidas!')).toBeInTheDocument()
                if (i === 3) expect(screen.queryByText(/de primeira seguidas/)).not.toBeInTheDocument()
                if (i === 4) expect(screen.getByText('5 de primeira seguidas!')).toBeInTheDocument()
                if (i < 4) fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            }
        })

        it('errar zera a sequência sem nenhuma mensagem e a contagem recomeça', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withFive() })
            renderLesson()

            await answer(0, right)
            await answer(1, wrong, false)
            expect(screen.queryByText(/sequência|perdeu|seguidas/i)).not.toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Falso' }))
            vi.mocked(answerCheckpoint).mockResolvedValueOnce(later)
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
            await screen.findByText(/Acertou na 2ª tentativa/)
            expect(screen.queryByText(/de primeira seguidas/)).not.toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

            await answer(2, right)
            await answer(3, right)
            await answer(4, right, false)

            // Só 3 acertos de primeira depois do erro: o selo de 3 vem na q4, não na q2.
            expect(await screen.findByText('3 de primeira seguidas!')).toBeInTheDocument()
        })

        it('em revisão não mostra selo nem vibra', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withFive({ status: 'completed', currentStep: 3 }) })
            renderLesson()

            for (let i = 0; i < 4; i++) {
                await answer(i, right)
            }

            expect(screen.queryByText(/de primeira seguidas/)).not.toBeInTheDocument()
            expect(vibrate).not.toHaveBeenCalled()
        })

        it('vibra ao concluir a lição, mas não ao só rever uma já concluída', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 3, completed: true, xpAwarded: 50 })
            const first = renderLesson()

            fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

            await waitFor(() => expect(vibrate).toHaveBeenCalledWith([60, 50, 90]))
            first.unmount()
            vibrate.mockClear()

            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ status: 'completed', currentStep: 3 }) })
            renderLesson()
            for (let i = 0; i < 3; i++) fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
            await screen.findByRole('heading', { level: 1, name: 'Lição concluída' })

            expect(vibrate).not.toHaveBeenCalled()
        })

        it('vibra no acerto e fica silencioso no erro', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: withFive() })
            renderLesson()

            await answer(0, wrong, false)
            expect(await screen.findByRole('alert')).toBeInTheDocument()
            expect(vibrate).not.toHaveBeenCalled()

            fireEvent.click(screen.getByRole('button', { name: 'Falso' }))
            vi.mocked(answerCheckpoint).mockResolvedValueOnce(later)
            fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
            await screen.findByText(/Acertou na 2ª tentativa/)
            expect(vibrate).toHaveBeenCalledTimes(1)
        })
    })

    describe('tempo estimado (LJ.5.2)', () => {
        const long = { scenarioText: 'a'.repeat(3000), revelationText: 'a'.repeat(1500) }

        it('o primeiro cartão da lição mostra "~N min"', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0, ...long }) })

            renderLesson()

            expect(await screen.findByText('~5 min')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            await screen.findByText('Sua aposta')
            expect(screen.queryByText(/min$/)).not.toBeInTheDocument()
        })

        it('ao retomar no meio mostra "Faltam ~N min" no primeiro cartão da fase retomada', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2, ...long }) })

            renderLesson()

            expect(await screen.findByText('Faltam ~2 min')).toBeInTheDocument()
        })

        it('o "Faltam" não reaparece em toda fase depois que o servidor regrava o passo', async () => {
            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 1, ...long }) })
            vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 2, completed: false })

            renderLesson()
            expect(await screen.findByText(/^Faltam ~\d+ min$/)).toBeInTheDocument()

            vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2, ...long }) })
            fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
            await screen.findByText('O que acontece')
            expect(screen.queryByText(/min$/)).not.toBeInTheDocument()
        })
    })
})
