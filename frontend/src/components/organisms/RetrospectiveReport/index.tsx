import { useState } from 'react'
import { buildShareText, monthLabel, renderShareBlob, shareOrDownload } from '../../../features/retrospective/shareCard'
import { Delta } from '../../atoms/Delta'
import { Button } from '../../atoms/Button'
import { ActivityCalendar } from '../../molecules/ActivityCalendar'
import { MetricTile } from '../../molecules/MetricTile'
import type { RetrospectiveReportProps } from './types'
import styles from './index.module.css'

export type { RetrospectiveReportProps } from './types'

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`
}

// Retrospectiva de um mês (MO.5.4): lições, conquistas, nível, calendário de dias, maior sequência,
// rentabilidade do mês (só percentual), duelos e ligas. Tom de celebração:
// mês sem atividade vira convite para voltar, nunca cobrança nem escassez.
export function RetrospectiveReport({ retrospective, identity }: RetrospectiveReportProps) {
    const [status, setStatus] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'failed'>('idle')

    async function handleShare() {
        setStatus('working')
        const blob = await renderShareBlob(retrospective, identity)
        if (!blob) {
            setStatus('failed')
            return
        }
        const outcome = await shareOrDownload(blob, buildShareText(retrospective), `retrospectiva-${retrospective.month}.png`)
        setStatus(outcome === 'cancelled' ? 'idle' : outcome)
    }

    if (retrospective.empty) {
        return (
            <section className={styles.report} aria-label={`Retrospectiva de ${monthLabel(retrospective.month)}`}>
                <p className={styles.empty}>
                    Em {monthLabel(retrospective.month)} você não teve atividade por aqui. Sem problema: quando voltar, a próxima
                    retrospectiva mostra o que você fez.
                </p>
            </section>
        )
    }

    return (
        <section className={styles.report} aria-label={`Retrospectiva de ${monthLabel(retrospective.month)}`}>
            <div className={styles.stats}>
                <MetricTile label="Lições concluídas" value={String(retrospective.lessonsCompleted)} />
                <MetricTile label="Conquistas do mês" value={String(retrospective.achievementsUnlocked)} />
                <MetricTile label="Nível" value={String(retrospective.level)} />
            </div>

            {retrospective.achievementNames.length > 0 && (
                <p className={styles.names}>Conquistas: {retrospective.achievementNames.join(', ')}.</p>
            )}

            <div className={styles.stats}>
                <MetricTile label="Maior sequência" value={plural(retrospective.longestStreak, 'dia', 'dias')} />
                <MetricTile
                    label="Rentabilidade do mês"
                    value={
                        retrospective.bestReturnPct === null ? 'Sem dado' : <Delta percent={retrospective.bestReturnPct} variant="text" />
                    }
                />
                <MetricTile label="Duelos vencidos" value={`${retrospective.duelsWon} de ${retrospective.duelsPlayed}`} />
                <MetricTile label="Ligas" value={String(retrospective.leaguesActive)} />
            </div>
            <div className={styles.block}>
                <h2 className={styles.blockTitle}>Seus dias</h2>
                <p className={styles.note}>
                    {plural(retrospective.activeDays.length, 'dia com atividade', 'dias com atividade')} em{' '}
                    {monthLabel(retrospective.month)}.
                </p>
                <ActivityCalendar activeDays={retrospective.activeDays} daysInMonth={retrospective.daysInMonth} />
            </div>

            <div className={styles.actions}>
                <Button disabled={status === 'working'} onClick={handleShare}>
                    {status === 'working' ? 'Preparando imagem…' : 'Compartilhar imagem'}
                </Button>
                {status === 'shared' && <span className={styles.ok}>Pronto, compartilhado.</span>}
                {status === 'downloaded' && <span className={styles.ok}>Imagem salva no seu aparelho.</span>}
                {status === 'failed' && (
                    <span className={styles.error} role="alert">
                        Não foi possível gerar a imagem agora. Tente de novo.
                    </span>
                )}
            </div>
            <p className={styles.note}>A imagem mostra só números de atividade e percentuais. Nenhum valor em reais.</p>
        </section>
    )
}
