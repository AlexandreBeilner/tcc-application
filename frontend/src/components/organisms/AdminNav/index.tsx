import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ADMIN_SECTIONS, isSectionActive } from '../../../features/admin/adminSections'
import type { AdminNavProps } from './types'
import styles from './index.module.css'

export type { AdminNavProps } from './types'

// Lista de seções do painel admin — barra lateral no desktop, faixa
// horizontal no tablet e conteúdo da gaveta no mobile (`AdminShell` decide
// onde monta; a composição por breakpoint é só CSS). Seção sem rota ainda
// (`to` indefinido) aparece desabilitada com "Em breve", nunca como link
// morto pra uma tela 404.
export function AdminNav({ onNavigate }: AdminNavProps) {
    const navRef = useRef<HTMLElement>(null)
    const { pathname } = useLocation()

    // No tablet a lista é uma faixa rolável: ao abrir direto numa seção do
    // fim (ex: Auditoria), traz o item ativo pra vista. `scrollIntoView` pode
    // não existir (jsdom), por isso a chamada opcional.
    useEffect(() => {
        const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
        active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }, [pathname])

    return (
        <nav ref={navRef} className={styles.nav} aria-label="Seções do painel administrativo">
            <ul className={styles.list}>
                {ADMIN_SECTIONS.map((section) => {
                    const { key, label, Icon, to } = section
                    const active = to !== undefined && isSectionActive(section, pathname)
                    return (
                        <li key={key}>
                            {to ? (
                                <Link
                                    to={to}
                                    onClick={onNavigate}
                                    aria-current={active ? 'page' : undefined}
                                    className={active ? `${styles.item} ${styles.active}` : styles.item}
                                >
                                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                                    <span>{label}</span>
                                </Link>
                            ) : (
                                <span className={`${styles.item} ${styles.disabled}`} aria-disabled="true">
                                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                                    <span>{label}</span>
                                    <span className={styles.soon}>Em breve</span>
                                </span>
                            )}
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
