import { describeEffects, percentLabel } from '../../../features/assemblies/assemblyText'
import type { AssemblyOption, OptionScore } from '../../../services/assemblies'
import { Button } from '../../atoms/Button'
import styles from './index.module.css'

interface AssemblyOptionCardProps {
    option: AssemblyOption
    score: OptionScore | undefined
    // Voto da própria pessoa nesta opção.
    mine: boolean
    // Opção vencedora de uma assembleia aprovada.
    winner: boolean
    // Mostra o botão (assembleia aberta e pessoa com direito).
    canVote: boolean
    pending: boolean
    onVote: (optionId: string) => void
    hasVoted: boolean
}

// Uma das duas opções da pauta: o que ganha, o que perde, o que ela mexe e o placar. Os dois lados
// têm o mesmo peso visual (nenhum é "o certo") e o placar usa a mesma cor nos dois.
export function AssemblyOptionCard({ option, score, mine, winner, canVote, pending, onVote, hasVoted }: AssemblyOptionCardProps) {
    const effects = describeEffects(option)
    const percent = score?.weightPercent ?? 0
    const voters = score?.voters ?? 0

    return (
        <article className={[styles.card, mine ? styles.mine : ''].filter(Boolean).join(' ')} aria-label={option.label}>
            <header className={styles.header}>
                <h3 className={styles.label}>{option.label}</h3>
                {winner && <span className={styles.tag}>Aprovada</span>}
                {mine && <span className={styles.tag}>Seu voto</span>}
            </header>
            <dl className={styles.sides}>
                <div>
                    <dt className={styles.sideTitle}>O que ganha</dt>
                    <dd className={styles.sideText}>{option.gain}</dd>
                </div>
                <div>
                    <dt className={styles.sideTitle}>O que perde</dt>
                    <dd className={styles.sideText}>{option.loss}</dd>
                </div>
            </dl>
            {effects.length > 0 && (
                <ul className={styles.effects} aria-label="O que esta opção muda na empresa">
                    {effects.map((text) => (
                        <li key={text} className={styles.effect}>
                            {text}
                        </li>
                    ))}
                </ul>
            )}

            <div className={styles.score}>
                <div className={styles.bar} role="img" aria-label={`${percentLabel(percent)} das ações de quem votou`}>
                    <div className={styles.fill} style={{ width: `${percent}%` }} />
                </div>
                <span className={styles.scoreText}>
                    {percentLabel(percent)} das ações · {voters} {voters === 1 ? 'votante' : 'votantes'}
                </span>
            </div>

            {canVote && !mine && (
                <Button variant={hasVoted ? 'secondary' : 'primary'} disabled={pending} onClick={() => onVote(option.id)}>
                    {hasVoted ? 'Trocar meu voto para esta' : 'Votar nesta opção'}
                </Button>
            )}
        </article>
    )
}
