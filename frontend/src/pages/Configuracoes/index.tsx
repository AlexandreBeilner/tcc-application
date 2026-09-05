import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { useAuth } from '../../features/auth/AuthContext'
import { useIdentitiesQuery } from '../../features/auth/useIdentitiesQuery'
import { ApiError } from '../../services/client'
import { changePassword, updateProfile } from '../../services/auth'
import styles from './index.module.css'

const PROVIDER_LABELS: Record<string, string> = { google: 'Google' }

function providerLabel(providerName: string): string {
    return PROVIDER_LABELS[providerName] ?? providerName
}

// Tela 9.2 (tarefa 6.10) — dados cadastrais (`PATCH /me`), troca de senha
// (`POST /me/password`) e provedores conectados (`GET /me/identities`, só
// leitura), cada um sua própria seção/estado de submit — "Salvar" →
// confirmação inline, sem navegação (inventário 9.2). `currentPassword`
// fica sempre opcional no form: só a conta OAuth-only dispensa (backend,
// não sinalizado ao client), então deixar o backend decidir e mostrar
// `err.message` (`.docs/backend/auth.md`: "senha atual obrigatória"/
// "senha atual incorreta") é mais simples que replicar a regra aqui —
// mesmo princípio de `Login` (erro do backend exibido direto).
export function Configuracoes() {
    const { token, user, setUser } = useAuth()
    const identitiesQuery = useIdentitiesQuery()

    const [name, setName] = useState(user?.name ?? '')
    const [email, setEmail] = useState(user?.email ?? '')
    const [username, setUsername] = useState(user?.username ?? '')
    const [profileError, setProfileError] = useState<string | null>(null)
    const [profileSaved, setProfileSaved] = useState(false)
    const [isSavingProfile, setIsSavingProfile] = useState(false)

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [passwordSaved, setPasswordSaved] = useState(false)
    const [isSavingPassword, setIsSavingPassword] = useState(false)

    if (!user) {
        return (
            <main className={styles.page}>
                <p className={styles.loading}>Carregando…</p>
            </main>
        )
    }

    async function handleProfileSubmit(event: SubmitEvent) {
        event.preventDefault()
        setProfileError(null)
        setProfileSaved(false)
        setIsSavingProfile(true)
        try {
            const result = await updateProfile(token as string, { name, email, username })
            setUser(result.user)
            setProfileSaved(true)
        } catch (err) {
            setProfileError(err instanceof ApiError ? err.message : 'Não foi possível salvar agora. Tente novamente.')
        } finally {
            setIsSavingProfile(false)
        }
    }

    async function handlePasswordSubmit(event: SubmitEvent) {
        event.preventDefault()
        setPasswordError(null)
        setPasswordSaved(false)

        if (newPassword !== confirmPassword) {
            setPasswordError('As senhas não coincidem.')
            return
        }

        setIsSavingPassword(true)
        try {
            await changePassword(token as string, {
                currentPassword: currentPassword || undefined,
                newPassword,
            })
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setPasswordSaved(true)
        } catch (err) {
            setPasswordError(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha agora. Tente novamente.')
        } finally {
            setIsSavingPassword(false)
        }
    }

    return (
        <main className={styles.page}>
            <Link to="/perfil" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Meu Perfil
            </Link>

            <h1 className={styles.title}>Configurações de Conta</h1>

            <div className={styles.layout}>
                <div className={styles.main}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Dados cadastrais</h2>
                        <form className={styles.form} onSubmit={handleProfileSubmit}>
                            <label className={styles.field}>
                                Nome
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    required
                                    maxLength={100}
                                    autoComplete="name"
                                />
                            </label>

                            <label className={styles.field}>
                                E-mail
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                    maxLength={100}
                                    autoComplete="email"
                                />
                            </label>

                            <label className={styles.field}>
                                Nome de usuário
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    required
                                    minLength={3}
                                    maxLength={30}
                                    pattern="[a-z0-9_]+"
                                    autoComplete="username"
                                />
                            </label>

                            {profileError && (
                                <p className={styles.error} role="alert">
                                    {profileError}
                                </p>
                            )}

                            {profileSaved && !profileError && (
                                <p className={styles.saved}>
                                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                                    Perfil atualizado.
                                </p>
                            )}

                            <Button type="submit" disabled={isSavingProfile}>
                                Salvar
                            </Button>
                        </form>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Alterar senha</h2>
                        <form className={styles.form} onSubmit={handlePasswordSubmit}>
                            <label className={styles.field}>
                                Senha atual
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    autoComplete="current-password"
                                />
                            </label>

                            <label className={styles.field}>
                                Nova senha
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    autoComplete="new-password"
                                />
                            </label>

                            <label className={styles.field}>
                                Confirmar nova senha
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    autoComplete="new-password"
                                />
                            </label>

                            {passwordError && (
                                <p className={styles.error} role="alert">
                                    {passwordError}
                                </p>
                            )}

                            {passwordSaved && !passwordError && (
                                <p className={styles.saved}>
                                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                                    Senha atualizada.
                                </p>
                            )}

                            <Button type="submit" disabled={isSavingPassword}>
                                Salvar
                            </Button>
                        </form>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Provedores conectados</h2>
                        {identitiesQuery.isError && (
                            <p className={styles.error} role="alert">
                                Não foi possível carregar os provedores conectados agora.
                            </p>
                        )}
                        {!identitiesQuery.data && !identitiesQuery.isError && <p className={styles.loading}>Carregando…</p>}
                        {identitiesQuery.data && identitiesQuery.data.identities.length === 0 && (
                            <p className={styles.empty}>Nenhum provedor conectado — login só por e-mail e senha.</p>
                        )}
                        {identitiesQuery.data && identitiesQuery.data.identities.length > 0 && (
                            <ul className={styles.identityList}>
                                {identitiesQuery.data.identities.map((identity) => (
                                    <li key={identity.id} className={styles.identityItem}>
                                        {providerLabel(identity.providerName)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <aside className={styles.sidebar}>
                    <div className={styles.panel}>
                        <h2 className={styles.panelTitle}>Privacidade e dados</h2>
                        <p className={styles.panelNote}>Exportar seus dados ou excluir sua conta.</p>
                        <Link to="/configuracoes/privacidade" className={styles.panelLink}>
                            Privacidade e LGPD
                        </Link>
                    </div>
                </aside>
            </div>
        </main>
    )
}
