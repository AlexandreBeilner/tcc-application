import { describe, expect, it } from 'vitest'
import { assignItem, completeAssignment, emptyAssignment, itemsInGroup, pileItems, unassignItem } from '.'

describe('categorizeBoard', () => {
    it('começa com todos os itens na pilha e sem resposta completa', () => {
        const board = emptyAssignment(3)

        expect(pileItems(board)).toEqual([0, 1, 2])
        expect(completeAssignment(board)).toBeUndefined()
    })

    it('coloca, troca de grupo e devolve à pilha sem mexer nos outros itens', () => {
        let board = assignItem(emptyAssignment(4), 1, 0)
        board = assignItem(board, 3, 1)
        expect(itemsInGroup(board, 0)).toEqual([1])
        expect(itemsInGroup(board, 1)).toEqual([3])
        expect(pileItems(board)).toEqual([0, 2])

        board = assignItem(board, 1, 1)
        expect(itemsInGroup(board, 0)).toEqual([])
        expect(itemsInGroup(board, 1)).toEqual([1, 3])

        board = unassignItem(board, 3)
        expect(pileItems(board)).toEqual([0, 2, 3])
    })

    it('só entrega a resposta com todos os itens agrupados', () => {
        let board = emptyAssignment(3)
        board = assignItem(board, 0, 1)
        board = assignItem(board, 1, 0)
        expect(completeAssignment(board)).toBeUndefined()

        board = assignItem(board, 2, 1)
        expect(completeAssignment(board)).toEqual([1, 0, 1])
    })

    it('ignora item fora da lista e não altera a original', () => {
        const board = emptyAssignment(2)

        expect(assignItem(board, 5, 0)).toEqual([undefined, undefined])
        assignItem(board, 0, 0)
        expect(board).toEqual([undefined, undefined])
    })
})
