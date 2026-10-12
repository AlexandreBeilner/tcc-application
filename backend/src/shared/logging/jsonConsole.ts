import { format } from 'node:util'

// Logs estruturados sem dependência nova (LW.3.5): em produção cada `console.log/warn/error` do código
// existente vira UMA linha JSON no stdout (`{"ts","level","msg",...}`), que o Docker coleta e rotaciona
// (compose de produção: 10 MB x 3). Ligado por `LOG_FORMAT=json`; em desenvolvimento segue o texto normal.
//
// LGPD: nunca grava segredo. Dois filtros: (1) campos de objeto com nome sensível são trocados por
// "[removido]"; (2) padrões de segredo dentro de texto (cabeçalho Bearer, chaves `sk_`/`re_`/`whsec_`,
// JWT, URL de conexão com senha) também. Patrimônio absoluto não é logado pelo código; o filtro de campo
// cobre o caso de um objeto com `netWorth`/`balance` ser impresso por engano.
const SENSITIVE_KEY =
  /pass(word)?|senha|secret|token|authorization|cookie|api[-_]?key|credential|jwt|net[-_]?worth|patrimonio|balance|saldo|email/i

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [removido]'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt removido]'],
  [/\b(sk|rcb|re|whsec)_[A-Za-z0-9_]{8,}/g, '[chave removida]'],
  [/(postgres(ql)?|redis):\/\/[^\s:@/]*:[^\s@/]+@/gi, '$1://[removido]@'],
]

export function redactText(text: string): string {
  return SECRET_PATTERNS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  )
}

function redactValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactText(value)
  if (value instanceof Error) return serializeError(value)
  if (value === null || typeof value !== 'object') return value
  if (depth >= 4) return '[objeto profundo]'
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(item, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[removido]' : redactValue(inner, depth + 1)
  }
  return out
}

function serializeError(err: Error): Record<string, unknown> {
  return {
    name: err.name,
    message: redactText(err.message),
    stack: err.stack ? redactText(err.stack) : undefined,
    ...(err.cause !== undefined ? { cause: redactValue(err.cause, 2) } : {}),
  }
}

export type LogLevel = 'info' | 'warn' | 'error'

// Monta a linha JSON de um evento. Os argumentos seguem o contrato do `console.*`: a primeira string é a
// mensagem; `Error` e objetos seguintes viram campos (`err` e `data`).
export function buildLogLine(
  level: LogLevel,
  args: unknown[],
  now: () => Date = () => new Date(),
): string {
  const errors: Record<string, unknown>[] = []
  const objects: unknown[] = []
  const texts: unknown[] = []
  for (const arg of args) {
    if (arg instanceof Error) errors.push(serializeError(arg))
    else if (arg !== null && typeof arg === 'object') objects.push(redactValue(arg, 0))
    else texts.push(arg)
  }
  const line: Record<string, unknown> = {
    ts: now().toISOString(),
    level,
    msg: redactText(format(...(texts.length > 0 ? texts : [errors[0]?.message ?? '']))),
  }
  if (errors.length > 0) line.err = errors.length === 1 ? errors[0] : errors
  if (objects.length > 0) line.data = objects.length === 1 ? objects[0] : objects
  return JSON.stringify(line)
}

// Troca os métodos do `console` por versões que escrevem JSON. `write` é injetável nos testes.
export function installJsonConsole(
  target: Pick<Console, 'log' | 'info' | 'warn' | 'error'> = console,
  write: (level: LogLevel, line: string) => void = (level, line) =>
    (level === 'error' ? process.stderr : process.stdout).write(`${line}\n`),
): void {
  target.log = (...args: unknown[]) => write('info', buildLogLine('info', args))
  target.info = target.log
  target.warn = (...args: unknown[]) => write('warn', buildLogLine('warn', args))
  target.error = (...args: unknown[]) => write('error', buildLogLine('error', args))
}
