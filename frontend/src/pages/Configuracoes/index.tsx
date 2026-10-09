import { useRef, useState } from 'react'
import type { ChangeEvent, SubmitEvent } from 'react'
import { ArrowLeft, Check, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/atoms/Avatar'
import { Button } from '../../components/atoms/Button'
import { useAuth } from '../../features/auth/AuthContext'
import { useIdentitiesQuery } from '../../features/auth/useIdentitiesQuery'
import { useTheme } from '../../features/theme/ThemeContext'
import { changePassword, updateProfile, uploadAvatar } from '../../services/auth'
import styles from './index.module.css'
import { formatApiError } from '../../utils/formatApiError'

const PROVIDER_LABELS: Record<string, string> = { google: 'Google' }

function providerLabel(providerName: string): string {
    return PROVIDER_LABELS[providerName] ?? providerName
}

// Tarefa 6.10.8 — mesmos limites de `UploadAvatarUseCase`
// (`.docs/backend/auth.md`), checados aqui só pra dar feedback imediato
// sem esperar a ida e volta ao backend; a validação de verdade continua
// no use case (backend nunca confia só no client).
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

// Tela 9.2 (tarefa 6.10) — dados cadastrais (`PATCH /me`), troca de senha
// (`POST /me/password`) e provedores conectados (`GET /me/identities`, só
// leitura), cada um sua própria seção/estado de submit — "Salvar" →
// confirmação inline, sem navegação (inventário 9.2). `currentPassword`
// fica sempre opcional no form: só a conta OAuth-only dispensa (backend,
// não sinalizado ao client), então deixar o backend decidir e mostrar
// a mensagem do erro (`.docs/backend/auth.md`: "senha atual obrigatória"/
// "senha atual incorreta") é mais simples que replicar a regra aqui,
// mesmo princípio de `Login` (erro do backend exibido direto). E-mail
// (tarefa 6.10.4, apontado pelo autor) é read-only nesta seção desde
// esta sessão — produtos consolidados não deixam trocar e-mail livre
// sem um fluxo de verificação separado; `PATCH /me` continua aceitando
// `email?` a nível de contrato, só este client não envia mais o campo.
// Tema claro/escuro (tarefa 6.10.7, apontado pelo autor) — os tokens das
// duas paletas já existiam desde a 1.0 (`identidade-visual-tokens.md`),
// só faltava o controle de UI; `useTheme` (`features/theme/ThemeContext`)
// aplica `data-theme` no `<html>` e persiste em `localStorage`. Foto de
// perfil (tarefa 6.10.8) — `<input type="file" hidden>` disparado por um
// botão (`avatarInputRef`, mesmo padrão de esconder o input nativo feio
// atrás de um `Button` estilizado); tipo/tamanho checados aqui só pra
// feedback imediato, a validação de verdade é sempre do backend
// (`UploadAvatarUseCase`). `setUser(result.user)` já reflete a nova
// `avatarUrl` em qualquer lugar que consome `useAuth().user` (AvatarMenu
// etc.), sem invalidar nenhuma query.
export function Configuracoes() {
    const { token, user, setUser } = useAuth()
    const identitiesQuery = useIdentitiesQuery()
    const { theme, setTheme } = useTheme()
    const avatarInputRef = useRef<HTMLInputElement>(null)

    const [name, setName] = useState(user?.name ?? '')
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

    const [avatarError, setAvatarError] = useState<string | null>(null)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

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
            const result = await updateProfile(token as string, { name, username })
            setUser(result.user)
            setProfileSaved(true)
        } catch (err) {
            setProfileError(formatApiError(err, 'Não foi possível salvar agora. Tente novamente.'))
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
            setPasswordError(formatApiError(err, 'Não foi possível trocar a senha agora. Tente novamente.'))
        } finally {
            setIsSavingPassword(false)
        }
    }

    async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) {
            return
        }

        setAvatarError(null)

        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            setAvatarError('Tipo de arquivo não suportado. Use JPEG, PNG ou WEBP.')
            return
        }
        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            setAvatarError('Arquivo maior que o limite de 5MB.')
            return
        }

        setIsUploadingAvatar(true)
        try {
            const result = await uploadAvatar(token as string, file)
            setUser(result.user)
        } catch (err) {
            setAvatarError(formatApiError(err, 'Não foi possível enviar a foto agora. Tente novamente.'))
        } finally {
            setIsUploadingAvatar(false)
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
                        <h2 className={styles.sectionTitle}>Foto de perfil</h2>
                        <div className={styles.avatarRow}>
                            <div className={styles.avatarPreview}>
                                <Avatar username={user.username} avatarUrl={user.avatarUrl} size="lg" />
                            </div>
                            <div className={styles.avatarActions}>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    aria-label="Foto de perfil"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleAvatarChange}
                                    hidden
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={isUploadingAvatar}
                                    onClick={() => avatarInputRef.current?.click()}
                                >
                                    {isUploadingAvatar ? 'Enviando…' : 'Alterar foto'}
                                </Button>
                                <p className={styles.avatarHint}>JPEG, PNG ou WEBP, até 5MB.</p>
                            </div>
                        </div>
                        {avatarError && (
                            <p className={styles.error} role="alert">
                                {avatarError}
                            </p>
                        )}
                    </section>

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
                                <input type="email" value={user.email} readOnly disabled autoComplete="email" />
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
                        <h2 className={styles.sectionTitle}>Aparência</h2>
                        <div className={styles.themeToggle} role="radiogroup" aria-label="Tema">
                            <button
                                type="button"
                                role="radio"
                                aria-checked={theme === 'dark'}
                                className={`${styles.themeOption} ${theme === 'dark' ? styles.themeOptionActive : ''}`}
                                onClick={() => setTheme('dark')}
                            >
                                <Moon size={16} strokeWidth={2} aria-hidden="true" />
                                Escuro
                            </button>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={theme === 'light'}
                                className={`${styles.themeOption} ${theme === 'light' ? styles.themeOptionActive : ''}`}
                                onClick={() => setTheme('light')}
                            >
                                <Sun size={16} strokeWidth={2} aria-hidden="true" />
                                Claro
                            </button>
                        </div>
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
                            <p className={styles.empty}>Nenhum provedor conectado. Login só por e-mail e senha.</p>
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
