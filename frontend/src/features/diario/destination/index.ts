import { glossary } from '../../lessons/glossary'
import type { Lesson } from '../../../services/lessons'
import type { LearnMore } from '..'

// Destino seguro do "Saiba mais" de um cartão do Diário (DI.4.2). Nunca aponta para lugar fechado:
// - glossário: sempre aberto (RC.3.5), só se o termo existe (comparação sem caixa);
// - lição: só se já está disponível ou concluída (a trilha trava as demais, Fase Q);
// - guia: os guias moram na landing, não no app, então não há destino aqui.
// Sem destino seguro devolve `null` e o módulo não mostra o link.
export function learnMoreDestination(learnMore: NonNullable<LearnMore>, lessons: readonly Lesson[]): string | null {
    if (learnMore.kind === 'glossary') {
        const wanted = learnMore.ref.toLowerCase()
        const term = Object.keys(glossary).find((key) => key.toLowerCase() === wanted)
        return term ? `/glossario?termo=${encodeURIComponent(term)}` : null
    }
    if (learnMore.kind === 'lesson') {
        const lesson = lessons.find((candidate) => candidate.code === learnMore.ref)
        return lesson && lesson.status !== 'locked' ? `/trilha/${lesson.id}` : null
    }
    return null
}
