import { useId, useState } from 'react'
import type { SubmitEvent } from 'react'
import {
    describeCorrectionError,
    MAX_CORRECTION_REASON_LENGTH,
    MIN_CORRECTION_REASON_LENGTH,
    parseCreditAmount,
    parseWholeNumber,
} from '../../../features/admin/adminUsers'
import {
    useAdjustXpMutation,
    useCorrectAchievementMutation,
    useCorrectLessonMutation,
    useCreditUserMutation,
    useSetStreakMutation,
    useUserCorrectionContextQuery,
} from '../../../features/admin/useUserCorrections'
import { formatCurrency } from '../../../features/portfolio/format'
import type { CorrectionLessonStatus } from '../../../services/admin'
import { ConfirmDialog } from '../../molecules/ConfirmDialog'
import type { AdminUserCorrectionsProps } from './types'
import styles from './index.module.css'

export type { AdminUserCorrectionsProps } from './types'

const LESSON_STATUS_LABELS: Record<CorrectionLessonStatus, string> = {
    completed: 'concluída',
    in_progress: 'em andamento',
    not_started: 'não iniciada',
}

interface ReasonFieldProps {
    label: string
    value: string
    optional?: boolean
    disabled: boolean
    onChange: (value: string) => void
}

function ReasonField({ label, value, optional = false, disabled, onChange }: ReasonFieldProps) {
    const id = useId()
    return (
        <label htmlFor={id} className={styles.field}>
            <span>{label}</span>
            <input
                id={id}
                className={styles.input}
                value={value}
                maxLength={MAX_CORRECTION_REASON_LENGTH}
                disabled={disabled}
                required={!optional}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    )
}

function validReason(reason: string): boolean {
    return reason.trim().length >= MIN_CORRECTION_REASON_LENGTH
}

