export interface SparklineGeometry {
    linePath: string
    direction: 'up' | 'down' | 'flat'
}

// Caminho SVG de uma série real de preços (MO.9.5). Sem ruído inventado: a
// regra de "altos e baixos" do identidade-visual-padroes.md §4 vale para
// progressão sintética; aqui a série já vem do motor. Menos de 2 pontos não
// desenha nada (null). Série constante vira uma linha no meio.
export function computeSparklineGeometry(values: number[], width: number, height: number, marginY = 3): SparklineGeometry | null {
    const finite = values.filter((value) => Number.isFinite(value))
    if (finite.length < 2) return null

    const min = Math.min(...finite)
    const max = Math.max(...finite)
    const span = max - min
    const usableH = height - 2 * marginY
    const lastIndex = finite.length - 1

    const points = finite.map((value, i) => {
        const x = (i / lastIndex) * width
        const y = span === 0 ? height / 2 : marginY + usableH * (1 - (value - min) / span)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })

    const delta = finite[lastIndex] - finite[0]
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    return { linePath: points.join(' '), direction }
}
