import type { EngineRequestError } from '../../domain/errors'

// Tradutor único de erro do engine para o cliente (tarefa RC.1.5). O engine
// devolve `{ error: string }` com texto interno (nomes de coluna, "temporizador",
// "tick"); aqui cada erro vira `{ code, error }` com `code` estável e `error` em
// português para o usuário. Mensagem fora da tabela nunca passa adiante: cai
// numa mensagem genérica pelo status HTTP.

export interface TranslatedEngineError {
  status: number
  body: Record<string, unknown> & { code: string; error: string }
}

interface KnownError {
  pattern: RegExp
  code: string
  message: string
}

const KNOWN_ERRORS: KnownError[] = [
  {
    pattern: /saldo insuficiente/i,
    code: 'insufficient_balance',
    message: 'Saldo insuficiente para essa operação.',
  },
  {
    pattern: /posição insuficiente|quantidade em posição/i,
    code: 'insufficient_position',
    message: 'Você não tem quantidade suficiente em carteira para essa venda.',
  },
  {
    pattern: /ordem pendurada não está mais disponível/i,
    code: 'order_no_longer_available',
    message: 'A oferta que casaria com a sua ordem acabou de sair do mercado. Tente de novo.',
  },
  { pattern: /ordem não encontrada/i, code: 'order_not_found', message: 'Ordem não encontrada.' },
  {
    pattern: /ordem não pode ser cancelada/i,
    code: 'order_not_cancellable',
    message: 'Essa ordem não pode mais ser cancelada.',
  },
  {
    pattern: /abaixo da aplicação mínima/i,
    code: 'below_minimum_investment',
    message: 'O valor está abaixo da aplicação mínima deste produto.',
  },
  {
    pattern: /posição não encontrada para resgate|sem posição/i,
    code: 'position_not_found',
    message: 'Você não tem posição neste título para resgatar.',
  },
  { pattern: /ativo não encontrado/i, code: 'asset_not_found', message: 'Ativo não encontrado.' },
  {
    pattern: /conta não encontrada/i,
    code: 'account_not_found',
    message: 'Conta de investimentos não encontrada.',
  },
  {
    pattern: /temporizador ainda não rodou/i,
    code: 'market_not_ready',
    message: 'O mercado ainda não tem cotações para este produto. Tente novamente em instantes.',
  },
  {
    pattern: /só é suportad[oa]/i,
    code: 'asset_class_mismatch',
    message: 'Essa operação não está disponível para este tipo de ativo.',
  },
  {
    pattern: /indisponível/i,
    code: 'service_unavailable',
    message: 'O mercado está indisponível no momento. Tente novamente em instantes.',
  },
  {
    pattern: /deve ser maior que zero|obrigatóri[oa]s?|deve ser um|inválid[oa]/i,
    code: 'invalid_request',
    message: 'Pedido inválido. Confira os dados e tente de novo.',
  },
]

const FALLBACK_BY_STATUS: Array<{
  matches: (status: number) => boolean
  code: string
  message: string
}> = [
  {
    matches: (s) => s === 400,
    code: 'invalid_request',
    message: 'Pedido inválido. Confira os dados e tente de novo.',
  },
  { matches: (s) => s === 404, code: 'not_found', message: 'Não encontramos o que você procurou.' },
  {
    matches: (s) => s === 422,
    code: 'operation_rejected',
    message: 'Não foi possível concluir a operação.',
  },
  {
    matches: (s) => s >= 500,
    code: 'market_unavailable',
    message: 'O mercado está indisponível no momento. Tente novamente em instantes.',
  },
]

const GENERIC = { code: 'unknown_error', message: 'Não foi possível concluir a operação agora.' }

export function translateEngineError(err: EngineRequestError): TranslatedEngineError {
  // Erro que o engine já devolve com `code` próprio e mensagem pensada para o
  // usuário (ex: market_closed, tarefa S.11): repassa como veio.
  if (typeof err.details.code === 'string') {
    return {
      status: err.status,
      body: { ...err.details, code: err.details.code, error: err.message },
    }
  }

  const known = KNOWN_ERRORS.find((entry) => entry.pattern.test(err.message))
  const chosen = known ?? FALLBACK_BY_STATUS.find((entry) => entry.matches(err.status)) ?? GENERIC
  return { status: err.status, body: { ...err.details, code: chosen.code, error: chosen.message } }
}
