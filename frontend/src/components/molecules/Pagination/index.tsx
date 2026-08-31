import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { PaginationProps } from './types'
import styles from './index.module.css'

export type { PaginationProps } from './types'

// Convenção padrão de listagem paginada (backlog 6.8.2) — primeira/anterior/
// próxima/última, sempre no mesmo lugar. Nada a mostrar com 1 página só
// (escopo Amigos quase sempre, Global com poucos cadastros) — nenhum
// controle desabilitado ocupando espaço à toa.
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null

    const isFirst = page <= 1
    const isLast = page >= totalPages

    return (
        <nav className={styles.pagination} aria-label="Paginação da classificação">
            <button
                type="button"
                className={styles.control}
                disabled={isFirst}
                onClick={() => onPageChange(1)}
                aria-label="Primeira página"
            >
                <ChevronsLeft size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
                type="button"
                className={styles.control}
                disabled={isFirst}
                onClick={() => onPageChange(page - 1)}
                aria-label="Página anterior"
            >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            <span className={styles.status}>
                Página {page} de {totalPages}
            </span>

            <button
                type="button"
                className={styles.control}
                disabled={isLast}
                onClick={() => onPageChange(page + 1)}
                aria-label="Próxima página"
            >
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
                type="button"
                className={styles.control}
                disabled={isLast}
                onClick={() => onPageChange(totalPages)}
                aria-label="Última página"
            >
                <ChevronsRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
        </nav>
    )
}
