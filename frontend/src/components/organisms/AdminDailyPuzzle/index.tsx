import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    categoryLabel,
    DAILY_ORIGIN_LABELS,
    DAILY_SCOPE_LABELS,
    describeDailyError,
    formatGameDate,
} from '../../../features/admin/dailyAdmin'
import { useDailyPuzzleQuery, usePublishDailyPuzzlesMutation, useReplaceDailyCardMutation } from '../../../features/admin/useAdminDaily'
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
    return card === 'word' ? [puzzle.word.id] : [puzzle.question.id]
}

// Um dia do Diário como o jogador vai ver, mais o gabarito (só o painel mostra), com as ações de
// publicar e trocar cartão (DI.5.1). O conteúdo nasce pronto (criado e conferido pela skill
// `diario-conteudo`), então não há etapa de revisão: a prévia serve para conferir e corrigir.
export function AdminDailyPuzzle({ number }: AdminDailyPuzzleProps) {
    const query = useDailyPuzzleQuery(number)
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
                    setNotice('Cartão trocado.')
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

    const published = puzzle.published_at !== null
    const busy = publish.isPending || replace.isPending

    return (
        <div className={styles.root}>
            <header className={styles.head}>
                <div>
                    <h1 className={styles.title}>
                        Jogo #{puzzle.number} · {formatGameDate(puzzle.date)}
                    </h1>
                    <div className={styles.badges}>
                        <span className={published ? styles.badge : `${styles.badge} ${styles.dashed}`}>
                            {published ? 'Publicado' : 'Fora do ar'}
                        </span>
                        {puzzle.is_today_or_past && <span className={styles.badge}>Jogável hoje</span>}
                    </div>
                </div>
                <div className={styles.actions}>
                    <Button disabled={busy || published} onClick={doPublish}>
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
