import type { RequestParamHandler } from 'express'

// Mesmo formato 8-4-4-4-12 que o Postgres aceita em colunas `uuid` (sem
// exigir versão/variante RFC, que `z.uuid()` exige e alguns ids
// determinísticos do motor não têm).
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Uso: `router.param('id', requireUuidParam)`. Sem isso, um `:id` que não é
// UUID chega no banco/motor, estoura na cast da query e vira 500 (achado da
// validação ponta a ponta do mercado simulado, `tmp/relatorio-e2e-mercado-simulado.md`).
export const requireUuidParam: RequestParamHandler = (_req, res, next, value) => {
  if (typeof value !== 'string' || !UUID_FORMAT.test(value)) {
    res.status(400).json({ error: 'id deve ser um UUID válido' })
    return
  }
  next()
}
