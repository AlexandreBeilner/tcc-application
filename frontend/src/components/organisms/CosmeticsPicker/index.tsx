import { Avatar } from '../../atoms/Avatar'
import { CosmeticTags } from '../../molecules/CosmeticTags'
import { useCosmeticChangeMutation, useMyCosmeticsQuery } from '../../../features/cosmetics/useMyCosmetics'
import type { CosmeticItem, CosmeticKind } from '../../../services/cosmetics'
import { formatApiError } from '../../../utils/formatApiError'
import type { CosmeticsPickerProps } from './types'
import styles from './index.module.css'

export type { CosmeticsPickerProps } from './types'

// Seletor de identidade em Configurações (MO.5.1): moldura de avatar e título que os outros veem
// ao lado do nome. Livre para todos; só os títulos ligados a convites esperam os amigos que valem.
export function CosmeticsPicker({ username, avatarUrl }: CosmeticsPickerProps) {
    const cosmeticsQuery = useMyCosmeticsQuery()
    const change = useCosmeticChangeMutation()

    const mine = cosmeticsQuery.data
    if (!mine) return null

    const frames = mine.catalog.filter((item) => item.kind === 'frame')
    const titles = mine.catalog.filter((item) => item.kind === 'title')

    function choose(kind: CosmeticKind, item: CosmeticItem | null) {
        change.mutate({ kind, itemKey: item?.key ?? null })
    }

    const errorMessage = change.isError ? formatApiError(change.error, 'Não foi possível salvar a escolha. Tente de novo.') : null

    return (
        <section className={styles.section} aria-labelledby="cosmetics-title">
            <h2 id="cosmetics-title" className={styles.title}>
                Identidade no app
            </h2>
            <p className={styles.note}>
                Moldura e título aparecem para os outros no ranking, no perfil e na lista de amigos. São só visual: não mudam sua posição
                nem mostram quanto você tem.
            </p>

            <div className={styles.preview}>
                <Avatar username={username} avatarUrl={avatarUrl} size="sm" frame={mine.selection.frame} />
                <span className={styles.previewName}>@{username}</span>
                <CosmeticTags cosmetics={mine.display} />
            </div>

            <div className={styles.group} role="group" aria-label="Moldura do avatar">
                <h3 className={styles.groupTitle}>Moldura</h3>
                <div className={styles.frames}>
                    <button
                        type="button"
                        className={styles.frameOption}
                        aria-pressed={mine.selection.frame === null}
                        disabled={change.isPending}
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
                            disabled={change.isPending}
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
                            disabled={change.isPending}
                            onClick={() => choose('title', null)}
                        >
                            <span className={styles.optionLabel}>Sem título</span>
                        </button>
                    </li>
                    {titles.map((item) => {
                        const locked = item.unlockReferrals !== null && item.unlockReferrals > mine.referralCount
                        return (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    className={styles.titleOption}
                                    aria-pressed={mine.selection.title === item.key}
                                    disabled={change.isPending || locked}
                                    onClick={() => choose('title', item)}
                                >
                                    <span className={styles.optionLabel}>{item.name}</span>
                                    <span className={styles.optionHint}>
                                        {locked
                                            ? `Libera com ${item.unlockReferrals} amigos que concluírem a primeira lição (você tem ${mine.referralCount}).`
                                            : item.description}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
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
