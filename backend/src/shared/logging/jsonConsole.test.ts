import { describe, expect, it, vi } from 'vitest'
import { buildLogLine, installJsonConsole, redactText } from './jsonConsole'

const FIXED = () => new Date('2026-10-12T12:00:00.000Z')
const parse = (line: string) => JSON.parse(line) as Record<string, Record<string, unknown> & string>

describe('buildLogLine', () => {
  it('emite uma linha JSON com data, nível e mensagem', () => {
    expect(parse(buildLogLine('info', ['ranking: snapshot calculado'], FIXED))).toEqual({
      ts: '2026-10-12T12:00:00.000Z',
      level: 'info',
      msg: 'ranking: snapshot calculado',
    })
  })

  it('transforma Error em campo err, com a pilha', () => {
    const line = parse(
      buildLogLine('error', ['folha: erro no check', new Error('banco caiu')], FIXED),
    )
    expect(line.msg).toBe('folha: erro no check')
    expect(line.err.name).toBe('Error')
    expect(line.err.message).toBe('banco caiu')
    expect(line.err.stack).toContain('banco caiu')
  })

  it('aceita só um Error (console.error(err)) usando a mensagem dele', () => {
    const line = parse(buildLogLine('error', [new Error('falhou')], FIXED))
    expect(line.msg).toBe('falhou')
    expect(line.err.message).toBe('falhou')
  })

  it('remove campos sensíveis de objetos, em qualquer profundidade', () => {
    const line = parse(
      buildLogLine(
        'info',
        [
          'req',
          {
            route: '/me',
            password: 'SenhaForte#2026',
            headers: { authorization: 'Bearer abc', accept: 'json' },
            user: { email: 'a@b.com', netWorth: 123456.78, name: 'Ana' },
          },
        ],
        FIXED,
      ),
    )
    expect(line.data.route).toBe('/me')
    expect(line.data.password).toBe('[removido]')
    expect(line.data.headers.authorization).toBe('[removido]')
    expect(line.data.headers.accept).toBe('json')
    expect(line.data.user.email).toBe('[removido]')
    expect(line.data.user.netWorth).toBe('[removido]')
    expect(JSON.stringify(line)).not.toContain('SenhaForte')
    expect(JSON.stringify(line)).not.toContain('123456')
  })
})

describe('redactText', () => {
  it.each([
    ['Authorization: Bearer abc.def-123', 'Bearer [removido]'],
    ['token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdefghijk', '[jwt removido]'],
    ['chave sk_live_ABCDEFGH12345678', '[chave removida]'],
    ['chave re_AbCdEfGh1234567890', '[chave removida]'],
    [
      'postgres://selucra_owner:SenhaSecreta123@postgres:5432/db',
      'postgres://[removido]@postgres:5432/db',
    ],
    ['redis://:SenhaSecreta123@redis:6379/0', 'redis://[removido]@redis:6379/0'],
  ])('troca o segredo em "%s"', (input, expected) => {
    const out = redactText(input)
    expect(out).toContain(expected)
    expect(out).not.toMatch(
      /SenhaSecreta123|abc\.def-123|ABCDEFGH12345678|AbCdEfGh1234567890|abcdefghijk/,
    )
  })

  it('não mexe em texto comum', () => {
    expect(redactText('ranking: 12 usuário(s), 7 grupo(s)')).toBe(
      'ranking: 12 usuário(s), 7 grupo(s)',
    )
  })
})

describe('installJsonConsole', () => {
  it('redireciona log, warn e error para o escritor, com o nível certo', () => {
    const fakeConsole = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const write = vi.fn()
    installJsonConsole(fakeConsole, write)
    fakeConsole.log('a')
    fakeConsole.warn('b')
    fakeConsole.error('c', new Error('x'))
    expect(write.mock.calls.map(([level]) => level)).toEqual(['info', 'warn', 'error'])
    expect(parse(write.mock.calls[2][1]).err.message).toBe('x')
  })
})
