import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminDailyAccepted } from '../../components/organisms/AdminDailyAccepted'
import { AdminDailyEvents } from '../../components/organisms/AdminDailyEvents'
import { AdminDailyQuestions } from '../../components/organisms/AdminDailyQuestions'
import { AdminDailyWords } from '../../components/organisms/AdminDailyWords'
import styles from './index.module.css'

type Tab = 'words' | 'questions' | 'events' | 'accepted'

const TABS: { key: Tab; label: string }[] = [
    { key: 'words', label: 'Palavras' },
    { key: 'questions', label: 'Perguntas' },
    { key: 'events', label: 'Eventos' },
    { key: 'accepted', label: 'Palavras aceitas' },
]

// Conteúdo do Diário (DI.5.1): os bancos que a agenda sorteia. Tudo que o jogador vê tem fonte primária
// registrada e passa pela revisão do dia antes de ir ao ar. Não há IA: o conteúdo é curado à mão.
export function AdminDiarioConteudo() {
    const [tab, setTab] = useState<Tab>('words')

    return (
        <main className={styles.page}>
            <Link to="/admin/diario" className={styles.back}>
                Voltar ao Diário
            </Link>
            <header>
                <h1 className={styles.title}>Conteúdo do Diário</h1>
                <p className={styles.subtitle}>
                    Palavras, perguntas e eventos da Linha do tempo. Editar o que o jogador vê zera a revisão dos dias ainda não publicados
                    que usam o item.
                </p>
            </header>

            <div role="tablist" aria-label="Bancos de conteúdo" className={styles.tabs}>
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`diario-tab-${key}`}
                        aria-selected={tab === key}
                        aria-controls="diario-tabpanel"
                        className={tab === key ? `${styles.tab} ${styles.active}` : styles.tab}
                        onClick={() => setTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id="diario-tabpanel" aria-labelledby={`diario-tab-${tab}`}>
                {tab === 'words' && <AdminDailyWords />}
                {tab === 'questions' && <AdminDailyQuestions />}
                {tab === 'events' && <AdminDailyEvents />}
                {tab === 'accepted' && <AdminDailyAccepted />}
            </div>
        </main>
    )
}
