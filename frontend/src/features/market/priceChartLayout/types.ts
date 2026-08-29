export interface PriceChartPoint {
    x: number
    y: number
    price: number
    simulatedDay: number
}

export interface PriceChartLayout {
    points: PriceChartPoint[]
    linePath: string
    fillPath: string
    minPrice: number
    maxPrice: number
    isGain: boolean
}
