import { SHARE_COLOR, type CanvasLike } from '../../retrospective/shareCard'
import { formatEstimateValue } from '../estimateScale'
import type { EstimateUnit } from '../widgets/schema'

// Compartilhar o resultado de uma lição (LJ.5.10): placar ou chute de uma estimativa, com o link de convite da
// pessoa. Só estudo: nunca patrimônio, posição nem rentabilidade (RNF09). Os textos não levam o link, que quem
// compartilha acrescenta no fim.

export interface ScoreShareInput {
    lessonTitle: string
    // Perguntas acertadas de primeira e o total que valeu ponto; `total` 0 quando a lição não tem placar.
    firstTry: number
    total: number
}

export function buildScoreMessage({ lessonTitle, firstTry, total }: ScoreShareInput): string {
    if (total <= 0) return `Concluí a lição "${lessonTitle}" no Selucra.`
    return `Fiz a lição "${lessonTitle}" no Selucra: ${firstTry} de ${total} de primeira.`
}

export interface EstimateShareInput {
    guess: number
    value: number
    unit: EstimateUnit
}

// "Chutei R$ 3.100. Era R$ 6.727,50."
export function buildEstimateMessage({ guess, value, unit }: EstimateShareInput): string {
    return `Chutei ${formatEstimateValue(guess, unit)}. Era ${formatEstimateValue(value, unit)}. Será que você acerta?`
}

// Texto final enviado: a mensagem e o link de convite.
export function withInviteLink(message: string, url: string): string {
    return `${message} ${url}`
}

export interface ResultCardData {
    lessonTitle: string
    // Número grande do cartão ("4 de 5", "R$ 3.100") e a legenda dele ("de primeira", "meu chute").
    headline: string
    caption: string
    // Linha de baixo ("Era R$ 6.727,50"), opcional.
    footnote?: string
}

export function buildScoreCard({ lessonTitle, firstTry, total }: ScoreShareInput): ResultCardData {
    return total > 0
        ? { lessonTitle, headline: `${firstTry} de ${total}`, caption: 'de primeira' }
        : { lessonTitle, headline: 'Lição', caption: 'concluída' }
}

export function buildEstimateCard(lessonTitle: string, { guess, value, unit }: EstimateShareInput): ResultCardData {
    return {
        lessonTitle,
        headline: formatEstimateValue(guess, unit),
        caption: 'foi o meu chute',
        footnote: `Era ${formatEstimateValue(value, unit)}`,
    }
}

const CARD = { width: 1080, height: 1080 }

// Quebra o título em linhas que cabem na largura, para um nome de lição longo não sair do cartão.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = []
    let line = ''
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line)
            line = word
        } else {
            line = next
        }
    }
    if (line) lines.push(line)
    return lines.slice(0, 3)
}

// Desenha o cartão no canvas, no tema escuro dos tokens (a imagem sai igual em qualquer tema do app).
export function drawResultCard(canvas: CanvasLike, data: ResultCardData): void {
    canvas.width = CARD.width
    canvas.height = CARD.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = SHARE_COLOR.bg
    ctx.fillRect(0, 0, CARD.width, CARD.height)
    const glow = ctx.createLinearGradient(0, 0, CARD.width, 480)
    glow.addColorStop(0, SHARE_COLOR.brandBg)
    glow.addColorStop(1, SHARE_COLOR.bg)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, CARD.width, 480)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = SHARE_COLOR.brandSoft
    ctx.font = '700 36px sans-serif'
    ctx.fillText('Selucra', 80, 120)

    ctx.fillStyle = SHARE_COLOR.text
    ctx.font = '700 52px sans-serif'
    wrapLines(ctx, data.lessonTitle, CARD.width - 160).forEach((line, index) => ctx.fillText(line, 80, 260 + index * 64))

    ctx.fillStyle = SHARE_COLOR.text
    ctx.font = '800 170px sans-serif'
    ctx.fillText(data.headline, 80, 640)
    ctx.fillStyle = SHARE_COLOR.brandSoft
    ctx.font = '700 52px sans-serif'
    ctx.fillText(data.caption, 80, 716)
    if (data.footnote) {
        ctx.fillStyle = SHARE_COLOR.muted
        ctx.font = '600 44px sans-serif'
        ctx.fillText(data.footnote, 80, 800)
    }

    ctx.fillStyle = SHARE_COLOR.muted
    ctx.font = '600 30px sans-serif'
    ctx.fillText('Aprenda a investir de brincadeira, com dinheiro fictício.', 80, CARD.height - 60)
}

export async function renderResultBlob(data: ResultCardData): Promise<Blob | null> {
    const canvas = document.createElement('canvas')
    drawResultCard(canvas, data)
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

export type ShareResultOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

// Pelo menu do sistema quando ele existe (com a imagem, se o aparelho aceita arquivo); sem ele, copia o texto
// com o link para a área de transferência.
export async function shareResult(text: string, blob: Blob | null): Promise<ShareResultOutcome> {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
            const file = blob ? new File([blob], 'selucra-resultado.png', { type: 'image/png' }) : null
            if (file && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], text })
            } else {
                await navigator.share({ text })
            }
            return 'shared'
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
            // qualquer outra falha do menu de compartilhar cai na cópia do texto
        }
    }
    try {
        await navigator.clipboard.writeText(text)
        return 'copied'
    } catch {
        return 'failed'
    }
}
