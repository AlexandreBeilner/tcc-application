import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    categoryLabel,
    DAILY_ORIGIN_LABELS,
    DAILY_SCOPE_LABELS,
    describeDailyError,
    formatGameDate,
} from '../../../features/admin/dailyAdmin'
import {
    useDailyPuzzleQuery,
    usePublishDailyPuzzlesMutation,
    useReplaceDailyCardMutation,
    useReviewDailyPuzzleMutation,
} from '../../../features/admin/useAdminDaily'
import { ApiError } from '../../../services/client'
import type { DailyPuzzleDetail, DailyReplaceCardInput } from '../../../services/admin'
import { Button } from '../../atoms/Button'
import { AdminDailyCardPicker } from '../../molecules/AdminDailyCardPicker'
import type { PickerCard } from '../../molecules/AdminDailyCardPicker'
import type { AdminDailyPuzzleProps } from './types'
import styles from './index.module.css'

export type { AdminDailyPuzzleProps } from './types'

function Source({ text }: { text: string }) {
    return <p className={styles.source}>Fonte: {text}</p>
}

function OriginMark({ origin }: { origin: 'generated' | 'manual' }) {
    return origin === 'manual' ? <span className={styles.manual}>{DAILY_ORIGIN_LABELS.manual}</span> : null
}

function currentIdsOf(card: PickerCard, puzzle: DailyPuzzleDetail): string[] {
    if (card === 'word') return [puzzle.word.id]
    if (card === 'question') return [puzzle.question.id]
    return puzzle.events.map((event) => event.id)
}

