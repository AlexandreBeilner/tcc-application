import { useState } from 'react'
import { formatSignedPercent } from '../../../features/market/format'
import { buildShareText, monthLabel, renderShareBlob, shareOrDownload } from '../../../features/retrospective/shareCard'
import { Button } from '../../atoms/Button'
import { ActivityCalendar } from '../../molecules/ActivityCalendar'
import { MetricTile } from '../../molecules/MetricTile'
import { ProInvite } from '../../molecules/ProInvite'
import type { RetrospectiveReportProps } from './types'
import styles from './index.module.css'

export type { RetrospectiveReportProps } from './types'

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`
}

// Retrospectiva de um mês (MO.5.4): cartões com as 3 métricas de todos e, no PRO, calendário de
// dias, maior sequência, rentabilidade do mês (só percentual), duelos e ligas. Tom de celebração:
// mês sem atividade vira convite para voltar, nunca cobrança nem escassez.
export function RetrospectiveReport({ retrospective, identity }: RetrospectiveReportProps) {
    const [status, setStatus] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'failed'>('idle')
    const premium = retrospective.premium

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

            {premium ? (
                <>
                    <div className={styles.stats}>
                        <MetricTile label="Maior sequência" value={plural(premium.longestStreak, 'dia', 'dias')} />
                        <MetricTile
                            label="Rentabilidade do mês"
                            value={premium.bestReturnPct === null ? 'Sem dado' : formatSignedPercent(premium.bestReturnPct)}
                        />
                        <MetricTile label="Duelos vencidos" value={`${premium.duelsWon} de ${premium.duelsPlayed}`} />
                        <MetricTile label="Ligas" value={String(premium.leaguesActive)} />
                    </div>
                    <div className={styles.block}>
                        <h2 className={styles.blockTitle}>Seus dias</h2>
                        <p className={styles.note}>
                            {plural(premium.activeDays.length, 'dia com atividade', 'dias com atividade')} em{' '}
                            {monthLabel(retrospective.month)}.
                        </p>
                        <ActivityCalendar activeDays={premium.activeDays} daysInMonth={premium.daysInMonth} />
                    </div>
                </>
            ) : (
                <ProInvite context="retrospective">
                    A versão completa traz o calendário de dias, a maior sequência, a rentabilidade do mês e os duelos, com uma imagem
                    personalizada para compartilhar.
                </ProInvite>
            )}

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
