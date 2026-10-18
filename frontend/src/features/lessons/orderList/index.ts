// Reordenação da pergunta de ordenar (LJ.2.3). Funções puras: a tela só liga botões e ponteiro a elas.

// Move o item da posição `from` para `to` (as posições entre os dois deslocam uma casa). Fora da lista não faz nada.
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]
    const next = [...list]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
}

// Posição da lista sob a coordenada vertical `y`, dadas as caixas das linhas de cima para baixo. Acima de tudo
// vale a primeira, abaixo de tudo a última; entre duas linhas vale a mais próxima.
export function indexAtY(rows: readonly { top: number; bottom: number }[], y: number): number {
    if (rows.length === 0) return 0
    let best = 0
    let bestDistance = Infinity
    rows.forEach((row, index) => {
        const distance = y < row.top ? row.top - y : y > row.bottom ? y - row.bottom : 0
        if (distance < bestDistance) {
            best = index
            bestDistance = distance
        }
    })
    return best
}

// Frase da contagem devolvida ao errar (LJ-D2): "3 de 5 no lugar certo", sem dizer quais.
export function orderHintMessage(correctCount: number, total: number): string {
    return `${correctCount} de ${total} no lugar certo.`
}
