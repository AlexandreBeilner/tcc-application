import { useState } from 'react'
import { describeDailyError } from '../../../features/admin/dailyAdmin'
import {
    useAddDailyAcceptedWordMutation,
    useDailyAcceptedWordsQuery,
    useRemoveDailyAcceptedWordMutation,
} from '../../../features/admin/useAdminDaily'
import { Button } from '../../atoms/Button'
import { AdminField, adminInputClass } from '../../molecules/AdminField'
import styles from './index.module.css'

// Lista extra de palavras aceitas como palpite (DI.5.1, seção 3.1). A lista do dicionário não se edita
// aqui; a extra guarda o que o dicionário não tem (siglas e termos do mercado, como "Selic"). Uma
// palavra-resposta nunca sai da lista, porque o jogador precisa poder digitá-la.
export function AdminDailyAccepted() {
    const query = useDailyAcceptedWordsQuery()
    const add = useAddDailyAcceptedWordMutation()
    const remove = useRemoveDailyAcceptedWordMutation()
    const [word, setWord] = useState('')
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    function fail(err: unknown) {
        setNotice(null)
        const { message, problems } = describeDailyError(err)
        setError([message, ...problems.filter((p) => p !== message)].join('. '))
    }

    function submit() {
        setError(null)
        add.mutate(word, {
            onSuccess: (result) => {
                setNotice(`${result.word} agora é aceita como palpite.`)
                setWord('')
            },
            onError: fail,
        })
    }

    function drop(target: string) {
        setError(null)
        remove.mutate(target, { onSuccess: (result) => setNotice(`${result.word} saiu da lista extra.`), onError: fail })
    }

    return (
        <section className={styles.root} aria-label="Palavras aceitas">
            <form
                className={styles.toolbar}
                onSubmit={(event) => {
                    event.preventDefault()
                    if (word.trim() !== '') submit()
                }}
            >
                <AdminField label="Nova palavra aceita" hint="De 4 a 9 letras. Acentos e caixa são ignorados.">
                    {(id) => (
                        <input id={id} className={adminInputClass} value={word} maxLength={20} onChange={(e) => setWord(e.target.value)} />
                    )}
                </AdminField>
                <Button disabled={add.isPending || word.trim() === ''} onClick={submit}>
                    {add.isPending ? 'Adicionando…' : 'Adicionar'}
                </Button>
            </form>
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
            {query.isLoading && <p className={styles.muted}>Carregando a lista…</p>}
            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar a lista agora.
                </p>
            )}
            {query.data && query.data.length === 0 && <p className={styles.muted}>A lista extra está vazia.</p>}
            <ul className={styles.items}>
                {(query.data ?? []).map((item) => (
                    <li key={item} className={styles.item}>
                        <span className={styles.name}>{item}</span>
                        <button type="button" className={styles.link} disabled={remove.isPending} onClick={() => drop(item)}>
                            Remover
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    )
}
