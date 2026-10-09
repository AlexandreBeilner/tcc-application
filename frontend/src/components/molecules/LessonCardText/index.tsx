import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { parseLessonMarkup } from '../../../features/lessons/parseLessonMarkup'
import type { Card } from '../../../features/lessons/splitIntoCards'
import type { Lesson } from '../../../services/lessons'
import { GlossaryTerm } from '../GlossaryTerm'
import styles from './index.module.css'

// Só o que a referência `{{ref:X.Y}}` precisa pra virar link.
export type LessonRef = Pick<Lesson, 'id' | 'code'>

// Texto de um cartão da lição, compartilhado pela tela da lição (3.2) e pela pré-visualização do painel
// admin (N.23): o que o admin vê é renderizado pelo mesmo código que o usuário vê (separação em cartões,
// `[revelar]`, glossário `{{Termo}}` e referência `{{ref:X.Y}}`).

// Revelação progressiva (tarefa A.3) — cartão marcado `[revelar]` esconde o
// texto atrás de um botão "Ver resultado" até o toque; um `<button>` de
// verdade preserva a navegação por teclado (Tab alcança, Enter/Espaço
// ativa), sem precisar de nenhum tratamento especial.
export function LessonCardBody({
    card,
    revealed,
    onReveal,
    lessons,
    termsSeen,
}: {
    card: Card
    revealed: boolean
    onReveal: () => void
    lessons: LessonRef[]
    termsSeen?: Set<string>
}) {
    if (card.hidden && !revealed) {
        return (
            <button type="button" className={styles.revealButton} onClick={onReveal}>
                <Eye size={16} aria-hidden="true" />
                Ver resultado
            </button>
        )
    }

    return <p className={styles.body}>{renderLessonMarkup(card.text, lessons, termsSeen)}</p>
}

// Convenção `{{Termo}}`/`{{ref:X.Y}}` das tarefas C.1/C.2 — termo resolvido
// no catálogo vira popover (`GlossaryTerm`), referência de lição vira link
// pra ela (`ref` resolvido pro `id` real aqui, já que é aqui que a lista de
// `lessons` está disponível), e o resto do texto continua como nó de texto
// puro (não `<span>`) pra não quebrar consultas de teste que buscam o texto
// completo do cartão quando não há marcação nenhuma.
function renderLessonMarkup(text: string, lessons: LessonRef[], termsSeen: Set<string> = new Set()) {
    // Popover só no primeiro uso do termo na lição (RC.3.5); depois, texto puro.
    const shown = new Set(termsSeen)
    return parseLessonMarkup(text).map((segment, index) => {
        if (segment.type === 'term') {
            if (shown.has(segment.term)) {
                return segment.term
            }
            shown.add(segment.term)
            return <GlossaryTerm key={index} term={segment.term} definition={segment.definition} />
        }

        if (segment.type === 'ref') {
            const referencedLesson = lessons.find((candidate) => candidate.code === segment.code)
            const label = `já visto na lição ${segment.code}`

            return referencedLesson ? (
                <Link key={index} to={`/trilha/${referencedLesson.id}`} className={styles.refLink}>
                    {label}
                </Link>
            ) : (
                label
            )
        }

        return segment.value
    })
}

// Barra de progresso fina interna à fase (tarefa A.1) — pontinhos menores
// que a barra de 4 segmentos, só aparece quando a fase tem mais de 1
// cartão. Decorativa: o único controle interativo continua sendo o botão
// "Continuar", então não interfere na navegação por teclado.
export function LessonCardDots({ total, current }: { total: number; current: number }) {
    return (
        <div className={styles.cardDots} aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className={[styles.cardDot, index < current && styles.done, index === current && styles.current]
                        .filter(Boolean)
                        .join(' ')}
                />
            ))}
        </div>
    )
}
