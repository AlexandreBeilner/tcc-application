import { Link } from 'react-router-dom'
import { Avatar } from '../../atoms/Avatar'
import { CosmeticTags } from '../../molecules/CosmeticTags'
import { useBillingStatusQuery } from '../../../features/billing/useBillingStatus'
import { useCosmeticChangeMutation, useMyCosmeticsQuery } from '../../../features/cosmetics/useMyCosmetics'
import { isProRequiredError } from '../../../services/client'
import type { CosmeticItem, CosmeticKind } from '../../../services/cosmetics'
import { formatApiError } from '../../../utils/formatApiError'
import type { CosmeticsPickerProps } from './types'
import styles from './index.module.css'

export type { CosmeticsPickerProps } from './types'

// Seletor de identidade em Configurações (MO.5.1): moldura de avatar e título que os outros veem
// ao lado do nome, mais o selo PRO, que aparece sozinho. Quem não é PRO vê a vitrine em modo
// leitura com um convite (nunca bloqueio nem contador); quem cancelou vê que a escolha anterior
// segue guardada e volta quando assinar de novo.
export function CosmeticsPicker({ username, avatarUrl }: CosmeticsPickerProps) {
    const cosmeticsQuery = useMyCosmeticsQuery()
    const billingQuery = useBillingStatusQuery()
    const change = useCosmeticChangeMutation()

    const mine = cosmeticsQuery.data
    const billing = billingQuery.data
    if (!mine) return null
    // Cobrança desligada e sem plano: o PRO ainda não existe neste ambiente, nada a mostrar.
    if (!mine.isPro && billing && !billing.billingEnabled) return null

    const frames = mine.catalog.filter((item) => item.kind === 'frame')
    const titles = mine.catalog.filter((item) => item.kind === 'title')
    const hasArchivedChoice = !mine.isPro && (mine.selection.frame !== null || mine.selection.title !== null)
    const previewFrame = mine.isPro ? mine.selection.frame : null

    function choose(kind: CosmeticKind, item: CosmeticItem | null) {
        change.mutate({ kind, itemKey: item?.key ?? null })
    }

    const errorMessage = change.isError
        ? isProRequiredError(change.error)
            ? 'Seu plano PRO não está ativo agora. Veja a situação em "Seu plano".'
            : formatApiError(change.error, 'Não foi possível salvar a escolha. Tente de novo.')
        : null

    return (
        <section className={styles.section} aria-labelledby="cosmetics-title">
            <h2 id="cosmetics-title" className={styles.title}>
                Identidade no app
            </h2>
            <p className={styles.note}>
                Moldura, título e selo aparecem para os outros no ranking, no perfil e na lista de amigos. São só visual: não mudam sua
                posição nem mostram quanto você tem.
            </p>

            <div className={styles.preview}>
                <Avatar username={username} avatarUrl={avatarUrl} size="sm" frame={previewFrame} />
                <span className={styles.previewName}>@{username}</span>
                <CosmeticTags cosmetics={mine.display} />
            </div>

            {!mine.isPro && (
                <p className={styles.invite}>
                    {hasArchivedChoice
                        ? 'Suas escolhas continuam guardadas e voltam quando você assinar de novo. '
                        : 'Molduras e títulos fazem parte do plano PRO. '}
                    <Link className={styles.link} to="/planos">
                        Conhecer o PRO
                    </Link>
                </p>
            )}

            <div className={styles.group} role="group" aria-label="Moldura do avatar">
                <h3 className={styles.groupTitle}>Moldura</h3>
                <div className={styles.frames}>
                    <button
                        type="button"
                        className={styles.frameOption}
                        aria-pressed={mine.selection.frame === null}
                        disabled={!mine.isPro || change.isPending}
                        onClick={() => choose('frame', null)}
                    >
                        <Avatar username={username} avatarUrl={avatarUrl} size="sm" />
                        <span className={styles.optionLabel}>Sem moldura</span>
                    </button>
                    {frames.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={styles.frameOption}
                            aria-pressed={mine.selection.frame === item.key}
                            disabled={!mine.isPro || change.isPending}
                            title={item.description}
                            onClick={() => choose('frame', item)}
                        >
                            <Avatar username={username} avatarUrl={avatarUrl} size="sm" frame={item.key} />
                            <span className={styles.optionLabel}>{item.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.group} role="group" aria-label="Título">
                <h3 className={styles.groupTitle}>Título</h3>
                <ul className={styles.titles}>
                    <li>
                        <button
                            type="button"
                            className={styles.titleOption}
                            aria-pressed={mine.selection.title === null}
                            disabled={!mine.isPro || change.isPending}
                            onClick={() => choose('title', null)}
                        >
                            <span className={styles.optionLabel}>Sem título</span>
                        </button>
                    </li>
                    {titles.map((item) => (
                        <li key={item.key}>
                            <button
                                type="button"
                                className={styles.titleOption}
                                aria-pressed={mine.selection.title === item.key}
                                disabled={!mine.isPro || change.isPending}
                                onClick={() => choose('title', item)}
                            >
                                <span className={styles.optionLabel}>{item.name}</span>
                                <span className={styles.optionHint}>{item.description}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {errorMessage && (
                <p className={styles.error} role="alert">
                    {errorMessage}
                </p>
            )}
        </section>
    )
}
