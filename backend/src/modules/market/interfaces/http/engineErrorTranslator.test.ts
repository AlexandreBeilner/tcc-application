import { describe, expect, it } from 'vitest'
import { EngineRequestError } from '../../domain/errors'
import { translateEngineError } from './engineErrorTranslator'

const translate = (status: number, message: string, details = {}) =>
  translateEngineError(new EngineRequestError(status, message, details))

describe('translateEngineError', () => {
  it('traduz saldo insuficiente para código estável e mensagem em português', () => {
    const { status, body } = translate(422, 'saldo insuficiente para executar a ordem')
    expect(status).toBe(422)
    expect(body).toEqual({
      code: 'insufficient_balance',
      error: 'Saldo insuficiente para essa operação.',
    })
  })

  it.each([
    ['quantidade em posição insuficiente para a venda', 'insufficient_position'],
    ['ordem pendurada não está mais disponível para execução', 'order_no_longer_available'],
    ['valor abaixo da aplicação mínima do produto', 'below_minimum_investment'],
    [
      'temporizador ainda não rodou nenhum tick — sem taxa de mercado simulada pra este produto',
      'market_not_ready',
    ],
    ['serviço de book indisponível', 'service_unavailable'],
    [
      'execução de ordem só é suportada pra ativo de renda variável (ação, ETF, FII)',
      'asset_class_mismatch',
    ],
    ['user_id e asset_id são obrigatórios e devem ser UUIDs válidos', 'invalid_request'],
  ])('mapeia "%s" para %s', (message, code) => {
    expect(translate(422, message).body.code).toBe(code)
  })

  it('nunca repassa texto interno: mensagem desconhecida cai no genérico do status', () => {
    const { body } = translate(422, 'soma das posições excede outstanding_shares do ativo')
    expect(body.code).toBe('operation_rejected')
    expect(body.error).not.toMatch(/outstanding_shares/)
    expect(translate(500, 'pq: deadlock detected').body.code).toBe('market_unavailable')
    expect(translate(418, 'xicara').body.code).toBe('unknown_error')
  })

  it('repassa 1:1 erro que já vem com code próprio (market_closed) e os campos extras', () => {
    const { body } = translate(422, 'Mercado fechado. Abre na segunda-feira, 05/10.', {
      code: 'market_closed',
      opens_on: '2026-10-05',
      days_until_open: 1,
    })
    expect(body).toEqual({
      code: 'market_closed',
      error: 'Mercado fechado. Abre na segunda-feira, 05/10.',
      opens_on: '2026-10-05',
      days_until_open: 1,
    })
  })
})
