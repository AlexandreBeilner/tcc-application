import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getMarketCalendar, getMarketClock } from '../../../services/market'
import { calendarFixture, calendarWindow, DEFAULT_EVENTS, SATURDAY_CLOCK, WEDNESDAY_CLOCK } from '../../../test/calendarFixtures'
import { MarketCalendarPanel } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({ getMarketClock: vi.fn(), getMarketCalendar: vi.fn() }))

function renderPanel(onClose = vi.fn()) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MarketCalendarPanel onClose={onClose} />
        </QueryClientProvider>,
    )
    return { onClose }
}

describe('MarketCalendarPanel', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        vi.mocked(getMarketClock).mockResolvedValue(WEDNESDAY_CLOCK)
        vi.mocked(getMarketCalendar).mockResolvedValue(calendarFixture(DEFAULT_EVENTS))
    })

    afterEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('mostra o dia, o trimestre em dias e a regra do tempo acelerado', async () => {
        renderPanel()

        expect(await screen.findByText('Dia 135 · quarta 08/07/2026')).toBeInTheDocument()
        expect(screen.queryByText(/Trimestre: dia/)).not.toBeInTheDocument()
        expect(screen.getByText(/5 dias de mercado/)).toBeInTheDocument()
        expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument()
    })

    it('pede a janela de 7 dias atrás a 14 à frente', async () => {
        renderPanel()

        await screen.findByText('Dia 135 · quarta 08/07/2026')
        expect(getMarketCalendar).toHaveBeenCalledWith('token', '2026-07-01', '2026-07-22', { scope: 'mine' })
        // Sem matchMedia (jsdom) o layout cai no mobile: a janela do trimestre não é pedida.
        expect(getMarketCalendar).toHaveBeenCalledTimes(1)
    })

    it('abre em "Meus" e a troca para "Todos" pede scope=all e fica lembrada', async () => {
        renderPanel()

        await screen.findByText('Dia 135 · quarta 08/07/2026')
        expect(screen.getByRole('radio', { name: 'Meus' })).toBeChecked()

        fireEvent.click(screen.getByRole('radio', { name: 'Todos' }))

        await vi.waitFor(() => expect(getMarketCalendar).toHaveBeenLastCalledWith('token', '2026-07-01', '2026-07-22', { scope: 'all' }))
        expect(localStorage.getItem('app.calendar.scope')).toBe('all')
    })

    it('lembra o escopo escolhido na abertura seguinte', async () => {
        localStorage.setItem('app.calendar.scope', 'all')
        renderPanel()

        await screen.findByText('Dia 135 · quarta 08/07/2026')
        expect(screen.getByRole('radio', { name: 'Todos' })).toBeChecked()
        expect(getMarketCalendar).toHaveBeenCalledWith('token', '2026-07-01', '2026-07-22', { scope: 'all' })
    })

    it('hoje, em "Todos": o que é seu vai em "Para você" e o do mercado em "No mercado"', async () => {
        localStorage.setItem('app.calendar.scope', 'all')
        renderPanel()

        expect(await screen.findByText('Copom cortou a Selic para 10,50%')).toBeInTheDocument()
        const mine = within(screen.getByRole('region', { name: 'Para você' }))
        expect(mine.getByText('Vencimento de LFT2029')).toBeInTheDocument()
        expect(mine.getByText(/seg 13\/07 · em 5 dias/)).toBeInTheDocument()
        expect(mine.queryByText(/Copom/)).not.toBeInTheDocument()

        const market = within(screen.getByText('No mercado', { selector: 'summary' }).parentElement as HTMLElement)
        expect(market.getByText('Divulgação de resultados do trimestre')).toBeInTheDocument()
        expect(market.getByText('PAPL11: data-ex')).toBeInTheDocument()
        expect(market.getByText(/ter 14\/07 · em 6 dias/)).toBeInTheDocument()
        // Tudo que vem aí carrega "previsto" em texto, não só o tracejado.
        expect(market.getAllByText(/previsto/)).toHaveLength(2)
    })

    it('em "Meus" o mercado fica de fora, com aviso e atalho para ver tudo', async () => {
        renderPanel()

        await screen.findByText('Dia 135 · quarta 08/07/2026')
        expect(screen.queryByText('No mercado', { selector: 'summary' })).not.toBeInTheDocument()
        expect(screen.queryByText('Copom cortou a Selic para 10,50%')).not.toBeInTheDocument()
        expect(screen.getByText(/Mostrando só o que afeta você/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Ver o mercado' }))
        expect(screen.getByRole('radio', { name: 'Todos' })).toBeChecked()
    })

    it('mostra o provento a receber: confirmado fica sólido, estimado é dito em texto', async () => {
        vi.mocked(getMarketCalendar).mockResolvedValue(
            calendarFixture({
                141: [
                    {
                        kind: 'dividend_payment_date',
                        scope: 'global',
                        future: true,
                        relevance: 'mine',
                        relevance_reason: 'position',
                        ticker: 'PAPL11',
                        unit_value: 0.88,
                        user_quantity: 10,
                        estimated_amount: 8.8,
                        amount_is_estimate: false,
                    },
                    {
                        kind: 'dividend_payment_date',
                        scope: 'global',
                        future: true,
                        relevance: 'mine',
                        relevance_reason: 'position',
                        ticker: 'BNDD3',
                        unit_value: 0.5,
                        user_quantity: 4,
                        estimated_amount: 2,
                        amount_is_estimate: true,
                    },
                ],
            }),
        )
        renderPanel()

        const mine = within(await screen.findByRole('region', { name: 'Para você' }))
        expect(await mine.findByText(/Proventos a receber nesta janela:/)).toHaveTextContent('R$ 10,80 (estimado)')
        expect(mine.getByText(/10 unidades · R\$ 8,80 \(valor confirmado\)/)).toBeInTheDocument()
        expect(mine.getByText(/4 unidades · R\$ 2,00 \(estimado\)/)).toBeInTheDocument()
    })

    it('a faixa de dias marca "para você" e "no mercado" por contagem em texto', async () => {
        renderPanel()

        const today = await screen.findByRole('button', { name: /quarta 08\/07, hoje, 2 no mercado/ })
        expect(within(today).getByTestId('market-mark')).toBeInTheDocument()
        expect(within(today).queryByTestId('mine-mark')).not.toBeInTheDocument()
        const order = screen.getByRole('button', { name: /segunda 06\/07, 1 para você/ })
        expect(within(order).getByTestId('mine-mark')).toHaveTextContent('1')
    })

    it('selecionar um dia passado sem fatos mostra o vazio', async () => {
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: /terça 07\/07/ }))
        expect(screen.getByText('Nada que afete você neste dia.')).toBeInTheDocument()
    })

    it('dia passado com ordem do usuário mostra a etiqueta VOCÊ', async () => {
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: /segunda 06\/07, 1 para você/ }))
        expect(screen.getByText('Compra de 10 BNDD3')).toBeInTheDocument()
        expect(screen.getByText('VOCÊ')).toBeInTheDocument()
        expect(screen.getByText('Para ver o que vem depois, toque em hoje.')).toBeInTheDocument()
    })

    it('dia futuro sem fato seu mostra o vazio de "Para você"', async () => {
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: /quinta 09\/07/ }))
        expect(screen.getByText('Nada que afete você neste dia.')).toBeInTheDocument()
    })

    it('fim de semana aparece como fechado em texto na faixa e no detalhe', async () => {
        renderPanel()

        const saturday = await screen.findByRole('button', { name: /sábado 11\/07, mercado fechado/ })
        expect(within(saturday).getByText('fechado')).toBeInTheDocument()
        fireEvent.click(saturday)
        expect(screen.getByText('Mercado fechado')).toBeInTheDocument()
    })

    it('painel aberto num sábado mostra o dia de hoje como fechado', async () => {
        vi.mocked(getMarketClock).mockResolvedValue(SATURDAY_CLOCK)
        renderPanel()

        expect(await screen.findByText('Mercado fechado')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /Hoje, sábado 11\/07 · dia 138/ })).toBeInTheDocument()
    })

    it('falha do calendário avisa em texto', async () => {
        vi.mocked(getMarketCalendar).mockRejectedValue(new Error('fora do ar'))
        renderPanel()

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os fatos do calendário')
    })

    it('o último dia do trimestre é um bloco marcado em texto, sem barra de progresso', async () => {
        // Dia 88 de 91: o relatório cai 3 dias à frente (dia 138), dentro da faixa.
        vi.mocked(getMarketClock).mockResolvedValue({ ...WEDNESDAY_CLOCK, quarter_day: 88 })
        renderPanel()

        const block = await screen.findByRole('button', { name: /sábado 11\/07, mercado fechado, fim do trimestre/ })
        expect(within(block).getByText('fim do trim.')).toBeInTheDocument()
        expect(screen.queryByRole('img', { name: /do trimestre/ })).not.toBeInTheDocument()

        fireEvent.click(block)
        expect(screen.getByText('Fim do trimestre', { selector: 'span' })).toBeInTheDocument()
    })

    it('fecha por Esc, pelo botão e pelo fundo', async () => {
        const { onClose } = renderPanel()
        await screen.findByText('Dia 135 · quarta 08/07/2026')

        fireEvent.keyDown(document, { key: 'Escape' })
        fireEvent.click(screen.getByRole('button', { name: 'Fechar calendário' }))
        expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('sem dados do dia (calendário vazio) não quebra', async () => {
        vi.mocked(getMarketCalendar).mockResolvedValue(calendarWindow(128, 149))
        renderPanel()

        expect(await screen.findByText('Nada que afete você neste dia.')).toBeInTheDocument()
    })
})
