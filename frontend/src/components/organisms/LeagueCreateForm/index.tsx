import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useCreateLeagueMutation } from '../../../features/leagues/useLeagues'
import type { LeagueWindow } from '../../../services/leagues'
import { formatApiError } from '../../../utils/formatApiError'
import { Button } from '../../atoms/Button'
import type { LeagueCreateFormProps } from './types'
import styles from './index.module.css'

export type { LeagueCreateFormProps } from './types'

const WINDOWS: { value: LeagueWindow; label: string }[] = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mês' },
]

// Criar liga (MO.5.2c): nome e período; quem cria convida os amigos depois.
export function LeagueCreateForm({ onCreated }: LeagueCreateFormProps) {
    const create = useCreateLeagueMutation()
    const [name, setName] = useState('')
    const [window, setWindow] = useState<LeagueWindow>('week')

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        try {
            const league = await create.mutateAsync({ name, window })
            setName('')
            onCreated?.(league.id)
        } catch {
            // o erro fica em `create.error` e aparece abaixo
        }
    }

    const errorMessage = create.isError ? formatApiError(create.error, 'Não foi possível criar a liga. Tente de novo.') : null

    return (
        <section className={styles.section} aria-labelledby="league-create-title">
            <h2 id="league-create-title" className={styles.title}>
                Criar uma liga
            </h2>
            <p className={styles.note}>
                Até 3 ligas abertas, com até 20 pessoas cada. A pontuação é a rentabilidade percentual do período, a mesma do ranking.
            </p>
            <form className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.field}>
                    Nome da liga
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        minLength={3}
                        maxLength={40}
                        required
                    />
                </label>
                <div className={styles.field} role="group" aria-label="Período">
                    Período
                    <div className={styles.pills}>
                        {WINDOWS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={[styles.pill, option.value === window && styles.pillActive].filter(Boolean).join(' ')}
                                aria-pressed={option.value === window}
                                onClick={() => setWindow(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                {errorMessage && (
                    <p className={styles.error} role="alert">
                        {errorMessage}
                    </p>
                )}
                <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? 'Criando…' : 'Criar liga'}
                </Button>
            </form>
        </section>
    )
}
