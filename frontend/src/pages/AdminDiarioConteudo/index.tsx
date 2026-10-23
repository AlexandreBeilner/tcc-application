import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminDailyAccepted } from '../../components/organisms/AdminDailyAccepted'
import { AdminDailyQuestions } from '../../components/organisms/AdminDailyQuestions'
import { AdminDailyWords } from '../../components/organisms/AdminDailyWords'
import styles from './index.module.css'

type Tab = 'words' | 'questions' | 'accepted'

const TABS: { key: Tab; label: string }[] = [
    { key: 'words', label: 'Palavras' },
    { key: 'questions', label: 'Perguntas' },
    { key: 'accepted', label: 'Palavras aceitas' },
]

// Conteúdo do Diário (DI.5.1): os bancos que a agenda sorteia. Tudo que o jogador vê tem fonte primária
// registrada. O conteúdo é criado e conferido pela skill `diario-conteudo` (sem IA no produto); aqui só se corrige.
export function AdminDiarioConteudo() {
    const [tab, setTab] = useState<Tab>('words')

    return (
        <main className={styles.page}>
            <Link to="/admin/diario" className={styles.back}>
                Voltar ao Diário
            </Link>
            <header>
                <h1 className={styles.title}>Conteúdo do Diário</h1>
                <p className={styles.subtitle}>Palavras e perguntas. Item em jogo já publicado só muda com confirmação.</p>
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
                {tab === 'accepted' && <AdminDailyAccepted />}
            </div>
        </main>
    )
}
