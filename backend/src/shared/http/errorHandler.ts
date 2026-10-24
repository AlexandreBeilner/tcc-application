import type { ErrorRequestHandler } from 'express'

// Códigos de erro do Postgres que significam "o cliente mandou um valor que
// o banco não consegue interpretar", não falha do servidor: 22P02
// (invalid_text_representation, ex: id que não é UUID) e 22003
// (numeric_value_out_of_range).
const CLIENT_INPUT_PG_CODES = new Set(['22P02', '22003'])

function findPgCode(err: unknown): string | undefined {
  let current: unknown = err
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

// Último middleware do app: sem ele, qualquer erro não tratado vira a página
// HTML padrão do Express (com stack fora de produção), que nenhum cliente da
// API espera. Achado da validação ponta a ponta do mercado simulado: `:id`
// que não é UUID em ~10 rotas devolvia 500 + HTML.
export const jsonErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  const pgCode = findPgCode(err)
  if (pgCode && CLIENT_INPUT_PG_CODES.has(pgCode)) {
    res.status(400).json({ error: 'identificador ou valor inválido' })
    return
  }

  // body-parser (JSON malformado, corpo grande demais) já anota o status 4xx.
  const status = (err as { status?: unknown }).status
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: 'requisição inválida' })
    return
  }

  // O requestId (middleware de log) liga este erro à linha da requisição.
  console.error('erro não tratado', err, { requestId: res.locals.requestId })
  res.status(500).json({ error: 'erro interno' })
}
