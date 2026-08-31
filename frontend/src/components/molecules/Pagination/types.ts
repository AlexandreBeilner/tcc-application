export interface PaginationProps {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
    // Tarefa 6.9.1 reaproveita este componente pra Amigos/Solicitações —
    // rótulo próprio por tela, mesma convenção de `aria-label` distinto por
    // instância. Default preserva o rótulo original da Classificação
    // (6.8.2) pros usos existentes que não passam a prop.
    ariaLabel?: string
}
