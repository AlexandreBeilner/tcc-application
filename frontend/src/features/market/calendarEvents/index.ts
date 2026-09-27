import type { CalendarEvent, CalendarEventKind } from '../../../services/market'
import { formatCurrency } from '../../portfolio/format'
import { formatSelic } from '../calendarFormat'

export interface CalendarEventView {
    title: string
    subtitle: string
    // Nome do tipo em texto: o ícone nunca é o único sinal.
    label: string
    mine: boolean
}

const KIND_LABEL: Record<CalendarEventKind, string> = {
    macro_event: 'Evento de mercado',
    copom: 'Copom',
    report: 'Balanço',
    dividend_ex_date: 'Provento',
    dividend_payment_date: 'Provento',
    order_executed: 'Ordem',
    dividend_received: 'Provento',
    fixed_income_purchase: 'Renda fixa',
    fixed_income_redemption: 'Renda fixa',
    fixed_income_maturity: 'Renda fixa',
    salary_payment: 'Salário',
}

const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })

function money(value: number | undefined): string {
    return value === undefined ? '' : formatCurrency(value)
}

function describeCopom(event: CalendarEvent): Pick<CalendarEventView, 'title' | 'subtitle'> {
    const { selic_rate: current, previous_selic_rate: previous } = event
    if (event.future || current === undefined) {
        return { title: 'Reunião do Copom', subtitle: 'Decisão da Selic' }
    }
    const subtitle = previous === undefined ? 'Decisão anunciada' : `Anterior: ${formatSelic(previous)}. Nova: ${formatSelic(current)}`
    if (previous === undefined || current === previous) return { title: `Copom manteve a Selic em ${formatSelic(current)}`, subtitle }
    const verb = current > previous ? 'subiu' : 'cortou'
    return { title: `Copom ${verb} a Selic para ${formatSelic(current)}`, subtitle }
}

// Texto de um fato do calendário. Evento macro mostra só o título já escrito pelo
// motor: a direção (positivo/negativo) fica de fora de propósito, o calendário
// não entrega o veredito (diretrizes de redação de eventos macro).
export function describeCalendarEvent(event: CalendarEvent): CalendarEventView {
    const label = KIND_LABEL[event.kind]
    const mine = event.scope === 'user'
    const ticker = event.ticker ?? ''

    switch (event.kind) {
        case 'macro_event':
            return { title: event.title ?? 'Evento de mercado', subtitle: label, label, mine }
        case 'copom':
            return { ...describeCopom(event), label, mine }
        case 'report':
            return { title: 'Divulgação de resultados do trimestre', subtitle: 'Balanços das empresas', label, mine }
        case 'dividend_ex_date':
            return { title: `${ticker}: data-ex`, subtitle: `${money(event.unit_value)} por unidade`, label, mine }
        case 'dividend_payment_date':
            return { title: `${ticker}: pagamento do provento`, subtitle: `${money(event.unit_value)} por unidade`, label, mine }
        case 'order_executed': {
            const verb = event.side === 'sell' ? 'Venda' : 'Compra'
            const quantity = event.quantity === undefined ? '' : `${quantityFormatter.format(event.quantity)} `
            return { title: `${verb} de ${quantity}${ticker}`, subtitle: `Executada a ${money(event.unit_value)}`, label, mine }
        }
        case 'dividend_received':
            return { title: `Provento recebido de ${ticker}`, subtitle: `${money(event.unit_value)} por unidade`, label, mine }
        case 'fixed_income_purchase':
            return { title: `Aporte em ${ticker}`, subtitle: 'Renda fixa', label, mine }
        case 'fixed_income_redemption':
            return { title: `Resgate de ${ticker}`, subtitle: 'Renda fixa', label, mine }
        case 'fixed_income_maturity':
            return { title: `Vencimento de ${ticker}`, subtitle: 'Seu título vence e é resgatado', label, mine }
        case 'salary_payment':
            if (event.future) return { title: 'Dia de pagamento', subtitle: 'Salário do mês', label, mine }
            return { title: `Salário: ${money(event.unit_value)}`, subtitle: 'Caiu na sua conta', label, mine }
    }
}
