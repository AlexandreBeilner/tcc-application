export interface RetentionLineChartSeries {
    key: string
    label: string
    // Cor como token de CSS (ex: `var(--color-brand-500)`), nunca valor solto.
    color: string
    // Um valor por dia, na ordem de `days`; nulo = sem dado (a linha se interrompe).
    values: Array<number | null>
    // Só uma série por gráfico leva a área sob a linha (a principal).
    filled?: boolean
}

export interface RetentionLineChartProps {
    title: string
    // Dias em AAAA-MM-DD (UTC), do mais antigo para o mais recente.
    days: string[]
    series: RetentionLineChartSeries[]
    formatValue: (value: number) => string
    // Texto lido por leitor de tela no lugar do desenho (o gráfico é decorativo).
    summary: string
    emptyMessage: string
    // Nota sob o gráfico, ex: desde quando existe registro.
    note?: string
}
