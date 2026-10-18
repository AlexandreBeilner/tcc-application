import { describe, expect, it } from 'vitest'
import { indexAtY, moveItem, orderHintMessage } from '.'

describe('moveItem', () => {
    it.each([
        ['sobe um', [0, 1, 2, 3], 2, 1, [0, 2, 1, 3]],
        ['desce um', [0, 1, 2, 3], 1, 2, [0, 2, 1, 3]],
        ['do fim para o começo', [0, 1, 2, 3], 3, 0, [3, 0, 1, 2]],
        ['do começo para o fim', [0, 1, 2, 3], 0, 3, [1, 2, 3, 0]],
        ['mesma posição', [0, 1, 2], 1, 1, [0, 1, 2]],
        ['origem fora da lista', [0, 1, 2], 5, 0, [0, 1, 2]],
        ['destino negativo', [0, 1, 2], 1, -1, [0, 1, 2]],
    ])('%s', (_name, list, from, to, expected) => {
        expect(moveItem(list, from, to)).toEqual(expected)
    })

    it('não altera a lista original', () => {
        const list = [0, 1, 2]
        moveItem(list, 0, 2)
        expect(list).toEqual([0, 1, 2])
    })
})

describe('indexAtY', () => {
    const rows = [
        { top: 0, bottom: 40 },
        { top: 48, bottom: 88 },
        { top: 96, bottom: 136 },
    ]

    it.each([
        ['acima de tudo', -20, 0],
        ['dentro da primeira', 20, 0],
        ['dentro da segunda', 70, 1],
        ['no vão, mais perto da segunda', 46, 1],
        ['no vão, mais perto da primeira', 41, 0],
        ['abaixo de tudo', 400, 2],
    ])('%s', (_name, y, expected) => {
        expect(indexAtY(rows, y)).toBe(expected)
    })

    it('lista vazia cai na posição 0', () => {
        expect(indexAtY([], 10)).toBe(0)
    })
})

describe('orderHintMessage', () => {
    it('diz a contagem sem apontar quais itens', () => {
        expect(orderHintMessage(3, 5)).toBe('3 de 5 no lugar certo.')
    })
})
