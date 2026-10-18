export interface RetentionChartSeriesInput {
    key: string
    // Um valor por dia, na ordem de `days`; nulo = sem dado (a linha se interrompe, não vai a zero).
    values: Array<number | null>
}

export interface RetentionChartPoint {
    x: number
    y: number
    value: number
}

export interface RetentionChartSeries {
    key: string
    // Trechos contínuos de dias com dado; um dia sem dado separa dois trechos.
    segments: RetentionChartPoint[][]
    linePath: string
    // Área sob o trecho (só a primeira série é preenchida na tela).
    fillPath: string
    // Ponto por dia (nulo onde não há dado), para o cursor achar o valor.
    byIndex: Array<RetentionChartPoint | null>
}

export interface RetentionChartLayout {
    series: RetentionChartSeries[]
    maxValue: number
    xs: number[]
}
