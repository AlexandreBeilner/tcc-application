// Ponto de hover (tarefa 6.7.1) — coordenadas de tela já calculadas das
// duas séries no mesmo mês, pro tooltip mostrar os dois valores
// intermediários ao passar o mouse (mesmo padrão de
// `features/market/priceChartLayout`, que já resolve x/y por ponto).
export interface GrowthChartPoint {
    x: number
    investedY: number
    totalY: number
    month: number
    invested: number
    total: number
}

export interface GrowthChartLayout {
    // Sólido + preenchido (identidade-visual-padroes.md §3) — capital
    // efetivamente aportado, "já é seu".
    investedPath: string
    investedFillPath: string
    // Tracejado, sem preenchimento — o rendimento projetado por cima do
    // aportado ainda não aconteceu, é só a simulação (§3: "nunca preencher
    // a parte ainda não conquistada").
    totalPath: string
    minValue: number
    maxValue: number
    points: GrowthChartPoint[]
}
