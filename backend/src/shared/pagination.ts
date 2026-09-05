export interface PaginationResult<T> {
  items: T[]
  page: number
  totalEntries: number
  totalPages: number
}

// Convenção de paginação compartilhada por Amigos/Solicitações (6.9.1) e
// Classificação (6.8.2) — página fora do intervalo válido nunca vira erro
// (ex: página aberta antes de a lista encolher o bastante pra ela deixar de
// existir), clampa pro extremo mais próximo em vez de devolver lista vazia
// enganosa. `items` já deve estar ordenado por quem chama.
export function paginate<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const totalEntries = items.length
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))
  const clampedPage = Math.min(Math.max(1, page), totalPages)
  const pageStart = (clampedPage - 1) * pageSize

  return {
    items: items.slice(pageStart, pageStart + pageSize),
    page: clampedPage,
    totalEntries,
    totalPages,
  }
}
