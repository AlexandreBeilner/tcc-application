// Rótulos e datas do calendário do mercado (tarefa S.12). `weekday` vem do
// motor como código estável (`sun`..`sat`); a tradução é responsabilidade do
// frontend. Datas são `AAAA-MM-DD` e nunca passam por fuso local.
const WEEKDAY_SHORT: Record<string, string> = {
    sun: 'dom',
    mon: 'seg',
    tue: 'ter',
    wed: 'qua',
    thu: 'qui',
    fri: 'sex',
    sat: 'sáb',
}

const WEEKDAY_LONG: Record<string, string> = {
    sun: 'domingo',
    mon: 'segunda',
    tue: 'terça',
    wed: 'quarta',
    thu: 'quinta',
    fri: 'sexta',
    sat: 'sábado',
}

// Ordem do eixo vertical da grade do trimestre: segunda a domingo.
export const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function weekdayShort(code: string): string {
    return WEEKDAY_SHORT[code] ?? code
}

export function weekdayLong(code: string): string {
    return WEEKDAY_LONG[code] ?? code
}

// "12/01" a partir de "2026-01-12".
export function formatDayMonth(isoDate: string): string {
    const [, month, day] = isoDate.split('-')
    return `${day}/${month}`
}

// Só o dia do mês, "12", pra faixa de dias.
export function formatDayOfMonth(isoDate: string): string {
    return isoDate.split('-')[2]
}

// Soma dias a uma data `AAAA-MM-DD` em UTC (evita virada de fuso/horário de verão).
export function shiftIsoDate(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

// Formato do rótulo de um dia, sem rodeio: "quarta 08/07".
export function formatWeekdayDate(weekday: string, isoDate: string): string {
    return `${weekdayLong(weekday)} ${formatDayMonth(isoDate)}`
}

const selicFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Selic em pontos percentuais com 2 casas ("10,75%"): a Selic anda em passos de
// 0,25 e o formato de 1 casa dos demais indicadores arredondaria o passo.
export function formatSelic(percentPoints: number): string {
    return `${selicFormatter.format(percentPoints)}%`
}
