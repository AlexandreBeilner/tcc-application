import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getMarketCalendar, getMarketClock } from '../../../services/market'
import { calendarFixture, DEFAULT_EVENTS, SATURDAY_CLOCK, WEDNESDAY_CLOCK } from '../../../test/calendarFixtures'
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
        expect(getMarketCalendar).toHaveBeenCalledWith('token', '2026-07-01', '2026-07-22')
        // Sem matchMedia (jsdom) o layout cai no mobile: a janela do trimestre não é pedida.
        expect(getMarketCalendar).toHaveBeenCalledTimes(1)
    })

    it('hoje: "Aconteceu" com o do dia e "Vem aí" só com fatos futuros', async () => {
        renderPanel()

        expect(await screen.findByText('Copom cortou a Selic para 10,50%')).toBeInTheDocument()
        const comingHeading = screen.getByRole('heading', { name: 'Vem aí' })
        const coming = within(comingHeading.parentElement as HTMLElement)
        expect(coming.getByText('Divulgação de resultados do trimestre')).toBeInTheDocument()
        expect(coming.getByText('Vencimento de LFT2029')).toBeInTheDocument()
        expect(coming.getByText('PAPL11: data-ex')).toBeInTheDocument()
        expect(coming.queryByText(/Copom cortou/)).not.toBeInTheDocument()
        // Tudo que vem aí carrega "previsto" em texto, não só o tracejado.
        expect(coming.getAllByText(/previsto/)).toHaveLength(3)
        expect(coming.getByText(/seg 13\/07 · em 5 dias/)).toBeInTheDocument()
    })

    it('selecionar um dia passado sem fatos mostra o vazio', async () => {
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: /terça 07\/07/ }))
        expect(screen.getByText('Nada registrado neste dia.')).toBeInTheDocument()
    })

    it('dia passado com ordem do usuário mostra a etiqueta VOCÊ', async () => {
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: /segunda 06\/07, 1 fato/ }))
        expect(screen.getByText('Compra de 10 BNDD3')).toBeInTheDocument()
        expect(screen.getByText('VOCÊ')).toBeInTheDocument()
        expect(screen.getByText('Para ver o que vem depois, toque em hoje.')).toBeInTheDocument()
    })

    it('dia futuro: "Ainda não aconteceu" e só o previsto', async () => {
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: /quinta 09\/07/ }))
        expect(screen.getByText('Ainda não aconteceu.')).toBeInTheDocument()
        expect(screen.getByText('Nenhum fato previsto.')).toBeInTheDocument()
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
        vi.mocked(getMarketCalendar).mockResolvedValue({ from_day: 128, to_day: 149, days: [] })
        renderPanel()

        expect(await screen.findByText('Nada registrado neste dia.')).toBeInTheDocument()
    })
})
