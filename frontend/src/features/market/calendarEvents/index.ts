import type { CalendarEvent, CalendarEventKind } from '../../../services/market'
import { formatCurrency } from '../../portfolio/format'
import { formatSelic } from '../calendarFormat'

export interface CalendarEventView {
    title: string
    subtitle: string
    // Nome do tipo em texto: o ícone nunca é o único sinal.
    label: string
    mine: boolean
    // Valor do usuário no fato (provento), quando o motor mandou. Nunca de terceiros.
    amount?: string
    // Valor confirmado (data-ex já passou): o item fica sólido em vez de tracejado.
    confirmed: boolean
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
    assembly_open: 'Assembleia',
    assembly_close: 'Assembleia',
    assembly_effect: 'Assembleia',
}

const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function money(value: number | undefined): string {
    return value === undefined ? '' : formatCurrency(value)
}

// monthLabel (achado 025) traduz 'AAAA-MM' pro nome do mês em pt-BR — usado
// aqui pro subtítulo de salary_payment e por `dayFlipReveal` pro teatro de
// recompensa, pra distinguir "salário de junho" de "salário de agosto" quando
// um catch-up (backend, T.5) credita vários meses atrasados no mesmo dia
// simulado, todos com o mesmo valor.
export function monthLabel(referenceMonth: string): string {
    const [year, month] = referenceMonth.split('-').map(Number)
    return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)))
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

function describeAmount(event: CalendarEvent): string | undefined {
    if (event.estimated_amount === undefined) return undefined
    const units = event.user_quantity
    const quantity = units === undefined ? '' : `${quantityFormatter.format(units)} ${units === 1 ? 'unidade' : 'unidades'} · `
    return `${quantity}${money(event.estimated_amount)} ${event.amount_is_estimate ? '(estimado)' : '(valor confirmado)'}`
}

export function describeCalendarEvent(event: CalendarEvent): CalendarEventView {
    return { ...describeKind(event), amount: describeAmount(event), confirmed: event.amount_is_estimate === false }
}

// Texto de um fato do calendário. Evento macro mostra só o título já escrito pelo
// motor: a direção (positivo/negativo) fica de fora de propósito, o calendário
// não entrega o veredito (diretrizes de redação de eventos macro).
function describeKind(event: CalendarEvent): Omit<CalendarEventView, 'amount' | 'confirmed'> {
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
        // O título já vem pronto do servidor ("Empresa: pauta"); sem valor em reais.
        case 'assembly_open':
            return { title: event.title ?? 'Assembleia de acionistas', subtitle: 'Abre a votação', label, mine }
        case 'assembly_close':
            return { title: event.title ?? 'Assembleia de acionistas', subtitle: 'Fecha a votação', label, mine }
        case 'assembly_effect':
            return { title: event.title ?? 'Assembleia de acionistas', subtitle: 'O efeito da decisão começa', label, mine }
        case 'salary_payment': {
            if (event.future) return { title: 'Dia de pagamento', subtitle: 'Salário do mês', label, mine }
            // reference_month (achado 025) pode divergir do dia deste evento num
            // catch-up de vários meses atrasados de uma vez (backend, T.5) — sem
            // mostrar o mês no subtítulo, vários salários do mesmo valor no mesmo
            // dia ficariam indistinguíveis pro usuário.
            const subtitle = event.reference_month ? `Referente a ${monthLabel(event.reference_month)}` : 'Caiu na sua conta'
            return { title: `Salário: ${money(event.unit_value)}`, subtitle, label, mine }
        }
    }
}
