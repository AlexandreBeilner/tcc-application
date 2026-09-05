// Padrão "busca a página 1, lê `totalPages`, busca o resto em paralelo,
// junta num array só" repetido em `useAllFriendsQuery` e
// `useAllFriendRequestsQuery` (6.9.1/8.2) — quem já pediu a página 1 passa
// `firstPageItems`/`totalPages` prontos pra não pagar essa busca de novo.
export async function fetchAllPages<T>(totalPages: number, firstPageItems: T[], fetchPage: (page: number) => Promise<T[]>): Promise<T[]> {
    if (totalPages <= 1) {
        return firstPageItems
    }
    const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2)))
    return [...firstPageItems, ...rest.flatMap((items) => items)]
}
