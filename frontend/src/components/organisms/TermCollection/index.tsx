import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, HelpCircle } from 'lucide-react'
import { useLessonsQuery } from '../../../features/lessons/useLessonsQuery'
import { deriveTermCollection } from '../../../features/lessons/termCollection'
import type { TermCard } from '../../../features/lessons/termCollection'
import { trackNameFor } from '../../../utils/tracks'
import type { TermCollectionProps } from './types'
import styles from './index.module.css'

export type { TermCollectionProps } from './types'

// Coleção de termos (LJ.5.9): cada termo do glossário é uma carta, ganha ao concluir a lição que o ensina. Dá posse
// ao que foi aprendido sem nenhum XP novo. No próprio perfil (`isOwn`) mostra "N de M", as cartas ganhas viradas
// para cima e, recolhidas, as que faltam viradas para baixo, só com a trilha onde se ganha. No perfil de outra
// pessoa (LJ-D6) só a contagem e as cartas ganhas, nunca as que faltam. Termo aprendido não é dado financeiro,
// então a RNF09 não se aplica.
export function TermCollection({ completedLessonCodes, isOwn }: TermCollectionProps) {
    const { earned, locked, total } = deriveTermCollection(completedLessonCodes)
    const [openTerm, setOpenTerm] = useState<string | null>(null)
    const [showLocked, setShowLocked] = useState(false)
    // Só o próprio perfil precisa achar a lição para o atalho "Rever a lição".
    const lessons = useLessonsQuery({ enabled: isOwn })
    const lessonIdByCode = new Map((lessons.data?.lessons ?? []).map((lesson) => [lesson.code, lesson.id]))

    if (!isOwn && earned.length === 0) return null
    if (total === 0) return null

    return (
        <section className={styles.section} aria-label={isOwn ? 'Seus termos' : 'Termos aprendidos'}>
            <h2 className={styles.title}>
                {isOwn ? (
                    <>
                        Seus termos: {earned.length} de {total}
                    </>
                ) : (
                    <>Termos aprendidos: {earned.length}</>
                )}
            </h2>
            {isOwn && (
                <div
                    className={styles.meter}
                    role="progressbar"
                    aria-label="Termos ganhos"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={earned.length}
                >
                    <span className={styles.meterFill} style={{ width: `${(earned.length / total) * 100}%` }} />
                </div>
            )}

            {earned.length === 0 ? (
                <p className={styles.empty}>Conclua uma lição para ganhar a primeira carta.</p>
            ) : (
                <ul className={styles.grid}>
                    {earned.map((card) => (
                        <EarnedCard
                            key={card.term}
                            card={card}
                            open={openTerm === card.term}
                            lessonId={isOwn ? lessonIdByCode.get(card.lessonCode) : undefined}
                            onToggle={() => setOpenTerm((current) => (current === card.term ? null : card.term))}
                        />
                    ))}
                </ul>
            )}

            {isOwn && locked.length > 0 && (
                <>
                    <button
                        type="button"
                        className={styles.toggle}
                        aria-expanded={showLocked}
                        onClick={() => setShowLocked((value) => !value)}
                    >
                        {showLocked ? 'Esconder as cartas que faltam' : `Ver as ${locked.length} cartas que faltam`}
                    </button>
                    {showLocked && (
                        <ul className={styles.grid}>
                            {locked.map((card) => (
                                <li
                                    key={card.term}
                                    className={`${styles.card} ${styles.locked}`}
                                    aria-label={`Carta por ganhar, da trilha ${trackNameFor(card.trackNumber) ?? ''}`}
                                >
                                    <HelpCircle size={16} strokeWidth={2} aria-hidden="true" />
                                    <span className={styles.lockedTrack}>{trackNameFor(card.trackNumber)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    )
}

function EarnedCard({
    card,
    open,
    lessonId,
    onToggle,
}: {
    card: TermCard
    open: boolean
    lessonId: string | undefined
    onToggle: () => void
}) {
    return (
        <li className={`${styles.cardItem} ${open ? styles.open : ''}`}>
            <button type="button" className={`${styles.card} ${styles.earned}`} aria-expanded={open} onClick={onToggle}>
                <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
                <span className={styles.term}>{card.term}</span>
            </button>
            {open && (
                <div className={styles.detail}>
                    <p className={styles.definition}>{card.definition}</p>
                    {card.example && <p className={styles.example}>{card.example}</p>}
                    {lessonId && (
                        <Link className={styles.review} to={`/trilha/${lessonId}`}>
                            Rever a lição
                        </Link>
                    )}
                </div>
            )}
        </li>
    )
}
