// Gráficos decorativos gerados na hora do build (nada de Math.random: o HTML é
// determinístico). Seguem a regra de .claude/identidade-visual-padroes.md: linha de
// progressão sempre com altos e baixos, sólido = já aconteceu, tracejado = projeção.

export function rng(seed) {
    let s = seed
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296
        return s / 4294967296
    }
}

const f = (n) => n.toFixed(1)
export const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join(' ')

export function sparklinePoints() {
    const r = rng(7)
    const n = 34
    const raw = []
    let v = 105
    for (let i = 0; i < n; i++) {
        v += (r() - 0.58) * -9 - 1.1
        raw.push([i * (260 / (n - 1)), v])
    }
    const ys = raw.map((p) => p[1])
    const lo = Math.min(...ys)
    const hi = Math.max(...ys)
    const pts = raw.map((p) => [p[0], 128 - (14 + ((p[1] - lo) / (hi - lo)) * 100 - 14)])
    const last = pts[pts.length - 1]
    const r2 = rng(3)
    const proj = [last]
    for (let j = 1; j <= 12; j++) proj.push([last[0] + j * 10, last[1] - j * 1.6 + (r2() - 0.5) * 5])
    return { pts, proj, last }
}

export function heroSparkSvg() {
    const { pts, proj, last } = sparklinePoints()
    let grid = ''
    for (let g = 1; g < 5; g++) grid += `<line x1="0" x2="400" y1="${g * 30}" y2="${g * 30}" stroke="var(--grid)"/>`
    return (
        `<svg class="spark" viewBox="0 0 400 150" preserveAspectRatio="none" role="img" aria-label="Gráfico de evolução do patrimônio, com altos e baixos">` +
        grid +
        `<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".35"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>` +
        `<path d="${toPath(pts)} L${f(last[0])} 150 L0 150Z" fill="url(#ga)"/>` +
        `<path d="${toPath(pts)}" fill="none" stroke="var(--brand-300)" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
        `<path d="${toPath(proj)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>` +
        `<line x1="${f(last[0])}" x2="${f(last[0])}" y1="0" y2="150" stroke="var(--muted)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>` +
        `<circle cx="${f(last[0])}" cy="${f(last[1])}" r="4.5" fill="var(--brand-300)"/></svg>`
    )
}

export const TRAIL_MARKS = [
    [40, 360],
    [110, 300],
    [190, 250],
    [270, 190],
    [340, 120],
    [400, 52],
]
const TRAIL_LABELS = ['Juros', 'Inflação', 'Tesouro', 'Ações', 'FIIs', 'ETFs']
export const TRAIL_CURRENT = 3

export function trailPoints() {
    const r = rng(21)
    const full = []
    for (let m = 0; m < TRAIL_MARKS.length - 1; m++) {
        const a = TRAIL_MARKS[m]
        const b = TRAIL_MARKS[m + 1]
        full.push(a)
        for (let k = 1; k <= 3; k++) {
            const t = k / 4
            full.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * (k === 2 ? 26 : 16)])
        }
    }
    full.push(TRAIL_MARKS[TRAIL_MARKS.length - 1])
    return full
}

export function trailSvg() {
    const full = trailPoints()
    const idx = TRAIL_CURRENT * 4
    let h = `<svg viewBox="0 0 440 420" role="img" aria-label="Mapa da trilha com lições concluídas, a lição atual e as próximas bloqueadas">`
    h += `<path d="${toPath(full.slice(0, idx + 1))}" fill="none" stroke="var(--gamify)" stroke-width="3" stroke-linejoin="round"/>`
    h += `<path d="${toPath(full.slice(idx))}" fill="none" stroke="var(--muted)" stroke-width="2.4" stroke-dasharray="6 6" stroke-linejoin="round"/>`
    TRAIL_MARKS.forEach((p, i) => {
        const done = i < TRAIL_CURRENT
        const now = i === TRAIL_CURRENT
        const stroke = now ? 'var(--brand)' : done ? 'var(--gamify)' : 'var(--muted)'
        h += `<circle cx="${p[0]}" cy="${p[1]}" r="${now ? 16 : 12}" fill="${done ? 'var(--gamify)' : 'var(--surface)'}" stroke="${stroke}" stroke-width="2.5"${done || now ? '' : ' stroke-dasharray="4 3"'}/>`
        if (done)
            h += `<path d="M${p[0] - 5} ${p[1]}l3.5 3.5 6-7" fill="none" stroke="#14161B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
        if (now) {
            h += `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="var(--brand-300)"/>`
            h += `<rect x="${p[0] - 44}" y="${p[1] - 52}" width="88" height="24" rx="12" fill="var(--brand)"/>`
            h += `<text x="${p[0]}" y="${p[1] - 36}" text-anchor="middle" font-size="12" font-weight="600" fill="#fff">Você está aqui</text>`
        }
        const last = i === TRAIL_MARKS.length - 1
        h += `<text x="${last ? p[0] : p[0] + 16}" y="${p[1] + (last ? 34 : 32)}" font-size="12" fill="var(--text2)" text-anchor="${last ? 'middle' : 'start'}">${TRAIL_LABELS[i]}</text>`
    })
    return h + '</svg>'
}
