// Estado da pergunta de agrupar (LJ.2.4). Funções puras: a tela só liga toques a elas.

// Grupo escolhido para cada item (na ordem dos itens); `undefined` é item ainda na pilha.
export type Assignment = (number | undefined)[]

export function emptyAssignment(itemCount: number): Assignment {
    return Array.from({ length: itemCount }, () => undefined)
}

// Coloca o item no grupo (ou troca de grupo). Item fora da lista não faz nada.
export function assignItem(assignment: Assignment, item: number, group: number): Assignment {
    if (item < 0 || item >= assignment.length) return [...assignment]
    return assignment.map((current, index) => (index === item ? group : current))
}

// Devolve o item para a pilha.
export function unassignItem(assignment: Assignment, item: number): Assignment {
    return assignment.map((current, index) => (index === item ? undefined : current))
}

// Só envia com todos os itens agrupados: devolve a resposta pronta, ou `undefined` se falta algum.
export function completeAssignment(assignment: Assignment): number[] | undefined {
    return assignment.every((group) => group !== undefined) ? (assignment as number[]) : undefined
}

export function itemsInGroup(assignment: Assignment, group: number): number[] {
    return assignment.flatMap((current, index) => (current === group ? [index] : []))
}

export function pileItems(assignment: Assignment): number[] {
    return assignment.flatMap((current, index) => (current === undefined ? [index] : []))
}
