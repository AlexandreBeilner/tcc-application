import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { RewardRevealProvider } from '../../features/shell/RewardRevealProvider'
import { advanceLesson, getLesson, listLessons, reviewLesson } from '../../services/lessons'
import type { Lesson as LessonType } from '../../services/lessons'
import { getAsset, getFixedIncomeTaxRate, listAssets } from '../../services/market'
import type { AssetDetail, AssetSummary } from '../../services/market'
import { listMissions } from '../../services/missions'
import { Lesson } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/lessons', () => ({
    getLesson: vi.fn(),
    listLessons: vi.fn(),
    advanceLesson: vi.fn(),
    reviewLesson: vi.fn(),
}))
vi.mock('../../services/market', () => ({ listAssets: vi.fn(), getAsset: vi.fn(), getFixedIncomeTaxRate: vi.fn() }))
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
        microDecisionCorrectOption: null,
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

        expect(await screen.findByText('Cenário')).toBeInTheDocument()
        expect(screen.getByText('Diversificação')).toBeInTheDocument()
        expect(screen.getByText('Espalhar capital reduz risco')).toBeInTheDocument()
    })

    it('retoma no meio (currentStep vindo do backend), sem voltar ao passo 0', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })

        renderLesson()

        expect(await screen.findByText('Revelação')).toBeInTheDocument()
        expect(screen.getByText('Diversificar reduz o risco não sistemático')).toBeInTheDocument()
    })

    it('avança do passo 0 chamando POST progress com step 1', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 1, completed: false })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

        await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 1))
        expect(await screen.findByText('Micro-decisão')).toBeInTheDocument()
    })

    it('passo de micro-decisão (reflection) exige confirmação antes de habilitar Continuar', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 1 }) })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Continuar' })
        expect(button).toBeDisabled()

        fireEvent.click(screen.getByRole('checkbox'))
        expect(button).not.toBeDisabled()
    })

    it('micro-decisão com opções reais (backlog engajamento B.3) mostra os botões de escolha, não o checkbox', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionOptions: ['Sim', 'Não'], microDecisionCorrectOption: 0 }),
        })

        renderLesson()

        expect(await screen.findByRole('button', { name: 'Sim' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Não' })).toBeInTheDocument()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
        expect(screen.queryByText('Já pensei na minha resposta')).not.toBeInTheDocument()
    })

    it('micro-decisão com opções reais exige escolher uma opção antes de habilitar Continuar', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionOptions: ['Sim', 'Não'], microDecisionCorrectOption: 0 }),
        })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Continuar' })
        expect(button).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
        expect(button).not.toBeDisabled()
    })

    it('escolher a opção certa envia selectedOption e mostra "Você acertou" na Revelação', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionOptions: ['Sim', 'Não'], microDecisionCorrectOption: 0 }),
        })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 2, completed: false })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Sim' }))
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 2, 0))
        expect(await screen.findByText('Você acertou')).toBeInTheDocument()
    })

    it('escolher a opção errada mostra "Quase" com a resposta certa na Revelação', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionOptions: ['Sim', 'Não'], microDecisionCorrectOption: 0 }),
        })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 2, completed: false })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Não' }))
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 2, 1))
        expect(await screen.findByText('Quase. A resposta certa era: Sim')).toBeInTheDocument()
    })

    it('lição sem opções reais continua mostrando o checkbox de hoje na Revelação (regressão)', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })

        renderLesson()

        await screen.findByText('Revelação')
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

    it('ao chegar no passo 3 mostra o desbloqueio com o que foi liberado', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 3, completed: true })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

        expect(await screen.findByText('Desbloqueio')).toBeInTheDocument()
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

        await screen.findByText('Desbloqueio')
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

    it('lição já concluída reabre direto no desbloqueio (modo revisão), sem recreditar', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, status: 'completed' }) })

        renderLesson()

        expect(await screen.findByText('Desbloqueio')).toBeInTheDocument()
        expect(advanceLesson).not.toHaveBeenCalled()
    })

    it('lição já concluída reabre e registra a revisão (missão "revise uma lição antiga")', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, status: 'completed' }) })

        renderLesson()

        await screen.findByText('Desbloqueio')
        await waitFor(() => expect(reviewLesson).toHaveBeenCalledExactlyOnceWith('token-valido', 'lesson-1'))
    })

    it('lição em andamento, não concluída, não registra revisão nenhuma', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0, status: 'available' }) })

        renderLesson()

        await screen.findByText('Cenário')
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
        await waitFor(() => expect(screen.getByText('Cenário')).toBeInTheDocument())
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

    it('micro-decisão fatiada: checkbox só aparece no último cartão do prompt', async () => {
        vi.mocked(getLesson).mockResolvedValue({
            lesson: lesson({ currentStep: 1, microDecisionPrompt: 'Primeiro cartão.\n\nSegundo cartão.' }),
        })

        renderLesson()

        await screen.findByText('Primeiro cartão.')
        expect(screen.queryByText('Já pensei na minha resposta')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        expect(await screen.findByText('Segundo cartão.')).toBeInTheDocument()
        expect(screen.getByText('Já pensei na minha resposta')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
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
        vi.mocked(getLesson).mockRejectedValue(new Error('bloqueada'))

        renderLesson()

        expect(
            await screen.findByText('Não foi possível carregar esta lição agora. Ela pode estar bloqueada ou não existir.'),
        ).toBeInTheDocument()
    })
})
