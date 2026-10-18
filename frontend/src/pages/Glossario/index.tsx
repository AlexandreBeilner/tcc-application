import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { glossary } from '../../features/lessons/glossary'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import styles from './index.module.css'

const normalize = (text: string) =>
    text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()

// Página de consulta do glossário (RC.3.5): todos os termos em ordem
// alfabética, com busca, exemplo e link para a lição que ensina o termo.
export function Glossario() {
    // `?termo=` vem do "Saiba mais" do Diário (DI.4.2): abre o glossário já filtrado nesse termo.
    const [searchParams] = useSearchParams()
    const [query, setQuery] = useState(searchParams.get('termo') ?? '')
    const lessons = useLessonsQuery().data?.lessons ?? []

    const needle = normalize(query.trim())
    const entries = Object.entries(glossary)
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
        .filter(([term, entry]) => needle === '' || normalize(`${term} ${entry.definition}`).includes(needle))

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Glossário</h1>
                <p className={styles.subtitle}>Os termos das lições, em um só lugar.</p>
            </header>

            <label className={styles.search}>
                <span className={styles.searchLabel}>Buscar termo</span>
                <input
                    type="search"
                    className={styles.input}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ex: Selic, deságio, ETF"
                />
            </label>

            <p className={styles.count} aria-live="polite">
                {entries.length} {entries.length === 1 ? 'termo' : 'termos'}
            </p>

            {entries.length === 0 ? (
                <p className={styles.empty}>Nenhum termo encontrado para essa busca.</p>
            ) : (
                <dl className={styles.list}>
                    {entries.map(([term, entry]) => {
                        const lesson = entry.originLesson ? lessons.find((candidate) => candidate.code === entry.originLesson) : undefined
                        return (
                            <div key={term} className={styles.item}>
                                <dt className={styles.term}>{term}</dt>
                                <dd className={styles.definition}>{entry.definition}</dd>
                                {entry.example && <dd className={styles.example}>Exemplo: {entry.example}</dd>}
                                {lesson && (
                                    <dd className={styles.origin}>
                                        <Link to={`/trilha/${lesson.id}`}>Ver na lição: {lesson.title}</Link>
                                    </dd>
                                )}
                            </div>
                        )
                    })}
                </dl>
            )}
        </main>
    )
}
