// Construção de DOM sem framework. Texto sempre por `textContent`, nunca por HTML.

export type Child = Node | string | null | undefined | false
type Attrs = Record<string, string | boolean | number | undefined>

export function el<K extends keyof HTMLElementTagNameMap>(
    doc: Document,
    tag: K,
    attrs: Attrs = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag)
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === false) continue
        if (key === 'class') node.className = String(value)
        else node.setAttribute(key, value === true ? '' : String(value))
    }
    append(node, children)
    return node
}

export function append(parent: Node, children: Child[]): void {
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue
        parent.appendChild(typeof child === 'string' ? parent.ownerDocument!.createTextNode(child) : child)
    }
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Maiúsculas, sem acento, só A-Z: a mesma forma que o servidor compara (`acoes` vale por `AÇÕES`). */
export function normalizeLetters(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
}

export function formatDate(isoDate: string): string {
    const date = new Date(`${isoDate}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return isoDate
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
}

export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
