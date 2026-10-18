// Atalhos e gestos do player (LJ.5.3). Só decisão pura: quem clica nos botões reais (que já carregam o
// `disabled` de cada trava) é `useLessonShortcuts`.

export type ShortcutAction = { type: 'back' } | { type: 'continue' } | { type: 'enter' } | { type: 'option'; index: number }

export interface ShortcutInput {
    key: string
    hasModifier: boolean
    // Campo de texto, `select` ou conteúdo editável: a tecla é da pessoa digitando.
    editable: boolean
    // O foco está dentro de um widget da lição (controle deslizante, arrastar, tabela com setas...).
    inWidget: boolean
    // Botão, link ou resumo de `<details>` com foco: o Enter dele já faz a ação nativa.
    interactive: boolean
}

// Números 1 a 4 escolhem a alternativa de múltipla escolha.
const OPTION_KEYS = ['1', '2', '3', '4']

export function resolveShortcut({ key, hasModifier, editable, inWidget, interactive }: ShortcutInput): ShortcutAction | null {
    if (hasModifier || editable || inWidget) return null
    if (key === 'ArrowLeft') return { type: 'back' }
    if (key === 'ArrowRight') return { type: 'continue' }
    if (key === 'Enter') return interactive ? null : { type: 'enter' }
    const option = OPTION_KEYS.indexOf(key)
    return option >= 0 ? { type: 'option', index: option } : null
}

export interface SwipeInput {
    dx: number
    dy: number
    durationMs: number
}

const MIN_DISTANCE_PX = 60
// Mais horizontal que vertical (2 para 1), para não brigar com a rolagem da página.
const MIN_HORIZONTAL_RATIO = 2
const MAX_DURATION_MS = 800

// Deslizar para a esquerda avança, para a direita volta (como virar página).
export function swipeAction({ dx, dy, durationMs }: SwipeInput): 'back' | 'continue' | null {
    if (durationMs > MAX_DURATION_MS || Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * MIN_HORIZONTAL_RATIO) {
        return null
    }
    return dx < 0 ? 'continue' : 'back'
}
