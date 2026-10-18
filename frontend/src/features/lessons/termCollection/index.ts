import { glossary } from '../glossary'
import type { GlossaryEntry } from '../glossary'

// Coleção de termos (LJ.5.9): cada termo do glossário que tem lição de origem vira uma carta, ganha ao concluir a
// lição que o ensina. Tudo derivado do progresso (códigos das lições concluídas), sem tabela nem XP novos.
export interface TermCard {
    term: string
    definition: string
    example?: string
    // Código da lição que ensina o termo.
    lessonCode: string
    // Número da trilha (0 a 3; 4 é a Trilha F), de onde o termo vem.
    trackNumber: number
}

export interface TermCollection {
    earned: TermCard[]
    locked: TermCard[]
    total: number
}

// Trilha do código da lição: "2.7.1" é da Trilha 2 e "F.1" da Trilha F (número 4). Código fora do padrão devolve undefined.
export function trackNumberOfLessonCode(code: string): number | undefined {
    const prefix = code.split('.')[0]
    if (prefix === 'F') return 4
    const number = prefix ? Number(prefix) : Number.NaN
    return Number.isInteger(number) && number >= 0 && number <= 3 ? number : undefined
}

// Todas as cartas do baralho: só termo com lição de origem e de trilha conhecida entra (sem lição, ninguém o ganharia).
export function allTermCards(catalog: Record<string, GlossaryEntry> = glossary): TermCard[] {
    return Object.entries(catalog).flatMap(([term, entry]) => {
        const trackNumber = entry.originLesson ? trackNumberOfLessonCode(entry.originLesson) : undefined
        if (!entry.originLesson || trackNumber === undefined) return []
        return [
            {
                term,
                definition: entry.definition,
                ...(entry.example ? { example: entry.example } : {}),
                lessonCode: entry.originLesson,
                trackNumber,
            },
        ]
    })
}

// Separa o baralho em ganhas e a ganhar, pelas lições concluídas. Ordem das cartas: a do currículo (trilha, depois
// código da lição, depois nome do termo), igual para quem vê e para quem é visto.
export function deriveTermCollection(completedLessonCodes: readonly string[], catalog?: Record<string, GlossaryEntry>): TermCollection {
    const done = new Set(completedLessonCodes)
    const cards = allTermCards(catalog).sort(compareCards)
    return {
        earned: cards.filter((card) => done.has(card.lessonCode)),
        locked: cards.filter((card) => !done.has(card.lessonCode)),
        total: cards.length,
    }
}

function compareCards(a: TermCard, b: TermCard): number {
    if (a.trackNumber !== b.trackNumber) return a.trackNumber - b.trackNumber
    const byLesson = a.lessonCode.localeCompare(b.lessonCode, 'pt-BR', { numeric: true })
    return byLesson !== 0 ? byLesson : a.term.localeCompare(b.term, 'pt-BR')
}