// Correções manuais de conta (N.17): crédito de caixa sem teto, ajuste de XP e de streak,
// conceder ou revogar conquista, concluir ou reabrir lição. Tudo auditado e protegido por
// senha recente (o `withReauth` dos hooks pede de novo se a conferência venceu). O crédito
// pede confirmação mostrando o valor formatado, pra um erro de digitação não virar milhões.
// Resetar carteira não existe: apagaria histórico imutável.
export function AdminUserCorrections({ userId, username }: AdminUserCorrectionsProps) {
    const contextQuery = useUserCorrectionContextQuery(userId)
    const credit = useCreditUserMutation()
    const adjustXp = useAdjustXpMutation()
    const setStreak = useSetStreakMutation()
    const correctAchievement = useCorrectAchievementMutation()
    const correctLesson = useCorrectLessonMutation()

    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [creditAmount, setCreditAmount] = useState('')
    const [creditReason, setCreditReason] = useState('')
    const [confirmingCredit, setConfirmingCredit] = useState(false)
    const [creditDialogError, setCreditDialogError] = useState<string | null>(null)

    const [xpDelta, setXpDelta] = useState('')
    const [xpReason, setXpReason] = useState('')
    const [streakValue, setStreakValue] = useState('')
    const [streakReason, setStreakReason] = useState('')

    const [achievementId, setAchievementId] = useState('')
    const [achievementReason, setAchievementReason] = useState('')
    const [lessonId, setLessonId] = useState('')
    const [lessonReason, setLessonReason] = useState('')

    const achievements = contextQuery.data?.achievements ?? []
    const lessons = contextQuery.data?.lessons ?? []
    const selectedAchievement = achievements.find((a) => a.id === achievementId)
    const selectedLesson = lessons.find((l) => l.id === lessonId)

    const busy = credit.isPending || adjustXp.isPending || setStreak.isPending || correctAchievement.isPending || correctLesson.isPending

    const amount = parseCreditAmount(creditAmount)
    const delta = parseWholeNumber(xpDelta)
    const streak = parseWholeNumber(streakValue)

    function succeed(message: string) {
        setNotice(message)
        setError(null)
    }

    function fail(err: unknown) {
        setNotice(null)
        setError(describeCorrectionError(err))
    }

    function runCredit() {
        if (amount === null) return
        setCreditDialogError(null)
        credit.mutate(
            { userId, amount, reason: creditReason.trim() || undefined },
            {
                onSuccess: (result) => {
                    succeed(`Crédito de ${formatCurrency(result.credited)} aplicado em @${username}.`)
                    setCreditAmount('')
                    setCreditReason('')
                    setConfirmingCredit(false)
                },
                onError: (err) => setCreditDialogError(describeCorrectionError(err)),
            },
        )
    }

    function submitXp(event: SubmitEvent) {
        event.preventDefault()
        if (delta === null || delta === 0) return
        adjustXp.mutate(
            { userId, delta, reason: xpReason.trim() },
            {
                onSuccess: (result) => {
                    succeed(`XP ajustado. Agora são ${result.xp} XP, nível ${result.level}.`)
                    setXpDelta('')
                    setXpReason('')
                },
                onError: fail,
            },
        )
    }

    function submitStreak(event: SubmitEvent) {
        event.preventDefault()
        if (streak === null || streak < 0) return
        setStreak.mutate(
            { userId, value: streak, reason: streakReason.trim() },
            {
                onSuccess: (result) => {
                    succeed(`Streak definido em ${result.current_streak} dia(s). Maior streak: ${result.longest_streak}.`)
                    setStreakValue('')
                    setStreakReason('')
                },
                onError: fail,
            },
        )
    }

    function runAchievement(action: 'grant' | 'revoke') {
        if (!selectedAchievement) return
        correctAchievement.mutate(
            { userId, achievementId: selectedAchievement.id, action, reason: achievementReason.trim() },
            {
                onSuccess: () => {
                    succeed(
                        action === 'grant'
                            ? `Conquista "${selectedAchievement.name}" concedida.`
                            : `Conquista "${selectedAchievement.name}" revogada.`,
                    )
                    setAchievementReason('')
                },
                onError: fail,
            },
        )
    }

    function runLesson(action: 'complete' | 'reopen') {
        if (!selectedLesson) return
        correctLesson.mutate(
            { userId, lessonId: selectedLesson.id, action, reason: lessonReason.trim() },
            {
                onSuccess: () => {
                    succeed(
                        action === 'complete'
                            ? `Lição ${selectedLesson.code} marcada como concluída (sem XP).`
                            : `Lição ${selectedLesson.code} reaberta.`,
                    )
                    setLessonReason('')
                },
                onError: fail,
            },
        )
    }

    return (
        <section className={styles.root} aria-labelledby="user-corrections">
            <h2 id="user-corrections" className={styles.title}>
                Correções de conta
            </h2>
            <p className={styles.intro}>
                Ferramentas de suporte. Cada ação fica na auditoria com o motivo e pede a senha de novo se a conferência recente venceu.
            </p>

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            <div className={styles.grid}>
                <form
                    className={styles.card}
                    aria-label="Crédito de caixa"
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (amount !== null) setConfirmingCredit(true)
                    }}
                >
                    <h3 className={styles.cardTitle}>Crédito de caixa</h3>
                    <p className={styles.hint}>
                        Soma dinheiro simulado na conta, sem teto. É caixa livre: aparece no extrato como crédito administrativo e não
                        altera a rentabilidade do ranking.
                    </p>
                    <label className={styles.field}>
                        <span>Valor (R$)</span>
                        <input
                            className={styles.input}
                            inputMode="decimal"
                            placeholder="1.500,00"
                            value={creditAmount}
                            disabled={busy}
                            onChange={(event) => setCreditAmount(event.target.value)}
                        />
                    </label>
                    <ReasonField label="Motivo (opcional)" optional value={creditReason} disabled={busy} onChange={setCreditReason} />
                    <button type="submit" className={styles.submit} disabled={busy || amount === null}>
                        Creditar
                    </button>
                </form>

                <form className={styles.card} aria-label="Ajuste de XP" onSubmit={submitXp}>
                    <h3 className={styles.cardTitle}>Ajustar XP</h3>
                    <p className={styles.hint}>
                        Valor positivo soma, negativo tira. O nível é recalculado do total e o XP nunca fica abaixo de zero.
                    </p>
                    <label className={styles.field}>
                        <span>Variação de XP</span>
                        <input
                            className={styles.input}
                            inputMode="numeric"
                            placeholder="-50 ou 200"
                            value={xpDelta}
                            disabled={busy}
                            onChange={(event) => setXpDelta(event.target.value)}
                        />
                    </label>
                    <ReasonField label="Motivo" value={xpReason} disabled={busy} onChange={setXpReason} />
                    <button
                        type="submit"
                        className={styles.submit}
                        disabled={busy || delta === null || delta === 0 || !validReason(xpReason)}
                    >
                        Aplicar ajuste
                    </button>
                </form>

                <form className={styles.card} aria-label="Ajuste de streak" onSubmit={submitStreak}>
                    <h3 className={styles.cardTitle}>Definir streak</h3>
                    <p className={styles.hint}>
                        Define a sequência atual em dias. A maior sequência histórica só sobe. Zero reinicia a sequência.
                    </p>
                    <label className={styles.field}>
                        <span>Streak atual (dias)</span>
                        <input
                            className={styles.input}
                            inputMode="numeric"
                            placeholder="7"
                            value={streakValue}
                            disabled={busy}
                            onChange={(event) => setStreakValue(event.target.value)}
                        />
                    </label>
                    <ReasonField label="Motivo" value={streakReason} disabled={busy} onChange={setStreakReason} />
                    <button
                        type="submit"
                        className={styles.submit}
                        disabled={busy || streak === null || streak < 0 || !validReason(streakReason)}
                    >
                        Definir streak
                    </button>
                </form>

                <div className={styles.card} role="group" aria-label="Conquistas">
                    <h3 className={styles.cardTitle}>Conquistas</h3>
                    <p className={styles.hint}>
                        Conceder não checa o critério. Revogar não impede que a conquista volte sozinha se o usuário ainda cumprir o
                        critério.
                    </p>
                    <label className={styles.field}>
                        <span>Conquista</span>
                        <select
                            className={styles.input}
                            value={achievementId}
                            disabled={busy || contextQuery.isLoading}
                            onChange={(event) => setAchievementId(event.target.value)}
                        >
                            <option value="">Selecione…</option>
                            {achievements.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                    {a.unlocked ? ' (já tem)' : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <ReasonField label="Motivo" value={achievementReason} disabled={busy} onChange={setAchievementReason} />
                    <div className={styles.buttons}>
                        <button
                            type="button"
                            className={styles.submit}
                            disabled={busy || !selectedAchievement || selectedAchievement.unlocked || !validReason(achievementReason)}
                            onClick={() => runAchievement('grant')}
                        >
                            Conceder
                        </button>
                        <button
                            type="button"
                            className={`${styles.submit} ${styles.danger}`}
                            disabled={busy || !selectedAchievement || !selectedAchievement.unlocked || !validReason(achievementReason)}
                            onClick={() => runAchievement('revoke')}
                        >
                            Revogar
                        </button>
                    </div>
                </div>

                <div className={styles.card} role="group" aria-label="Lições">
                    <h3 className={styles.cardTitle}>Lições</h3>
                    <p className={styles.hint}>
                        Concluir não dá XP, não conta pra missão nem pro streak (se for devido, ajuste o XP à parte). Reabrir uma lição no
                        meio da trilha faz o usuário perder o acesso à última que ela liberou até concluí-la de novo.
                    </p>
                    <label className={styles.field}>
                        <span>Lição</span>
                        <select
                            className={styles.input}
                            value={lessonId}
                            disabled={busy || contextQuery.isLoading}
                            onChange={(event) => setLessonId(event.target.value)}
                        >
                            <option value="">Selecione…</option>
                            {lessons.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.code} · {l.title} ({LESSON_STATUS_LABELS[l.status]})
                                </option>
                            ))}
                        </select>
                    </label>
                    <ReasonField label="Motivo" value={lessonReason} disabled={busy} onChange={setLessonReason} />
                    <div className={styles.buttons}>
                        <button
                            type="button"
                            className={styles.submit}
                            disabled={busy || !selectedLesson || selectedLesson.status === 'completed' || !validReason(lessonReason)}
                            onClick={() => runLesson('complete')}
                        >
                            Marcar como concluída
                        </button>
                        <button
                            type="button"
                            className={`${styles.submit} ${styles.danger}`}
                            disabled={busy || !selectedLesson || selectedLesson.status !== 'completed' || !validReason(lessonReason)}
                            onClick={() => runLesson('reopen')}
                        >
                            Reabrir
                        </button>
                    </div>
                </div>
            </div>

            {contextQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar as conquistas e lições deste usuário.
                </p>
            )}

            {confirmingCredit && amount !== null && (
                <ConfirmDialog
                    title="Creditar caixa nesta conta?"
                    confirmLabel="Creditar"
                    pendingLabel="Creditando…"
                    pending={credit.isPending}
                    onConfirm={runCredit}
                    onCancel={() => {
                        setConfirmingCredit(false)
                        setCreditDialogError(null)
                    }}
                >
                    <p>
                        Você vai somar <strong>{formatCurrency(amount)}</strong> ao saldo de @{username}.
                    </p>
                    <p>Confira o valor: o crédito não tem teto e não dá para desfazer. A ação fica registrada na auditoria.</p>
                    {creditDialogError && (
                        <p role="alert" className={styles.error}>
                            {creditDialogError}
                        </p>
                    )}
                </ConfirmDialog>
            )}
        </section>
    )
}
