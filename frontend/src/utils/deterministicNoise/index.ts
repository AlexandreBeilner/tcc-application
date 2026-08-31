// Hash determinístico (nunca `Math.random`) compartilhado por todo gráfico
// de linha com ruído sintético entre marcos reais — Mapa da Trilha
// (`features/lessons/trackChartLayout`) e sparkline do pódio da
// Classificação (`features/ranking/podiumSparkline`), mesmo princípio
// (identidade-visual-padroes.md §4). O mesmo `seed` sempre produz o mesmo
// valor, senão o gráfico "tremeria" a cada re-render.
export function noise(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453
    return value - Math.floor(value)
}
