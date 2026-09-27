import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../services/client'
import { classifyOrderRejection, describeOrderRejection } from '.'
import type { AssetBook } from '../../../services/market'

describe('classifyOrderRejection', () => {
    it('não é ApiError, não classifica', () => {
        expect(classifyOrderRejection(new Error('falha de rede'))).toBeNull()
    })

    it('status diferente de 422, não classifica', () => {
        expect(classifyOrderRejection(new ApiError(403, 'saldo insuficiente para executar a ordem'))).toBeNull()
    })

    it('422 com code (market_closed), não classifica — tem tratamento próprio', () => {
        const err = new ApiError(422, 'mercado fechado', { code: 'market_closed', opens_on: '2026-10-05', days_until_open: 2 })
        expect(classifyOrderRejection(err)).toBeNull()
    })

    it('422 de saldo insuficiente', () => {
        expect(
            classifyOrderRejection(
                new ApiError(422, 'saldo insuficiente para executar a ordem', { error: 'saldo insuficiente para executar a ordem' }),
            ),
        ).toBe('insufficient_balance')
    })

    it('422 de posição insuficiente', () => {
        const err = new ApiError(422, 'quantidade em posição insuficiente para a venda', {
            error: 'quantidade em posição insuficiente para a venda',
        })
        expect(classifyOrderRejection(err)).toBe('insufficient_position')
    })

    it('422 de outra causa (ordem pendurada furada), não classifica', () => {
        const err = new ApiError(422, 'ordem pendurada não está mais disponível para execução', {
            error: 'ordem pendurada não está mais disponível para execução',
        })
        expect(classifyOrderRejection(err)).toBeNull()
    })
})

describe('describeOrderRejection', () => {
    const book: AssetBook = {
        is_sandbox: false,
        price: null,
        best_bid: 29,
        best_ask: 30,
        mid_price: 29.5,
        bids: null,
        asks: [
            { price: 30, quantity: 5 },
            { price: 31, quantity: 10 },
        ],
    }

    it('saldo insuficiente: informa a quantidade máxima calculada pelo book', () => {
        // 5 * 30 = 150 (sobra 30, não alcança nem 1 cota do próximo nível a 31) -> total 5.
        expect(describeOrderRejection('insufficient_balance', 'PETR4', book, 180, undefined)).toBe(
            'Saldo insuficiente para essa quantidade. Com o saldo e o book atuais, dá pra comprar no máximo 5 PETR4.',
        )
    })

    it('saldo insuficiente sem cair em nenhuma cota (saldo menor que o melhor ask)', () => {
        expect(describeOrderRejection('insufficient_balance', 'PETR4', book, 10, undefined)).toBe(
            'Saldo insuficiente para comprar PETR4 agora, mesmo em quantidade menor.',
        )
    })

    it('posição insuficiente: informa quantas cotas o usuário realmente tem', () => {
        expect(describeOrderRejection('insufficient_position', 'PETR4', book, undefined, 3)).toBe(
            'Você só tem 3 PETR4 disponíveis pra vender.',
        )
    })

    it('posição insuficiente sem nenhuma cota', () => {
        expect(describeOrderRejection('insufficient_position', 'PETR4', book, undefined, 0)).toBe(
            'Você não tem PETR4 suficiente em carteira pra essa venda.',
        )
    })
})
