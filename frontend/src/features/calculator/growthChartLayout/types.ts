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
}
