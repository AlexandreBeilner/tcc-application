import { EmailCategoryOption } from '../../molecules/EmailCategoryOption'
import { EMAIL_CATEGORIES, EMAIL_CATEGORY_COPY } from '../../../features/emailPreferences/emailCategoryCopy'
import { useEmailPreferencesQuery, useUpdateEmailPreferences } from '../../../features/emailPreferences/useEmailPreferences'
import type { EmailSuppression } from '../../../services/emailPreferences'
import { formatApiError } from '../../../utils/formatApiError'
import styles from './index.module.css'

function suppressionNotice(suppression: EmailSuppression): string {
    return suppression === 'bounce'
        ? 'Não conseguimos entregar e-mails para o endereço da sua conta, então nenhum e-mail está sendo enviado, nem os de segurança. Confira se o endereço está correto e ativo.'
        : 'Você marcou um e-mail nosso como spam, então não enviamos mais e-mails opcionais para este endereço. Os avisos de segurança da conta continuam saindo.'
}

// Seção "E-mails" de Configurações (EM.6.1). Segurança e avisos da conta não aparecem como opção
// porque nunca são desligáveis; as duas categorias opcionais nascem desligadas e cada clique grava
// na hora (sem botão "Salvar"), como um interruptor.
export function EmailPreferencesSection() {
    const query = useEmailPreferencesQuery()
    const update = useUpdateEmailPreferences()

    return (
        <section className={styles.section} aria-labelledby="email-preferences-title">
            <h2 id="email-preferences-title" className={styles.title}>
                E-mails
            </h2>
            <p className={styles.note}>
                Avisos de segurança e da conta, como redefinir a senha ou confirmar o e-mail, sempre são enviados. Os e-mails abaixo são
                opcionais e começam desligados.
            </p>

            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar suas preferências de e-mail agora.
                </p>
            )}
            {!query.data && !query.isError && <p className={styles.loading}>Carregando…</p>}

            {query.data?.suppression && (
                <p className={styles.notice} role="status">
                    {suppressionNotice(query.data.suppression)}
                </p>
            )}

            {query.data && (
                <div className={styles.options}>
                    {EMAIL_CATEGORIES.map((category) => (
                        <EmailCategoryOption
                            key={category}
                            title={EMAIL_CATEGORY_COPY[category].title}
                            description={EMAIL_CATEGORY_COPY[category].description}
                            checked={query.data.preferences[category]}
                            disabled={update.isPending}
                            onChange={(checked) => update.mutate({ [category]: checked })}
                        />
                    ))}
                </div>
            )}

            {update.isError && (
                <p className={styles.error} role="alert">
                    {formatApiError(update.error, 'Não foi possível salvar agora. Tente novamente.')}
                </p>
            )}
        </section>
    )
}
