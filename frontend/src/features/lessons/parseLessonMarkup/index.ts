import { glossary } from '../glossary'
import type { Segment } from './types'

export type { Segment } from './types'

const REF_PREFIX = 'ref:'

// Convenção unificada das tarefas C.1/C.2 do backlog de engajamento: termo
// entre chaves duplas no texto. `{{FGC}}` vira um segmento `term` com a
// definição resolvida do catálogo (glossário inline); `{{ref:2.1}}` vira um
// segmento `ref` com o `code` da lição citada (elenco recorrente), resolvido
// pro `id` real na camada de renderização (`Lesson/index.tsx`), que já tem a
// lista de lições carregada via `useLessonsQuery` — sem chamada nova. Termo
// de glossário sem entrada no catálogo cai de volta pro texto puro
// (`{{Termo}}` → `Termo`), nunca quebra a renderização; a mesma garantia
// pra `ref` fica a cargo de quem renderiza (lição inexistente também nunca
// quebra a tela).
const MARKUP_PATTERN = /\{\{([^{}]+)\}\}/g

export function parseLessonMarkup(text: string): Segment[] {
    const segments: Segment[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    MARKUP_PATTERN.lastIndex = 0
    while ((match = MARKUP_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
        }

        segments.push(toSegment(match[1].trim()))
        lastIndex = MARKUP_PATTERN.lastIndex
    }

    if (lastIndex < text.length) {
        segments.push({ type: 'text', value: text.slice(lastIndex) })
    }

    return segments.length > 0 ? segments : [{ type: 'text', value: text }]
}

function toSegment(content: string): Segment {
    if (content.startsWith(REF_PREFIX)) {
        return { type: 'ref', code: content.slice(REF_PREFIX.length).trim() }
    }

    const entry = glossary[content]
    return entry ? { type: 'term', term: content, definition: entry.definition } : { type: 'text', value: content }
}

// Termos de glossário que o texto usa (só os que existem no catálogo), na ordem.
export function termsInText(text: string): string[] {
    return parseLessonMarkup(text).flatMap((segment) => (segment.type === 'term' ? [segment.term] : []))
}
