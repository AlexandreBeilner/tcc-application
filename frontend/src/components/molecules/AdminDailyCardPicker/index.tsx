import { useId, useState } from 'react'
import { categoryLabel } from '../../../features/admin/dailyAdmin'
import { useDailyQuestionsQuery, useDailyWordsQuery } from '../../../features/admin/useAdminDaily'
import { Button } from '../../atoms/Button'
import { AdminField, adminInputClass } from '../AdminField'
import type { AdminDailyCardPickerProps } from './types'
import styles from './index.module.css'

export type { AdminDailyCardPickerProps, PickerCard } from './types'

interface Option {
    id: string
    title: string
    detail: string
}

function normalize(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function useOptions(card: AdminDailyCardPickerProps['card']): { options: Option[]; loading: boolean; failed: boolean } {
    const words = useDailyWordsQuery()
    const questions = useDailyQuestionsQuery()
    if (card === 'word') {
        return {
            options: (words.data ?? [])
                .filter((w) => w.active)
                .map((w) => ({ id: w.id, title: w.display, detail: categoryLabel(w.category) })),
            loading: words.isLoading,
            failed: words.isError,
        }
    }
    return {
        options: (questions.data ?? [])
            .filter((q) => q.active)
            .map((q) => ({ id: q.id, title: q.question, detail: categoryLabel(q.category) })),
        loading: questions.isLoading,
        failed: questions.isError,
    }
}

// Troca de um cartão do jogo (DI.5.1): busca no banco, escolhe um item e confirma.
// Jogo já publicado só troca com a confirmação marcada.
export function AdminDailyCardPicker({ card, currentIds, published, pending, error, onSubmit, onCancel }: AdminDailyCardPickerProps) {
    const { options, loading, failed } = useOptions(card)
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<string | null>(null)
    const [confirmed, setConfirmed] = useState(false)
    const confirmId = useId()

    const visible = options
        .filter((o) => !currentIds.includes(o.id))
        .filter((o) => normalize(`${o.title} ${o.detail}`).includes(normalize(query)))
        .slice(0, 60)
    const blocked = published && !confirmed

    function submit() {
        if (selected === null) return
        const confirm_published = published ? confirmed : undefined
        if (card === 'word') onSubmit({ card, word_id: selected, confirm_published })
        else onSubmit({ card, question_id: selected, confirm_published })
    }

    return (
        <div className={styles.root}>
            <AdminField label="Buscar no banco">
                {(id) => <input id={id} className={adminInputClass} value={query} onChange={(event) => setQuery(event.target.value)} />}
            </AdminField>
            {loading && <p className={styles.hint}>Carregando o banco…</p>}
            {failed && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o banco agora.
                </p>
            )}
            <ul className={styles.list} aria-label="Itens do banco">
                {visible.map((option) => (
                    <li key={option.id}>
                        <label className={styles.option}>
                            <input
                                type="radio"
                                name="daily-card-option"
                                checked={selected === option.id}
                                onChange={() => setSelected(option.id)}
                            />
                            <span>
                                <span className={styles.optionTitle}>{option.title}</span>
                                <span className={styles.optionDetail}>{option.detail}</span>
                            </span>
                        </label>
                    </li>
                ))}
                {!loading && visible.length === 0 && <li className={styles.hint}>Nenhum item encontrado.</li>}
            </ul>
            {published && (
                <label htmlFor={confirmId} className={styles.confirm}>
                    <input id={confirmId} type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                    <span>Este jogo já está publicado. Confirmo a troca.</span>
                </label>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            <div className={styles.actions}>
                <Button disabled={selected === null || blocked || pending} onClick={submit}>
                    {pending ? 'Trocando…' : 'Trocar cartão'}
                </Button>
                <Button variant="secondary" disabled={pending} onClick={onCancel}>
                    Cancelar
                </Button>
            </div>
        </div>
    )
}
