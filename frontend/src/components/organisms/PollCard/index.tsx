import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { pollSummary } from '../../../features/lessons/pollSummary'
import type { PollCardProps } from './types'
import styles from './index.module.css'

export type { PollCardProps } from './types'

// Enquete da comunidade (bloco `poll`): pergunta de opinião, sem resposta certa. Um toque registra o voto (não há
// botão de enviar) e as barras crescem até os percentuais. Não trava o Continuar e não entra no placar. O
// servidor nunca devolve quem votou, só o agregado.
export function PollCard({ block, state, pending, error, onVote }: PollCardProps) {
    const voted = state !== undefined
    // As barras entram em 0% e crescem no quadro seguinte; sem isso o CSS não tem de onde animar.
    const [grown, setGrown] = useState(false)
    useEffect(() => {
        if (!voted) return
        const frame = requestAnimationFrame(() => setGrown(true))
        return () => cancelAnimationFrame(frame)
    }, [voted])

    return (
        <section className={styles.poll} aria-label="Enquete">
            <span className={styles.eyebrow}>Enquete</span>
            <p className={styles.prompt}>{block.prompt}</p>

            {!voted ? (
                <div className={styles.options} role="group" aria-label="Escolha uma opção">
                    {block.options.map((option, index) => (
                        <button
                            key={option}
                            type="button"
                            className={styles.option}
                            disabled={pending}
                            data-lesson-option=""
                            onClick={() => onVote(index)}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            ) : (
                <ul className={styles.results} aria-label="Respostas">
                    {block.options.map((option, index) => {
                        const own = index === state.vote
                        const percent = state.results?.percentages[index]
                        return (
                            <li key={option} className={[styles.row, own && styles.own].filter(Boolean).join(' ')}>
                                {percent !== undefined && (
                                    <span className={styles.bar} style={{ width: grown ? `${percent}%` : '0%' }} aria-hidden="true" />
                                )}
                                <span className={styles.label}>
                                    {option}
                                    {own && (
                                        <span className={styles.mine}>
                                            <Check size={14} aria-hidden="true" />
                                            Seu voto
                                        </span>
                                    )}
                                </span>
                                {percent !== undefined && <span className={styles.percent}>{percent}%</span>}
                            </li>
                        )
                    })}
                </ul>
            )}

            {error && !voted && (
                <p role="alert" className={styles.feedback}>
                    Não deu para registrar seu voto. Tente de novo.
                </p>
            )}

            {voted && (
                <div role="status" className={styles.after}>
                    <p className={styles.summary}>{pollSummary(state)}</p>
                    {state.results && <p className={styles.count}>{state.results.total} respostas</p>}
                    {block.closing && <p className={styles.closing}>{block.closing}</p>}
                </div>
            )}
        </section>
    )
}
