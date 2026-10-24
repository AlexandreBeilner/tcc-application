import { useState } from 'react'
import { Button } from '../../components/atoms/Button'
import { buildInviteLink } from '../../features/referral/referralCode'
import { useMyReferralQuery } from '../../features/referral/useMyReferral'
import styles from './index.module.css'

// Marcos de indicação: espelham as conquistas `referrals_qualified_*` (seedAchievements) e os
// títulos com `unlock_referrals` (migração 0049). Mudou lá, muda aqui.
const MILESTONES = [
    { threshold: 5, achievement: 'Convidou os Primeiros', title: 'Mensageiro' },
    { threshold: 20, achievement: 'Comunidade em Crescimento', title: 'Embaixador' },
    { threshold: 50, achievement: 'Fundador de Turma', title: 'Patrono' },
] as const

// Indicação entre amigos (MO.7.2). Qualquer pessoa convida por um link; o convite vale quando o
// amigo conclui a primeira lição. Cada marco libera uma conquista e um título para o perfil.
// Composição própria no desktop: o link e as regras à esquerda, a escada de marcos numa coluna
// fixa à direita.
export function Convidar() {
    const referralQuery = useMyReferralQuery()
    const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
    const referral = referralQuery.data

    const link = referral ? buildInviteLink(window.location.origin, referral.code) : ''
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(link)
            setCopied('copied')
        } catch {
            setCopied('failed')
        }
    }

    async function shareLink() {
        try {
            await navigator.share({
                title: 'Selucra',
                text: 'Aprenda a investir de brincadeira com dinheiro fictício. Entre pelo meu convite:',
                url: link,
            })
        } catch {
            // a pessoa fechou a folha de compartilhamento: nada a fazer
        }
    }

    const next = referral ? MILESTONES.find((milestone) => milestone.threshold > referral.qualifiedCount) : undefined
    const progressPercent = referral && next ? Math.min(100, Math.round((referral.qualifiedCount / next.threshold) * 100)) : 100
    const remaining = referral && next ? next.threshold - referral.qualifiedCount : 0

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Convidar amigos</h1>
            <p className={styles.lead}>
                Chame amigos para aprender junto. Quando um amigo que entrou pelo seu link conclui a primeira lição, o convite passa a valer
                e você avança na escada de marcos.
            </p>

            {referralQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar seu convite agora. Tente novamente em instantes.
                </p>
            )}
            {referralQuery.isLoading && <p className={styles.muted}>Carregando seu convite…</p>}

            {referral && (
                <div className={styles.layout}>
                    <div className={styles.main}>
                        <section className={styles.block} aria-labelledby="invite-link-title">
                            <h2 id="invite-link-title" className={styles.sectionTitle}>
                                Seu link
                            </h2>
                            <div className={styles.linkBox}>
                                <input
                                    className={styles.linkInput}
                                    readOnly
                                    value={link}
                                    aria-label="Seu link de convite"
                                    onFocus={(e) => e.currentTarget.select()}
                                />
                                <div className={styles.linkActions}>
                                    <Button onClick={copyLink}>{copied === 'copied' ? 'Link copiado' : 'Copiar link'}</Button>
                                    {canShare && (
                                        <Button variant="secondary" onClick={shareLink}>
                                            Compartilhar
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {copied === 'failed' && (
                                <p className={styles.error} role="alert">
                                    Não deu para copiar automaticamente. Selecione o link e copie à mão.
                                </p>
                            )}
                            <p className={styles.muted}>
                                Seu código: <strong className={styles.code}>{referral.code}</strong>
                            </p>
                        </section>

                        <section className={styles.block} aria-labelledby="invite-progress-title">
                            <h2 id="invite-progress-title" className={styles.sectionTitle}>
                                Seu progresso
                            </h2>
                            <div className={styles.stats}>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{referral.qualifiedCount}</span>
                                    <span className={styles.statLabel}>
                                        {referral.qualifiedCount === 1 ? 'convite válido' : 'convites válidos'}
                                    </span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{referral.pendingCount}</span>
                                    <span className={styles.statLabel}>
                                        {referral.pendingCount === 1 ? 'amigo ainda na 1ª lição' : 'amigos ainda na 1ª lição'}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.progress}>
                                <div
                                    className={styles.progressTrack}
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={next?.threshold ?? referral.qualifiedCount}
                                    aria-valuenow={referral.qualifiedCount}
                                    aria-label="Progresso até o próximo marco"
                                >
                                    <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                                </div>
                                <p className={styles.muted}>
                                    {!next
                                        ? 'Você passou por todos os marcos. Obrigado por trazer tanta gente.'
                                        : remaining === 1
                                          ? `Falta 1 convite válido para o título ${next.title}.`
                                          : `Faltam ${remaining} convites válidos para o título ${next.title}.`}
                                </p>
                            </div>
                        </section>

                        <section className={styles.block} aria-labelledby="invite-rules-title">
                            <h2 id="invite-rules-title" className={styles.sectionTitle}>
                                Como funciona
                            </h2>
                            <ul className={styles.rules}>
                                <li>O convite vale quando o amigo conclui a primeira lição, não só ao criar a conta.</li>
                                <li>Não há limite de convites.</li>
                                <li>Cada marco libera uma conquista e um título para o seu perfil, que você escolhe em Configurações.</li>
                            </ul>
                        </section>
                    </div>

                    <aside className={styles.side} aria-labelledby="invite-ladder-title">
                        <h2 id="invite-ladder-title" className={styles.sectionTitle}>
                            Escada de marcos
                        </h2>
                        <ol className={styles.ladder}>
                            {MILESTONES.map((milestone) => {
                                const reached = referral.qualifiedCount >= milestone.threshold
                                return (
                                    <li key={milestone.threshold} className={`${styles.step} ${reached ? styles.stepReached : ''}`}>
                                        <span className={styles.stepThreshold}>{milestone.threshold} convites</span>
                                        <span className={styles.stepReward}>
                                            Título {milestone.title} e a conquista {milestone.achievement}
                                        </span>
                                        <span className={styles.stepStatus}>{reached ? 'Liberado' : 'Em andamento'}</span>
                                    </li>
                                )
                            })}
                        </ol>
                    </aside>
                </div>
            )}
        </main>
    )
}