// Um dia do Diário como o jogador vai ver, mais o gabarito (só o painel mostra), com as ações de
// revisar, publicar e trocar cartão (DI.5.1). Revisar é afirmar que o texto, as alternativas, o
// gabarito e as fontes foram conferidos; trocar um cartão zera a revisão do dia.
export function AdminDailyPuzzle({ number }: AdminDailyPuzzleProps) {
    const query = useDailyPuzzleQuery(number)
    const review = useReviewDailyPuzzleMutation()
    const publish = usePublishDailyPuzzlesMutation()
    const replace = useReplaceDailyCardMutation()
    const [picker, setPicker] = useState<PickerCard | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pickerError, setPickerError] = useState<string | null>(null)

    const puzzle = query.data

    function run<T>(start: (callbacks: { onSuccess: () => void; onError: (err: unknown) => void }) => T, done: string) {
        setError(null)
        setNotice(null)
        start({
            onSuccess: () => setNotice(done),
            onError: (err) => {
                const { message, problems } = describeDailyError(err)
                setError([message, ...problems].join(' '))
            },
        })
    }

    function doReview() {
        run((cb) => review.mutate(number, cb), 'Dia marcado como revisado.')
    }

    function doPublish() {
        run((cb) => publish.mutate([number], cb), 'Dia publicado.')
    }

    function doReplace(input: DailyReplaceCardInput) {
        setPickerError(null)
        replace.mutate(
            { number, input },
            {
                onSuccess: () => {
                    setPicker(null)
                    setNotice('Cartão trocado. O dia precisa ser revisado de novo.')
                },
                onError: (err) => setPickerError(describeDailyError(err).message),
            },
        )
    }

    if (query.isLoading) return <p className={styles.muted}>Carregando o jogo…</p>
    if (query.isError || !puzzle) {
        const notFound = query.error instanceof ApiError && query.error.status === 404
        return (
            <p className={styles.error} role="alert">
                {notFound ? 'Este jogo não existe. A agenda só tem os dias já preparados.' : 'Não foi possível carregar o jogo agora.'}
            </p>
        )
    }

    const reviewed = puzzle.reviewed_at !== null
    const published = puzzle.published_at !== null
    const busy = review.isPending || publish.isPending || replace.isPending
    const rank = new Map(puzzle.correct_order.map((id, index) => [id, index + 1]))

    return (
        <div className={styles.root}>
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>
                        Jogo #{puzzle.number} · {formatGameDate(puzzle.date)}
                    </h1>
                    <div className={styles.badges}>
                        <span className={reviewed ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                            {reviewed ? 'Revisado' : 'Sem revisão'}
                        </span>
                        <span className={published ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                            {published ? 'Publicado' : 'Fora do ar'}
                        </span>
                        {puzzle.is_today_or_past && <span className={styles.badge}>Jogável hoje</span>}
                    </div>
                </div>
                <div className={styles.actions}>
                    <Button disabled={busy || reviewed} onClick={doReview}>
                        {review.isPending ? 'Revisando…' : reviewed ? 'Revisado' : 'Marcar como revisado'}
                    </Button>
                    <Button variant="secondary" disabled={busy || !reviewed || published} onClick={doPublish}>
                        {publish.isPending ? 'Publicando…' : published ? 'Publicado' : 'Publicar'}
                    </Button>
                </div>
            </header>

            {puzzle.warnings.length > 0 && (
                <ul className={styles.warnings} aria-label="Avisos do dia">
                    {puzzle.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                    ))}
                </ul>
            )}
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

            <div className={styles.cards}>
                <section className={styles.card} aria-label="Palavra do dia">
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>Palavra do dia</h2>
                        <OriginMark origin={puzzle.origins.word} />
                    </div>
                    <p className={styles.answer}>
                        {puzzle.word.display} <span className={styles.muted}>({puzzle.word.answer.length} letras)</span>
                    </p>
                    <p className={styles.text}>{puzzle.word.definition}</p>
                    <p className={styles.meta}>
                        {categoryLabel(puzzle.word.category)} · {DAILY_SCOPE_LABELS[puzzle.word.scope]}
                        {!puzzle.word.active && ' · desativada'}
                    </p>
                    <Button variant="secondary" disabled={busy} onClick={() => setPicker(picker === 'word' ? null : 'word')}>
                        Trocar palavra
                    </Button>
                </section>

                <section className={styles.card} aria-label="Pergunta do dia">
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>Pergunta do dia</h2>
                        <OriginMark origin={puzzle.origins.question} />
                    </div>
                    <p className={styles.text}>{puzzle.question.question}</p>
                    <ol className={styles.options}>
                        {puzzle.question.options.map((option, index) => (
                            <li key={option} className={index === puzzle.question.correct_index ? styles.correct : undefined}>
                                {option}
                                {index === puzzle.question.correct_index && <strong> (correta)</strong>}
                            </li>
                        ))}
                    </ol>
                    <p className={styles.text}>{puzzle.question.explanation}</p>
                    <Source text={puzzle.question.source_ref} />
                    <p className={styles.meta}>
                        {categoryLabel(puzzle.question.category)} · {DAILY_SCOPE_LABELS[puzzle.question.scope]}
                        {!puzzle.question.active && ' · desativada'}
                    </p>
                    <Button variant="secondary" disabled={busy} onClick={() => setPicker(picker === 'question' ? null : 'question')}>
                        Trocar pergunta
                    </Button>
                </section>

                <section className={styles.card} aria-label="Linha do tempo">
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>Linha do tempo</h2>
                        <OriginMark origin={puzzle.origins.timeline} />
                    </div>
                    <p className={styles.meta}>Na ordem em que o jogador vê. O número é a posição certa.</p>
                    <ol className={styles.events}>
                        {puzzle.events.map((event) => (
                            <li key={event.id} className={styles.event}>
                                <div className={styles.eventHead}>
                                    <span className={styles.rank}>{rank.get(event.id)}</span>
                                    <strong>{event.label}</strong>
                                    <span className={styles.muted}>{event.year}</span>
                                </div>
                                <p className={styles.text}>{event.explanation}</p>
                                <Source text={event.source_ref} />
                                <p className={styles.meta}>
                                    {categoryLabel(event.category)} · {DAILY_SCOPE_LABELS[event.scope]}
                                    {!event.active && ' · desativado'}
                                </p>
                            </li>
                        ))}
                    </ol>
                    <Button variant="secondary" disabled={busy} onClick={() => setPicker(picker === 'timeline' ? null : 'timeline')}>
                        Trocar eventos
                    </Button>
                </section>
            </div>

            {picker && (
                <AdminDailyCardPicker
                    key={picker}
                    card={picker}
                    currentIds={currentIdsOf(picker, puzzle)}
                    published={published}
                    pending={replace.isPending}
                    error={pickerError}
                    onSubmit={doReplace}
                    onCancel={() => setPicker(null)}
                />
            )}

            <Link to="/admin/diario" className={styles.back}>
                Voltar à agenda
            </Link>
        </div>
    )
}
