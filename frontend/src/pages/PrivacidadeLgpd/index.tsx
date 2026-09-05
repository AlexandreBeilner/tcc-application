import { useState } from 'react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { useAuth } from '../../features/auth/AuthContext'
import { ApiError } from '../../services/client'
import { deleteAccount, exportAccountData } from '../../services/auth'
import styles from './index.module.css'

// Tela 9.3 (tarefa 6.10, RNF04) — restrita à gestão de dados pessoais
// (spec v0.4 §8.2: não há visibilidade de perfil configurável nesta
// fase). "Exportar dados" (`GET /me/export`) monta um arquivo local via
// Blob/`URL.createObjectURL` — não existe endpoint de download, o client
// HTTP só devolve o JSON (`services/auth.exportAccountData`). "Excluir
// conta" pede confirmação em duas etapas (inventário, estados especiais)
// antes de chamar `DELETE /me`; sucesso desloga imediatamente mesmo sem
// blacklist de JWT (`.docs/backend/auth.md`) — nunca deixar a sessão local
// "logada" numa conta recém-anonimizada.
export function PrivacidadeLgpd() {
    const { token, logout } = useAuth()
    const navigate = useNavigate()

    const [isExporting, setIsExporting] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)

    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    async function handleExport() {
        setExportError(null)
        setIsExporting(true)
        try {
            const result = await exportAccountData(token as string)
            const blob = new Blob([JSON.stringify(result.export, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'meus-dados.json'
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            setExportError(err instanceof ApiError ? err.message : 'Não foi possível exportar seus dados agora. Tente novamente.')
        } finally {
            setIsExporting(false)
        }
    }

    async function handleDelete() {
        setDeleteError(null)
        setIsDeleting(true)
        try {
            await deleteAccount(token as string)
            logout()
            navigate('/login', { replace: true })
        } catch (err) {
            setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir sua conta agora. Tente novamente.')
            setIsDeleting(false)
            setConfirmingDelete(false)
        }
    }

    return (
        <main className={styles.page}>
            <Link to="/configuracoes" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Configurações
            </Link>

            <h1 className={styles.title}>Privacidade e LGPD</h1>

            <section className={styles.section}>
                <p className={styles.note}>
                    Sua rentabilidade percentual, nível e conquistas são sempre visíveis a outros usuários. O valor absoluto do seu
                    patrimônio nunca é exposto — nem no ranking, nem no seu perfil público, independentemente de qualquer configuração.
                </p>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Exportar dados</h2>
                <p className={styles.description}>
                    Baixe uma cópia dos seus dados pessoais e de progresso na plataforma (portabilidade, LGPD).
                </p>
                {exportError && (
                    <p className={styles.error} role="alert">
                        {exportError}
                    </p>
                )}
                <Button variant="secondary" onClick={handleExport} disabled={isExporting}>
                    {isExporting ? 'Exportando…' : 'Exportar dados'}
                </Button>
            </section>

            <section className={`${styles.section} ${styles.danger}`}>
                <h2 className={styles.sectionTitle}>Excluir conta</h2>
                <p className={styles.description}>
                    Sua identidade pessoal (nome, e-mail, username, senha) é removida permanentemente. Seu histórico de mercado e ranking
                    passado continua existindo de forma anônima — esta ação não pode ser desfeita.
                </p>

                {deleteError && (
                    <p className={styles.error} role="alert">
                        {deleteError}
                    </p>
                )}

                {!confirmingDelete ? (
                    <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
                        Excluir conta
                    </Button>
                ) : (
                    <div className={styles.confirmBox}>
                        <p className={styles.confirmText}>
                            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
                            Tem certeza? Esta ação é irreversível.
                        </p>
                        <div className={styles.confirmActions}>
                            <Button variant="secondary" disabled={isDeleting} onClick={() => setConfirmingDelete(false)}>
                                Cancelar
                            </Button>
                            <Button disabled={isDeleting} onClick={handleDelete}>
                                {isDeleting ? 'Excluindo…' : 'Confirmar exclusão'}
                            </Button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    )
}
