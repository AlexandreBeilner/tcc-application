import type { Retrospective } from '../../../services/retrospectives'

const MONTH_NAMES = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
]

// 'AAAA-MM' -> 'setembro de 2026'
export function monthLabel(month: string): string {
    const [year, mon] = month.split('-').map(Number)
    return `${MONTH_NAMES[mon - 1]} de ${year}`
}

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`
}

// Texto curto que acompanha a imagem (só números de atividade, nunca valor em reais, RNF09). O
// destaque é a sequência (PRO) ou as lições (todos), como os apps de hábito costumam fazer.
export function buildShareText(retro: Retrospective): string {
    const parts: string[] = []
    if (retro.premium && retro.premium.longestStreak > 0) {
        parts.push(plural(retro.premium.longestStreak, 'dia seguido', 'dias seguidos'))
    }
    if (retro.lessonsCompleted > 0) parts.push(plural(retro.lessonsCompleted, 'lição', 'lições'))
    parts.push(`nível ${retro.level}`)
    return `Meu ${monthLabel(retro.month).split(' de ')[0]} no Investimenta: ${parts.join(', ')}.`
}

// Dados do selo/identidade que a imagem personalizada (PRO) mostra.
export interface ShareIdentity {
    username: string
    isPro: boolean
    // Chave da moldura (`frame_aurora`...) e título, só para PRO.
    frame: string | null
    title: string | null
}

// Cores das molduras: espelho de `--frame-*` em `index.css` (canvas não lê custom properties).
// Manter em sincronia com `identidade-visual-tokens.md`, seção 2.7.
export const FRAME_COLORS: Record<string, [string, string]> = {
    frame_aurora: ['#2dd4bf', '#3b82f6'],
    frame_oceano: ['#1d4fc4', '#60a5fa'],
    frame_crepusculo: ['#8b5cf6', '#ec4899'],
    frame_ametista: ['#7c3aed', '#c4b5fd'],
    frame_coral: ['#fb7185', '#f472b6'],
    frame_grafite: ['#6b7280', '#d1d5db'],
}

const CARD = { width: 1080, height: 1350 }
// Paleta escura do app (tokens, seção 2): a imagem sempre sai no tema escuro, que lê bem em redes.
const COLOR = {
    bg: '#0e0f13',
    surface: '#16181d',
    border: '#2a2e38',
    text: '#f5f6f8',
    muted: '#9ba1ae',
    brand: '#2f6fed',
    brandSoft: '#93b4ff',
    brandBg: '#0e1e42',
    gain: '#34c77b',
    loss: '#e5484d',
}

export interface CanvasLike {
    width: number
    height: number
    getContext(type: '2d'): CanvasRenderingContext2D | null
}

// Desenha o cartão compartilhável no canvas. Versão simples (todos): lições, conquistas e nível.
// Versão PRO: destaque da sequência, calendário de dias, rentabilidade do mês como marco em
// percentual, e a identidade (moldura, título e selo). Nunca desenha valor em reais.
export function drawShareCard(canvas: CanvasLike, retro: Retrospective, identity: ShareIdentity): void {
    canvas.width = CARD.width
    canvas.height = CARD.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = COLOR.bg
    ctx.fillRect(0, 0, CARD.width, CARD.height)
    const glow = ctx.createLinearGradient(0, 0, CARD.width, 520)
    glow.addColorStop(0, COLOR.brandBg)
    glow.addColorStop(1, COLOR.bg)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, CARD.width, 520)

    // Identidade: avatar com moldura (PRO), nome, título e selo.
    const cx = 140
    const cy = 150
    const frameColors = identity.isPro && identity.frame ? FRAME_COLORS[identity.frame] : undefined
    if (frameColors) {
        const ring = ctx.createLinearGradient(cx - 70, cy - 70, cx + 70, cy + 70)
        ring.addColorStop(0, frameColors[0])
        ring.addColorStop(1, frameColors[1])
        ctx.fillStyle = ring
        ctx.beginPath()
        ctx.arc(cx, cy, 70, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = COLOR.surface
    ctx.beginPath()
    ctx.arc(cx, cy, frameColors ? 60 : 64, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLOR.brandSoft
    ctx.font = '700 56px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(identity.username.charAt(0).toUpperCase(), cx, cy + 2)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = COLOR.text
    ctx.font = '700 44px sans-serif'
    ctx.fillText(`@${identity.username}`, 250, 140)
    if (identity.isPro) {
        ctx.fillStyle = COLOR.brandBg
        ctx.strokeStyle = COLOR.brand
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.roundRect(250, 160, 84, 40, 20)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = COLOR.brandSoft
        ctx.font = '700 24px sans-serif'
        ctx.fillText('PRO', 276, 189)
        if (identity.title) {
            ctx.fillStyle = COLOR.muted
            ctx.font = 'italic 28px sans-serif'
            ctx.fillText(identity.title, 350, 190)
        }
    }

    // Título do mês.
    ctx.fillStyle = COLOR.muted
    ctx.font = '600 34px sans-serif'
    ctx.fillText(`Meu ${monthLabel(retro.month)}`, 80, 330)

    // Destaque: sequência (PRO) ou lições (todos).
    const premium = retro.premium
    const headline = premium && premium.longestStreak > 0 ? premium.longestStreak : retro.lessonsCompleted
    const headlineLabel =
        premium && premium.longestStreak > 0
            ? headline === 1
                ? 'dia seguido'
                : 'dias seguidos'
            : headline === 1
              ? 'lição concluída'
              : 'lições concluídas'
    ctx.fillStyle = COLOR.text
    ctx.font = '800 220px sans-serif'
    ctx.fillText(String(headline), 80, 560)
    ctx.fillStyle = COLOR.brandSoft
    ctx.font = '700 52px sans-serif'
    ctx.fillText(headlineLabel, 80, 630)

    // Calendário de dias (PRO): ponto cheio = manteve a sequência, vazado = dia off.
    if (premium) {
        const active = new Set(premium.activeDays)
        const cols = 10
        const size = 64
        const gap = 14
        for (let day = 1; day <= premium.daysInMonth; day++) {
            const col = (day - 1) % cols
            const row = Math.floor((day - 1) / cols)
            const x = 80 + col * (size + gap) + size / 2
            const y = 740 + row * (size + gap) + size / 2
            ctx.beginPath()
            ctx.arc(x, y, size / 2 - 4, 0, Math.PI * 2)
            if (active.has(day)) {
                ctx.fillStyle = COLOR.brand
                ctx.fill()
            } else {
                ctx.strokeStyle = COLOR.border
                ctx.lineWidth = 4
                ctx.stroke()
            }
        }
    }

    // Marcos do mês, em contagens e percentual (nunca em reais).
    const chips: { label: string; color: string }[] = [
        { label: `Nível ${retro.level}`, color: COLOR.text },
        { label: retro.achievementsUnlocked === 1 ? '1 conquista' : `${retro.achievementsUnlocked} conquistas`, color: COLOR.text },
    ]
    if (!premium) {
        chips.unshift({ label: retro.lessonsCompleted === 1 ? '1 lição' : `${retro.lessonsCompleted} lições`, color: COLOR.text })
    }
    if (premium?.bestReturnPct != null) {
        const pct = premium.bestReturnPct
        const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
        chips.push({
            label: `${sign}${Math.abs(pct).toFixed(1).replace('.', ',')}% no mês`,
            color: pct > 0 ? COLOR.gain : pct < 0 ? COLOR.loss : COLOR.muted,
        })
    }
    if (premium && premium.duelsWon > 0) {
        chips.push({ label: premium.duelsWon === 1 ? '1 duelo vencido' : `${premium.duelsWon} duelos vencidos`, color: COLOR.text })
    }
    ctx.font = '700 36px sans-serif'
    let x = 80
    let y = 1130
    for (const chip of chips) {
        const width = ctx.measureText(chip.label).width + 56
        if (x + width > CARD.width - 80) {
            x = 80
            y += 84
        }
        ctx.fillStyle = COLOR.surface
        ctx.strokeStyle = COLOR.border
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.roundRect(x, y - 44, width, 66, 33)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = chip.color
        ctx.fillText(chip.label, x + 28, y)
        x += width + 20
    }

    ctx.fillStyle = COLOR.muted
    ctx.font = '600 30px sans-serif'
    ctx.fillText('Investimenta', 80, CARD.height - 50)
}

export async function renderShareBlob(retro: Retrospective, identity: ShareIdentity): Promise<Blob | null> {
    const canvas = document.createElement('canvas')
    drawShareCard(canvas, retro, identity)
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

// Compartilha a imagem pelo menu do sistema quando existe (celular); senão baixa o PNG.
export async function shareOrDownload(blob: Blob, text: string, filename: string): Promise<ShareOutcome> {
    const file = new File([blob], filename, { type: 'image/png' })
    try {
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text })
            return 'shared'
        }
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
        // qualquer outra falha do menu de compartilhar cai no download
    }
    try {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
        return 'downloaded'
    } catch {
        return 'failed'
    }
}
