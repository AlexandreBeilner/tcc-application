export interface IndicatorChartPoint {
    x: number
    y: number
    value: number
    simulatedDay: number
}

export interface IndicatorChartLayout {
    points: IndicatorChartPoint[]
    linePath: string
    fillPath: string
    minValue: number
    maxValue: number
}

export interface IndicatorChartEntry {
    simulatedDay: number
    value: number
}
